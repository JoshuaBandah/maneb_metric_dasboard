/**
 * V1 Metrics Stream — Server-Sent Events
 *
 * Streams V1 backend metrics + portal search stats every 2 seconds.
 * GET /v1/api/metrics/stream
 */

import { NextRequest } from 'next/server';

const BACKEND_URL        = process.env.BACKEND_URL || 'http://localhost:3000';
const STREAM_INTERVAL_MS = 2000;

// Import portal search metrics recorded by the V1 search route
// Using dynamic import to avoid circular dependency issues
async function getPortalMetrics() {
  try {
    const mod = await import('../../search/route');
    return mod.v1SearchMetrics;
  } catch {
    return null;
  }
}

async function fetchV1BackendMetrics() {
  try {
    const res = await fetch(`${BACKEND_URL}/v1/metrics`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
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
          const [vpsData, portalMetrics] = await Promise.all([
            fetchV1BackendMetrics(),
            getPortalMetrics(),
          ]);

          const avgResponseMs = portalMetrics && portalMetrics.total > 0
            ? Math.round(portalMetrics.totalMs / portalMetrics.total)
            : 0;

          const payload = {
            timestamp: new Date().toISOString(),
            source:    'v1',
            memory:    vpsData?.memory   ?? { used: 0, total: 0, usagePercent: 0 },
            latency:   vpsData?.latency  ?? {
              avgMs:          avgResponseMs,
              p50Ms:          0,
              p90Ms:          0,
              p99Ms:          0,
              eventLoopLagMs: 0,
            },
            requests: vpsData?.requests ?? {
              total:            portalMetrics?.total    ?? 0,
              failed:           portalMetrics?.failed   ?? 0,
              success:          portalMetrics?.success  ?? 0,
              errorRatePercent: portalMetrics && portalMetrics.total > 0
                ? +((portalMetrics.failed / portalMetrics.total) * 100).toFixed(1)
                : 0,
            },
            cpu: vpsData?.cpu ?? { usagePercent: 0 },
            clientSideRequest: vpsData?.clientSideRequest ?? {
              total_vus:        portalMetrics?.total    ?? 0,
              success_vus:      portalMetrics?.success  ?? 0,
              failed_vus:       portalMetrics?.failed   ?? 0,
              success_rate:     portalMetrics && portalMetrics.total > 0
                ? +((portalMetrics.success / portalMetrics.total) * 100).toFixed(1)
                : 0,
              avg_wait_time_ms: avgResponseMs,
              updatedAt:        portalMetrics?.lastSearch ?? null,
            },
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
