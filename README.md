# engram-ts

Browser-first persistent memory for TypeScript agents. Memories are stored in IndexedDB through Dexie; a Lunr full-text index is derived asynchronously from persisted headers and records. Search results contain compact headers, and full conversation records are loaded separately by memory ID.

`engram-ts` includes **Entity & Relation Graph Linking**, allowing software agents to connect memories to specific codebase entities (files, services, components, database tables) with typed semantic relationships (`modifies`, `fixes`, `depends_on`, `implements`, etc.), indexed with composite Dexie keys for sub-millisecond graph queries.

## Install and run

Requires Node.js 20+ (Node.js 24 recommended) and pnpm 10.

```sh
pnpm install
pnpm test
pnpm build
```

### Running the applications

The monorepo includes two standalone web applications to demonstrate the library's functionality and performance:

- **Demo App** (Memory Library Workbench):
  ```sh
  pnpm demo
  ```
  Runs a local Vite workbench to write, search, and view agent conversation memories in the browser profile. Supports entity relation tagging (`entity:relation`), filtering by entity badge, and full record inspection on-demand by ID.

- **Benchmark App** (Performance Evaluation Suite):
  ```sh
  pnpm benchmark
  ```
  Runs a performance testing suite evaluating search times across **100**, **1,000**, **10,000**, and **50,000** records. It benchmarks direct sequential IndexedDB table scans against Engram-ts in-memory inverted index (Lunr.js) and indexed compound lookups (`[entity+relation]`), highlighting latency and speedup differences.

## Library usage

```ts
import { Engram } from 'engram-ts';

const memory = new Engram({ databaseName: 'assistant-memory' });

// 1. Save a structured memory with connected entities
const saved = await memory.save({
  title: 'Fix JWT refresh race condition',
  type: 'bugfix',
  project: 'auth-service',
  tags: ['security', 'tokens'],
  entities: [
    { entity: 'src/auth/jwt.ts', relation: 'fixes' },
    { entity: 'UserService', relation: 'depends_on' },
  ],
  records: [{
    title: 'Mutex lock around token refresh',
    content: 'Acquire an in-flight promise lock before requesting token renewal to prevent duplicate requests.',
    tags: ['mutex'],
  }],
});

// 2. Text search with Lunr index (boosts entity matches x8)
const matches = await memory.search({ query: 'token refresh race condition', project: 'auth-service' });

// 3. Graph query: find all memories that touched an entity
const jwtMemories = await memory.search({ entity: 'src/auth/jwt.ts' });

// 4. Exact relation query: find only memories that fixed a bug in this entity
const fixedJwt = await memory.search({ entity: 'src/auth/jwt.ts', relation: 'fixes' });

// 5. Direct store query via getByEntity helper
const userDependencies = await memory.getByEntity('UserService', 'depends_on');

// 6. Retrieve full document by ID
const detail = await memory.getById(saved.id);

memory.close();
```

`search()` can be called with an empty query to list compact headers. Full record content is not returned in search results.

---

## Codebase Entity & Relation Graph

### The Motivation
When AI agents assist in software development, architectural decisions and bugfixes rarely exist in isolation. Flat tags (e.g. `tags: ['auth', 'user']`) introduce ambiguity:
- Did the decision *create*, *fix*, *deprecate*, or *modify* the component?
- Which tag relates to which action when multiple components are mentioned?

`engram-ts` solves this by introducing **first-class Entity Relations**:
```
[Memory Document] ──(relation: 'fixes')────> [Entity: 'src/auth/jwt.ts']
                  ──(relation: 'depends_on')─> [Entity: 'UserService']
```

### Storage Architecture (IndexedDB Compound Index)
Entity relations are persisted in an independent IndexedDB table (`relations`) managed by Dexie, backed by a compound index:
```ts
relations: 'id, memoryId, entity, relation, project, [entity+relation], [project+entity]'
```
- **Instant lookups:** Resolves `[entity+relation]` in $<1\text{ ms}$, bypassing full table scans even with 50,000+ memories.
- **Hybrid Search:** Combines Lunr full-text search with entity filters, boosting entity matches in text search by $8\times$.

### Controlled Relation Vocabulary (`RELATION_TYPES`)

To prevent vocabulary divergence across different agent sessions, `engram-ts` provides standard relationship verbs:

| Relation | Semantic Meaning | Recommended Usage |
| :--- | :--- | :--- |
| `modifies` | Changed code, logic, schema, or configuration | Refactorings, file edits, configuration changes |
| `implements` | Implements an interface, contract, or design pattern | New classes implementing interfaces, architectural patterns |
| `fixes` | Resolved a bug, regression, or security issue | Bug fixes, race conditions, edge case mitigations |
| `depends_on` | Added a runtime or architectural dependency | New module imports, third-party libraries, services |
| `deprecates` | Replaced or marked as deprecated | Decommissioned APIs, legacy adapters |
| `refactors` | Cleaned up or re-architected without changing behavior | Internal restructurings, performance cleanups |
| `defines` | Created or established this entity for the first time | New services, database tables, core abstractions |

---

## LangGraph Tools

`createLangGraphMemoryTools(memory)` publishes three LangChain/LangGraph-compatible structured tools:

1. **`memory_save`**: Captures concise memories. Its Zod schema explicitly instructs the LLM to register all affected codebase entities and choose relations from `RELATION_TYPES`, seeding the project knowledge graph automatically.
2. **`memory_search`**: Searches memories by keyword, entity path (e.g., `src/auth/jwt.ts`), and/or relation filter (`fixes`).
3. **`memory_get`**: Retrieves full conversation records on-demand using the memory ID.

### Agent Workflow Example

```ts
import { createLangGraphMemoryTools } from 'engram-ts';

const tools = createLangGraphMemoryTools(memory);
// Register tools in your LangGraph tool node or agent executor
```

When an agent is asked to modify `src/auth/jwt.ts`, it can first call:
```json
{
  "entity": "src/auth/jwt.ts"
}
```
to `memory_search`, instantly discovering past decisions, known race conditions, and fixes affecting that file before generating new code.

---

## Package Layout

- `src/types/` defines the memory document, header, record, and entity relation contracts (`RELATION_TYPES`, `EntityRelation`, `MemoryRelationRecord`).
- `src/storage/` stores headers, full records, and entity relations across separate IndexedDB tables (`headers`, `records`, `relations`) with Dexie compound indexes.
- `src/search/` derives the in-memory Lunr index with high boost factors for entity tokens (`entities: 8`, `title: 10`).
- `src/adapters/` exposes LangGraph-compatible tools with Zod schemas and prompt guidance for LLMs.
- `demo/` is a Vite browser workbench supporting entity relation tagging, entity badges, and discovery links.
- `benchmark/` evaluates search performance across 100 to 50,000 records, comparing unindexed sequential table scans with Lunr text search and compound `[entity+relation]` IndexedDB lookups.
- `tests/` comprehensive unit tests for storage, graph lookups, hybrid searches, and LangGraph tool execution.

The package is marked private to prevent accidental publication. Remove that guard and review the package metadata before a release.
