'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.push('/v3/dashboard');
  }, [router]);

  return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <p>Redirecting to V3 dashboard...</p>
    </div>
  );
}
