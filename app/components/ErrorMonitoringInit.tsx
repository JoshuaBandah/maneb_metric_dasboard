'use client';

import { useEffect } from 'react';
import { initializeErrorMonitoring } from '../lib/errorMonitoring';

/**
 * Client component to initialize error monitoring
 * This must be a client component to run in the browser
 */
export function ErrorMonitoringInit() {
  useEffect(() => {
    initializeErrorMonitoring();
  }, []);

  return null;
}
