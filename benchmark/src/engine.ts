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
 * Prepara la base de datos con `count` registros (100, 1.000, 10.000 o 50.000):
 * 1. Limpia la base de datos de benchmark.
 * 2. Genera los registros de prueba sintéticos y realistas.
 * 3. Almacena en la tabla de IndexedDB en lotes (batching) midiendo el tiempo exacto.
 * 4. Inicializa Engram-ts para que compile el índice invertido de Lunr.js en memoria.
 */
export async function seedBenchmark(
  count: BenchmarkDatasetSize,
  onProgress?: (update: ProgressUpdate) => void,
): Promise<SeedBenchmarkResult> {
  // 1. Limpieza
  onProgress?.({
    stage: 'clearing',
    percent: 5,
    message: 'Limpiando base de datos IndexedDB anterior...',
  });
  if (activeEngram) {
    activeEngram.close();
    activeEngram = null;
  }
  await clearBenchmarkDB();

  // 2. Generación
  onProgress?.({
    stage: 'generating',
    percent: 15,
    message: `Generando ${count.toLocaleString()} registros realistas en memoria...`,
  });
  await new Promise((resolve) => setTimeout(resolve, 20)); // Cede control
  const { headers, records } = generateBenchmarkData(count);

  // 3. Inserción por lotes en IndexedDB
  onProgress?.({
    stage: 'inserting',
    percent: 25,
    message: `Insertando ${count.toLocaleString()} registros en IndexedDB...`,
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
        message: `Guardando en IndexedDB: ${completed.toLocaleString()} / ${total.toLocaleString()} registros (${Math.round((completed / total) * 100)}%)...`,
        currentCount: completed,
        totalCount: total,
      });
    },
  );

  // 4. Inicialización e indexación con Engram-ts + Lunr.js
  onProgress?.({
    stage: 'indexing',
    percent: 75,
    message: 'Engram-ts: Leyendo IndexedDB y compilando índice invertido Lunr.js en memoria RAM...',
  });
  await new Promise((resolve) => setTimeout(resolve, 30));

  const tIndexStart = performance.now();
  activeEngram = new Engram({ databaseName: BENCHMARK_DB_NAME });
  // Un search activa la promesa de ready e inicialización completa del índice Lunr
  await activeEngram.search({ query: 'warmup', limit: 1 });
  const indexDurationMs = performance.now() - tIndexStart;

  currentDatasetSize = count;

  onProgress?.({
    stage: 'done',
    percent: 100,
    message: `¡Completado! ${count.toLocaleString()} registros almacenados e indexados con éxito.`,
  });

  return {
    count,
    insertDurationMs: Number(insertDurationMs.toFixed(1)),
    indexDurationMs: Number(indexDurationMs.toFixed(1)),
    totalDurationMs: Number((insertDurationMs + indexDurationMs).toFixed(1)),
  };
}

/**
 * Ejecuta la comparativa de búsqueda por palabra:
 * - Búsqueda Directa en IndexedDB (escaneo secuencial tabla por tabla con Dexie).
 * - Búsqueda en Engram-ts (índice invertido Lunr.js en memoria RAM).
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

  // Calentamiento preliminar de caché del motor V8
  await searchDirectIndexedDB(query, 10);
  await activeEngram.search({ query, limit: 10 });

  // 1. Medición de Búsqueda Directa en la tabla de IndexedDB
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

  // 2. Medición de Búsqueda usando Engram-ts con Lunr.js
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

  // Cálculo de factor de aceleración (Speedup)
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
