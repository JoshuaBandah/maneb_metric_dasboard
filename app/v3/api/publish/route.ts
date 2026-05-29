/**
 * V3 Publish Route
 *
 * Admin selects exam type + year → this route:
 *   1. Pulls ALL results for that exam from the VPS database
 *   2. Groups students by school/centre
 *   3. Generates one indexed JSON file per school
 *   4. Pushes every school file to CDN (R2 or mock)
 *   5. Updates the upload log
 *
 * No CSV upload needed. Data comes from the database.
 * After publish, students fetch directly from CDN — zero DB hit.
 *
 * POST /v3/api/publish
 * Body: { examType: "JCE" | "MSCE" | "PLSCE", examYear: "2024" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateV3SchoolFile } from '../../lib/index-generator';
import { uploadSchoolFileToR2, appendToUploadLog, getCDNBaseUrl } from '../../lib/r2-client';

const BACKEND_URL = process.env.V3_DB_URL || 'http://localhost:3002';

export type ExamType = 'JCE' | 'MSCE' | 'PLSCE';

/**
 * Fetch all results for a given exam type and year from the VPS database.
 * The backend returns a flat array of rows — one row per student per subject.
 *
 * Expected response from backend:
 * [
 *   { examNumber: "J0282/001", dob: "2004-01-01", name: "John Banda",
 *     subject: "Mathematics", grade: "A", school: "Zomba Secondary" },
 *   ...
 * ]
 */
async function fetchResultsFromDB(
  examType: ExamType,
  examYear: string
): Promise<any[]> {
  const url = `${BACKEND_URL}/api/results?examType=${examType}&year=${examYear}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000), // 30s — large dataset
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(
      `Database fetch failed: ${res.status} ${res.statusText} — ${url}`
    );
  }

  return res.json();
}

/**
 * Convert flat DB rows into per-school CSV-like content strings
 * that the existing index-generator can process.
 *
 * Groups rows by school name, then formats as:
 *   examNumber,dob,name,subject,grade
 */
function groupRowsBySchool(
  rows: any[]
): Map<string, { schoolName: string; csvContent: string }> {
  // school name → rows[]
  const schoolMap = new Map<string, any[]>();

  for (const row of rows) {
    const school = row.school || row.schoolName || 'Unknown School';
    if (!schoolMap.has(school)) schoolMap.set(school, []);
    schoolMap.get(school)!.push(row);
  }

  // Convert each school's rows to CSV content string
  const result = new Map<string, { schoolName: string; csvContent: string }>();

  for (const [schoolName, schoolRows] of schoolMap.entries()) {
    const lines = ['examNumber,dob,name,subject,grade'];
    for (const row of schoolRows) {
      lines.push(
        `${row.examNumber},${row.dob},${row.name},${row.subject},${row.grade}`
      );
    }
    result.set(schoolName, { schoolName, csvContent: lines.join('\n') });
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const examType: ExamType = body.examType;
    const examYear: string   = body.examYear?.trim();

    // Validate
    if (!examType || !['JCE', 'MSCE', 'PLSCE'].includes(examType)) {
      return NextResponse.json(
        { error: 'Invalid examType. Must be JCE, MSCE, or PLSCE' },
        { status: 400 }
      );
    }

    if (!examYear || !/^\d{4}$/.test(examYear)) {
      return NextResponse.json(
        { error: 'Invalid examYear. Must be a 4-digit year e.g. 2024' },
        { status: 400 }
      );
    }

    // 1. Pull results from database
    let rows: any[];
    try {
      rows = await fetchResultsFromDB(examType, examYear);
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to fetch results from database: ${err instanceof Error ? err.message : 'Unknown error'}`,
          hint: 'Make sure the VPS backend is running and BACKEND_URL is set correctly',
        },
        { status: 502 }
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: `No results found for ${examType} ${examYear} in the database` },
        { status: 404 }
      );
    }

    // 2. Group by school
    const schoolGroups = groupRowsBySchool(rows);

    // 3. Generate + upload one file per school
    const results: {
      centre: string;
      school: string;
      totalStudents: number;
      publicUrl: string;
      errors?: string[];
    }[] = [];

    const failures: { school: string; error: string }[] = [];

    for (const [schoolName, { csvContent }] of schoolGroups.entries()) {
      try {
        // Generate indexed school file
        const { file: schoolFile, centre, errors } = generateV3SchoolFile(
          csvContent,
          schoolName,
          examYear,
          examType
        );

        if (schoolFile.totalStudents === 0) {
          failures.push({ school: schoolName, error: 'No valid student records' });
          continue;
        }

        // Upload school index JSON to R2
        const publicUrl = await uploadSchoolFileToR2(schoolFile, examYear, examType);

        // Log it
        await appendToUploadLog({
          centre,
          school: schoolName,
          examYear,
          examType,
          totalStudents: schoolFile.totalStudents,
          uploadedAt: schoolFile.publishedAt,
          publicUrl,
        });

        results.push({
          centre,
          school: schoolName,
          totalStudents: schoolFile.totalStudents,
          publicUrl,
          errors: errors.length > 0 ? errors : undefined,
        });

        console.log(
          `[Publish] ${examType} ${examYear} — ${schoolName} (${centre}): ${schoolFile.totalStudents} students → ${publicUrl}`
        );
      } catch (err) {
        failures.push({
          school: schoolName,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const totalStudents = results.reduce((s, r) => s + r.totalStudents, 0);

    return NextResponse.json({
      success:       true,
      examType,
      examYear,
      totalSchools:  results.length,
      totalStudents,
      cdnBase:       getCDNBaseUrl(),
      mockMode:      !process.env.R2_ACCOUNT_ID,
      schools:       results,
      failures:      failures.length > 0 ? failures : undefined,
      message:       `Published ${examType} ${examYear}: ${results.length} schools, ${totalStudents} students to CDN`,
    });
  } catch (error) {
    console.error('V3 Publish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
