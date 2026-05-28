'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import styles from './style/dashBoard.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

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
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const es = new EventSource('http://localhost:3001/metrics/stream');

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMetrics(data);
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
      } catch (err) {}
    };

    es.onerror = (err) => {};

    return () => es.close();
  }, []);

  const k6 = metrics.clientSideRequest || {};
  const isCritical = metrics.requests.errorRatePercent > 50 || k6.failed_vus > 100;

  const trendChartData = {
    labels: history.map((h) => h.timestamp.toLocaleTimeString()),
    datasets: [
      {
        label: 'Latency (ms)',
        data: history.map((h) => h.latency),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'CPU (%)',
        data: history.map((h) => h.cpu),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'K6 Success VUs',
        data: history.map((h) => h.k6_success),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'K6 Failed VUs',
        data: history.map((h) => h.k6_failed),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const errorChartData = {
    labels: ['Success Requests', 'Failed Requests'],
    datasets: [
      {
        data: [k6.success_vus, k6.failed_vus],
        backgroundColor: ['#4caf50', '#f44336'],
        borderWidth: 1,
      },
    ],
  };

  const resourceChartData = {
    labels: ['CPU', 'Memory'],
    datasets: [
      {
        label: 'Usage %',
        data: [metrics.cpu.usagePercent, metrics.memory.usagePercent],
        backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)'],
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>MANEB Monitoring Dashboard</h1>

      <div className={`${styles.alert} ${isCritical ? styles.danger : styles.success}`}>
        {isCritical ? 'SYSTEM ALERT — High load detected' : 'System Healthy'}
      </div>

      <div className={styles.grid}>
        <Card title="CPU Usage" value={`${metrics.cpu.usagePercent.toFixed(1)}%`} />
        <Card title="Memory Usage" value={`${metrics.memory.usagePercent.toFixed(1)}%`} />
        <Card title="Avg Latency" value={`${metrics.latency.avgMs.toFixed(1)} ms`} />
        <Card title="Requests" value={metrics.requests.total} />
        <Card title="Failed Requests" value={metrics.requests.failed} />
        <Card title="Error Rate" value={`${metrics.requests.errorRatePercent.toFixed(1)}%`} />
      </div>

      <div className={styles.grid}>
        <Card title="K6 Total VUs" value={k6.total_vus || 0} />
        <Card title="K6 Success VUs" value={k6.success_vus || 0} />
        <Card title="K6 Failed VUs" value={k6.failed_vus || 0} />
        <Card title="K6 Failure Rate" value={`${(100 - k6.success_rate || 0).toFixed(1)}%`} />
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3>System + K6 Realtime Trends</h3>
          <Line data={trendChartData} />
        </div>

        <div className={styles.chartCard}>
          <h3>Request Success vs Failure</h3>
          <Doughnut data={errorChartData} />
        </div>

        <div className={styles.chartCard}>
          <h3>Resource Usage</h3>
          <Bar data={resourceChartData} />
        </div>

        <div className={styles.chartCard}>
          <h3>K6 Live Snapshot</h3>
          <div className={styles.metricsTable}>
            <Row label="Total VUs" value={k6.total_vus || 0} />
            <Row label="Successful VUs" value={k6.success_vus || 0} />
            <Row label="Failed VUs" value={k6.failed_vus || 0} />
            <Row label="Success Rate" value={`${(k6.success_rate || 0).toFixed(1)}%`} />
            <Row label="Average Wait" value={`${(k6.avg_wait_time_ms || 0).toFixed(1)} ms`} />
            <Row label="Event Loop Lag" value={`${metrics.latency.eventLoopLagMs.toFixed(2)} ms`} />
            <Row label="P50 Latency" value={`${metrics.latency.p50Ms.toFixed(2)} ms`} />
            <Row label="P90 Latency" value={`${metrics.latency.p90Ms.toFixed(2)} ms`} />
            <Row label="P99 Latency" value={`${metrics.latency.p99Ms.toFixed(2)} ms`} />
            <Row label="Updated At" value={k6.updatedAt ? new Date(k6.updatedAt).toLocaleTimeString() : '-'} />
          </div>
        </div>
      </div>
    </div>
  );
}

const Card = ({ title, value }) => {
  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>{title}</p>
      <h2>{value}</h2>
    </div>
  );
};

const Row = ({ label, value }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
};
