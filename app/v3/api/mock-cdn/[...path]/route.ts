/**
 * Mock CDN File Server
 *
 * Mimics Cloudflare R2 public bucket URL behaviour.
 * Real R2:     https://pub-xxx.r2.dev/jce/2024/0282.json
 * Mock CDN:    http://localhost:3000/api/mock-cdn/jce/2024/0282.json
 *
 * GET  — serve a stored file (with realistic CDN headers)
 * PUT  — store a file (used by r2-client.ts in mock mode)
 * HEAD — check if a file exists
 *
 * CDN behaviour simulated:
 *   - Cache-Control headers
 *   - X-Cache: HIT / MISS (first request = MISS, subsequent = HIT)
 *   - CF-Ray header (fake, for realism)
 *   - Simulated edge latency (2-15ms) to mimic Cloudflare PoP
 *   - CORS headers so student portal can fetch cross-origin
 */

import { NextRequest, NextResponse } from 'next/server';
import { mockCDNStore } from '../store';

// Simulate Cloudflare edge latency (ms)
const EDGE_LATENCY_MIN = 2;
const EDGE_LATENCY_MAX = 15;

function simulateEdgeLatency(): Promise<void> {
  const ms = Math.floor(Math.random() * (EDGE_LATENCY_MAX - EDGE_LATENCY_MIN + 1)) + EDGE_LATENCY_MIN;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeCFRay(): string {
  return Math.random().toString(36).substring(2, 18).toUpperCase() + '-JNB'; // JNB = Johannesburg PoP
}

function buildCDNHeaders(obj: { cacheHits: number; cacheControl: string; contentType: string; size: number }) {
  const isHit = obj.cacheHits > 1; // First request is a MISS, rest are HITs
  return {
    'Content-Type': obj.contentType,
    'Cache-Control': obj.cacheControl,
    'X-Cache': isHit ? 'HIT' : 'MISS',
    'X-Cache-Status': isHit ? 'HIT' : 'MISS',
    'CF-Ray': fakeCFRay(),
    'CF-Cache-Status': isHit ? 'HIT' : 'MISS',
    'Content-Length': String(obj.size),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Mock-CDN': 'true', // Flag so you know it's the mock
  };
}

// ─── GET — serve file ─────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const key = path.join('/');

  await simulateEdgeLatency();

  const obj = mockCDNStore.get(key);

  if (!obj) {
    return new NextResponse(
      JSON.stringify({ error: 'NoSuchKey', message: `Object "${key}" not found` }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Mock-CDN': 'true',
          'CF-Ray': fakeCFRay(),
        },
      }
    );
  }

  return new NextResponse(obj.body, {
    status: 200,
    headers: buildCDNHeaders(obj),
  });
}

// ─── PUT — store file (used by mock r2-client) ────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const key = path.join('/');

  const body        = await request.text();
  const contentType = request.headers.get('Content-Type') || 'application/json';
  const cacheControl = request.headers.get('Cache-Control') || 'public, max-age=300';

  if (!body) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 });
  }

  const obj = mockCDNStore.put(key, body, contentType, cacheControl);

  return NextResponse.json(
    {
      success: true,
      key,
      size: obj.size,
      uploadedAt: obj.uploadedAt,
      publicUrl: `${request.nextUrl.origin}/api/mock-cdn/${key}`,
    },
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'X-Mock-CDN': 'true',
      },
    }
  );
}

// ─── HEAD — check existence ───────────────────────────────────────────────────

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const key = path.join('/');

  const obj = mockCDNStore.get(key);

  if (!obj) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: buildCDNHeaders(obj),
  });
}

// ─── OPTIONS — CORS preflight ─────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    },
  });
}
