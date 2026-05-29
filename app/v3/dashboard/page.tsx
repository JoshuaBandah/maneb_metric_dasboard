'use client';

import { useState } from 'react';
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
import { useMetricsStream } from '../../hooks/useMetricsStream';
import Link from 'next/link';
import styles from './v3-dashboard.module.css';

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
  memory: { used: 0, total: 0, usagePercent: 0 },
  latency: { avgMs: 0, p50Ms: 0, p90Ms: 0, p99Ms: 0, eventLoopLagMs: 0 },
  requests: { total: 0, failed: 0, success: 0, errorRatePercent: 0 },
  cpu: { usagePercent: 0 },
  clientSideRequest: {
    total_vus: 0, success_vus: 0, failed_vus: 0,
    success_rate: 0, avg_wait_time_ms: 0, updatedAt: null,
  },
  cloudflare: null as null | {
    totalOperations: number;
    reads: number;
    writes: number;
    breakdown: Record<string, number>;
    storage: null | { objectCount: number; payloadBytes: number; payloadKB: number };
    period: string;
    real: boolean;
  },
};

type TabType = 'metrics' | 'upload';

type ExamType = 'JCE' | 'MSCE' | 'PLSCE';

interface UploadRecord {
  centre: string;
  school: string;
  examYear: string;
  examType: string;
  totalStudents: number;
  uploadedAt: string;
  publicUrl: string;
}

interface PublishResult {
  success: boolean;
  message?: string;
  error?: string;
  hint?: string;
  examType?: string;
  examYear?: string;
  totalSchools?: number;
  totalStudents?: number;
  schools?: { centre: string; school: string; totalStudents: number; publicUrl: string }[];
  failures?: { school: string; error: string }[];
  mockMode?: boolean;
}

