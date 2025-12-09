import { 
  EmbeddedHerbalChunk, 
  HerbalRetrievedChunk, 
  RetrieveHerbalOptions 
} from './herbalTypes';

// Mock Pinecone-like client for demonstration
class MockVectorStore {
  private vectors: Map<string, { embedding: number[], chunk: EmbeddedHerbalChunk }> = new Map();
  
  async upsert(vectors: Array<{ id: string; values: number[]; metadata: any }>): Promise<void> {
    for (const vector of vectors) {
      this.vectors.set(vector.id, {
        embedding: vector.values,
        chunk: {
          chunk: vector.metadata.chunk,
          embedding: vector.values,
          id: vector.id
        } as EmbeddedHerbalChunk
      });
    }
  }
  
  async query(vector: number[], topK: number, filters?: any): Promise<Array<{ id: string; score: number }>> {
    // Simple cosine similarity search for demonstration
    const results: Array<{ id: string; score: number }> = [];
    
    this.vectors.forEach((item, id) => {
      if (filters) {
        // Basic filter checking
        if (filters.plant && item.chunk.chunk.plant !== filters.plant) {
          return;
        }
        if (filters.section && item.chunk.chunk.section !== filters.section) {
          return;
        }
      }
      
      const similarity = cosineSimilarity(vector, item.embedding);
      results.push({ id, score: similarity });
    });
    
    // Sort by score (descending) and return topK
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

const vectorStore = new MockVectorStore();

export async function retrieveHerbalKnowledge(
  query: string,
  options?: RetrieveHerbalOptions
): Promise<HerbalRetrievedChunk[]> {
  const opts = {
    topK: 10,
    useReranker: false,
    filters: {},
    ...options
  };

  // Multi-layer retrieval approach
  const results: HerbalRetrievedChunk[] = [];

  // Layer 1: Vector semantic search
  const semanticResults = await vectorSemanticSearch(query, opts);
  results.push(...semanticResults);

  // Layer 2: Keyword search for botanical names and related terms
  const keywordResults = await keywordSearch(query, opts);
  results.push(...keywordResults);

  // Remove duplicates and sort by score
  const uniqueResults = deduplicateResults(results);
  uniqueResults.sort((a, b) => b.score - a.score);

  // Apply reranking if requested
  if (opts.useReranker) {
    return rerankResults(query, uniqueResults.slice(0, opts.topK * 2)).slice(0, opts.topK);
  }

  return uniqueResults.slice(0, opts.topK);
}

async function vectorSemanticSearch(query: string, options: RetrieveHerbalOptions): Promise<HerbalRetrievedChunk[]> {
  // Generate embedding for the query
  const queryEmbedding = await generateQueryEmbedding(query);
  
  // Query the vector store
  const vectorResults = await vectorStore.query(
    queryEmbedding, 
    options.topK * 2, // Get more results for potential reranking
    options.filters
  );
  
  // Convert to HerbalRetrievedChunk format
  const results: HerbalRetrievedChunk[] = [];
  for (const result of vectorResults) {
    const storedItem = vectorStore['vectors'].get(result.id);
    if (storedItem) {
      results.push({
        chunk: storedItem.chunk,
        score: result.score
      });
    }
  }
  
  return results;
}

async function keywordSearch(query: string, options: RetrieveHerbalOptions): Promise<HerbalRetrievedChunk[]> {
  // This would normally search in a keyword index
  // For now, we'll use a simple approach with the stored vectors
  const results: HerbalRetrievedChunk[] = [];
  const queryLower = query.toLowerCase();
  
  vectorStore['vectors'].forEach((item, id) => {
    if (options.filters) {
      // Apply filters
      if (options.filters.plant && !item.chunk.chunk.plant.toLowerCase().includes(options.filters.plant.toLowerCase())) {
        return;
      }
      if (options.filters.section && !item.chunk.chunk.section.toLowerCase().includes(options.filters.section.toLowerCase())) {
        return;
      }
    }
    
    // Calculate a simple keyword match score
    let score = 0;
    const contentLower = item.chunk.chunk.content.toLowerCase();
    
    // Boost score for botanical name matches
    if (item.chunk.chunk.plant.toLowerCase().includes(queryLower)) {
      score += 0.8;
    }
    
    // Boost score for direct content matches
    if (contentLower.includes(queryLower)) {
      score += 0.5;
    }
    
    // Boost score for section matches
    if (item.chunk.chunk.section.toLowerCase().includes(queryLower)) {
      score += 0.3;
    }
    
    // Boost score for partial matches
    const queryWords = queryLower.split(/\s+/);
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        score += 0.1;
      }
    }
    
    if (score > 0) {
      results.push({
        chunk: item.chunk,
        score,
        embedding: item.embedding
      });
    }
  });
  
