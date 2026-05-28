/**
 * K6 Load Test — V3 CDN Architecture
 *
 * Simulates students fetching results directly from Cloudflare R2 CDN.
 * This is the V3 equivalent of break-test.js — same load pattern,
 * but targeting the CDN instead of the VPS backend.
 *
 * What this proves:
 *   - CDN handles the same load V1 struggles with, easily
 *   - Response times stay flat even as VUs ramp up
 *   - No server CPU/memory impact (CDN absorbs everything)
 *
 * Flow per VU:
 *   1. Pick a random centre number (simulates a student from any school)
 *   2. Fetch the school file from CDN: /jce/2024/{centre}.json
 *   3. Simulate in-memory lookup (no extra request needed)
 *   4. Push result to metrics endpoint on VPS
 *
 * Usage:
 *   k6 run k6/v3-cdn-test.js
 *
 * Environment variables (optional overrides):
 *   CDN_BASE_URL   — R2 public URL  (default: http://localhost:3000 for local mock)
 *   METRIC_URL     — VPS metrics collector (default: http://localhost:3001)
 *   EXAM_YEAR      — e.g. "2024"
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ─── Config ──────────────────────────────────────────────────────────────────

const CDN_BASE_URL = __ENV.CDN_BASE_URL || 'http://localhost:4000';
const METRIC_URL   = __ENV.METRIC_URL   || 'http://localhost:4000';
const EXAM_YEAR    = __ENV.EXAM_YEAR    || '2024';

/**
 * Centre numbers to simulate — replace with real MANEB centre numbers
 * once you have them. Each maps to one school file on R2.
 */
const CENTRE_NUMBERS = [
  '0282', '0145', '0391', '0512', '0673',
];

// ─── Custom metrics ───────────────────────────────────────────────────────────

const cdnResponseTime  = new Trend('cdn_response_time_ms', true);
const cdnSuccessRate   = new Rate('cdn_success_rate');
const cdnFailedFetches = new Counter('cdn_failed_fetches');
const lookupTime       = new Trend('in_memory_lookup_ms', true);

// ─── Load test config — 2 minutes ────────────────────────────────────────────

export const options = {
  scenarios: {
    cdn_load_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 100 },  // ramp up to 100 VUs
        { duration: '60s', target: 100 },  // hold at 100 VUs
        { duration: '30s', target: 0   },  // ramp down
      ],
    },
  },
  thresholds: {
    cdn_response_time_ms: ['p(95)<500'],
    cdn_success_rate:     ['rate>0.95'],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pick a random centre number from the list
 */
function randomCentre() {
  return CENTRE_NUMBERS[Math.floor(Math.random() * CENTRE_NUMBERS.length)];
}

/**
 * Simulate an in-memory index lookup.
 * In the real student portal this is instant — we just measure the time
 * to confirm it stays near 0ms even under load.
 */
function simulateLookup(schoolData) {
  const start = Date.now();

  if (!schoolData || !schoolData.index || !schoolData.students) {
    return { success: false, reason: 'invalid_school_file' };
  }

  // Pick a random student from the index
  const keys = Object.keys(schoolData.index);
  if (keys.length === 0) {
    return { success: false, reason: 'empty_index' };
  }

  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  const position  = schoolData.index[randomKey];
  const student   = schoolData.students[position];

  const elapsed = Date.now() - start;
  lookupTime.add(elapsed);

  return {
    success: !!student,
    lookupMs: elapsed,
  };
}

/**
 * Push VU result to the VPS metrics collector.
 * Same pattern as break-test.js so the dashboard can display both.
 */
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
  const centre  = randomCentre();
  const fileUrl = `${CDN_BASE_URL}/jce/${EXAM_YEAR}/${centre}.json`;

  // 1. Fetch school file from CDN
  const start    = Date.now();
  const response = http.get(fileUrl, {
    timeout: '30s',
    headers: {
      'Accept': 'application/json',
    },
    tags: { centre },
  });
  const fetchMs = Date.now() - start;

  cdnResponseTime.add(fetchMs);

  const fetchOk = check(response, {
    'CDN status 200':        (r) => r.status === 200,
    'response has body':     (r) => r.body && r.body.length > 0,
    'response under 500ms':  (r) => r.timings.duration < 500,
  });

  if (!fetchOk || response.status !== 200) {
    cdnSuccessRate.add(false);
    cdnFailedFetches.add(1);

    pushVUResult({
      vu:      __VU,
      iter:    __ITER,
      source:  'cdn',
      stage:   'fetch',
      success: false,
      reason:  `http_${response.status}`,
      fetchMs,
      centre,
    });

    sleep(0.5);
    return;
  }

  // 2. Parse JSON and simulate in-memory lookup
  let schoolData;
  try {
    schoolData = JSON.parse(response.body);
  } catch {
    cdnSuccessRate.add(false);
    cdnFailedFetches.add(1);

    pushVUResult({
      vu:      __VU,
      iter:    __ITER,
      source:  'cdn',
      stage:   'parse',
      success: false,
      reason:  'invalid_json',
      fetchMs,
      centre,
    });

    sleep(0.5);
    return;
  }

  const lookup = simulateLookup(schoolData);

  cdnSuccessRate.add(lookup.success);

  if (!lookup.success) {
    cdnFailedFetches.add(1);
  }

  // 3. Push result to metrics dashboard
  pushVUResult({
    vu:        __VU,
    iter:      __ITER,
    source:    'cdn',
    stage:     lookup.success ? 'completed' : 'lookup_failed',
    success:   lookup.success,
    fetchMs,
    lookupMs:  lookup.lookupMs || 0,
    waitTime:  fetchMs + (lookup.lookupMs || 0),
    centre,
    reason:    lookup.success ? null : lookup.reason,
  });

  // Minimal sleep — CDN is fast, simulate realistic user pacing
  sleep(Math.random() * 0.3);
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

export function teardown(data) {
  console.log('V3 CDN test complete. Clearing metrics...');

  http.post(`${METRIC_URL}/k6/clear`, null, {
    timeout: '30s',
  });
}
