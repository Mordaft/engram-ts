import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Engram } from '../engram';
import { RELATION_TYPES } from '../types/memory';

export { RELATION_TYPES };

export function createLangGraphMemoryTools(memory: Engram) {
  const search = tool(
    async ({ query, entity, relation, project, limit }) =>
      JSON.stringify(
        await memory.search({
          ...(query !== undefined ? { query } : {}),
          ...(entity !== undefined ? { entity } : {}),
          ...(relation !== undefined ? { relation } : {}),
          ...(project !== undefined ? { project } : {}),
          ...(limit !== undefined ? { limit } : {}),
        }),
      ),
    {
      name: 'memory_search',
      description:
        'Search persistent conversation memories. You can query with free text, OR search by linked codebase entity ' +
        '(e.g., entity: "src/auth/token-service.ts", relation: "modifies") to look up all decisions and bugfixes ' +
        'that impacted a specific file, class, or service. Returns compact headers only; call memory_get for full records.',
      schema: z.object({
        query: z.string().optional().describe('Free text keywords describing the decision, bug, or implementation to find.'),
        entity: z.string().optional().describe('Exact codebase entity name or file path (e.g. "AuthService", "src/storage/store.ts").'),
        relation: z.enum(RELATION_TYPES).optional().describe('Filter by relation type (e.g. "modifies", "fixes", "implements", "depends_on").'),
        project: z.string().optional().describe('Optional project name to restrict results.'),
        limit: z.number().int().positive().optional().describe('Maximum number of results to return (default 20).'),
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
    async ({ title, type, project, tags, entities, records }) =>
      JSON.stringify(
        await memory.save({
          title,
          type,
          project,
          ...(tags ? { tags } : {}),
          ...(entities ? { entities } : {}),
          records: records.map(({ title: recordTitle, content, tags: recordTags }) => ({
            title: recordTitle,
            content,
            ...(recordTags ? { tags: recordTags } : {}),
          })),
        }),
      ),
    {
      name: 'memory_save',
      description:
        'Save a concise, structured conversation memory for later search. ' +
        'CRITICAL: Always register affected codebase entities (files, services, components, APIs) ' +
        'and describe how this memory relates to them. This creates a searchable knowledge graph so future ' +
        'tasks touching those entities can immediately retrieve past decisions, conventions, and bugfixes.',
      schema: z.object({
        title: z.string().min(1).describe('Short, searchable summary title.'),
        type: z.string().min(1).describe('Memory category such as decision, architecture, bugfix, or implementation.'),
        project: z.string().min(1).describe('Project this memory belongs to.'),
        tags: z.array(z.string()).optional().describe('General thematic keywords (e.g. ["auth", "indexeddb"]).'),
        entities: z.array(
          z.object({
            entity: z.string().min(1).describe(
              'Specific codebase entity identifier. Prefer file paths, class/service names, database tables, or modules. ' +
              'Examples: "src/auth/jwt.ts", "UserService", "MemoryDatabase".',
            ),
            relation: z.enum(RELATION_TYPES).describe(
              'How this memory relates to the entity:\n' +
              '- "modifies": Changed code, logic, or configuration.\n' +
              '- "implements": Implements an interface, spec, or feature.\n' +
              '- "fixes": Resolved a bug or incident in this entity.\n' +
              '- "depends_on": Added a dependency on this entity.\n' +
              '- "deprecates": Replaced or marked as deprecated.\n' +
              '- "refactors": Cleaned up or re-architected.\n' +
              '- "defines": Created or established this entity for the first time.',
            ),
          }),
        ).optional().describe('Codebase entities affected by or referenced in this memory.'),
        records: z.array(
          z.object({
            title: z.string().min(1),
            content: z.string().min(1),
            tags: z.array(z.string()).optional(),
          }),
        ).min(1),
      }),
    },
  );

  return [search, get, save];
}
