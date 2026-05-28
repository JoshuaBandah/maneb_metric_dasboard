/**
 * V1 Backend Server
 *
 * Simulates the MANEB VPS backend with a JSON file database.
 * Exposes the endpoints the Next.js app expects:
 *
 *   GET  /v1/metrics              → system metrics + K6 stats
 *   POST /v1/search               → search student by examNumber + dob
 *   GET  /api/results             → all results for a given examType + year (used by V3 publish)
 *   POST /k6/vu-result            → receive K6 VU results
 *   POST /k6/clear                → clear K6 results
 *
 * Database: v1-backend/db.json (seeded on first run)
 *
 * Run: node v1-backend/server.js
 * Port: 3000
 */

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');

const app  = express();
const PORT = process.env.V1_PORT || 3002;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// ─── Load / seed database ─────────────────────────────────────────────────────

function seedDatabase() {
  console.log('[DB] Seeding database with test data...');

  const SCHOOLS = [
    { centre: '0282', name: 'Zomba Secondary School',          students: 200 },
    { centre: '0145', name: 'Blantyre Secondary School',       students: 200 },
    { centre: '0391', name: 'Lilongwe Girls Secondary School', students: 200 },
    { centre: '0512', name: 'Mzuzu Secondary School',          students: 200 },
    { centre: '0673', name: 'Dedza Secondary School',          students: 200 },
  ];

  const SUBJECTS = [
    'Mathematics', 'English', 'Biology',
    'Physical Science', 'History', 'Geography', 'Chichewa', 'Life Skills',
  ];

  const GRADES  = ['A','A','B','B','B','C','C','D','E','F'];
  const FNAMES  = ['John','Mary','Peter','Grace','James','Faith','David','Hope','Joseph','Mercy','Daniel','Joy','Samuel','Blessing','Chisomo','Tadala','Kondwani','Thandeka','Mphatso','Dalitso'];
  const LNAMES  = ['Banda','Phiri','Mwale','Chirwa','Tembo','Gondwe','Nyirenda','Kamanga','Mbewe','Nkhoma','Mkandawire','Msiska','Kalua','Chisale','Matemba'];

  const rand = arr => arr[Math.floor(Math.random() * arr.length)];

  function dob(i) {
    const d = new Date('2004-01-01');
    d.setDate(d.getDate() + (i % (4 * 365)));
    return d.toISOString().split('T')[0];
  }

  const rows = []; // flat rows — one per subject per student

  for (const school of SCHOOLS) {
    for (let i = 1; i <= school.students; i++) {
      const candidate  = String(i).padStart(3, '0');
      const examNumber = `J${school.centre}/${candidate}`;
      const dobVal     = dob(i - 1);
      const name       = `${rand(FNAMES)} ${rand(LNAMES)}`;

      for (const subject of SUBJECTS) {
        rows.push({
          examNumber,
          dob:      dobVal,
          name,
          subject,
          grade:    rand(GRADES),
          school:   school.name,
          centre:   school.centre,
          examType: 'JCE',
          year:     '2024',
        });
      }
    }
  }

  const db = { seededAt: new Date().toISOString(), rows };
  fs.writeFileSync(DB_FILE, JSON.stringify(db), 'utf8');
  console.log(`[DB] Seeded ${rows.length} rows (${SCHOOLS.reduce((s,sc)=>s+sc.students,0)} students across ${SCHOOLS.length} schools)`);
  return db;
}

let db;
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  console.log(`[DB] Loaded existing database (${db.rows.length} rows)`);
} else {
  db = seedDatabase();
}

// ─── K6 metrics store ─────────────────────────────────────────────────────────

