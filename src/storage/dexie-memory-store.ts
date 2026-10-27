import Dexie, { type Table } from 'dexie';
import type {
  CreateMemoryInput,
  MemoryDocument,
  MemoryHeader,
  MemoryRecord,
} from '../types/memory';
import type { MemoryStore } from './memory-store';

class MemoryDatabase extends Dexie {
  headers!: Table<MemoryHeader, string>;
  records!: Table<MemoryRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      headers: 'id, project, type, updatedAt',
      records: 'id, memoryId, createdAt, *tags',
    });
  }
}

export class DexieMemoryStore implements MemoryStore {
  private readonly database: MemoryDatabase;

  constructor(databaseName = 'engram-ts') {
    this.database = new MemoryDatabase(databaseName);
  }

  async create(input: CreateMemoryInput): Promise<MemoryHeader> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const header: MemoryHeader = {
      id,
      title: input.title.trim(),
      type: input.type.trim(),
      project: input.project.trim(),
      tags: [...(input.tags ?? [])],
      recordCount: input.records.length,
      createdAt: now,
      updatedAt: now,
    };
    const records: MemoryRecord[] = input.records.map((record) => ({
      ...record,
      id: crypto.randomUUID(),
      memoryId: id,
      tags: [...(record.tags ?? [])],
      createdAt: record.createdAt ?? now,
    }));

    await this.database.transaction('rw', this.database.headers, this.database.records, async () => {
      await this.database.headers.add(header);
      await this.database.records.bulkAdd(records);
    });

    return header;
  }

  getHeader(id: string): Promise<MemoryHeader | undefined> {
    return this.database.headers.get(id);
  }

  async getDocument(id: string): Promise<MemoryDocument | undefined> {
    const [header, records] = await Promise.all([
      this.database.headers.get(id),
      this.database.records.where('memoryId').equals(id).sortBy('createdAt'),
    ]);
    return header ? { header, records } : undefined;
  }

  listHeaders(): Promise<MemoryHeader[]> {
    return this.database.headers.orderBy('updatedAt').reverse().toArray();
  }

  listRecords(): Promise<MemoryRecord[]> {
    return this.database.records.toArray();
  }

  close(): void {
    this.database.close();
  }
}