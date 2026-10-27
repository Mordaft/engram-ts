import Dexie, { type Table } from 'dexie';
import type { MemoryHeader, MemoryRecord } from 'engram-ts';

export const BENCHMARK_DB_NAME = 'engram-benchmark-suite';

export class BenchmarkDB extends Dexie {
  headers!: Table<MemoryHeader, string>;
  records!: Table<MemoryRecord, string>;

  constructor(databaseName = BENCHMARK_DB_NAME) {
    super(databaseName);
    this.version(1).stores({
      headers: 'id, project, type, updatedAt',
      records: 'id, memoryId, createdAt, *tags',
    });
  }
}

export const benchmarkDb = new BenchmarkDB();

export async function clearBenchmarkDB(): Promise<void> {
  await benchmarkDb.transaction('rw', benchmarkDb.headers, benchmarkDb.records, async () => {
    await benchmarkDb.headers.clear();
    await benchmarkDb.records.clear();
  });
}

export async function getDatabaseStats(): Promise<{ headers: number; records: number }> {
  const [headers, records] = await Promise.all([
    benchmarkDb.headers.count(),
    benchmarkDb.records.count(),
  ]);
  return { headers, records };
}

/**
 * Inserts headers and records into IndexedDB in chunks of `chunkSize`
 * using bulkAdd, yielding to the event loop so UI does not freeze.
 */
export async function bulkInsertBenchmarkData(
  headers: MemoryHeader[],
  records: MemoryRecord[],
  chunkSize = 2000,
  onProgress?: (completed: number, total: number) => void,
): Promise<number> {
  const total = headers.length;
  const start = performance.now();

  for (let i = 0; i < total; i += chunkSize) {
    const chunkHeaders = headers.slice(i, i + chunkSize);
    const chunkRecords = records.slice(i, i + chunkSize);

    await benchmarkDb.transaction('rw', benchmarkDb.headers, benchmarkDb.records, async () => {
      await benchmarkDb.headers.bulkAdd(chunkHeaders);
      await benchmarkDb.records.bulkAdd(chunkRecords);
    });

    onProgress?.(Math.min(i + chunkSize, total), total);

    // Yield control so browser can paint progress bar and handle events
    if (i + chunkSize < total) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return performance.now() - start;
}

/**
 * Realiza una búsqueda directa por palabra clave en IndexedDB mediante un escaneo
 * completo de tablas (table scan / cursor) en `records` y `headers`, sin índice invertido.
 * Mide el tiempo exacto de ejecución con `performance.now()`.
 */
export async function searchDirectIndexedDB(
  query: string,
  limit = 50,
): Promise<{
  count: number;
  durationMs: number;
  samples: Array<{ title: string; snippet?: string }>;
}> {
  const term = query.trim().toLowerCase();
  const start = performance.now();

  if (!term) {
    const headers = await benchmarkDb.headers.limit(limit).toArray();
    const count = await benchmarkDb.headers.count();
    return {
      count,
      durationMs: performance.now() - start,
      samples: headers.slice(0, 3).map((h) => ({ title: h.title })),
    };
  }

  const matchingMemoryIds = new Set<string>();
  const sampleList: Array<{ title: string; snippet?: string }> = [];

  // Escaneo secuencial directo en la tabla de records de IndexedDB:
  // Lee cada objeto de disco, lo deserializa y evalúa subcadenas.
  await benchmarkDb.records
    .filter((record) => {
      const inTitle = record.title.toLowerCase().includes(term);
      if (inTitle) return true;
      const inContent = record.content.toLowerCase().includes(term);
      if (inContent) return true;
      const inTags = record.tags.some((t) => t.toLowerCase().includes(term));
      return inTags;
    })
    .each((record) => {
      matchingMemoryIds.add(record.memoryId);
      if (sampleList.length < 3) {
        sampleList.push({
          title: record.title,
          snippet: record.content.slice(0, 110) + '...',
        });
      }
    });

  // Escaneo secuencial en la tabla headers
  await benchmarkDb.headers
    .filter((header) => {
      const inTitle = header.title.toLowerCase().includes(term);
      if (inTitle) return true;
      const inType = header.type.toLowerCase().includes(term);
      if (inType) return true;
      const inTags = header.tags.some((t) => t.toLowerCase().includes(term));
      return inTags;
    })
    .each((header) => {
      matchingMemoryIds.add(header.id);
      if (sampleList.length < 3) {
        sampleList.push({ title: header.title });
      }
    });

  const durationMs = performance.now() - start;

  return {
    count: matchingMemoryIds.size,
    durationMs,
    samples: sampleList.slice(0, 3),
  };
}
