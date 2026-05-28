/**
 * Mock CDN — Bucket Stats & Listing
 *
 * GET  /api/mock-cdn        — list all stored objects + stats
 * DELETE /api/mock-cdn      — clear all stored objects (for test resets)
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockCDNStore } from '../store';

export async function GET(request: NextRequest) {
  const stats = mockCDNStore.stats();
  const origin = request.nextUrl.origin;

  return NextResponse.json({
    mockCDN: true,
    description: 'Local mock of Cloudflare R2 public bucket',
    endpoint: `${origin}/api/mock-cdn`,
    stats: {
      objectCount: stats.objectCount,
      totalBytes: stats.totalBytes,
      totalCacheHits: stats.totalCacheHits,
    },
    objects: stats.objects.map((o) => ({
      ...o,
      publicUrl: `${origin}/api/mock-cdn/${o.key}`,
    })),
  });
}

export async function DELETE(request: NextRequest) {
  const before = mockCDNStore.count();
  mockCDNStore.list().forEach((o) => mockCDNStore.delete(o.key));

  return NextResponse.json({
    success: true,
    message: `Cleared ${before} object(s) from mock CDN`,
  });
}