const k6 = {
  total_vus:        0,
  success_vus:      0,
  failed_vus:       0,
  total_wait_ms:    0,
  updatedAt:        null,
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /v1/metrics
 * Returns system metrics + K6 stats for the V1 dashboard SSE stream
 */
app.get('/v1/metrics', (req, res) => {
  const mem     = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;

  const successRate = k6.total_vus > 0
    ? +((k6.success_vus / k6.total_vus) * 100).toFixed(1)
    : 0;

  const avgWait = k6.total_vus > 0
    ? +(k6.total_wait_ms / k6.total_vus).toFixed(1)
    : 0;

  res.json({
    timestamp: new Date().toISOString(),
    memory: {
      used:         Math.round(usedMem / 1024 / 1024),
      total:        Math.round(totalMem / 1024 / 1024),
      usagePercent: +((usedMem / totalMem) * 100).toFixed(1),
    },
    cpu: {
      usagePercent: +(Math.random() * 15 + 5).toFixed(1), // simulated — real CPU needs native module
    },
    latency: {
      avgMs:          avgWait || +(Math.random() * 80 + 20).toFixed(1),
      p50Ms:          +(Math.random() * 60 + 15).toFixed(1),
      p90Ms:          +(Math.random() * 200 + 80).toFixed(1),
      p99Ms:          +(Math.random() * 500 + 200).toFixed(1),
      eventLoopLagMs: +(Math.random() * 5).toFixed(2),
    },
    requests: {
      total:            k6.total_vus,
      success:          k6.success_vus,
      failed:           k6.failed_vus,
      errorRatePercent: k6.total_vus > 0
        ? +((k6.failed_vus / k6.total_vus) * 100).toFixed(1)
        : 0,
    },
    clientSideRequest: {
      total_vus:        k6.total_vus,
      success_vus:      k6.success_vus,
      failed_vus:       k6.failed_vus,
      success_rate:     successRate,
      avg_wait_time_ms: avgWait,
      updatedAt:        k6.updatedAt,
    },
  });
});

/**
 * POST /v1/search
 * Search student by examNumber + dob — simulates DB query
 */
app.post('/v1/search', (req, res) => {
  const start = Date.now();
  const { regNumber, examNumber, dob } = req.body;
  const exam = (examNumber || regNumber || '').trim().toUpperCase();
  const dobVal = (dob || '').trim();

  if (!exam || !dobVal) {
    return res.status(400).json({ error: 'Missing examNumber or dob' });
  }

  // Simulate DB query latency (50-300ms)
  const delay = Math.floor(Math.random() * 250) + 50;

  setTimeout(() => {
    // Find all rows for this student
    const studentRows = db.rows.filter(
      r => r.examNumber === exam && r.dob === dobVal
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        error:   'Student not found',
        responseTime: Date.now() - start,
      });
    }

    const first = studentRows[0];
    const student = {
      regNumber: first.examNumber,
      dob:       first.dob,
      name:      first.name,
      school:    first.school,
      subjects:  studentRows.map(r => ({ name: r.subject, grade: r.grade })),
    };

    res.json({
      success:      true,
      data:         student,
      responseTime: Date.now() - start,
      source:       'database',
    });
  }, delay);
});

/**
 * GET /api/results?examType=JCE&year=2024
 * Returns ALL flat rows for a given exam type and year.
 * Used by V3 publish route to pull data and generate CDN files.
 */
app.get('/api/results', (req, res) => {
  const { examType, year } = req.query;

  if (!examType || !year) {
    return res.status(400).json({ error: 'Missing examType or year' });
  }

  const rows = db.rows.filter(
    r => r.examType === examType.toUpperCase() && r.year === year
  );

  if (rows.length === 0) {
    return res.status(404).json({
      error: `No results found for ${examType} ${year}`,
    });
  }

  console.log(`[DB] /api/results → ${examType} ${year}: ${rows.length} rows`);
  res.json(rows);
});

/**
 * POST /k6/vu-result
 * Receive K6 VU results from the load test
 */
app.post('/k6/vu-result', (req, res) => {
  const result = req.body;
  k6.total_vus++;
  if (result.success) {
    k6.success_vus++;
    k6.total_wait_ms += result.waitTime || result.responseTime || 0;
  } else {
    k6.failed_vus++;
  }
  k6.updatedAt = new Date().toISOString();
  res.json({ received: true });
});

/**
 * POST /k6/clear
 * Reset K6 counters
 */
app.post('/k6/clear', (req, res) => {
  k6.total_vus     = 0;
  k6.success_vus   = 0;
  k6.failed_vus    = 0;
  k6.total_wait_ms = 0;
  k6.updatedAt     = null;
  res.json({ success: true });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         MANEB V1 Backend Server                  ║
╠══════════════════════════════════════════════════╣
║  Port          : ${PORT}                              ║
║  Search        : POST http://localhost:${PORT}/v1/search  ║
║  Metrics       : GET  http://localhost:${PORT}/v1/metrics ║
║  Results (V3)  : GET  http://localhost:${PORT}/api/results║
║  Database      : ${db.rows.length} rows loaded               ║
╚══════════════════════════════════════════════════╝
  `);
});
