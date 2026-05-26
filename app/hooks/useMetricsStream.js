import { useEffect, useState } from 'react';

export function useMetricsStream(url) {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    let es = null;
    let reconnectTimeout = null;

    const connect = () => {
      try {
        es = new EventSource(url);

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setMetrics(data);
            setLoading(false);
            setError(null);

            const k6 = data.clientSideRequest || {};
            setHistory((prev) => {
              const updated = [...prev, {
                timestamp: new Date(),
                latency: data.latency?.avgMs || 0,
                cpu: data.cpu?.usagePercent || 0,
                memory: data.memory?.usagePercent || 0,
                requests: data.requests?.total || 0,
                k6_total: k6.total_vus || 0,
                k6_failed: k6.failed_vus || 0,
                k6_success: k6.success_vus || 0,
                k6_success_rate: k6.success_rate || 0,
              }];
              return updated.slice(-20);
            });
          } catch (parseErr) {
            console.error('Failed to parse metrics data:', parseErr);
          }
        };

        es.onerror = (err) => {
          console.error('EventSource error:', err);
          setError('Failed to connect to metrics stream');
          setLoading(false);
          es.close();
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeout = setTimeout(connect, 5000);
        };
      } catch (err) {
        console.error('Failed to create EventSource:', err);
        setError('Failed to initialize metrics stream');
        setLoading(false);
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (es) es.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [url]);

  return { metrics, history, loading, error };
}
