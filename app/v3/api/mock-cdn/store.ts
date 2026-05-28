/**
 * Mock CDN In-Memory Store
 *
 * Simulates Cloudflare R2 bucket storage for local development and testing.
 * Files are stored in a module-level Map so they persist across requests
 * within the same Next.js server process.
 *
 * Structure mirrors R2:
 *   key   = "jce/2024/0282.json"
 *   value = { body, contentType, uploadedAt, size, cacheControl }
 */

export interface MockCDNObject {
  key: string;
  body: string;
  contentType: string;
  cacheControl: string;
  uploadedAt: string;
  size: number;
  /** Simulated CDN cache state */
  cacheHits: number;
}

// Module-level store — persists for the lifetime of the dev server process
const store = new Map<string, MockCDNObject>();

export const mockCDNStore = {
  /**
   * Store a file — equivalent to PutObjectCommand
   */
  put(key: string, body: string, contentType = 'application/json', cacheControl = 'public, max-age=300'): MockCDNObject {
    const obj: MockCDNObject = {
      key,
      body,
      contentType,
      cacheControl,
      uploadedAt: new Date().toISOString(),
      size: Buffer.byteLength(body, 'utf8'),
      cacheHits: 0,
    };
    store.set(key, obj);
    return obj;
  },

  /**
   * Retrieve a file — equivalent to GetObjectCommand / public fetch
   */
  get(key: string): MockCDNObject | null {
    const obj = store.get(key);
    if (!obj) return null;
    // Increment cache hit counter to simulate CDN analytics
    obj.cacheHits++;
    return obj;
  },

  /**
   * List all stored objects
   */
  list(): MockCDNObject[] {
    return Array.from(store.values());
  },

  /**
   * Delete a file
   */
  delete(key: string): boolean {
    return store.delete(key);
  },

  /**
   * Check if a file exists
   */
  has(key: string): boolean {
    return store.has(key);
  },

  /**
   * Total number of stored objects
   */
  count(): number {
    return store.size;
  },

  /**
   * Total bytes stored
   */
  totalBytes(): number {
    let total = 0;
    for (const obj of store.values()) total += obj.size;
    return total;
  },

  /**
   * Stats for the metrics dashboard
   */
  stats() {
    const objects = Array.from(store.values());
    const totalRequests = objects.reduce((sum, o) => sum + o.cacheHits, 0);
    return {
      objectCount: store.size,
      totalBytes: this.totalBytes(),
      totalCacheHits: totalRequests,
      objects: objects.map((o) => ({
        key: o.key,
        size: o.size,
        uploadedAt: o.uploadedAt,
        cacheHits: o.cacheHits,
      })),
    };
  },
};
