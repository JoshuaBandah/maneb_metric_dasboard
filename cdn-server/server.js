/**
 * MANEB Mock CDN Server
 *
 * Standalone Node.js server that mimics Cloudflare R2 + CDN behaviour.
 * Runs independently from the Next.js app on port 4000.
 *
 * Simulates:
 *   - R2 object storage (PUT to store, GET to serve)
 *   - CDN cache headers (X-Cache HIT/MISS, CF-Ray, Cache-Control)
 *   - Johannesburg edge latency (2-15ms)
 *   - CORS for cross-origin student portal access
 *   - Prometheus metrics endpoint (/metrics)
 *   - K6 result collector (/k6/vu-result, /k6/clear)
 *   - Bucket stats (/stats)
 *
 * Usage:
 *   node cdn-server/server.js
 *   or
 *   npm run cdn
 *
 * Endpoints:
 *   GET    /jce/:year/:centre.json   → serve school file
 *   PUT    /jce/:year/:centre.json   → store school file (used by upload API)
 *   GET    /stats                    → bucket stats + cache analytics
 *   DELETE /clear                    → wipe all stored files
 *   GET    /metrics                  → Prometheus text format
 *   POST   /k6/vu-result             → receive K6 VU result
 *   POST   /k6/clear                 → clear K6 results
 */

const http = require('http');
const url  = require('url');
const fs   = require('fs');
const path = require('path');

const PORT       = process.env.CDN_PORT || 4000;
const STORE_DIR  = path.join(__dirname, 'store');

// Ensure store directory exists
if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });

// ─── In-memory object store (loaded from disk on startup) ─────────────────────
const store = new Map();

// ─── Persist helpers ──────────────────────────────────────────────────────────

function keyToFilePath(key) {
  // Sanitize key to safe file path
  const safe = key.replace(/[^a-zA-Z0-9/_.-]/g, '_');
  const full = path.join(STORE_DIR, safe);
  // Ensure subdirectory exists
  fs.mkdirSync(path.dirname(full), { recursive: true });
  return full;
}

function saveToDisk(obj) {
  try {
    const filePath = keyToFilePath(obj.key);
    const meta = { ...obj };
    delete meta.body;
    fs.writeFileSync(filePath + '.body', obj.body, 'utf8');
    fs.writeFileSync(filePath + '.meta', JSON.stringify(meta), 'utf8');
  } catch (e) {
    console.error(`[CDN] Failed to persist ${obj.key}:`, e.message);
  }
}

function loadFromDisk() {
  let count = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.meta')) {
        try {
          const metaPath = path.join(dir, entry.name);
          const bodyPath = metaPath.replace('.meta', '.body');
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          const body = fs.readFileSync(bodyPath, 'utf8');
          store.set(meta.key, { ...meta, body });
          count++;
        } catch {}
      }
    }
  }
  walk(STORE_DIR);
  return count;
}

// Load persisted files on startup
const loaded = loadFromDisk();
if (loaded > 0) console.log(`[CDN] Loaded ${loaded} object(s) from disk`);

// ─── K6 results collector ─────────────────────────────────────────────────────
const k6Results = {
  total_vus:        0,
  success_vus:      0,
  failed_vus:       0,
  total_fetch_ms:   0,
  total_lookup_ms:  0,
  updatedAt:        null,
};

// ─── Prometheus counters ──────────────────────────────────────────────────────
const prom = {
  cdn_requests_total:       0,
  cdn_cache_hits_total:     0,
  cdn_cache_misses_total:   0,
  cdn_bytes_served_total:   0,
  cdn_errors_total:         0,
  k6_vus_total:             0,
  k6_vus_success:           0,
  k6_vus_failed:            0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function edgeLatency() {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * 14) + 2));
}

function fakeCFRay() {
  return Math.random().toString(36).substring(2, 18).toUpperCase() + '-JNB';
}

function cdnHeaders(obj, isHit) {
  return {
    'Content-Type':              obj.contentType,
    'Cache-Control':             obj.cacheControl,
    'X-Cache':                   isHit ? 'HIT' : 'MISS',
    'CF-Cache-Status':           isHit ? 'HIT' : 'MISS',
    'CF-Ray':                    fakeCFRay(),
    'Content-Length':            String(obj.size),
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, PUT, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    'X-Mock-CDN':                'true',
    'X-CDN-Server':              `maneb-mock-cdn:${PORT}`,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end',  () => resolve(data));
    req.on('error', reject);
  });
}

function send(res, status, headers, body) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
  res.end(bodyStr);
}

