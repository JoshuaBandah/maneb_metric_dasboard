import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { captureError, createErrorLogger } from '../lib/errorMonitoring';

const logger = createErrorLogger('useMetricsStream');

interface MetricsData {
  memory?: { used: number; total: number; usagePercent: number };
  latency?: { avgMs: number; p50Ms: number; p90Ms: number; p99Ms: number; eventLoopLagMs: number };
  requests?: { total: number; failed: number; success: number; errorRatePercent: number };
  cpu?: { usagePercent: number };
  clientSideRequest?: {
    total_vus: number;
    success_vus: number;
    failed_vus: number;
    success_rate: number;
    avg_wait_time_ms: number;
    updatedAt: string | null;
  };
}

interface HistoryEntry {
  timestamp: Date;
  latency: number;
  cpu: number;
  memory: number;
  requests: number;
  k6_total: number;
  k6_failed: number;
  k6_success: number;
  k6_success_rate: number;
}

export function useMetricsStream(url: string) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    let es: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;

    const connect = () => {
      try {
        // Use API client to connect to metrics stream
        es = apiClient.connectMetricsStream(url);

        es.onmessage = (event) => {
          try {
            const data: MetricsData = JSON.parse(event.data);
            setMetrics(data);
            setLoading(false);
            setError(null);
            reconnectAttempts = 0; // Reset reconnect attempts on success

            const k6 = data.clientSideRequest || {
              total_vus: 0,
              success_vus: 0,
              failed_vus: 0,
              success_rate: 0,
              avg_wait_time_ms: 0,
              updatedAt: null,
            };
            setHistory((prev) => {
              const updated: HistoryEntry[] = [
                ...prev,
                {
                  timestamp: new Date(),
                  latency: data.latency?.avgMs || 0,
                  cpu: data.cpu?.usagePercent || 0,
                  memory: data.memory?.usagePercent || 0,
                  requests: data.requests?.total || 0,
                  k6_total: k6.total_vus || 0,
                  k6_failed: k6.failed_vus || 0,
                  k6_success: k6.success_vus || 0,
                  k6_success_rate: k6.success_rate || 0,
                }
              ];
              return updated.slice(-20); // Keep last 20 entries
            });
          } catch (parseErr) {
            const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
            logger.error(error, { action: 'parseMetricsData' });
          }
        };

        es.onerror = () => {
          setError('Failed to connect to metrics stream');
          setLoading(false);

          if (es) {
            es.close();
            es = null;
          }

          // Reconnect with exponential backoff — no hard limit, keep retrying
          reconnectAttempts++;
          const delayMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`[useMetricsStream] Reconnecting in ${delayMs}ms (attempt ${reconnectAttempts})`);
          reconnectTimeout = setTimeout(connect, delayMs);
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(error, { action: 'connectMetricsStream' });
        setError('Failed to initialize metrics stream');
        setLoading(false);

        // Reconnect with exponential backoff
        reconnectAttempts++;
        const delayMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectTimeout = setTimeout(connect, delayMs);
      }
    };

    connect();

    return () => {
      if (es) {
        es.close();
        es = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [url]);

  return { metrics, history, loading, error };
}
