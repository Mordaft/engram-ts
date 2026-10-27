import { DexieMemoryStore } from './storage/dexie-memory-store';
import type { MemoryStore } from './storage/memory-store';
import { LunrMemoryIndex } from './search/lunr-memory-index';
import type {
  CreateMemoryInput,
  MemoryDocument,
  MemoryHeader,
  MemorySearchResult,
  SearchMemoriesOptions,
} from './types/memory';

export interface EngramOptions {
  databaseName?: string;
  store?: MemoryStore;
}

export class Engram {
  private readonly store: MemoryStore;
  private readonly searchIndex: LunrMemoryIndex;
  private readonly ready: Promise<void>;

  constructor(options: EngramOptions = {}) {
    this.store = options.store ?? new DexieMemoryStore(options.databaseName);
    this.searchIndex = new LunrMemoryIndex(this.store);
    this.ready = this.searchIndex.initialize();
  }

  async save(input: CreateMemoryInput): Promise<MemoryHeader> {
    const title = input.title.trim();
    const type = input.type.trim();
    const project = input.project.trim();
    if (!title || !type || !project) {
      throw new TypeError('Memory title, type, and project are required.');
    }
    if (input.records.some((record) => !record.title.trim() || !record.content.trim())) {
      throw new TypeError('Every memory record must include a title and content.');
    }

    await this.ready;
    const header = await this.store.create({ ...input, title, type, project });
    await this.searchIndex.refresh();
    return header;
  }

  async search(options: SearchMemoriesOptions): Promise<MemorySearchResult[]> {
    await this.ready;
    return this.searchIndex.search(options.query, options.project, options.limit);
  }

  async getById(id: string): Promise<MemoryDocument | undefined> {
    await this.ready;
    return this.store.getDocument(id);
  }

  close(): void {
    this.store.close();
  }
}