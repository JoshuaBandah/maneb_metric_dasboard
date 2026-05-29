/**
 * Cloudflare R2 Analytics — Real metrics from Cloudflare GraphQL API
 *
 * Queries:
 *   1. r2OperationsAdaptiveGroups — request counts by action type (reads/writes)
 *   2. r2StorageAdaptiveGroups    — storage size, object count
 *
 * GET /v3/api/cloudflare
 */

import { NextRequest, NextResponse } from 'next/server';

const CF_API_TOKEN  = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const BUCKET_NAME   = process.env.R2_BUCKET_NAME || 'maneb-results';

async function cfGraphQL(query: string, variables: Record<string, string>) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(8000),
  });
  return res.json();
}

export async function GET(request: NextRequest) {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    return NextResponse.json(
      { error: 'Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID' },
      { status: 500 }
    );
  }

  try {
    const now   = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const startDate = since.toISOString();
    const endDate   = now.toISOString();

    // ── Query 1: Operations (reads + writes) ──────────────────────────────────
    const opsQuery = `
      query R2Operations($accountTag: string!, $startDate: Time, $endDate: Time, $bucketName: string) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            r2OperationsAdaptiveGroups(
              limit: 10000
              filter: {
                datetime_geq: $startDate
                datetime_leq: $endDate
                bucketName: $bucketName
              }
            ) {
              sum { requests }
              dimensions { actionType }
            }
          }
        }
      }
    `;

    // ── Query 2: Storage ──────────────────────────────────────────────────────
    const storageQuery = `
      query R2Storage($accountTag: string!, $startDate: Time, $endDate: Time, $bucketName: string) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            r2StorageAdaptiveGroups(
              limit: 1
              filter: {
                datetime_geq: $startDate
                datetime_leq: $endDate
                bucketName: $bucketName
              }
            ) {
              max {
                objectCount
                payloadSize
                metadataSize
              }
            }
          }
        }
      }
    `;

    const vars = {
      accountTag:  CF_ACCOUNT_ID,
      startDate,
      endDate,
      bucketName:  BUCKET_NAME,
    };

    const [opsData, storageData] = await Promise.all([
      cfGraphQL(opsQuery, vars),
      cfGraphQL(storageQuery, vars),
    ]);

    // Parse operations — group by actionType
    const opsGroups = opsData?.data?.viewer?.accounts?.[0]?.r2OperationsAdaptiveGroups ?? [];
    const opsSummary: Record<string, number> = {};
    let totalRequests = 0;

    for (const group of opsGroups) {
      const action = group.dimensions?.actionType ?? 'unknown';
      const count  = group.sum?.requests ?? 0;
      opsSummary[action] = (opsSummary[action] ?? 0) + count;
      totalRequests += count;
    }

    // Parse storage
    const storageGroups = storageData?.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups ?? [];
    const storage = storageGroups[0]?.max ?? null;

    // Classify reads vs writes
    const READ_ACTIONS  = ['GetObject', 'HeadObject', 'ListObjects', 'ListObjectsV2', 'ListBuckets'];
    const WRITE_ACTIONS = ['PutObject', 'DeleteObject', 'CreateMultipartUpload', 'UploadPart', 'CompleteMultipartUpload'];

    let readOps  = 0;
    let writeOps = 0;

    for (const [action, count] of Object.entries(opsSummary)) {
      if (READ_ACTIONS.some(r => action.includes(r)))  readOps  += count;
      if (WRITE_ACTIONS.some(w => action.includes(w))) writeOps += count;
    }

    return NextResponse.json({
      success:    true,
      timestamp:  new Date().toISOString(),
      period:     '24h',
      bucket:     BUCKET_NAME,
      operations: {
        total:      totalRequests,
        reads:      readOps,
        writes:     writeOps,
        breakdown:  opsSummary,
      },
      storage: storage
        ? {
            objectCount:  storage.objectCount  ?? 0,
            payloadBytes: storage.payloadSize   ?? 0,
            payloadKB:    Math.round((storage.payloadSize ?? 0) / 1024),
          }
        : null,
      errors: {
        ops:     opsData?.errors     ?? null,
        storage: storageData?.errors ?? null,
      },
    });
  } catch (err) {
    console.error('[Cloudflare Analytics]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch Cloudflare analytics' },
      { status: 500 }
    );
  }
}
