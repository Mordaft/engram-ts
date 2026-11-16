import type {
  CreateMemoryInput,
  MemoryDocument,
  MemoryHeader,
  MemoryRecord,
  MemoryRelationRecord,
} from '../types/memory';

export interface MemoryStore {
  create(input: CreateMemoryInput): Promise<MemoryHeader>;
  getHeader(id: string): Promise<MemoryHeader | undefined>;
  getDocument(id: string): Promise<MemoryDocument | undefined>;
  listHeaders(): Promise<MemoryHeader[]>;
  listRecords(): Promise<MemoryRecord[]>;
  listRelations(memoryId?: string): Promise<MemoryRelationRecord[]>;
  getMemoriesByEntity(entity: string, relation?: string, project?: string): Promise<MemoryHeader[]>;
  close(): void;
}
