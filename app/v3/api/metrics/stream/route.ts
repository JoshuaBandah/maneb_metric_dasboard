/**
 * V3 Metrics Stream — Server-Sent Events
 *
 * Streams real metrics every 2 seconds from:
 *   1. Cloudflare Analytics API — real R2 request counts, reads, writes, storage
 *   2. CDN server (port 4000)   — K6 load test results
 *
 * GET /v3/api/metrics/stream
 */

import { NextRequest } from 'next/server';

const CDN_SERVER_URL     = process.env.CDN_SERVER_URL || 'http://localhost:4000';
const STREAM_INTERVAL_MS = 2000;

// Cloudflare analytics — fetched every 10 seconds (rate limit friendly)
let cfCache: Record<string, unknown> | null = null;
let cfLastFetch = 0;
const CF_CACHE_TTL = 10000;

async function fetchCloudflareAnalytics(origin: string) {
  const now = Date.now();
  if (cfCache && now - cfLastFetch < CF_CACHE_TTL) return cfCache;

  try {
    const res = await fetch(`${origin}/v3/api/cloudflare`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return cfCache;
    const data = await res.json();
    if (data.success) {
      cfCache = data;
      cfLastFetch = now;
    }
    return cfCache;
  } catch {
    return cfCache;
  }
}

async function fetchCDNServerStats() {
  try {
    const res = await fetch(`${CDN_SERVER_URL}/stats`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const origin  = request.nextUrl.origin;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let active = true;

      request.signal.addEventListener('abort', () => {
        active = false;
        controller.close();
      });

      while (active) {
        try {
          const [cfData, cdnStats] = await Promise.all([
            fetchCloudflareAnalytics(origin),
            fetchCDNServerStats(),
          ]);

          // K6 results from CDN server
          const k6 = cdnStats?.k6 ?? null;

          const payload = {
            timestamp: new Date().toISOString(),
            source:    'v3',

            // Not applicable for V3 — CDN handles load, not VPS
            memory:   { used: 0, total: 0, usagePercent: 0 },
            cpu:      { usagePercent: 0 },
            requests: {
              total:            cfData?.operations?.total    ?? 0,
              success:          cfData?.operations?.reads    ?? 0,
              failed:           0,
              errorRatePercent: 0,
            },
            latency: {
              avgMs:          k6?.avg_fetch_ms ?? 0,
              p50Ms:          0,
              p90Ms:          0,
              p99Ms:          0,
              eventLoopLagMs: 0,
            },

            // K6 CDN load test results
            clientSideRequest: {
              total_vus:        k6?.total_vus    ?? 0,
              success_vus:      k6?.success_vus  ?? 0,
              failed_vus:       k6?.failed_vus   ?? 0,
              success_rate:     k6?.success_rate ?? 0,
              avg_wait_time_ms: k6?.avg_fetch_ms ?? 0,
              updatedAt:        k6?.updatedAt    ?? null,
            },

            // Real Cloudflare R2 analytics
            cloudflare: cfData
              ? {
                  totalOperations: cfData.operations?.total   ?? 0,
                  reads:           cfData.operations?.reads   ?? 0,
                  writes:          cfData.operations?.writes  ?? 0,
                  breakdown:       cfData.operations?.breakdown ?? {},
                  storage:         cfData.storage ?? null,
                  period:          cfData.period  ?? '24h',
                  real:            true,
                }
              : null,
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // keep streaming
        }

        await new Promise(resolve => setTimeout(resolve, STREAM_INTERVAL_MS));
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':                'text/event-stream',
      'Cache-Control':               'no-cache, no-transform',
      'Connection':                  'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
