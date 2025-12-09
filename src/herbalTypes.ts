export interface HerbalPlantRecord {
  botanicalName: string;
  plantFamily?: string;
  synonyms?: string[];
  localNames?: string[];
  plantPartsUsed?: string[];
  phytochemicalConstituents?: string[];
  traditionalUses?: string[];
  pharmacologicalActions?: string[];
  preparationMethods?: string;
  dosageAndAdministration?: string;
  toxicology?: string;
  contraindications?: string[];
  drugInteractions?: string[];
  sideEffects?: string[];
  conservationStatus?: string;
  geographicalDistribution?: string;
  cultivation?: string;
  references?: string;
  metadata?: {
    pages?: number[];
    sections?: string[];
    confidence?: number;
  };
}

export interface ParsedHerbalDocument {
  plants: HerbalPlantRecord[];
  rawText: string;
  metadata: Record<string, any>;
  pageCount?: number;
}

export interface HerbalChunk {
  content: string;
  plant: string;
  section: string;
  page?: number;
  plantIndex?: number;
  metadata?: Record<string, any>;
}

export interface EmbeddedHerbalChunk {
  chunk: HerbalChunk;
  embedding: number[];
  id: string;
}

export interface HerbalRetrievedChunk {
  chunk: HerbalChunk;
  score: number;
  embedding?: number[];
}

export interface ParseHerbalOptions {
  enhanced?: boolean;
  preserveFormatting?: boolean;
  extractTables?: boolean;
  preserveImages?: boolean;
  pageRange?: [number, number];
}

export interface ChunkHerbalOptions {
  maxChunkSize?: number;
  overlap?: number;
  preserveSections?: boolean;
}

export interface EmbedHerbalOptions {
  model?: string;
  batchSize?: number;
}

export interface RetrieveHerbalOptions {
  topK?: number;
  useReranker?: boolean;
  filters?: Record<string, any>;
  includeMetadata?: boolean;
}