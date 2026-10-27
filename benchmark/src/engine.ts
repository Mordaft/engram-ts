import { Engram } from 'engram-ts';
import {
  BENCHMARK_DB_NAME,
  bulkInsertBenchmarkData,
  clearBenchmarkDB,
  getDatabaseStats,
  searchDirectIndexedDB,
} from './database';
import { generateBenchmarkData } from './generator';
import type {
  BenchmarkDatasetSize,
  ProgressUpdate,
  SearchBenchmarkResult,
  SeedBenchmarkResult,
} from './types';

let activeEngram: Engram | null = null;
let currentDatasetSize = 0;

export function getActiveEngram(): Engram | null {
  return activeEngram;
}

export function getCurrentDatasetSize(): number {
  return currentDatasetSize;
}

/**
 * Prepares the database with `count` records (100, 1,000, 10,000, or 50,000):
 * 1. Clears previous benchmark database.
 * 2. Generates realistic synthetic benchmark records.
 * 3. Stores into IndexedDB in batches, measuring precise write time.
 * 4. Initializes Engram-ts to compile the Lunr.js in-memory inverted index.
 */
export async function seedBenchmark(
  count: BenchmarkDatasetSize,
  onProgress?: (update: ProgressUpdate) => void,
): Promise<SeedBenchmarkResult> {
  // 1. Clear database
  onProgress?.({
    stage: 'clearing',
    percent: 5,
    message: 'Clearing previous IndexedDB database...',
  });
  if (activeEngram) {
    activeEngram.close();
    activeEngram = null;
  }
  await clearBenchmarkDB();

  // 2. Generation
  onProgress?.({
    stage: 'generating',
    percent: 15,
    message: `Generating ${count.toLocaleString()} realistic records in memory...`,
  });
  await new Promise((resolve) => setTimeout(resolve, 20)); // Yield control
  const { headers, records } = generateBenchmarkData(count);

  // 3. Batch insertion into IndexedDB
  onProgress?.({
    stage: 'inserting',
    percent: 25,
    message: `Inserting ${count.toLocaleString()} records into IndexedDB...`,
    currentCount: 0,
    totalCount: count,
  });

  const insertDurationMs = await bulkInsertBenchmarkData(
    headers,
    records,
    2000,
    (completed, total) => {
      const pct = 25 + Math.round((completed / total) * 45);
      onProgress?.({
        stage: 'inserting',
        percent: pct,
        message: `Saving to IndexedDB: ${completed.toLocaleString()} / ${total.toLocaleString()} records (${Math.round((completed / total) * 100)}%)...`,
        currentCount: completed,
        totalCount: total,
      });
    },
  );

  // 4. Initialization and indexing with Engram-ts + Lunr.js
  onProgress?.({
    stage: 'indexing',
    percent: 75,
    message: 'Engram-ts: Reading IndexedDB and compiling Lunr.js inverted index in RAM...',
  });
  await new Promise((resolve) => setTimeout(resolve, 30));

  const tIndexStart = performance.now();
  activeEngram = new Engram({ databaseName: BENCHMARK_DB_NAME });
  // A search triggers the ready promise and full index initialization
  await activeEngram.search({ query: 'warmup', limit: 1 });
  const indexDurationMs = performance.now() - tIndexStart;

  currentDatasetSize = count;

  onProgress?.({
    stage: 'done',
    percent: 100,
    message: `Completed! ${count.toLocaleString()} records stored and indexed successfully.`,
  });

  return {
    count,
    insertDurationMs: Number(insertDurationMs.toFixed(1)),
    indexDurationMs: Number(indexDurationMs.toFixed(1)),
    totalDurationMs: Number((insertDurationMs + indexDurationMs).toFixed(1)),
  };
}

/**
 * Runs the search comparison for a given keyword query:
 * - Direct IndexedDB search (sequential table scan across records and headers via Dexie).
 * - Engram-ts search (in-memory inverted index via Lunr.js).
 */
export async function runSearchBenchmark(
  query: string,
  iterations = 3,
): Promise<SearchBenchmarkResult> {
  if (!activeEngram) {
    activeEngram = new Engram({ databaseName: BENCHMARK_DB_NAME });
    await activeEngram.search({ query: 'warmup', limit: 1 });
  }

  const stats = await getDatabaseStats();
  const totalRecords = stats.records;

  // Warm up V8 engine cache
  await searchDirectIndexedDB(query, 10);
  await activeEngram.search({ query, limit: 10 });

  // 1. Measure Direct IndexedDB search
  let idbDurationTotal = 0;
  let idbCount = 0;
  let idbSamples: Array<{ title: string; snippet?: string }> = [];

  for (let i = 0; i < iterations; i++) {
    const directRes = await searchDirectIndexedDB(query, 50);
    idbDurationTotal += directRes.durationMs;
    idbCount = directRes.count;
    idbSamples = directRes.samples;
  }
  const avgIdbMs = Number((idbDurationTotal / iterations).toFixed(2));

  // 2. Measure Engram-ts with Lunr.js search
  let lunrDurationTotal = 0;
  let lunrCount = 0;
  let lunrSamples: Array<{ title: string; score: number }> = [];

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const lunrRes = await activeEngram.search({ query, limit: 50 });
    const elapsed = performance.now() - t0;
    lunrDurationTotal += elapsed;
    lunrCount = lunrRes.length;
    lunrSamples = lunrRes.slice(0, 3).map((r) => ({
      title: r.header.title,
      score: Number(r.score.toFixed(3)),
    }));
  }
  const avgLunrMs = Number((lunrDurationTotal / iterations).toFixed(2));

  // Speedup multiplier calculation
  const safeLunr = Math.max(avgLunrMs, 0.05);
  const speedup = Number((avgIdbMs / safeLunr).toFixed(1));

  return {
    query,
    totalRecords,
    indexedDbTimeMs: avgIdbMs,
    lunrTimeMs: avgLunrMs,
    speedup,
    indexedDbMatches: idbCount,
    lunrMatches: lunrCount,
    indexedDbSample: idbSamples,
    lunrSample: lunrSamples,
    timestamp: new Date().toLocaleTimeString(),
  };
}
