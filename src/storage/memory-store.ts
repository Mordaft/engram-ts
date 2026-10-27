import type {
  CreateMemoryInput,
  MemoryDocument,
  MemoryHeader,
  MemoryRecord,
} from '../types/memory';

export interface MemoryStore {
  create(input: CreateMemoryInput): Promise<MemoryHeader>;
  getHeader(id: string): Promise<MemoryHeader | undefined>;
  getDocument(id: string): Promise<MemoryDocument | undefined>;
  listHeaders(): Promise<MemoryHeader[]>;
  listRecords(): Promise<MemoryRecord[]>;
  close(): void;
}