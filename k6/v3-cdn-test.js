/**
 * K6 Load Test — V3 CDN Architecture
 *
 * Each VU simulates a real student searching for their results.
 * The exam number and DOB are deterministic — they match exactly
 * what was seeded in the database and published to Cloudflare R2.
 *
 * Flow per VU:
 *   1. Pick a unique student (exam number + DOB) based on iteration
 *   2. Extract centre from exam number → build CDN file URL
 *   3. Fetch school file from Cloudflare R2
 *   4. Look up exam number + DOB in the index → O(1) match
 *   5. Record as SUCCESS if student found, FAILURE if not
 *   6. Push result to CDN server metrics collector
 *
 * Usage:
 *   k6 run k6/v3-cdn-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ─── Config ───────────────────────────────────────────────────────────────────

const CDN_BASE_URL = __ENV.CDN_BASE_URL || 'https://pub-bb1b974bb474447195d47562378bc210.r2.dev';
const METRIC_URL   = __ENV.METRIC_URL   || 'http://localhost:4000';

// ─── Custom metrics ───────────────────────────────────────────────────────────

const cdnResponseTime = new Trend('cdn_response_time_ms', true);
const cdnSuccessRate  = new Rate('cdn_success_rate');
const cdnFailedCount  = new Counter('cdn_failed_requests');
const lookupTime      = new Trend('in_memory_lookup_ms', true);
const cacheHitRate    = new Rate('cdn_cache_hit_rate');

// ─── Load shape ───────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    cdn_load_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 1000  },  // ramp up to 1000
        { duration: '30s', target: 5000  },  // ramp up to 5000
        { duration: '60s', target: 10000 },  // ramp up to 10000
        { duration: '60s', target: 10000 },  // hold at 10000
        { duration: '30s', target: 0     },  // ramp down
      ],
    },
  },
  thresholds: {
    cdn_response_time_ms: ['p(95)<2000'],
    cdn_success_rate:     ['rate>0.90'],
  },
};

// ─── Student pool ─────────────────────────────────────────────────────────────
//
// Each entry maps to real students seeded in the database and published to R2.
// Format matches exactly what index-generator produces:
//   JCE:   J{centre}/{candidate padded 3}  DOB base: 2004-01-01
//   MSCE:  M{centre}/{candidate padded 4}  DOB base: 2006-01-01
//   PLSCE: P{centre}/{candidate padded 3}  DOB base: 2011-01-01
//
// 300 students per JCE/MSCE school, 80 per PLSCE school.

const SCHOOLS = [
  { centre: '0282', folder: 'jce',   year: '2024', prefix: 'J', pad: 5, count: 10000, dobBase: '2004-01-01' },
  { centre: '0145', folder: 'jce',   year: '2024', prefix: 'J', pad: 5, count: 10000, dobBase: '2004-01-01' },
  { centre: '0391', folder: 'jce',   year: '2024', prefix: 'J', pad: 5, count: 10000, dobBase: '2004-01-01' },
  { centre: '0512', folder: 'jce',   year: '2024', prefix: 'J', pad: 5, count: 10000, dobBase: '2004-01-01' },
  { centre: '0673', folder: 'jce',   year: '2024', prefix: 'J', pad: 5, count: 10000, dobBase: '2004-01-01' },
  { centre: '0282', folder: 'msce',  year: '2025', prefix: 'M', pad: 4, count: 300, dobBase: '2006-01-01' },
  { centre: '0145', folder: 'msce',  year: '2025', prefix: 'M', pad: 4, count: 300, dobBase: '2006-01-01' },
  { centre: '0391', folder: 'msce',  year: '2025', prefix: 'M', pad: 4, count: 300, dobBase: '2006-01-01' },
  { centre: '0512', folder: 'msce',  year: '2025', prefix: 'M', pad: 4, count: 300, dobBase: '2006-01-01' },
  { centre: '0673', folder: 'msce',  year: '2025', prefix: 'M', pad: 4, count: 300, dobBase: '2006-01-01' },
  { centre: '2001', folder: 'plsce', year: '2025', prefix: 'P', pad: 3, count: 80,  dobBase: '2011-01-01' },
  { centre: '2002', folder: 'plsce', year: '2025', prefix: 'P', pad: 3, count: 80,  dobBase: '2011-01-01' },
  { centre: '2003', folder: 'plsce', year: '2025', prefix: 'P', pad: 3, count: 80,  dobBase: '2011-01-01' },
  { centre: '2004', folder: 'plsce', year: '2025', prefix: 'P', pad: 3, count: 80,  dobBase: '2011-01-01' },
];

// Total students across all schools
const TOTAL_STUDENTS = SCHOOLS.reduce((s, sc) => s + sc.count, 0);

/**
 * Generate a deterministic student for a given iteration.
 * Each iteration maps to a unique student — different exam number + DOB.
 * Cycles back after all students are exhausted.
 */
