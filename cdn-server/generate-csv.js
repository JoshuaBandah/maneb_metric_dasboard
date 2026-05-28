/**
 * Generate test CSV files for 5 MANEB JCE schools
 * Each school has 10,000 students × 8 subjects = 80,000 rows per file
 *
 * Schools:
 *   0282 — Zomba Secondary School
 *   0145 — Blantyre Secondary School
 *   0391 — Lilongwe Girls Secondary School
 *   0512 — Mzuzu Secondary School
 *   0673 — Dedza Secondary School
 *
 * Run: node cdn-server/generate-csv.js
 * Output: cdn-server/csv/
 */

const fs   = require('fs');
const path = require('path');

const SCHOOLS = [
  { centre: '0145', name: 'Blantyre Secondary School'         },
  { centre: '0391', name: 'Lilongwe Girls Secondary School'   },
  { centre: '0512', name: 'Mzuzu Secondary School'            },
  { centre: '0673', name: 'Dedza Secondary School'            },
];

const TOTAL_STUDENTS = 500;

const SUBJECTS = [
  'Mathematics',
  'English',
  'Biology',
  'Physical Science',
  'History',
  'Geography',
  'Chichewa',
  'Life Skills',
];

const GRADES = ['A', 'A', 'B', 'B', 'B', 'C', 'C', 'D', 'E', 'F'];

const FIRST_NAMES = [
  'John','Mary','Peter','Grace','James','Faith','David','Hope',
  'Joseph','Mercy','Daniel','Joy','Samuel','Blessing','Michael',
  'Patience','Emmanuel','Charity','Moses','Esther','Isaac','Ruth',
  'Aaron','Lydia','Elijah','Miriam','Joshua','Deborah','Caleb','Naomi',
  'Chisomo','Tadala','Kondwani','Thandeka','Mphatso','Dalitso','Takondwa',
  'Chimwemwe','Yankho','Wongani','Limbani','Tiwonge','Pemphero','Lusungu',
];

const LAST_NAMES = [
  'Banda','Phiri','Mwale','Chirwa','Tembo','Gondwe','Nyirenda','Kamanga',
  'Mbewe','Lungu','Zulu','Daka','Sakala','Mwanza','Chikwanda','Mutale',
  'Zimba','Mumba','Chanda','Musonda','Kapata','Nkosi','Mvula','Chiluba',
  'Nkhoma','Mkandawire','Msiska','Kalua','Chisale','Kaunda','Phiri',
  'Mwenifumbo','Chirambo','Kachingwe','Matemba','Nthara','Kumwenda',
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomGrade() {
  return randomFrom(GRADES);
}

function randomDOB(studentIndex) {
  // Spread DOBs across 2004–2007 deterministically
  const base   = new Date('2004-01-01');
  const offset = studentIndex % (4 * 365);
  const d      = new Date(base);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function padCandidate(n) {
  return String(n).padStart(3, '0');
}

// ─── Output directory ─────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, 'csv');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// ─── Generate one file per school ────────────────────────────────────────────

for (const school of SCHOOLS) {
  const filename   = `${school.name.toLowerCase().replace(/\s+/g, '_')}_2024.csv`;
  const outputFile = path.join(OUTPUT_DIR, filename);

  console.log(`\nGenerating ${school.name} (Centre ${school.centre})...`);

  const lines = ['examNumber,dob,name,subject,grade'];

  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    const examNumber = `J${school.centre}/${padCandidate(i)}`;
    const dob        = randomDOB(i - 1);
    const name       = `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`;

    for (const subject of SUBJECTS) {
      lines.push(`${examNumber},${dob},${name},${subject},${randomGrade()}`);
    }

    if (i % 2000 === 0) process.stdout.write(`  ${i}/${TOTAL_STUDENTS}\n`);
  }

  fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');

  const kb = (fs.statSync(outputFile).size / 1024).toFixed(1);
  console.log(`  ✓ ${filename} — ${TOTAL_STUDENTS} students, ${kb} KB`);
}

console.log(`
═══════════════════════════════════════════════
All files saved to: cdn-server/csv/
Upload each one via the V3 dashboard:
  http://localhost:3000/v3/dashboard → Upload Results tab
═══════════════════════════════════════════════
`);
