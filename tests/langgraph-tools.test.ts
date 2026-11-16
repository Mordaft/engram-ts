import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Engram } from '../src/engram';
import { createLangGraphMemoryTools } from '../src/adapters/langgraph-tools';

describe('createLangGraphMemoryTools', () => {
  it('publishes the search, retrieve, and save tools with input schemas', () => {
    const memory = new Engram({ databaseName: `engram-tools-${crypto.randomUUID()}` });
    const tools = createLangGraphMemoryTools(memory);

    expect(tools.map(({ name }) => name)).toEqual([
      'memory_search',
      'memory_get',
      'memory_save',
    ]);
    for (const memoryTool of tools) {
      expect(memoryTool.description.length).toBeGreaterThan(20);
      expect(memoryTool.schema).toBeDefined();
    }
    memory.close();
  });

  it('saves and searches memories using entities through LangGraph tools', async () => {
    const memory = new Engram({ databaseName: `engram-tools-${crypto.randomUUID()}` });
    const [searchTool, getTool, saveTool] = createLangGraphMemoryTools(memory);

    // Save with entities
    const saveResponseJson = await saveTool.invoke({
      title: 'Decoupled memory store from SQLite',
      type: 'architecture',
      project: 'engram-ts',
      tags: ['storage', 'dexie'],
      entities: [
        { entity: 'DexieMemoryStore', relation: 'implements' },
        { entity: 'src/storage/memory-store.ts', relation: 'modifies' },
      ],
      records: [
        {
          title: 'Browser persistence layer',
          content: 'Implemented DexieMemoryStore conforming to MemoryStore contract.',
        },
      ],
    });

    const savedHeader = JSON.parse(saveResponseJson);
    expect(savedHeader.id).toBeDefined();
    expect(savedHeader.entities).toHaveLength(2);

    // Search by entity
    const searchResponseJson = await searchTool.invoke({
      entity: 'DexieMemoryStore',
      relation: 'implements',
    });
    const searchResults = JSON.parse(searchResponseJson);
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].header.id).toBe(savedHeader.id);

    // Get full document
    const getResponseJson = await getTool.invoke({ id: savedHeader.id });
    const document = JSON.parse(getResponseJson);
    expect(document.header.title).toBe('Decoupled memory store from SQLite');
    expect(document.relations).toHaveLength(2);

    memory.close();
  });
});
