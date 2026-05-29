/**
 * Cloudflare R2 Client
 * Uploads school result files to real Cloudflare R2 via S3-compatible API.
 *
 * Required environment variables:
 *   R2_ACCOUNT_ID        - Cloudflare account ID
 *   R2_ACCESS_KEY_ID     - R2 API token access key
 *   R2_SECRET_ACCESS_KEY - R2 API token secret key
 *   R2_BUCKET_NAME       - e.g. "maneb-results"
 *   R2_PUBLIC_URL        - e.g. "https://pub-xxx.r2.dev"
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { V3SchoolFile, V3UploadRecord } from './v3-types';

function getR2Client(): S3Client {
  const accountId      = process.env.R2_ACCOUNT_ID;
  const accessKeyId    = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.local'
    );
  }

  return new S3Client({
    region:   'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Upload a school file to R2.
 * Path: jce/{examYear}/{centre}.json
 * Returns the public CDN URL.
 */
export async function uploadSchoolFileToR2(
  schoolFile: V3SchoolFile,
  examYear: string,
  examType: string = 'jce'
): Promise<string> {
  const bucket    = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucket || !publicUrl) {
    throw new Error('Missing R2_BUCKET_NAME or R2_PUBLIC_URL in environment variables');
  }

  // Path: {examType}/{examYear}/{centre}.json
  // e.g. msce/2025/0282.json
  const folder = examType.toLowerCase();
  const key    = `${folder}/${examYear}/${schoolFile.centre}.json`;
  const body   = JSON.stringify(schoolFile);

  await getR2Client().send(
    new PutObjectCommand({
      Bucket:       bucket,
      Key:          key,
      Body:         body,
      ContentType:  'application/json',
      CacheControl: 'public, max-age=300',
    })
  );

  return `${publicUrl}/${key}`;
}

/**
 * Append an upload record to the log file on R2.
 * The V3 metrics dashboard reads this to show publish history.
 */
export async function appendToUploadLog(record: V3UploadRecord): Promise<void> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME!;
  const folder = record.examType.toLowerCase();
  const logKey = `${folder}/uploads-log.json`;

  let existing: V3UploadRecord[] = [];

  try {
    const res  = await client.send(new GetObjectCommand({ Bucket: bucket, Key: logKey }));
    const body = await res.Body?.transformToString();
    if (body) existing = JSON.parse(body);
  } catch {
    existing = [];
  }

  const idx = existing.findIndex(
    r => r.centre === record.centre && r.examYear === record.examYear
  );
  if (idx >= 0) existing[idx] = record;
  else existing.push(record);

  await client.send(
    new PutObjectCommand({
      Bucket:      bucket,
      Key:         logKey,
      Body:        JSON.stringify(existing),
      ContentType: 'application/json',
      CacheControl: 'no-cache',
    })
  );
}

/**
 * Fetch the upload log from R2 for the metrics dashboard.
 */
export async function getUploadLog(): Promise<V3UploadRecord[]> {
  try {
    const client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;
    const res    = await client.send(new GetObjectCommand({ Bucket: bucket, Key: 'jce/uploads-log.json' }));
    const body   = await res.Body?.transformToString();
    return body ? JSON.parse(body) : [];
  } catch {
    return [];
  }
}

/**
 * Returns the public CDN base URL.
 */
export function getCDNBaseUrl(): string {
  return process.env.R2_PUBLIC_URL || '';
}
