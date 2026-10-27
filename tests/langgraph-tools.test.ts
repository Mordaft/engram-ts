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
});