import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { Engram } from '../src/engram';

const databaseNames: string[] = [];

function createMemory(): { memory: Engram; databaseName: string } {
  const databaseName = `engram-test-${crypto.randomUUID()}`;
  databaseNames.push(databaseName);
  return { memory: new Engram({ databaseName }), databaseName };
}

afterEach(async () => {
  for (const databaseName of databaseNames.splice(0)) {
    await Dexie.delete(databaseName);
  }
});

describe('Engram', () => {
  it('searches record content but returns only compact memory headers', async () => {
    const { memory } = createMemory();
    const header = await memory.save({
      title: 'Browser memory adapter design',
      type: 'architecture',
      project: 'engram-ts',
      tags: ['indexeddb'],
      records: [{
        title: 'Keep Lunr derived from Dexie',
        content: 'Persist records first, then rotate the full-text search index asynchronously.',
        tags: ['lunr', 'dexie'],
      }],
    });

    const results = await memory.search({ query: 'rotate full-text search', project: 'engram-ts' });

    expect(results).toHaveLength(1);
    expect(results[0]?.header.id).toBe(header.id);
    expect(results[0]?.header.recordCount).toBe(1);
    expect(results[0]?.header).not.toHaveProperty('records');

    const document = await memory.getById(header.id);
    expect(document?.records[0]?.content).toContain('rotate the full-text search index');
    memory.close();
  });

  it('filters search by project and lists compact headers for an empty query', async () => {
    const { memory } = createMemory();
    await memory.save({
      title: 'Storage boundary',
      type: 'decision',
      project: 'engram-ts',
      records: [{ title: 'Use Dexie', content: 'Keep IndexedDB operations behind a store.' }],
    });

    expect(await memory.search({ query: 'storage', project: 'another-project' })).toEqual([]);
    expect(await memory.search({ query: '   ' })).toMatchObject([{ header: { title: 'Storage boundary' } }]);
    memory.close();
  });

  it('saves and indexes entity relations in Dexie and allows graph lookup', async () => {
    const { memory } = createMemory();

    const mem1 = await memory.save({
      title: 'JWT Refresh race condition fix',
      type: 'bugfix',
      project: 'auth-service',
      entities: [
        { entity: 'src/auth/jwt.ts', relation: 'fixes' },
        { entity: 'UserService', relation: 'depends_on' },
      ],
      records: [{
        title: 'Mutex around token refresh',
        content: 'Avoid duplicate refresh calls by acquiring an in-flight promise lock.',
      }],
    });

    const mem2 = await memory.save({
      title: 'Refactored token serialization',
      type: 'refactor',
      project: 'auth-service',
      entities: [
        { entity: 'src/auth/jwt.ts', relation: 'refactors' },
      ],
      records: [{
        title: 'Fast JSON serializer',
        content: 'Switched to schema-based JSON serializer for JWT payload generation.',
      }],
    });

    // 1. Look up by entity
    const jwtMemories = await memory.search({ entity: 'src/auth/jwt.ts' });
    expect(jwtMemories).toHaveLength(2);
    expect(jwtMemories.map((m) => m.header.id).sort()).toEqual([mem1.id, mem2.id].sort());

    // 2. Look up by entity and relation
    const fixedMemories = await memory.search({ entity: 'src/auth/jwt.ts', relation: 'fixes' });
    expect(fixedMemories).toHaveLength(1);
    expect(fixedMemories[0]?.header.id).toBe(mem1.id);

    // 3. Look up by getByEntity
    const directLookup = await memory.getByEntity('UserService', 'depends_on');
    expect(directLookup).toHaveLength(1);
    expect(directLookup[0]?.id).toBe(mem1.id);

    // 4. Hybrid search: query + entity filter
    const hybrid = await memory.search({
      query: 'serializer',
      entity: 'src/auth/jwt.ts',
    });
    expect(hybrid).toHaveLength(1);
    expect(hybrid[0]?.header.id).toBe(mem2.id);

    // 5. Document retrieval includes relations
    const doc = await memory.getById(mem1.id);
    expect(doc?.header.entities).toHaveLength(2);
    expect(doc?.relations).toHaveLength(2);
    expect(doc?.relations?.some((r) => r.entity === 'src/auth/jwt.ts' && r.relation === 'fixes')).toBe(true);

    memory.close();
  });
});
