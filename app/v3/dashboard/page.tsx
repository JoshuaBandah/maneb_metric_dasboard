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

type TabType = 'metrics' | 'upload';

interface UploadRecord {
  centre: string;
  school: string;
  examYear: string;
  totalStudents: number;
  uploadedAt: string;
  publicUrl: string;
}

interface UploadResult {
  success: boolean;
  message?: string;
  error?: string;
  centre?: string;
  school?: string;
  examYear?: string;
  totalStudents?: number;
  publicUrl?: string;
  parseErrors?: string[];
}

export default function V3Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('metrics');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const metricsEndpoint = `${apiUrl}/api/v3/metrics/stream`;

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

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadStatus('');
    setUploadResult(null);

    const formData = new FormData(e.currentTarget);
    const schoolName = formData.get('schoolName') as string;
    const examYear = formData.get('examYear') as string;
    const file = formData.get('file') as File;

    if (!schoolName || !examYear || !file) {
      setUploadStatus('Please fill in all fields');
      setIsUploading(false);
      return;
    }

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('schoolName', schoolName);
      uploadFormData.append('examYear', examYear);
      uploadFormData.append('file', file);

      const response = await fetch('/v3/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data: UploadResult = await response.json();

      if (response.ok && data.success) {
        setUploadResult(data);
        setUploadStatus('success');
        (e.target as HTMLFormElement).reset();
        // Refresh history
        loadUploadHistory();
      } else {
        setUploadResult(data);
        setUploadStatus('error');
      }
    } catch (error) {
      setUploadResult({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
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
        <Link href="/v1/dashboard" className={styles.switchButton}>
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
              <Card title="CPU Usage" value={`${(metrics.cpu?.usagePercent || 0).toFixed(1)}%`} />
              <Card
                title="Memory Usage"
                value={`${(metrics.memory?.usagePercent || 0).toFixed(1)}%`}
              />
              <Card
                title="CDN Response Time"
                value={`${(metrics.latency?.avgMs || 0).toFixed(1)} ms`}
              />
              <Card title="Requests" value={metrics.requests?.total || 0} />
              <Card title="Failed Requests" value={metrics.requests?.failed || 0} />
              <Card
                title="Error Rate"
                value={`${(metrics.requests?.errorRatePercent || 0).toFixed(1)}%`}
              />
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
              <div className={styles.uploadCard}>
                <h2>Upload School Results CSV</h2>
                <p>
                  Upload a CSV file for a school. The centre number is extracted automatically
                  from the exam numbers in the file — no need to type it manually.
                </p>
                <ul>
                  <li>CSV is parsed and validated</li>
                  <li>Index is generated for O(1) student lookup</li>
                  <li>File is uploaded to Cloudflare R2 as <code>jce/&#123;year&#125;/&#123;centre&#125;.json</code></li>
                  <li>Students can access results immediately via CDN</li>
                </ul>

                <form onSubmit={handleFileUpload} className={styles.uploadForm}>
                  <div className={styles.formGroup}>
                    <label htmlFor="schoolName">School Name *</label>
                    <input
                      type="text"
                      id="schoolName"
                      name="schoolName"
                      placeholder="e.g., Zomba Secondary School"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="examYear">Exam Year *</label>
                    <input
                      type="text"
                      id="examYear"
                      name="examYear"
                      placeholder="e.g., 2024"
                      pattern="\d{4}"
                      maxLength={4}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="file">CSV File *</label>
                    <input
                      type="file"
                      id="file"
                      name="file"
                      accept=".csv"
                      required
                    />
                    <small>
                      Format: examNumber, dob (YYYY-MM-DD), name, subject1, grade1, subject2, grade2, ...
                    </small>
                  </div>

                  <button type="submit" disabled={isUploading} className={styles.uploadButton}>
                    {isUploading ? '⏳ Processing & Uploading...' : '📤 Upload to CDN'}
                  </button>
                </form>

                {/* Success result */}
                {uploadStatus === 'success' && uploadResult && (
                  <div className={`${styles.statusMessage} ${styles.success}`}>
                    <strong>✓ Upload successful</strong>
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <div>School: {uploadResult.school}</div>
                      <div>Centre: {uploadResult.centre}</div>
                      <div>Students: {uploadResult.totalStudents}</div>
                      <div>
                        CDN URL:{' '}
                        <a href={uploadResult.publicUrl} target="_blank" rel="noreferrer" style={{ color: '#2e7d32' }}>
                          {uploadResult.publicUrl}
                        </a>
                      </div>
                      {uploadResult.parseErrors && uploadResult.parseErrors.length > 0 && (
                        <div style={{ marginTop: 6, color: '#e65100' }}>
                          ⚠ {uploadResult.parseErrors.length} row(s) skipped — check CSV format
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error result */}
                {uploadStatus === 'error' && uploadResult && (
                  <div className={`${styles.statusMessage} ${styles.error}`}>
                    <strong>✗ Upload failed</strong>
                    <div style={{ marginTop: 4, fontSize: 12 }}>{uploadResult.error}</div>
                  </div>
                )}
              </div>

              <div className={styles.uploadCard}>
                <h3>CSV Format</h3>
                <pre className={styles.codeBlock}>
{`examNumber,dob,name,subject1,grade1,subject2,grade2
J0282/098,1990-05-15,John Banda,Mathematics,A,English,B
J0282/099,1991-03-20,Mary Phiri,Mathematics,B,English,A
J0282/100,1989-12-10,Peter Mwale,Mathematics,C,Biology,B`}
                </pre>
                <p style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
                  <strong>Exam number format:</strong> J&#123;CENTRE&#125;/&#123;CANDIDATE&#125;<br />
                  The centre number (e.g. <code>0282</code>) is extracted automatically.<br />
                  All rows in one CSV must belong to the same centre.
                </p>

                {/* Upload history */}
                {uploadHistory.length > 0 && (
                  <>
                    <h3 style={{ marginTop: 20 }}>Upload History</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f0f8fb' }}>
                            <th style={thStyle}>Centre</th>
                            <th style={thStyle}>School</th>
                            <th style={thStyle}>Year</th>
                            <th style={thStyle}>Students</th>
                            <th style={thStyle}>Uploaded</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploadHistory
                            .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
                            .map((rec, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={tdStyle}>{rec.centre}</td>
                                <td style={tdStyle}>{rec.school}</td>
                                <td style={tdStyle}>{rec.examYear}</td>
                                <td style={tdStyle}>{rec.totalStudents}</td>
                                <td style={tdStyle}>{new Date(rec.uploadedAt).toLocaleString()}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
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
