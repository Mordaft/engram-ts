import Dexie, { type Table } from 'dexie';
import type {
  CreateMemoryInput,
  MemoryDocument,
  MemoryHeader,
  MemoryRecord,
  MemoryRelationRecord,
} from '../types/memory';
import type { MemoryStore } from './memory-store';

class MemoryDatabase extends Dexie {
  headers!: Table<MemoryHeader, string>;
  records!: Table<MemoryRecord, string>;
  relations!: Table<MemoryRelationRecord, string>;

  constructor(name: string) {
    super(name);
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

export class DexieMemoryStore implements MemoryStore {
  private readonly database: MemoryDatabase;

  constructor(databaseName = 'engram-ts') {
    this.database = new MemoryDatabase(databaseName);
  }

  async create(input: CreateMemoryInput): Promise<MemoryHeader> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const entities = input.entities?.map((e) => ({
      entity: e.entity.trim(),
      relation: e.relation.trim(),
      ...(e.type ? { type: e.type.trim() } : {}),
    })) ?? [];

    const header: MemoryHeader = {
      id,
      title: input.title.trim(),
      type: input.type.trim(),
      project: input.project.trim(),
      tags: [...(input.tags ?? [])],
      entities,
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

    const relations: MemoryRelationRecord[] = entities.map((rel) => ({
      id: crypto.randomUUID(),
      memoryId: id,
      entity: rel.entity,
      relation: rel.relation,
      project: header.project,
      createdAt: now,
    }));

    await this.database.transaction(
      'rw',
      this.database.headers,
      this.database.records,
      this.database.relations,
      async () => {
        await this.database.headers.add(header);
        await this.database.records.bulkAdd(records);
        if (relations.length > 0) {
          await this.database.relations.bulkAdd(relations);
        }
      },
    );

    return header;
  }

  async getHeader(id: string): Promise<MemoryHeader | undefined> {
    const header = await this.database.headers.get(id);
    if (!header) return undefined;
    return {
      ...header,
      entities: header.entities ?? [],
    };
  }

  async getDocument(id: string): Promise<MemoryDocument | undefined> {
    const [header, records, relations] = await Promise.all([
      this.getHeader(id),
      this.database.records.where('memoryId').equals(id).sortBy('createdAt'),
      this.database.relations.where('memoryId').equals(id).toArray(),
    ]);
    return header ? { header, records, relations } : undefined;
  }

  async listHeaders(): Promise<MemoryHeader[]> {
    const headers = await this.database.headers.orderBy('updatedAt').reverse().toArray();
    return headers.map((header) => ({
      ...header,
      entities: header.entities ?? [],
    }));
  }

  listRecords(): Promise<MemoryRecord[]> {
    return this.database.records.toArray();
  }

  listRelations(memoryId?: string): Promise<MemoryRelationRecord[]> {
    if (memoryId) {
      return this.database.relations.where('memoryId').equals(memoryId).toArray();
    }
    return this.database.relations.toArray();
  }

  async getMemoriesByEntity(
    entity: string,
    relation?: string,
    project?: string,
  ): Promise<MemoryHeader[]> {
    const normalizedEntity = entity.trim();
    const normalizedRelation = relation?.trim();

    let matches: MemoryRelationRecord[];
    if (normalizedRelation) {
      matches = await this.database.relations
        .where('[entity+relation]')
        .equals([normalizedEntity, normalizedRelation])
        .toArray();
    } else {
      matches = await this.database.relations
        .where('entity')
        .equals(normalizedEntity)
        .toArray();
    }

    if (project) {
      matches = matches.filter((r) => r.project === project);
    }

    const memoryIds = [...new Set(matches.map((r) => r.memoryId))];
    const headers = await Promise.all(memoryIds.map((id) => this.getHeader(id)));
    return headers.filter((h): h is MemoryHeader => h !== undefined);
  }

  close(): void {
    this.database.close();
  }
}
