/**
 * K6 Load Test — V1 Backend Architecture
 *
 * Simulates students searching results via the V1 backend API.
 * Each VU hits POST /v1/api/search → Next.js → BACKEND_URL/v1/search → DB
 *
 * This is the comparison test against v3-cdn-test.js.
 * Same load shape, same number of VUs — different target.
 *
 * Expected result: latency climbs, errors increase under load.
 * That contrast vs V3 (flat 8ms, 0 errors) is the research proof.
 *
 * Usage:
 *   k6 run k6/v1-backend-test.js
 *
 * Env overrides:
 *   BASE_URL    — Next.js app URL (default: http://localhost:3001)
 *   METRIC_URL  — metrics collector  (default: http://localhost:3001)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL   = __ENV.BASE_URL   || 'http://10.10.20.52:3000';
const METRIC_URL = __ENV.METRIC_URL || 'http://10.10.20.52:3000'; // V1 backend directly

// ─── Custom metrics ───────────────────────────────────────────────────────────

const v1ResponseTime  = new Trend('v1_response_time_ms', true);
const v1SuccessRate   = new Rate('v1_success_rate');
const v1FailedCount   = new Counter('v1_failed_requests');
const v1TotalCount    = new Counter('v1_total_requests');

// ─── Load shape — same as V3 for fair comparison ──────────────────────────────

export const options = {
  scenarios: {
    v1_load_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 100 },  // ramp up to 100 VUs
        { duration: '60s', target: 100 },  // hold at 100 VUs
        { duration: '30s', target: 0   },  // ramp down
      ],
    },
  },
  thresholds: {
    // These will likely FAIL under load — that's the point
    v1_response_time_ms: ['p(95)<2000'],
    v1_success_rate:     ['rate>0.5'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Student pool — spread across all schools and exam types ─────────────────

const SCHOOLS = [
  { centre: '0282', prefix: 'J', year: '2024', pad: 3, max: 300 }, // JCE Zomba
  { centre: '0145', prefix: 'J', year: '2024', pad: 3, max: 300 }, // JCE Blantyre
  { centre: '0391', prefix: 'J', year: '2024', pad: 3, max: 300 }, // JCE Lilongwe Girls
  { centre: '0512', prefix: 'J', year: '2024', pad: 3, max: 300 }, // JCE Mzuzu
  { centre: '0673', prefix: 'J', year: '2024', pad: 3, max: 300 }, // JCE Dedza
  { centre: '0282', prefix: 'M', year: '2025', pad: 4, max: 300 }, // MSCE Zomba
  { centre: '0145', prefix: 'M', year: '2025', pad: 4, max: 300 }, // MSCE Blantyre
  { centre: '0391', prefix: 'M', year: '2025', pad: 4, max: 300 }, // MSCE Lilongwe Girls
  { centre: '0512', prefix: 'M', year: '2025', pad: 4, max: 300 }, // MSCE Mzuzu
  { centre: '0673', prefix: 'M', year: '2025', pad: 4, max: 300 }, // MSCE Dedza
];

function generateStudent(iter) {
  // Pick a different school for each iteration — round robin across all schools
  const school    = SCHOOLS[iter % SCHOOLS.length];
  // Pick a different student within that school
  const studentNo = (Math.floor(iter / SCHOOLS.length) % school.max) + 1;
  const candidate = String(studentNo).padStart(school.pad, '0');
  const examNumber = `${school.prefix}${school.centre}/${candidate}`;

  // DOB matches what was seeded: student 1 = base date, student 2 = base+1, etc.
  const baseYear = school.prefix === 'M' ? 2006 : 2004;
  const base = new Date(`${baseYear}-01-01`);
  base.setDate(base.getDate() + ((studentNo - 1) % (4 * 365)));

  return {
    examNumber,
    dob:      base.toISOString().split('T')[0],
    examYear: school.year,
  };
}

function pushVUResult(result) {
  http.post(
    `${METRIC_URL}/k6/vu-result`,
    JSON.stringify(result),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s',
    }
  );
}

// ─── Main VU flow ─────────────────────────────────────────────────────────────

export default function () {
  const student = generateStudent(__ITER);

  const start = Date.now();

  const res = http.post(
    `${BASE_URL}/v1/api/search`,
    JSON.stringify({
      examNumber: student.examNumber,
      dob:        student.dob,
      examYear:   student.examYear,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '30s',
      tags: { version: 'v1', school: student.examNumber.substring(0, 6) },
    }
  );

  const elapsed = Date.now() - start;
  v1ResponseTime.add(elapsed);
  v1TotalCount.add(1);

  const success = check(res, {
    'V1 status 200':        (r) => r.status === 200,
    'V1 has result':        (r) => {
      try { return JSON.parse(r.body).success === true; } catch { return false; }
    },
    'V1 under 2000ms':      (r) => r.timings.duration < 2000,
  });

  v1SuccessRate.add(success);

  if (!success) {
    v1FailedCount.add(1);
  }

  // Push result to V1 backend metrics collector
  pushVUResult({
    vu:          __VU,
    iter:        __ITER,
    success,
    waitTime:    elapsed,
    responseTime: elapsed,
    source:      'v1',
  });

  sleep(Math.random() * 0.3);
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

export function teardown() {
  console.log('V1 backend test complete.');
  http.post(`${METRIC_URL}/k6/clear`, null, { timeout: '10s' });
}
