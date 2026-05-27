'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_METRICS = {
  memory: {
    used: 0,
    total: 0,
    usagePercent: 0,
  },
  latency: {
    avgMs: 0,
    p50Ms: 0,
    p90Ms: 0,
    p99Ms: 0,
    eventLoopLagMs: 0,
  },
  requests: {
    total: 0,
    failed: 0,
    success: 0,
    errorRatePercent: 0,
  },
  cpu: {
    usagePercent: 0,
  },
  clientSideRequest: {
    total_vus: 0,
    success_vus: 0,
    failed_vus: 0,
    success_rate: 0,
    avg_wait_time_ms: 0,
    updatedAt: null,
  },
};

export default function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to V1 dashboard by default
    router.push('/v1/dashboard');
  }, [router]);

  return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <p>Redirecting to dashboard...</p>
    </div>
  );
}
