import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Engram } from '../engram';

export function createLangGraphMemoryTools(memory: Engram) {
  const search = tool(
    async ({ query, project }) =>
      JSON.stringify(await memory.search({ query, ...(project ? { project } : {}) })),
    {
      name: 'memory_search',
      description:
        'Search persistent conversation memories by text. Returns compact headers only; call memory_get for full records.',
      schema: z.object({
        query: z.string().min(1).describe('Keywords describing the decision, bug, or implementation to find.'),
        project: z.string().optional().describe('Optional project name to restrict results.'),
      }),
    },
  );
  const get = tool(
    async ({ id }) => {
      const document = await memory.getById(id);
      return document ? JSON.stringify(document) : `No memory found with ID ${id}.`;
    },
    {
      name: 'memory_get',
      description: 'Retrieve a memory and its full conversation records by the ID returned from memory_search.',
      schema: z.object({ id: z.string().min(1).describe('Memory ID returned by memory_search.') }),
    },
  );
  const save = tool(
    async ({ title, type, project, tags, records }) =>
      JSON.stringify(await memory.save({
        title,
        type,
        project,
        ...(tags ? { tags } : {}),
        records: records.map(({ title: recordTitle, content, tags: recordTags }) => ({
          title: recordTitle,
          content,
          ...(recordTags ? { tags: recordTags } : {}),
        })),
      })),
    {
      name: 'memory_save',
      description: 'Save a concise, structured conversation memory for later text search.',
      schema: z.object({
        title: z.string().min(1).describe('Short, searchable summary title.'),
        type: z.string().min(1).describe('Memory category such as decision, architecture, or implementation.'),
        project: z.string().min(1).describe('Project this memory belongs to.'),
        tags: z.array(z.string()).optional().describe('Searchable keywords for the memory.'),
        records: z.array(z.object({
          title: z.string().min(1),
          content: z.string().min(1),
          tags: z.array(z.string()).optional(),
        })).min(1),
      }),
    },
  );

  return [search, get, save];
}