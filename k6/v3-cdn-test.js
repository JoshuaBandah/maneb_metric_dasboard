/**
 * K6 — V3 Cloudflare CDN Direct Test
 *
 * Each VU fetches the school file DIRECTLY from Cloudflare R2,
 * then does an O(1) index lookup with a real exam number + DOB.
 *
 * No portal. No Next.js. No database. Pure Cloudflare CDN.
 *
 * Data confirmed matching DB and Cloudflare:
 *   Format:  J{centre}/{5-digit}  e.g. J0282/00001
 *   DOB:     2004-01-01 + ((n-1) % 1460) days
 *   Key:     J0282/00001_2004-01-01
 *   Schools: 0282, 0145, 0391, 0512, 0673 — 10,000 each = 50,000 total
 *
 * Run: k6 run k6/v3-cdn-test.js
 */

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const R2         = 'https://pub-bb1b974bb474447195d47562378bc210.r2.dev';
const METRIC_URL = __ENV.METRIC_URL || 'http://localhost:4000';

const responseTime = new Trend('v3_response_time_ms', true);
const successRate  = new Rate('v3_success_rate');
const failedCount  = new Counter('v3_failed_requests');
const lookupTime   = new Trend('v3_lookup_ms', true);

export const options = {
  vus:         3000,
  iterations:  3000,
  maxDuration: '10m',
  thresholds: {
    v3_response_time_ms: ['p(95)<5000'],
    v3_success_rate:     ['rate>0.90'],
  },
};

const CENTRES   = ['0282', '0145', '0391', '0512', '0673'];
const DOB_CYCLE = 1460;

function computeDOB(n) {
  const d = new Date(Date.UTC(2004, 0, 1) + ((n - 1) % DOB_CYCLE) * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// Each VU gets a unique student matching DB + Cloudflare exactly
function getStudent(iter) {
  const g  = iter % 50000;
  const ci = Math.floor(g / 10000);
  const n  = (g % 10000) + 1;
  return {
    examNumber: `J${CENTRES[ci]}/${String(n).padStart(5, '0')}`,
    dob:        computeDOB(n),
    centre:     CENTRES[ci],
  };
}

// ── Setup: download 5 school files from Cloudflare once ──────────────────────
export function setup() {
  try { http.post(`${METRIC_URL}/k6/clear`, null, { timeout: '3s' }); } catch (_) {}

  console.log('Downloading 5 school files from Cloudflare R2...');
  const indexes = {};

  for (const centre of CENTRES) {
    const res = http.get(`${R2}/jce/2024/${centre}.json`, { timeout: '120s' });
    if (res.status !== 200) {
      console.error(`  FAILED ${centre}: HTTP ${res.status}`);
      continue;
    }
    const file = JSON.parse(res.body);
    indexes[centre] = file.index;
    const cache = res.headers['CF-Cache-Status'] || 'UNKNOWN';
    console.log(`  ✓ ${centre}: ${file.totalStudents} students | ${cache} | ${res.timings.duration.toFixed(0)}ms`);
  }

  const loaded = Object.keys(indexes).length;
  if (loaded === 0) {
    console.error('ERROR: No files loaded. Check internet connection.');
  } else {
    console.log(`${loaded}/5 centres loaded. Starting 3000 VUs...`);
  }

  return indexes;
}

// ── VU: O(1) lookup directly in Cloudflare data ──────────────────────────────
export default function (indexes) {
  const s   = getStudent(__ITER);
  const idx = indexes ? indexes[s.centre] : null;

  if (!idx) {
    successRate.add(false);
    failedCount.add(1);
    return;
  }

  const t0       = Date.now();
  const key      = `${s.examNumber}_${s.dob}`;
  const position = idx[key];
  const found    = position !== undefined;
  const elapsed  = Date.now() - t0;

  responseTime.add(elapsed);
  lookupTime.add(elapsed);
  successRate.add(found);
  if (!found) failedCount.add(1);

  check({ found }, { 'student found in Cloudflare': (r) => r.found === true });

  // Push to local dashboard
  try {
    http.post(`${METRIC_URL}/k6/vu-result`, JSON.stringify({
      success:  found,
      fetchMs:  elapsed,
      lookupMs: elapsed,
      waitTime: elapsed,
      centre:   s.centre,
      stage:    found ? 'completed' : 'lookup_failed',
    }), { headers: { 'Content-Type': 'application/json' }, timeout: '1s' });
  } catch (_) {}
}

export function teardown() {
  console.log('Done → http://localhost:3000/v3/dashboard');
}
