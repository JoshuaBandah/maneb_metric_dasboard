/**
 * V3 Metrics Stream — Server-Sent Events
 *
 * Streams combined metrics every 2 seconds:
 *   1. K6 results from VPS (same source as V1, but V3 K6 targets CDN)
 *   2. Mock CDN stats (cache hits, object count, total requests)
 *
 * The VPS endpoint is optional — if unreachable, CDN stats still stream.
 * This means the dashboard works fully in local/mock mode.
 *
 * GET /v3/api/metrics/stream
 */

import { NextRequest } from 'next/server';

const VPS_METRICS_URL = process.env.VPS_METRICS_URL || 'http://10.10.20.52:3001';
const CDN_SERVER_URL  = process.env.CDN_SERVER_URL  || 'http://localhost:4000';
const STREAM_INTERVAL_MS = 2000;

async function fetchVPSMetrics() {
  try {
    const res = await fetch(`${VPS_METRICS_URL}/v3/metrics`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchCDNStats() {
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
  const origin = request.nextUrl.origin;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let active = true;

      // Stop streaming when client disconnects
      request.signal.addEventListener('abort', () => {
        active = false;
        controller.close();
      });

      while (active) {
        try {
          // Fetch both sources in parallel
          const [vpsData, cdnStats] = await Promise.all([
            fetchVPSMetrics(),
            fetchCDNStats(),
          ]);

          const payload = {
            timestamp: new Date().toISOString(),
            source: 'v3',

            // VPS system metrics (from K6 CDN load test results)
            memory: vpsData?.memory ?? { used: 0, total: 0, usagePercent: 0 },
            latency: vpsData?.latency ?? {
              avgMs: cdnStats ? 8 : 0,   // mock CDN avg ~8ms
              p50Ms: 0,
              p90Ms: 0,
              p99Ms: 0,
              eventLoopLagMs: 0,
            },
            requests: vpsData?.requests ?? { total: 0, failed: 0, success: 0, errorRatePercent: 0 },
            cpu: vpsData?.cpu ?? { usagePercent: 0 },

            // K6 CDN load test results — pulled from CDN server's K6 collector
            clientSideRequest: cdnStats?.k6 ?? vpsData?.clientSideRequest ?? {
              total_vus:        0,
              success_vus:      0,
              failed_vus:       0,
              success_rate:     0,
              avg_wait_time_ms: cdnStats?.k6?.avg_fetch_ms ?? 0,
              updatedAt:        null,
            },

            // Mock CDN / Cloudflare analytics
            cdn: cdnStats
              ? {
                  objectCount:      cdnStats.objectCount      ?? 0,
                  totalCacheHits:   cdnStats.counters?.cdn_cache_hits_total ?? 0,
                  totalBytes:       cdnStats.totalBytes        ?? 0,
                  objects:          cdnStats.objects           ?? [],
                  k6: cdnStats.k6  ?? null,
                  mock: true,
                }
              : null,
          };

          const message = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Keep streaming even on error
        }

        // Wait before next tick
        await new Promise((resolve) => setTimeout(resolve, STREAM_INTERVAL_MS));
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