  return results;
}

function deduplicateResults(results: HerbalRetrievedChunk[]): HerbalRetrievedChunk[] {
  const seenIds = new Set<string>();
  const uniqueResults: HerbalRetrievedChunk[] = [];
  
  for (const result of results) {
    // Create a unique identifier based on the chunk content and metadata
    const chunkId = `${result.chunk.chunk.plant}-${result.chunk.chunk.section}-${result.chunk.chunk.content.substring(0, 50)}`;
    
    if (!seenIds.has(chunkId)) {
      seenIds.add(chunkId);
      uniqueResults.push(result);
    }
  }
  
  return uniqueResults;
}

function rerankResults(query: string, results: HerbalRetrievedChunk[]): HerbalRetrievedChunk[] {
  // A simple reranking approach based on multiple factors
  return results.map(result => {
    let rerankScore = result.score;
    
    // Boost if the query matches the plant name
    if (result.chunk.chunk.plant.toLowerCase().includes(query.toLowerCase())) {
      rerankScore += 0.3;
    }
    
    // Boost if the query matches the section
    if (result.chunk.chunk.section.toLowerCase().includes(query.toLowerCase())) {
      rerankScore += 0.2;
    }
    
    // Boost based on content relevance
    const contentRelevance = calculateContentRelevance(query, result.chunk.chunk.content);
    rerankScore += contentRelevance * 0.3;
    
    return {
      ...result,
      score: rerankScore
    };
  }).sort((a, b) => b.score - a.score);
}

function calculateContentRelevance(query: string, content: string): number {
  // Simple TF-IDF-like relevance calculation
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const contentLower = content.toLowerCase();
  
  let matches = 0;
  for (const word of queryWords) {
    if (contentLower.includes(word)) {
      matches++;
    }
  }
  
  return matches / queryWords.length;
}

// Mock function to generate query embeddings
async function generateQueryEmbedding(query: string): Promise<number[]> {
  // In a real implementation, this would call an embedding API
  // For now, using a mock embedding function similar to the one in embedder
  const encoder = new TextEncoder();
  const data = encoder.encode(query.toLowerCase());
  
  // Create a 384-dimension embedding
  const embedding: number[] = new Array(384).fill(0);
  
  for (let i = 0; i < data.length; i++) {
    const idx = i % embedding.length;
    embedding[idx] = (embedding[idx] + (data[i] / 255.0)) % 1;
  }
  
  // Normalize the embedding
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (norm || 1));
}

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Function to store embedded chunks in the vector store
export async function storeHerbalEmbeddings(embeddedChunks: EmbeddedHerbalChunk[]): Promise<void> {
  const vectorsToStore = embeddedChunks.map(chunk => ({
    id: chunk.id,
    values: chunk.embedding,
    metadata: {
      chunk: chunk.chunk,
      plant: chunk.chunk.plant,
      section: chunk.chunk.section,
      content: chunk.chunk.content
    }
  }));
  
  await vectorStore.upsert(vectorsToStore);
}

// Function to build the herbal knowledge index
export async function buildHerbalKnowledgeIndex(
  embeddedChunks: EmbeddedHerbalChunk[]
): Promise<void> {
  await storeHerbalEmbeddings(embeddedChunks);
}