function getStudent(iter) {
  const globalIndex = iter % TOTAL_STUDENTS;
  let remaining = globalIndex;

  for (const school of SCHOOLS) {
    if (remaining < school.count) {
      const studentNo  = remaining + 1; // 1-based
      const candidate  = String(studentNo).padStart(school.pad, '0');
      const examNumber = `${school.prefix}${school.centre}/${candidate}`;

      // DOB matches seeder: (studentNo - 1) % (4 * 365) days from base
      const base = new Date(school.dobBase);
      base.setDate(base.getDate() + ((studentNo - 1) % (4 * 365)));
      const dob = base.toISOString().split('T')[0];

      return {
        examNumber,
        dob,
        centre:  school.centre,
        folder:  school.folder,
        year:    school.year,
      };
    }
    remaining -= school.count;
  }

  return {
    examNumber: 'J0282/001',
    dob:        '2004-01-01',
    centre:     '0282',
    folder:     'jce',
    year:       '2024',
  };
}

function buildIndexKey(examNumber, dob) {
  return `${examNumber}_${dob}`;
}

function pushVUResult(result) {
  http.post(
    `${METRIC_URL}/k6/vu-result`,
    JSON.stringify(result),
    { headers: { 'Content-Type': 'application/json' }, timeout: '10s' }
  );
}

// ─── Main VU flow ─────────────────────────────────────────────────────────────

export default function () {
  const student = getStudent(__ITER);
  const fileUrl = `${CDN_BASE_URL}/${student.folder}/${student.year}/${student.centre}.json`;

  // 1. Fetch school file from Cloudflare R2
  const fetchStart = Date.now();
  const response   = http.get(fileUrl, {
    timeout: '30s',
    headers: { 'Accept': 'application/json' },
    tags:    { centre: student.centre, folder: student.folder },
  });
  const fetchMs = Date.now() - fetchStart;

  cdnResponseTime.add(fetchMs);

  // Read Cloudflare cache headers
  const cfCacheStatus = response.headers['CF-Cache-Status'] || response.headers['cf-cache-status'] || '';
  cacheHitRate.add(cfCacheStatus === 'HIT');

  check(response, {
    'CDN status 200':       (r) => r.status === 200,
    'response under 500ms': (r) => r.timings.duration < 500,
  });

  if (response.status !== 200) {
    cdnSuccessRate.add(false);
    cdnFailedCount.add(1);
    pushVUResult({ vu: __VU, iter: __ITER, success: false, reason: `http_${response.status}`, fetchMs, centre: student.centre });
    sleep(0.3);
    return;
  }

  // 2. Parse school file
  let schoolFile;
  try {
    schoolFile = JSON.parse(response.body);
  } catch {
    cdnSuccessRate.add(false);
    cdnFailedCount.add(1);
    pushVUResult({ vu: __VU, iter: __ITER, success: false, reason: 'parse_error', fetchMs, centre: student.centre });
    sleep(0.3);
    return;
  }

  // 3. Look up student using exam number + DOB — O(1) index lookup
  const lookupStart = Date.now();
  const key         = buildIndexKey(student.examNumber, student.dob);
  const position    = schoolFile.index ? schoolFile.index[key] : undefined;
  const found       = schoolFile.students && position !== undefined && schoolFile.students[position] !== undefined;
  const lookupMs    = Date.now() - lookupStart;

  lookupTime.add(lookupMs);
  cdnSuccessRate.add(found);

  if (!found) {
    cdnFailedCount.add(1);
  }

  // 4. Push result to CDN server metrics collector
  pushVUResult({
    vu:        __VU,
    iter:      __ITER,
    source:    'cdn',
    stage:     found ? 'completed' : 'lookup_failed',
    success:   found,
    fetchMs,
    lookupMs,
    waitTime:  fetchMs + lookupMs,
    centre:    student.centre,
    folder:    student.folder,
    cacheStatus: cfCacheStatus,
    reason:    found ? null : `key_not_found:${key}`,
  });

  sleep(Math.random() * 0.3);
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

export function teardown() {
  console.log('V3 CDN test complete.');
  http.post(`${METRIC_URL}/k6/clear`, null, { timeout: '30s' });
}
