import Dexie, { type Table } from 'dexie';
import type { MemoryHeader, MemoryRecord, MemoryRelationRecord } from 'engram-ts';

export const BENCHMARK_DB_NAME = 'engram-benchmark-suite';

export class BenchmarkDB extends Dexie {
  headers!: Table<MemoryHeader, string>;
  records!: Table<MemoryRecord, string>;
  relations!: Table<MemoryRelationRecord, string>;

  constructor(databaseName = BENCHMARK_DB_NAME) {
    super(databaseName);
    this.version(1).stores({
      headers: 'id, project, type, updatedAt',
      records: 'id, memoryId, createdAt, *tags',
    });
    this.version(2).stores({
      headers: 'id, project, type, updatedAt',
      records: 'id, memoryId, createdAt, *tags',
      relations: 'id, memoryId, entity, relation, project, [entity+relation], [project+entity]',
    });
  }
}

export const benchmarkDb = new BenchmarkDB();

export async function clearBenchmarkDB(): Promise<void> {
  await benchmarkDb.transaction('rw', benchmarkDb.headers, benchmarkDb.records, benchmarkDb.relations, async () => {
    await benchmarkDb.headers.clear();
    await benchmarkDb.records.clear();
    await benchmarkDb.relations.clear();
  });
}

export async function getDatabaseStats(): Promise<{ headers: number; records: number; relations: number }> {
  const [headers, records, relations] = await Promise.all([
    benchmarkDb.headers.count(),
    benchmarkDb.records.count(),
    benchmarkDb.relations.count(),
  ]);
  return { headers, records, relations };
}

/**
 * Inserts headers, records, and relations into IndexedDB in chunks of `chunkSize`
 * using bulkAdd, yielding to the event loop so UI does not freeze.
 */
export async function bulkInsertBenchmarkData(
  headers: MemoryHeader[],
  records: MemoryRecord[],
  relations: MemoryRelationRecord[] = [],
  chunkSize = 2000,
  onProgress?: (completed: number, total: number) => void,
): Promise<number> {
  const total = headers.length;
  const start = performance.now();

  for (let i = 0; i < total; i += chunkSize) {
    const chunkHeaders = headers.slice(i, i + chunkSize);
    const chunkRecords = records.slice(i, i + chunkSize);
    const chunkRelations = relations.slice(i, i + chunkSize);

    await benchmarkDb.transaction('rw', benchmarkDb.headers, benchmarkDb.records, benchmarkDb.relations, async () => {
      await benchmarkDb.headers.bulkAdd(chunkHeaders);
      await benchmarkDb.records.bulkAdd(chunkRecords);
      if (chunkRelations.length > 0) {
        await benchmarkDb.relations.bulkAdd(chunkRelations);
      }
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
 * Performs a direct keyword or entity search on IndexedDB via a full table scan
 * (cursor/filter) across `records` and `headers` without an inverted index.
 * Measures exact execution duration with `performance.now()`.
 */
export async function searchDirectIndexedDB(
  query: string,
  limit = 50,
): Promise<{
  count: number;
  durationMs: number;
  samples: Array<{ title: string; snippet?: string }>;
}> {
  let term = query.trim();
  let filterEntity: string | undefined;
  let filterRelation: string | undefined;

  const entMatch = term.match(/entity:([^\s]+)/i);
  if (entMatch) {
    filterEntity = entMatch[1].toLowerCase();
    term = term.replace(entMatch[0], '').trim();
  }
  const relMatch = term.match(/rel(?:ation)?:([^\s]+)/i);
  if (relMatch) {
    filterRelation = relMatch[1].toLowerCase();
    term = term.replace(relMatch[0], '').trim();
  }
  term = term.toLowerCase();

  const start = performance.now();

  // If searching purely by entity via unindexed full scan of headers:
  if (filterEntity && !term) {
    const matchingHeaders: MemoryHeader[] = [];
    await benchmarkDb.headers
      .filter((h) =>
        (h.entities ?? []).some(
          (e) =>
            e.entity.toLowerCase() === filterEntity &&
            (!filterRelation || e.relation.toLowerCase() === filterRelation),
        ),
      )
      .each((h) => {
        matchingHeaders.push(h);
      });

    const durationMs = performance.now() - start;
    return {
      count: matchingHeaders.length,
      durationMs,
      samples: matchingHeaders.slice(0, 3).map((h) => ({ title: h.title })),
    };
  }

  if (!term && !filterEntity) {
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

  // Direct sequential scan in IndexedDB records table:
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

  // Sequential scan in headers table
  await benchmarkDb.headers
    .filter((header) => {
      if (filterEntity) {
        const matchesEntity = (header.entities ?? []).some(
          (e) =>
            e.entity.toLowerCase() === filterEntity &&
            (!filterRelation || e.relation.toLowerCase() === filterRelation),
        );
        if (!matchesEntity) return false;
      }
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
