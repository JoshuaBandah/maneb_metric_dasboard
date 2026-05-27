/**
 * V3 Index Generator
 * Generates index and links within school file for fast lookup
 */

import { V3SchoolFile, V3Student } from './v3-types';

/**
 * Parse CSV and generate V3 school file with index
 * CSV format: regNumber,dob,name,subject1:grade1,subject2:grade2,...
 */
export function generateV3SchoolFile(
  csvContent: string,
  school: string,
  cdnBaseUrl: string
): V3SchoolFile {
  const lines = csvContent.trim().split('\n');
  const students: V3Student[] = [];
  const index: Record<string, number> = {};

  // Skip header if present
  const startIndex = lines[0].toLowerCase().includes('regnumber') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 3) continue;

    const regNumber = parts[0].trim();
    const dob = parts[1].trim();
    const name = parts[2].trim();

    // Parse subjects and grades
    const subjects = [];
    for (let j = 3; j < parts.length; j += 2) {
      if (parts[j] && parts[j + 1]) {
        subjects.push({
          name: parts[j].trim(),
          grade: parts[j + 1].trim(),
        });
      }
    }

    // Generate link for this student
    const link = `${cdnBaseUrl}/${school}/${regNumber}_${dob}.html`;

    const student: V3Student = {
      regNumber,
      dob,
      name,
      subjects,
      link,
    };

    // Add to index
    const indexKey = `${regNumber}_${dob}`;
    index[indexKey] = students.length;

    students.push(student);
  }

  return {
    school,
    uploadedAt: new Date().toISOString(),
    totalStudents: students.length,
    students,
    index,
  };
}

/**
 * Search within school file using index
 * This runs on the frontend after CDN file is loaded
 */
export function searchInSchoolFile(
  schoolFile: V3SchoolFile,
  regNumber: string,
  dob: string
): V3Student | null {
  const indexKey = `${regNumber}_${dob}`;
  const studentIndex = schoolFile.index[indexKey];

  if (studentIndex === undefined) {
    return null;
  }

  return schoolFile.students[studentIndex] || null;
}

/**
 * Validate school file structure
 */
export function validateSchoolFile(file: V3SchoolFile): boolean {
  return (
    file.school &&
    file.students &&
    Array.isArray(file.students) &&
    file.index &&
    typeof file.index === 'object'
  );
}
