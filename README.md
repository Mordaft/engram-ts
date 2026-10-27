# engram-ts

Browser-first persistent memory for TypeScript agents. Memories are stored in IndexedDB through Dexie; a Lunr full-text index is derived asynchronously from persisted headers and records. Search results contain compact headers, and full conversation records are loaded separately by memory ID.

## Install and run

Requires Node.js 24 and pnpm 10.

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
  Runs a local Vite workbench to write, search, and view agent conversation memories in the browser profile. Full records load on-demand by ID, keeping memory overhead minimal.

- **Benchmark App** (Performance Evaluation Suite):
  ```sh
  pnpm benchmark
  ```
  Runs a performance testing suite evaluating search times across **100**, **1,000**, **10,000**, and **50,000** records. It benchmarks direct sequential IndexedDB table scans against Engram-ts in-memory inverted index powered by Lunr.js, highlighting latency and speedup differences.

## Library usage

```ts
import { Engram } from 'engram-ts';

const memory = new Engram({ databaseName: 'assistant-memory' });

const saved = await memory.save({
  title: 'Keep Lunr derived from Dexie',
  type: 'architecture',
  project: 'my-project',
  tags: ['search', 'indexeddb'],
  records: [{
    title: 'Persist before indexing',
    content: 'Write conversation records to IndexedDB before rebuilding the search index.',
    tags: ['persistence'],
  }],
});

const matches = await memory.search({ query: 'rebuilding search index', project: 'my-project' });
const detail = await memory.getById(saved.id);

memory.close();
```

`search()` can be called with an empty query to list compact headers. Full record content is not returned in search results.

## LangGraph tools

`createLangGraphMemoryTools(memory)` returns LangChain structured tools named `memory_search`, `memory_get`, and `memory_save`. They expose Zod input schemas and can be registered with a LangGraph tool node. Search results include IDs for a subsequent `memory_get` call.

## Package layout

- `src/types/` defines the memory document, header, and record contracts.
- `src/storage/` stores headers and full records in separate IndexedDB tables, using one transaction per memory write.
- `src/search/` rebuilds and atomically swaps the in-memory Lunr index from Dexie data.
- `src/adapters/` exposes LangGraph-compatible tools.
- `demo/` is a Vite browser consumer with the memory library and detail routes.
- `benchmark/` is a Vite browser application comparing direct IndexedDB searches with Engram-ts (Lunr.js) across 100 to 50,000 records.
- `tests/` covers persistence, progressive disclosure, project filtering, and tool metadata.

The package is marked private to prevent accidental publication. Remove that guard and review the package metadata before a release.