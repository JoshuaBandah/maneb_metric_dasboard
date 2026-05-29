'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './portal.module.css';

type Version     = 'v1' | 'v3';
type PortalState = 'search' | 'loading' | 'result' | 'error';

interface Subject { name: string; grade: string; }
interface Student {
  name: string;
  regNumber: string;
  dob: string;
  school?: string;
  subjects: Subject[];
}
interface SearchResult {
  success: boolean;
  data?: Student;
  error?: string;
  responseTime?: number;
  source?: string;
  fetchMs?: number;
  lookupMs?: number;
}

export default function StudentPortal() {
  // Version is set by the admin dashboard switch — invisible to students
  const [version, setVersion] = useState<Version>('v3');
  const [examNumber, setExamNumber] = useState('');
  const [dob, setDob]               = useState('');
  const [state, setState]           = useState<PortalState>('search');
  const [result, setResult]         = useState<Student | null>(null);
  const [searchMeta, setSearchMeta] = useState<Partial<SearchResult>>({});
  const [errorMsg, setErrorMsg]     = useState('');

  const EXAM_YEAR = process.env.NEXT_PUBLIC_EXAM_YEAR || '2024';

  // Always V3 — portal is V3 focused
  useEffect(() => {
    localStorage.setItem('maneb_portal_version', 'v3');
    setVersion('v3');
  }, []);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');
    setResult(null);
    setSearchMeta({});

    const exam   = examNumber.trim().toUpperCase();
    const dobVal = dob.trim();

    try {
      const endpoint = version === 'v1' ? '/v1/api/search' : '/v3/api/search';

      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ examNumber: exam, dob: dobVal, examYear: EXAM_YEAR }),
      });

      const data: SearchResult = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'No results found. Please check your details.');
        setSearchMeta(data);
        setState('error');
        return;
      }

      setResult(data.data!);
      setSearchMeta(data);
      setState('result');
    } catch {
      setErrorMsg('Unable to connect. Please check your internet connection.');
      setState('error');
    }
  }

  function handleReset() {
    setState('search');
    setResult(null);
    setErrorMsg('');
    setExamNumber('');
    setDob('');
    setSearchMeta({});
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <Image
            src="/maneb.png"
            alt="MANEB Logo"
            width={80}
            height={80}
            className={styles.logo}
            priority
          />
          <h1 className={styles.title}>Malawi National Examinations Board</h1>
          <p className={styles.subtitle}>Examination Results Portal</p>
          <p className={styles.hint}>&quot;Enter exam number and date of birth&quot;</p>
        </div>

        {/* ── Search form ── */}
        {(state === 'search' || state === 'error') && (
          <form onSubmit={handleSearch} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="examNumber" className={styles.label}>Student Number</label>
              <input
                id="examNumber"
                type="text"
                value={examNumber}
                onChange={e => setExamNumber(e.target.value)}
                placeholder="e.g. J0282/001"
                className={styles.input}
                required
                autoComplete="off"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="dob" className={styles.label}>Date of Birth</label>
              <input
                id="dob"
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                className={styles.input}
                required
              />
            </div>

            {state === 'error' && (
              <div className={styles.errorBox}>{errorMsg}</div>
            )}

            <button type="submit" className={styles.button}>
              View Results
            </button>
          </form>
        )}

        {/* ── Loading ── */}
        {state === 'loading' && (
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <p>Please wait...</p>
          </div>
        )}

        {/* ── Result ── */}
        {state === 'result' && result && (
          <div className={styles.resultBox}>
            <div className={styles.resultHeader}>
              <div className={styles.resultBadge}>✓ Results Found</div>
              <p className={styles.fetchTime}>
                Loaded in {searchMeta.responseTime}ms
              </p>
            </div>

            <div className={styles.studentInfo}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Name</span>
                <span className={styles.infoValue}>{result.name}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Exam Number</span>
                <span className={styles.infoValue}>{result.regNumber}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Date of Birth</span>
                <span className={styles.infoValue}>{result.dob}</span>
              </div>
              {result.school && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>School</span>
                  <span className={styles.infoValue}>{result.school}</span>
                </div>
              )}
            </div>

            <h3 className={styles.subjectsTitle}>Subject Results</h3>
            <table className={styles.subjectsTable}>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {result.subjects.map((s, i) => (
                  <tr key={i} className={gradeRowClass(s.grade)}>
                    <td>{s.name}</td>
                    <td className={styles.grade}>{s.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={handleReset} className={styles.resetButton}>
              Search Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function gradeRowClass(grade: string): string {
  if (grade === 'A') return styles.gradeA;
  if (grade === 'B') return styles.gradeB;
  if (grade === 'C') return styles.gradeC;
  if (grade === 'D') return styles.gradeD;
  return styles.gradeF;
}
