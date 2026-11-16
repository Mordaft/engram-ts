import type { MemoryHeader, MemoryRecord, MemoryRelationRecord } from 'engram-ts';

const TYPES = ['decision', 'architecture', 'implementation', 'bugfix', 'convention'] as const;
const PROJECTS = ['engram-ts', 'auth-service', 'gateway', 'agent-core', 'data-pipeline'] as const;

const CODEBASE_ENTITIES = [
  'src/auth/jwt-service.ts',
  'src/storage/dexie-store.ts',
  'src/search/lunr-index.ts',
  'PostgresConnectionPool',
  'RedisCacheManager',
  'AgentToolRegistry',
  'StreamPipelineBuffer',
  'ZodValidationBoundary',
] as const;

const RELATIONS = ['modifies', 'implements', 'fixes', 'depends_on', 'deprecates', 'refactors', 'defines'] as const;

const TOPICS = [
  {
    topic: 'database',
    title: 'Database connection pool optimization',
    content: 'Optimized PostgreSQL connection pool settings and added retry mechanisms for transient network disconnects.',
    tags: ['database', 'postgres', 'pool', 'performance'],
  },
  {
    topic: 'indexeddb',
    title: 'Dexie IndexedDB transaction batching',
    content: 'IndexedDB writes were chunked in batches of 2000 records to prevent long-running readwrite transaction stalls.',
    tags: ['indexeddb', 'dexie', 'browser-storage', 'batch'],
  },
  {
    topic: 'lunr',
    title: 'Lunr full-text search index rotation',
    content: 'Lunr inverted index is compiled in memory from Dexie headers and records to provide instant token lookups.',
    tags: ['lunr', 'search', 'full-text', 'inverted-index'],
  },
  {
    topic: 'refactor',
    title: 'Refactored memory store abstraction',
    content: 'Refactored the storage layer to decouple Dexie specific logic from the core agent memory interface.',
    tags: ['refactor', 'architecture', 'clean-code', 'interface'],
  },
  {
    topic: 'token',
    title: 'JWT authentication token expiration fix',
    content: 'Resolved token expiration desynchronization between client refresh timers and server authorization headers.',
    tags: ['token', 'jwt', 'auth', 'security'],
  },
  {
    topic: 'cache',
    title: 'Redis multi-tier cache invalidation',
    content: 'Implemented stale-while-revalidate caching with Redis key expiration and local memory memoization.',
    tags: ['cache', 'redis', 'latency', 'ttl'],
  },
  {
    topic: 'memory',
    title: 'Browser heap memory leak mitigation',
    content: 'Fixed retaining reference cycles in search document indexers to maintain low browser memory consumption.',
    tags: ['memory', 'heap', 'garbage-collection', 'performance'],
  },
  {
    topic: 'concurrency',
    title: 'Mutex lock for parallel agent actions',
    content: 'Added distributed lock pattern and local async semaphore to avoid concurrent file write collisions.',
    tags: ['concurrency', 'mutex', 'lock', 'async'],
  },
  {
    topic: 'pipeline',
    title: 'Stream processing data pipeline throughput',
    content: 'Enhanced data streaming pipeline with backpressure handling and chunked buffer transformations.',
    tags: ['pipeline', 'streaming', 'throughput', 'buffer'],
  },
  {
    topic: 'validation',
    title: 'Zod schema runtime validation boundary',
    content: 'Enforced strict Zod runtime schemas across all agent tool inputs to catch malformed payloads early.',
    tags: ['validation', 'zod', 'typescript', 'types'],
  },
] as const;

const MODIFIERS = [
  'in staging environment',
  'under high concurrency workload',
  'during regression testing',
  'following security audit recommendations',
  'to improve Core Web Vitals latency',
  'ahead of production rollout v2',
  'after migrating from legacy codebase',
  'to satisfy automated compliance checks',
  'for multi-tenant agent execution',
  'during synthetic benchmark evaluations',
];

/**
 * Deterministically generates N realistic headers, records, and entity relations matching engram-ts schema.
 */
export function generateBenchmarkData(count: number): {
  headers: MemoryHeader[];
  records: MemoryRecord[];
  relations: MemoryRelationRecord[];
} {
  const headers: MemoryHeader[] = new Array(count);
  const records: MemoryRecord[] = new Array(count);
  const relations: MemoryRelationRecord[] = new Array(count);
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    const topicItem = TOPICS[i % TOPICS.length]!;
    const modifier = MODIFIERS[(i * 7) % MODIFIERS.length]!;
    const type = TYPES[(i * 3) % TYPES.length]!;
    const project = PROJECTS[(i * 11) % PROJECTS.length]!;
    const entityName = CODEBASE_ENTITIES[i % CODEBASE_ENTITIES.length]!;
    const relationType = RELATIONS[(i * 3) % RELATIONS.length]!;

    const sequenceId = (i + 1).toString().padStart(5, '0');
    const memoryId = `bench-mem-${sequenceId}-${crypto.randomUUID().slice(0, 8)}`;
    const recordId = `bench-rec-${sequenceId}-${crypto.randomUUID().slice(0, 8)}`;
    const relationId = `bench-rel-${sequenceId}-${crypto.randomUUID().slice(0, 8)}`;

    const title = `[#${sequenceId}] ${topicItem.title} - ${modifier}`;
    const content = `${topicItem.content} Evaluation step ${i + 1}: verified in project ${project} using ${type} conventions. ${modifier}.`;
    const tags = [...topicItem.tags, `batch-${Math.floor(i / 1000)}`];
    const entities = [{ entity: entityName, relation: relationType }];

    headers[i] = {
      id: memoryId,
      title,
      type,
      project,
      tags,
      entities,
      recordCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    records[i] = {
      id: recordId,
      memoryId,
      title: `Action details: ${topicItem.title}`,
      content,
      tags,
      createdAt: now,
    };

    relations[i] = {
      id: relationId,
      memoryId,
      entity: entityName,
      relation: relationType,
      project,
      createdAt: now,
    };
  }

  return { headers, records, relations };
}