function prometheusText() {
  const avgFetchMs = k6Results.total_vus > 0
    ? (k6Results.total_fetch_ms / k6Results.total_vus).toFixed(2)
    : 0;
  const avgLookupMs = k6Results.success_vus > 0
    ? (k6Results.total_lookup_ms / k6Results.success_vus).toFixed(2)
    : 0;
  const successRate = k6Results.total_vus > 0
    ? ((k6Results.success_vus / k6Results.total_vus) * 100).toFixed(2)
    : 0;

  return `# HELP cdn_requests_total Total CDN file requests
# TYPE cdn_requests_total counter
cdn_requests_total ${prom.cdn_requests_total}

# HELP cdn_cache_hits_total Total CDN cache hits
# TYPE cdn_cache_hits_total counter
cdn_cache_hits_total ${prom.cdn_cache_hits_total}

# HELP cdn_cache_misses_total Total CDN cache misses
# TYPE cdn_cache_misses_total counter
cdn_cache_misses_total ${prom.cdn_cache_misses_total}

# HELP cdn_bytes_served_total Total bytes served by CDN
# TYPE cdn_bytes_served_total counter
cdn_bytes_served_total ${prom.cdn_bytes_served_total}

# HELP cdn_errors_total Total CDN errors (404s)
# TYPE cdn_errors_total counter
cdn_errors_total ${prom.cdn_errors_total}

# HELP cdn_objects_stored Current number of objects in store
# TYPE cdn_objects_stored gauge
cdn_objects_stored ${store.size}

# HELP k6_vus_total Total K6 virtual users run
# TYPE k6_vus_total counter
k6_vus_total ${k6Results.total_vus}

# HELP k6_vus_success K6 successful virtual users
# TYPE k6_vus_success counter
k6_vus_success ${k6Results.success_vus}

# HELP k6_vus_failed K6 failed virtual users
# TYPE k6_vus_failed counter
k6_vus_failed ${k6Results.failed_vus}

# HELP k6_cdn_avg_fetch_ms Average CDN fetch time from K6 (ms)
# TYPE k6_cdn_avg_fetch_ms gauge
k6_cdn_avg_fetch_ms ${avgFetchMs}

# HELP k6_cdn_avg_lookup_ms Average in-memory lookup time from K6 (ms)
# TYPE k6_cdn_avg_lookup_ms gauge
k6_cdn_avg_lookup_ms ${avgLookupMs}

# HELP k6_success_rate_percent K6 CDN success rate percentage
# TYPE k6_success_rate_percent gauge
k6_success_rate_percent ${successRate}
`;
}

// ─── Request router ───────────────────────────────────────────────────────────

