import { HerbalChunk, EmbeddedHerbalChunk, EmbedHerbalOptions } from './herbalTypes';

declare global {
  interface Window {
    // For client-side embedding if needed
    generateEmbedding?: (text: string, model?: string) => Promise<number[]>;
  }
}

export async function embedHerbalChunks(
  chunks: HerbalChunk[],
  options?: EmbedHerbalOptions
): Promise<EmbeddedHerbalChunk[]> {
  const opts = {
    model: 'BAAI/bge-large-en-v1.5', // Default model
    batchSize: 10, // Process in batches to manage API limits
    ...options
  };

  const embeddedChunks: EmbeddedHerbalChunk[] = [];
  const batchSize = opts.batchSize;

  // Process in batches to handle API rate limits
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    // Process each chunk in the batch
    const batchResults = await Promise.all(
      batch.map(async (chunk) => {
        try {
          // Generate embedding for the chunk content
          const embedding = await generateEmbedding(chunk.content, opts.model);
          
          return {
            chunk,
            embedding,
            id: `herbal-chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          };
        } catch (error) {
          console.error(`Error embedding chunk for plant ${chunk.plant}:`, error);
          // Return a chunk with an empty embedding in case of error
          return {
            chunk,
            embedding: [],
            id: `herbal-chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          };
        }
      })
    );
    
    embeddedChunks.push(...batchResults);
  }

  return embeddedChunks;
}

// This function handles the actual embedding generation
// It can work with various embedding providers
async function generateEmbedding(text: string, model?: string): Promise<number[]> {
  // Use the specified model or default
  const embeddingModel = model || 'BAAI/bge-large-en-v1.5';
  
  // For now, using a fallback approach since we don't have a specific embedding API
  // In a real implementation, this would call an embedding API
  try {
    // Check if we're in a browser environment with a local embedding function
    if (typeof window !== 'undefined' && window.generateEmbedding) {
      return await window.generateEmbedding(text, embeddingModel);
    } else {
      // Fallback: use a mock embedding function or call an external API
      // For demonstration, we'll return a mock embedding
      return await getMockEmbedding(text);
    }
  } catch (error) {
    console.warn(`Failed to generate embedding with ${embeddingModel}, trying fallback model...`);
    // Try with a fallback model
    return await getMockEmbedding(text);
  }
}

// Mock embedding function for demonstration purposes
// In a real implementation, this would call the actual embedding API
async function getMockEmbedding(text: string): Promise<number[]> {
  // In a real implementation, this would call an actual embedding API
  // For now, we create a mock embedding based on text characteristics
  
  // Create a simple hash-based embedding for demonstration
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase());
  
  // Create a 384-dimension embedding (common size for many embedding models)
  const embedding: number[] = new Array(384).fill(0);
  
  // Fill the embedding with a pattern based on the input text
  for (let i = 0; i < data.length; i++) {
    const idx = i % embedding.length;
    embedding[idx] = (embedding[idx] + (data[i] / 255.0)) % 1;
  }
  
  // Normalize the embedding to unit length
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (norm || 1));
}

// Alternative function to embed additional semantic information
export async function embedHerbalSemantics(
  chunks: HerbalChunk[],
  options?: EmbedHerbalOptions
): Promise<EmbeddedHerbalChunk[]> {
  const opts = {
    model: 'BAAI/bge-large-en-v1.5',
    batchSize: 10,
    ...options
  };

  const semanticChunks: HerbalChunk[] = [];
  
  // Create additional semantic chunks for better retrieval
  for (const chunk of chunks) {
    // Add botanical name variations
    if (chunk.plant) {
      semanticChunks.push({
        ...chunk,
        content: chunk.plant,
        section: 'botanical-names',
        metadata: { ...chunk.metadata, semanticType: 'botanical-name' }
      });
    }
    
    // Add local name variations if available
    if (chunk.metadata && chunk.metadata.localNames) {
      const localNames = Array.isArray(chunk.metadata.localNames) 
        ? chunk.metadata.localNames 
        : [chunk.metadata.localNames];
      
      for (const localName of localNames) {
        semanticChunks.push({
          ...chunk,
          content: localName,
          section: 'local-names',
          metadata: { ...chunk.metadata, semanticType: 'local-name' }
        });
      }
    }
    
    // Add chemical compound variations if available
    if (chunk.metadata && chunk.metadata.compounds) {
      const compounds = Array.isArray(chunk.metadata.compounds) 
        ? chunk.metadata.compounds 
        : [chunk.metadata.compounds];
      
      for (const compound of compounds) {
        semanticChunks.push({
          ...chunk,
          content: compound,
          section: 'compounds',
          metadata: { ...chunk.metadata, semanticType: 'compound' }
        });
      }
    }
    
    // Add the original chunk
    semanticChunks.push(chunk);
  }
  
  return await embedHerbalChunks(semanticChunks, opts);
}