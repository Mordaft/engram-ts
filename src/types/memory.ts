export interface MemoryRecordInput {
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
}

export interface CreateMemoryInput {
  title: string;
  type: string;
  project: string;
  tags?: string[];
  records: MemoryRecordInput[];
}

export interface MemoryHeader {
  id: string;
  title: string;
  type: string;
  project: string;
  tags: string[];
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRecord extends MemoryRecordInput {
  id: string;
  memoryId: string;
  tags: string[];
  createdAt: string;
}

export interface MemoryDocument {
  header: MemoryHeader;
  records: MemoryRecord[];
}

export interface SearchMemoriesOptions {
  query: string;
  project?: string;
  limit?: number;
}

export interface MemorySearchResult {
  header: MemoryHeader;
  score: number;
}