async function router(req, res) {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, PUT, HEAD, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    });
    res.end();
    return;
  }

  // ── GET /metrics  (Prometheus scrape endpoint) ────────────────────────────
  if (method === 'GET' && pathname === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end(prometheusText());
    return;
  }

  // ── GET /stats  (bucket analytics) ───────────────────────────────────────
  if (method === 'GET' && pathname === '/stats') {
    const objects = Array.from(store.values()).map(o => ({
      key:        o.key,
      size:       o.size,
      uploadedAt: o.uploadedAt,
      cacheHits:  o.cacheHits,
    }));
    send(res, 200, {}, {
      mockCDN:     true,
      port:        PORT,
      objectCount: store.size,
      totalBytes:  Array.from(store.values()).reduce((s, o) => s + o.size, 0),
      prometheus:  `http://localhost:${PORT}/metrics`,
      counters:    prom,
      k6: {
        total_vus:      k6Results.total_vus,
        success_vus:    k6Results.success_vus,
        failed_vus:     k6Results.failed_vus,
        success_rate:   k6Results.total_vus > 0
          ? +((k6Results.success_vus / k6Results.total_vus) * 100).toFixed(2)
          : 0,
        avg_fetch_ms:   k6Results.total_vus > 0
          ? +(k6Results.total_fetch_ms / k6Results.total_vus).toFixed(2)
          : 0,
        avg_lookup_ms:  k6Results.success_vus > 0
          ? +(k6Results.total_lookup_ms / k6Results.success_vus).toFixed(2)
          : 0,
        updatedAt:      k6Results.updatedAt,
      },
      objects,
    });
    return;
  }

  // ── DELETE /clear  (wipe store for test resets) ───────────────────────────
  if (method === 'DELETE' && pathname === '/clear') {
    const count = store.size;
    store.clear();
    // Wipe disk store too
    try {
      fs.rmSync(STORE_DIR, { recursive: true, force: true });
      fs.mkdirSync(STORE_DIR, { recursive: true });
    } catch {}
    send(res, 200, {}, { success: true, message: `Cleared ${count} object(s)` });
    return;
  }

  // ── POST /k6/vu-result  (K6 pushes VU results here) ──────────────────────
  if (method === 'POST' && pathname === '/k6/vu-result') {
    try {
      const body   = await readBody(req);
      const result = JSON.parse(body);

      k6Results.total_vus++;
      prom.k6_vus_total++;

      if (result.success) {
        k6Results.success_vus++;
        prom.k6_vus_success++;
        k6Results.total_fetch_ms  += result.fetchMs  || 0;
        k6Results.total_lookup_ms += result.lookupMs || 0;
      } else {
        k6Results.failed_vus++;
        prom.k6_vus_failed++;
      }

      k6Results.updatedAt = new Date().toISOString();

      send(res, 200, {}, { received: true });
    } catch {
      send(res, 400, {}, { error: 'Invalid JSON' });
    }
    return;
  }

  // ── POST /k6/clear  (reset K6 counters) ──────────────────────────────────
  if (method === 'POST' && pathname === '/k6/clear') {
    k6Results.total_vus       = 0;
    k6Results.success_vus     = 0;
    k6Results.failed_vus      = 0;
    k6Results.total_fetch_ms  = 0;
    k6Results.total_lookup_ms = 0;
    k6Results.updatedAt       = null;
    send(res, 200, {}, { success: true, message: 'K6 results cleared' });
    return;
  }

  // ── PUT /:key  (store a file — called by r2-client in mock mode) ──────────
  if (method === 'PUT') {
    const key = pathname.replace(/^\//, '');
    if (!key) {
      send(res, 400, {}, { error: 'Missing key' });
      return;
    }

    try {
      const body         = await readBody(req);
      const contentType  = req.headers['content-type']  || 'application/json';
      const cacheControl = req.headers['cache-control'] || 'public, max-age=300';

      const obj = {
        key,
        body,
        contentType,
        cacheControl,
        uploadedAt: new Date().toISOString(),
        size:       Buffer.byteLength(body, 'utf8'),
        cacheHits:  0,
      };

      store.set(key, obj);
      saveToDisk(obj);

      console.log(`[CDN] PUT /${key} — ${obj.size} bytes`);

      send(res, 200, { 'X-Mock-CDN': 'true' }, {
        success:    true,
        key,
        size:       obj.size,
        uploadedAt: obj.uploadedAt,
        publicUrl:  `http://localhost:${PORT}/${key}`,
      });
    } catch {
      send(res, 500, {}, { error: 'Failed to store object' });
    }
    return;
  }

  // ── GET /:key  (serve a file — student portal fetches from here) ──────────
  if (method === 'GET' || method === 'HEAD') {
    const key = pathname.replace(/^\//, '');
    if (!key) {
      send(res, 400, {}, { error: 'Missing key' });
      return;
    }

    await edgeLatency();

    const obj = store.get(key);

    if (!obj) {
      prom.cdn_errors_total++;
      send(res, 404, { 'X-Mock-CDN': 'true', 'CF-Ray': fakeCFRay() }, {
        error:   'NoSuchKey',
        message: `Object "${key}" not found`,
      });
      return;
    }

    // Track cache state
    const isHit = obj.cacheHits > 0;
    obj.cacheHits++;

    prom.cdn_requests_total++;
    prom.cdn_bytes_served_total += obj.size;
    if (isHit) prom.cdn_cache_hits_total++;
    else       prom.cdn_cache_misses_total++;

    const headers = cdnHeaders(obj, isHit);

    if (method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    console.log(`[CDN] GET /${key} — ${isHit ? 'HIT' : 'MISS'} — ${obj.size} bytes`);

    res.writeHead(200, headers);
    res.end(obj.body);
    return;
  }

  // ── 404 fallback ──────────────────────────────────────────────────────────
  send(res, 404, {}, { error: 'Not found' });
}

// ─── Start server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  router(req, res).catch(err => {
    console.error('[CDN] Unhandled error:', err);
    send(res, 500, {}, { error: 'Internal server error' });
  });
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         MANEB Mock CDN Server                    ║
╠══════════════════════════════════════════════════╣
║  CDN Base URL  : http://localhost:${PORT}           ║
║  Stats         : http://localhost:${PORT}/stats     ║
║  Prometheus    : http://localhost:${PORT}/metrics   ║
║  K6 collector  : http://localhost:${PORT}/k6/vu-result ║
╚══════════════════════════════════════════════════╝
  `);
});
