export type BenchmarkDatasetSize = 100 | 1000 | 10000 | 50000;

export interface SearchBenchmarkResult {
  query: string;
  totalRecords: number;
  indexedDbTimeMs: number;
  lunrTimeMs: number;
  speedup: number;
  indexedDbMatches: number;
  lunrMatches: number;
  indexedDbSample: Array<{ title: string; snippet?: string }>;
  lunrSample: Array<{ title: string; score: number }>;
  timestamp: string;
}

export interface SeedBenchmarkResult {
  count: number;
  insertDurationMs: number;
  indexDurationMs: number;
  totalDurationMs: number;
}

export interface ComparisonHistoryEntry {
  records: number;
  insertMs: number;
  indexMs: number;
  query: string;
  directIdbMs: number;
  lunrMs: number;
  speedup: number;
  matches: number;
  timestamp: string;
}

export interface ProgressUpdate {
  stage: 'idle' | 'generating' | 'inserting' | 'indexing' | 'searching' | 'done' | 'clearing';
  percent: number;
  message: string;
  currentCount?: number;
  totalCount?: number;
}
