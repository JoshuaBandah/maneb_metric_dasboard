/**
 * Cloudflare R2 Client
 * Uses the S3-compatible API to upload school result files.
 *
 * Required environment variables (server-side only, no NEXT_PUBLIC_ prefix):
 *   R2_ACCOUNT_ID        - Cloudflare account ID
 *   R2_ACCESS_KEY_ID     - R2 API token access key
 *   R2_SECRET_ACCESS_KEY - R2 API token secret key
 *   R2_BUCKET_NAME       - e.g. "maneb-results"
 *   R2_PUBLIC_URL        - e.g. "https://pub-xxx.r2.dev"
 *
 * Mock mode (no credentials needed):
 *   Set R2_PUBLIC_URL=http://localhost:3000/api/mock-cdn
 *   Leave R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY empty.
 *   The mock CDN at /api/mock-cdn will be used instead of real R2.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { V3SchoolFile, V3UploadRecord } from './v3-types';

/**
 * Returns true when R2 credentials are not configured —
 * meaning we should fall back to the local mock CDN.
 */
function isMockMode(): boolean {
  return (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  );
}

/**
 * Base URL for the mock CDN (used when isMockMode() is true).
 * Defaults to localhost:3000 but respects NEXT_PUBLIC_API_URL.
 */
function getMockBaseUrl(): string {
  // Standalone CDN server runs on port 4000
  return process.env.CDN_SERVER_URL || 'http://localhost:4000';
}

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// ─── Mock CDN helpers ─────────────────────────────────────────────────────────

async function mockPut(key: string, body: string, contentType: string, cacheControl: string): Promise<void> {
  const url = `${getMockBaseUrl()}/${key}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Cache-Control': cacheControl },
    body,
  });
  if (!res.ok) {
    throw new Error(`Mock CDN PUT failed for key "${key}": ${res.statusText}`);
  }
}

async function mockGet(key: string): Promise<string | null> {
  const url = `${getMockBaseUrl()}/${key}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mock CDN GET failed for key "${key}": ${res.statusText}`);
  return res.text();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Upload a school file to R2 (or mock CDN).
 * Path: jce/{examYear}/{centre}.json
 * Returns the public URL of the uploaded file.
 */
export async function uploadSchoolFileToR2(
  schoolFile: V3SchoolFile,
  examYear: string
): Promise<string> {
  const key = `jce/${examYear}/${schoolFile.centre}.json`;
  const body = JSON.stringify(schoolFile);
  const contentType = 'application/json';
  const cacheControl = 'public, max-age=300';

  if (isMockMode()) {
    // ── Mock CDN path ──
    await mockPut(key, body, contentType, cacheControl);
    const publicUrl = `${getMockBaseUrl()}/${key}`;
    console.log(`[Mock CDN] Uploaded ${key} (${Buffer.byteLength(body)} bytes) → ${publicUrl}`);
    return publicUrl;
  }

  // ── Real R2 path ──
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucket || !publicUrl) {
    throw new Error('Missing R2_BUCKET_NAME or R2_PUBLIC_URL in environment variables');
  }

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );

  return `${publicUrl}/${key}`;
}

/**
 * Append an upload record to the log file (jce/uploads-log.json).
 * This is what the V3 metrics dashboard reads.
 */
export async function appendToUploadLog(record: V3UploadRecord): Promise<void> {
  const logKey = 'jce/uploads-log.json';

  let existing: V3UploadRecord[] = [];

  if (isMockMode()) {
    // ── Mock CDN path ──
    const raw = await mockGet(logKey);
    if (raw) {
      try { existing = JSON.parse(raw); } catch { existing = []; }
    }

    const idx = existing.findIndex(
      (r) => r.centre === record.centre && r.examYear === record.examYear
    );
    if (idx >= 0) existing[idx] = record;
    else existing.push(record);

    await mockPut(logKey, JSON.stringify(existing), 'application/json', 'no-cache');
    return;
  }

  // ── Real R2 path ──
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME!;

  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: logKey }));
    const body = await response.Body?.transformToString();
    if (body) existing = JSON.parse(body);
  } catch {
    existing = [];
  }

  const idx = existing.findIndex(
    (r) => r.centre === record.centre && r.examYear === record.examYear
  );
  if (idx >= 0) existing[idx] = record;
  else existing.push(record);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: logKey,
      Body: JSON.stringify(existing),
      ContentType: 'application/json',
      CacheControl: 'no-cache',
    })
  );
}

/**
 * Fetch the upload log for the metrics dashboard.
 */
export async function getUploadLog(): Promise<V3UploadRecord[]> {
  const logKey = 'jce/uploads-log.json';

  if (isMockMode()) {
    const raw = await mockGet(logKey);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  // ── Real R2 path ──
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME!;

  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: logKey }));
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : [];
  } catch {
    return [];
  }
}

/**
 * Returns the base public URL for CDN files.
 * Used by the student portal to know where to fetch school files from.
 */
export function getCDNBaseUrl(): string {
  if (isMockMode()) return getMockBaseUrl();
  return process.env.R2_PUBLIC_URL || getMockBaseUrl();
}
