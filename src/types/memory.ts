export const RELATION_TYPES = [
  'modifies',
  'implements',
  'fixes',
  'depends_on',
  'deprecates',
  'refactors',
  'defines',
] as const;

export type RelationType = (typeof RELATION_TYPES)[number] | (string & {});

export interface EntityRelation {
  entity: string;
  relation: RelationType;
  type?: string;
}

export interface MemoryRelationRecord {
  id: string;
  memoryId: string;
  entity: string;
  relation: string;
  project: string;
  createdAt: string;
}

export interface MemoryRecordInput {
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
}

export interface CreateMemoryInput {
  title: string;
  type: string;
  project: string;
  tags?: string[];
  entities?: EntityRelation[];
  records: MemoryRecordInput[];
}

export interface MemoryHeader {
  id: string;
  title: string;
  type: string;
  project: string;
  tags: string[];
  entities: EntityRelation[];
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRecord extends MemoryRecordInput {
  id: string;
  memoryId: string;
  tags: string[];
  createdAt: string;
}

export interface MemoryDocument {
  header: MemoryHeader;
  records: MemoryRecord[];
  relations?: MemoryRelationRecord[];
}

export interface SearchMemoriesOptions {
  query?: string;
  entity?: string;
  relation?: string;
  project?: string;
  limit?: number;
}

export interface MemorySearchResult {
  header: MemoryHeader;
  score: number;
}