export default function V3Dashboard() {
  const [activeTab, setActiveTab]         = useState<TabType>('metrics');
  const [examType, setExamType]           = useState<ExamType>('JCE');
  const [examYear, setExamYear]           = useState('2024');
  const [isPublishing, setIsPublishing]   = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const metricsEndpoint = `${apiUrl}/v3/api/metrics/stream`;

  const { metrics: streamMetrics, history, loading, error } = useMetricsStream(
    metricsEndpoint
  );

  // Load upload history from V3 metrics endpoint
  const loadUploadHistory = async () => {
    try {
      const res = await fetch('/v3/api/metrics');
      if (res.ok) {
        const data = await res.json();
        setUploadHistory(data.uploads || []);
      }
    } catch {
      // silently fail — history is non-critical
    }
  };

  // Load history when upload tab is opened
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'upload') loadUploadHistory();
  };

  const metrics = streamMetrics || DEFAULT_METRICS;

  const k6 = metrics.clientSideRequest || {
    total_vus: 0,
    success_vus: 0,
    failed_vus: 0,
    success_rate: 0,
    avg_wait_time_ms: 0,
    updatedAt: null,
  };

  const handlePublish = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPublishing(true);
    setPublishResult(null);

    try {
      const res = await fetch('/v3/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examType, examYear }),
      });

      const data: PublishResult = await res.json();
      setPublishResult(data);
      if (data.success) loadUploadHistory();
    } catch (err) {
      setPublishResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const trendChartData = {
    labels: history.map((h) => h.timestamp.toLocaleTimeString()),
    datasets: [
      {
        label: 'CDN Response Time (ms)',
        data: history.map((h) => h.latency),
        borderColor: 'rgb(69, 183, 209)',
        backgroundColor: 'rgba(69, 183, 209, 0.1)',
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
        data: [k6?.success_vus || 0, k6?.failed_vus || 0],
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
        data: [metrics.cpu?.usagePercent || 0, metrics.memory?.usagePercent || 0],
        backgroundColor: ['rgba(69, 183, 209, 0.7)', 'rgba(76, 175, 80, 0.7)'],
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>V3: CDN Architecture</h1>
          <p className={styles.subtitle}>Edge-Based Distribution - Ultra-Fast Frontend Search</p>
        </div>
        <Link
          href="/v1/dashboard"
          className={styles.switchButton}
          onClick={() => localStorage.setItem('maneb_portal_version', 'v1')}
          style={{ display: 'none' }}
        >
          Switch to V1 (Backend)
        </Link>
      </div>



      <div className={styles.tabContainer}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'metrics' ? styles.active : ''}`}
            onClick={() => handleTabChange('metrics')}
          >
            📊 Metrics & Performance
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'upload' ? styles.active : ''}`}
            onClick={() => handleTabChange('upload')}
          >
            📤 Upload Results
          </button>
        </div>

        {activeTab === 'metrics' && (
          <div className={styles.tabContent}>
            {loading && (
              <div className={styles.alert} style={{ backgroundColor: '#2196F3', color: 'white' }}>
                Loading metrics... Please wait.
              </div>
            )}

            {error && (
              <div className={styles.alert} style={{ backgroundColor: '#ff9800', color: 'white' }}>
                ⚠ Failed to connect to metrics stream
              </div>
            )}

            <div
              className={`${styles.alert} ${
                (metrics.requests?.errorRatePercent || 0) > 50 ||
                (metrics.clientSideRequest?.failed_vus || 0) > 100
                  ? styles.danger
                  : styles.success
              }`}
            >
              {(metrics.requests?.errorRatePercent || 0) > 50 ||
              (metrics.clientSideRequest?.failed_vus || 0) > 100
                ? 'SYSTEM ALERT — High load detected'
                : 'System Healthy - CDN Performing Optimally'}
            </div>

            <div className={styles.grid}>
              <Card title="CDN Response Time"    value={`${(metrics.latency?.avgMs || 0).toFixed(1)} ms`} />
              <Card title="CF Total Operations"  value={metrics.cloudflare?.totalOperations ?? 0} />
              <Card title="CF Read Requests"     value={metrics.cloudflare?.reads ?? 0} />
              <Card title="CF Write Requests"    value={metrics.cloudflare?.writes ?? 0} />
              <Card title="Objects on CDN"       value={metrics.cloudflare?.storage?.objectCount ?? 0} />
              <Card title="Storage Used"         value={metrics.cloudflare?.storage ? `${metrics.cloudflare.storage.payloadKB} KB` : '—'} />
            </div>

            <div className={styles.grid}>
              <Card title="K6 Total VUs" value={k6.total_vus || 0} />
              <Card title="K6 Success VUs" value={k6.success_vus || 0} />
              <Card title="K6 Failed VUs" value={k6.failed_vus || 0} />
              <Card
                title="K6 Failure Rate"
                value={k6.total_vus === 0 ? 'N/A' : `${(100 - k6.success_rate || 0).toFixed(1)}%`}
              />
            </div>

            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <h3>CDN + K6 Realtime Trends</h3>
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
                  <Row
                    label="Event Loop Lag"
                    value={`${(metrics.latency?.eventLoopLagMs || 0).toFixed(2)} ms`}
                  />
                  <Row label="P50 Latency" value={`${(metrics.latency?.p50Ms || 0).toFixed(2)} ms`} />
                  <Row label="P90 Latency" value={`${(metrics.latency?.p90Ms || 0).toFixed(2)} ms`} />
                  <Row label="P99 Latency" value={`${(metrics.latency?.p99Ms || 0).toFixed(2)} ms`} />
                  <Row
                    label="Updated At"
                    value={k6.updatedAt ? new Date(k6.updatedAt).toLocaleTimeString() : '-'}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className={styles.tabContent}>
            <div className={styles.uploadContainer}>

              {/* ── Publish form ── */}
              <div className={styles.uploadCard}>
                <h2>Publish Results to CDN</h2>
                <p>
                  Select the exam type and year. The system will pull all results
                  from the database, generate one indexed file per school, and
                  push everything to the CDN. Students can then access results
                  instantly — no database hit required.
                </p>
                <ul>
                  <li>Results fetched from VPS database</li>
                  <li>Grouped by school/centre automatically</li>
                  <li>One indexed JSON file generated per school</li>
                  <li>All files pushed to CDN simultaneously</li>
                  <li>Students access CDN directly — zero backend load</li>
                </ul>

                <form onSubmit={handlePublish} className={styles.uploadForm}>
                  <div className={styles.formGroup}>
                    <label htmlFor="examType">Exam Type *</label>
                    <select
                      id="examType"
                      value={examType}
                      onChange={e => setExamType(e.target.value as ExamType)}
                      className={styles.select}
                      required
                    >
                      <option value="JCE">JCE — Junior Certificate of Education</option>
                      <option value="MSCE">MSCE — Malawi School Certificate of Education</option>
                      <option value="PLSCE">PLSCE — Primary Leaving School Certificate</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="examYear">Exam Year *</label>
                    <select
                      id="examYear"
                      value={examYear}
                      onChange={e => setExamYear(e.target.value)}
                      className={styles.select}
                      required
                    >
                      {[2025, 2024, 2023, 2022, 2021, 2020].map(y => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isPublishing}
                    className={styles.uploadButton}
                  >
                    {isPublishing
                      ? '⏳ Fetching from DB & Publishing...'
                      : `🚀 Publish ${examType} ${examYear} to CDN`}
                  </button>
                </form>

                {/* Success */}
                {publishResult?.success && (
                  <div className={`${styles.statusMessage} ${styles.success}`}>
                    <strong>✓ {publishResult.message}</strong>
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <div>Schools published: {publishResult.totalSchools}</div>
                      <div>Total students: {publishResult.totalStudents}</div>
                      {publishResult.mockMode && (
                        <div style={{ color: '#e65100', marginTop: 4 }}>
                          ⚠ Mock mode — files stored on local CDN server
                        </div>
                      )}
                    </div>
                    {publishResult.schools && publishResult.schools.length > 0 && (
                      <div style={{ marginTop: 10, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: '#e8f5e9' }}>
                              <th style={thStyle}>Centre</th>
                              <th style={thStyle}>School</th>
                              <th style={thStyle}>Students</th>
                              <th style={thStyle}>CDN URL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {publishResult.schools.map((s, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={tdStyle}>{s.centre}</td>
                                <td style={tdStyle}>{s.school}</td>
                                <td style={tdStyle}>{s.totalStudents}</td>
                                <td style={tdStyle}>
                                  <a href={s.publicUrl} target="_blank" rel="noreferrer"
                                    style={{ color: '#2e7d32', fontSize: 10 }}>
                                    View ↗
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {publishResult.failures && publishResult.failures.length > 0 && (
                      <div style={{ marginTop: 8, color: '#c62828', fontSize: 11 }}>
                        ⚠ {publishResult.failures.length} school(s) failed to publish
                      </div>
                    )}
                  </div>
                )}

                {/* Error */}
                {publishResult && !publishResult.success && (
                  <div className={`${styles.statusMessage} ${styles.error}`}>
                    <strong>✗ Publish failed</strong>
                    <div style={{ marginTop: 4, fontSize: 12 }}>{publishResult.error}</div>
                    {publishResult.hint && (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>
                        {publishResult.hint}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Publish history ── */}
              <div className={styles.uploadCard}>
                <h3>Publish History</h3>
                <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                  Schools currently published to CDN
                </p>

                {uploadHistory.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '20px 0' }}>
                    No results published yet
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f0f8fb' }}>
                          <th style={thStyle}>Exam</th>
                          <th style={thStyle}>Centre</th>
                          <th style={thStyle}>School</th>
                          <th style={thStyle}>Students</th>
                          <th style={thStyle}>Published</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadHistory
                          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
                          .map((rec, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={tdStyle}>{rec.examType || 'JCE'} {rec.examYear}</td>
                              <td style={tdStyle}>{rec.centre}</td>
                              <td style={tdStyle}>{rec.school}</td>
                              <td style={tdStyle}>{rec.totalStudents}</td>
                              <td style={tdStyle}>{new Date(rec.uploadedAt).toLocaleString()}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '6px 8px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#45B7D1',
  borderBottom: '2px solid #e0e0e0',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  color: '#333',
};

const Card = ({ title, value }: { title: string; value: string | number }) => {
  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>{title}</p>
      <h2>{value}</h2>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string | number }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
};
