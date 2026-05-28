/**
 * V3 Upload API Route
 *
 * Receives a CSV file from the admin dashboard, generates a school JSON file
 * with an O(1) lookup index, and uploads it directly to Cloudflare R2.
 *
 * The centre number is extracted automatically from the exam numbers in the CSV.
 * Admin only needs to provide: CSV file + exam year + school name.
 *
 * POST /v3/api/upload
 * FormData fields:
 *   file      - CSV file
 *   examYear  - e.g. "2024"
 *   schoolName - e.g. "Zomba Secondary"
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateV3SchoolFile } from '../../lib/index-generator';
import { uploadSchoolFileToR2, appendToUploadLog, getCDNBaseUrl } from '../../lib/r2-client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const examYear = (formData.get('examYear') as string)?.trim();
    const schoolName = (formData.get('schoolName') as string)?.trim();

    // Validate inputs
    if (!file || !examYear || !schoolName) {
      return NextResponse.json(
        { error: 'Missing required fields: file, examYear, schoolName' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are accepted' },
        { status: 400 }
      );
    }

    // Read CSV content
    const csvContent = await file.text();
    if (!csvContent.trim()) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Generate school file with index
    let generatorResult;
    try {
      generatorResult = generateV3SchoolFile(csvContent, schoolName, examYear);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to parse CSV' },
        { status: 422 }
      );
    }

    const { file: schoolFile, centre, errors } = generatorResult;

    if (schoolFile.totalStudents === 0) {
      return NextResponse.json(
        { error: 'No valid student records found in CSV', parseErrors: errors },
        { status: 422 }
      );
    }

    // Upload to Cloudflare R2
    let publicUrl: string;
    try {
      publicUrl = await uploadSchoolFileToR2(schoolFile, examYear);
    } catch (err) {
      console.error('R2 upload error:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to upload to CDN' },
        { status: 502 }
      );
    }

    // Append to upload log for metrics dashboard
    await appendToUploadLog({
      centre,
      school: schoolName,
      examYear,
      totalStudents: schoolFile.totalStudents,
      uploadedAt: schoolFile.publishedAt,
      publicUrl,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${schoolFile.totalStudents} students for ${schoolName} (Centre ${centre})`,
      centre,
      school: schoolName,
      examYear,
      totalStudents: schoolFile.totalStudents,
      publicUrl,
      r2Key: `jce/${examYear}/${centre}.json`,
      cdnBase: getCDNBaseUrl(),
      mockMode: !process.env.R2_ACCOUNT_ID,
      parseErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('V3 Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
