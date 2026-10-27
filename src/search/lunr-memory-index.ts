import lunr from 'lunr';
import type { MemoryHeader, MemoryRecord, MemorySearchResult } from '../types/memory';
import type { MemoryStore } from '../storage/memory-store';

interface SearchDocument {
  id: string;
  title: string;
  type: string;
  project: string;
  tags: string;
  content: string;
}

export class LunrMemoryIndex {
  private index: lunr.Index | undefined;
  private headers = new Map<string, MemoryHeader>();
  private refreshQueue: Promise<void> = Promise.resolve();

  constructor(private readonly store: MemoryStore) {}

  initialize(): Promise<void> {
    return this.refresh();
  }

  refresh(): Promise<void> {
    const nextRefresh = this.refreshQueue.then(() => this.rebuild());
    this.refreshQueue = nextRefresh.catch(() => undefined);
    return nextRefresh;
  }

  async search(query: string, project?: string, limit = 20): Promise<MemorySearchResult[]> {
    const normalizedQuery = query.trim().replace(/[+\-:&|!(){}\[\]^"~*?:\\/]/g, ' ').trim();
    if (!this.index) {
      await this.initialize();
    }
    if (!normalizedQuery) {
      return [...this.headers.values()]
        .filter((header) => !project || header.project === project)
        .slice(0, Math.max(0, limit))
        .map((header) => ({ header, score: 0 }));
    }

    let matches: lunr.Index.Result[];
    try {
      matches = this.index?.search(normalizedQuery) ?? [];
    } catch (error) {
      throw new Error('Memory search query could not be parsed.', { cause: error });
    }

    return matches
      .filter(({ ref }) => {
        const header = this.headers.get(ref);
        return header !== undefined && (!project || header.project === project);
      })
      .slice(0, Math.max(0, limit))
      .flatMap(({ ref, score }) => {
        const header = this.headers.get(ref);
        return header ? [{ header, score }] : [];
      });
  }

  private async rebuild(): Promise<void> {
    const [headers, records] = await Promise.all([
      this.store.listHeaders(),
      this.store.listRecords(),
    ]);
    const recordsByMemory = new Map<string, MemoryRecord[]>();
    for (const record of records) {
      const current = recordsByMemory.get(record.memoryId) ?? [];
      current.push(record);
      recordsByMemory.set(record.memoryId, current);
    }

    const documents: SearchDocument[] = headers.map((header) => ({
      id: header.id,
      title: header.title,
      type: header.type,
      project: header.project,
      tags: header.tags.join(' '),
      content: (recordsByMemory.get(header.id) ?? [])
        .map((record) => `${record.title} ${record.content} ${record.tags.join(' ')}`)
        .join(' '),
    }));
    const nextIndex = lunr(function buildIndex() {
      this.ref('id');
      this.field('title', { boost: 10 });
      this.field('type', { boost: 5 });
      this.field('project', { boost: 4 });
      this.field('tags', { boost: 3 });
      this.field('content');
      documents.forEach((document) => this.add(document));
    });

    this.headers = new Map(headers.map((header) => [header.id, header]));
    this.index = nextIndex;
  }
}