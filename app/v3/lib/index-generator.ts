/**
 * V3 Index Generator
 * Parses MANEB JCE CSV and generates a school file with O(1) lookup index.
 *
 * MANEB exam number format: J{CENTRE}/{CANDIDATE}
 * Example: J0282/098  →  centre = "0282", candidate = "098"
 *
 * The centre number is extracted from the first valid exam number in the CSV.
 * This means the admin does NOT need to type the school/centre manually —
 * it is derived directly from the data.
 */

import { V3SchoolFile, V3Student, V3Subject } from './v3-types';

/**
 * Extract centre number from a MANEB JCE exam number.
 * J0282/098  →  "0282"
 */
export function extractCentreNumber(examNumber: string): string | null {
  // Pattern: J followed by digits, then slash, then candidate digits
  const match = examNumber.trim().match(/^J(\d+)\//i);
  if (!match) return null;
  return match[1];
}

/**
 * Build the lookup key used in the index map.
 * "J0282/098" + "1990-05-15"  →  "J0282/098_1990-05-15"
 */
export function buildIndexKey(examNumber: string, dob: string): string {
  return `${examNumber.trim().toUpperCase()}_${dob.trim()}`;
}

/**
 * Parse MANEB JCE CSV and generate a V3SchoolFile ready for R2 upload.
 *
 * The CSV is expected to be a FLAT/UNNORMALIZED table — one row per subject result.
 * The same student appears multiple times (once per subject).
 * This function groups all rows by exam number, collecting subjects into an array.
 *
 * Expected CSV columns (flat format):
 *   examNumber, dob, name, subject, grade
 *
 * Example (flat — multiple rows per student):
 *   J0282/098,1990-05-15,John Banda,Mathematics,A
 *   J0282/098,1990-05-15,John Banda,English,B
 *   J0282/098,1990-05-15,John Banda,Biology,C
 *   J0282/099,1991-03-20,Mary Phiri,Mathematics,B
 *   J0282/099,1991-03-20,Mary Phiri,English,A
 *
 * Output: one student object per exam number with subjects[] grouped together.
 */
export function generateV3SchoolFile(
  csvContent: string,
  schoolName: string,
  examYear: string
): { file: V3SchoolFile; centre: string; errors: string[] } {
  const lines = csvContent.trim().split('\n');
  const errors: string[] = [];
  let centre = '';

  // Skip header row if present
  const startLine =
    lines[0].toLowerCase().includes('examnumber') ||
    lines[0].toLowerCase().includes('regnumber') ||
    lines[0].toLowerCase().includes('exam_number') ||
    lines[0].toLowerCase().includes('reg_number')
      ? 1
      : 0;

  /**
   * Intermediate map: examNumber → student being built
   * We use a Map to preserve insertion order (student order in final array)
   */
  const studentMap = new Map<string, V3Student>();

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 5) {
      errors.push(`Line ${i + 1}: expected at least 5 columns (examNumber, dob, name, subject, grade), skipped`);
      continue;
    }

    const examNumber = parts[0].trim().toUpperCase();
    const dob        = parts[1].trim();
    const name       = parts[2].trim();
    const subject    = parts[3].trim();
    const grade      = parts[4].trim();

    if (!examNumber || !dob || !name || !subject || !grade) {
      errors.push(`Line ${i + 1}: one or more required fields are empty, skipped`);
      continue;
    }

    // Validate exam number format
    const extractedCentre = extractCentreNumber(examNumber);
    if (!extractedCentre) {
      errors.push(`Line ${i + 1}: invalid exam number format "${examNumber}" (expected J0282/098), skipped`);
      continue;
    }

    // Set centre from first valid record
    if (!centre) {
      centre = extractedCentre;
    }

    // Reject rows from a different centre — CSV must be single-school
    if (extractedCentre !== centre) {
      errors.push(
        `Line ${i + 1}: exam number "${examNumber}" belongs to centre ${extractedCentre}, expected ${centre}. Skipped.`
      );
      continue;
    }

    // Group: if student already exists, just append the subject
    if (studentMap.has(examNumber)) {
      studentMap.get(examNumber)!.subjects.push({ name: subject, grade });
    } else {
      // First row for this student — create the record
      studentMap.set(examNumber, {
        regNumber: examNumber,
        dob,
        name,
        subjects: [{ name: subject, grade }],
      });
    }
  }

  if (!centre) {
    throw new Error(
      'Could not extract centre number from CSV. Check exam number format (expected: J0282/098).'
    );
  }

  // Build final students array and index map from the grouped map
  const students: V3Student[] = [];
  const index: Record<string, number> = {};

  for (const student of studentMap.values()) {
    const key = buildIndexKey(student.regNumber, student.dob);
    index[key] = students.length;
    students.push(student);
  }

  const schoolFile: V3SchoolFile = {
    centre,
    school: schoolName,
    exam: `JCE ${examYear}`,
    publishedAt: new Date().toISOString(),
    totalStudents: students.length,
    students,
    index,
  };

  return { file: schoolFile, centre, errors };
}

/**
 * Search within a loaded school file using the index.
 * Runs entirely in the browser — no server hit.
 *
 * @param schoolFile  The parsed JSON from R2
 * @param examNumber  e.g. "J0282/098"
 * @param dob         e.g. "1990-05-15"
 */
export function searchInSchoolFile(
  schoolFile: V3SchoolFile,
  examNumber: string,
  dob: string
): V3Student | null {
  const key = buildIndexKey(examNumber, dob);
  const position = schoolFile.index[key];

  if (position === undefined) return null;
  return schoolFile.students[position] ?? null;
}

/**
 * Validate that a school file has the required structure.
 */
export function validateSchoolFile(file: V3SchoolFile): boolean {
  return (
    typeof file.centre === 'string' &&
    typeof file.school === 'string' &&
    Array.isArray(file.students) &&
    typeof file.index === 'object' &&
    file.students.length > 0
  );
}
