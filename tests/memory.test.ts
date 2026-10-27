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
});