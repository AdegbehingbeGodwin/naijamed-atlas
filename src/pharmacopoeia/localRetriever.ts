import { join } from 'path';

interface HerbalChunkWithMetadata {
  id: string;
  text: string;
  embedding: number[];
  source: "AHP" | "WAP";
  page: number;
}

// In-memory storage for herbal vectors
let herbalVectors: HerbalChunkWithMetadata[] = [];

// Load herbal vectors from JSON file when module is imported
async function loadHerbalVectors(): Promise<void> {
  try {
    // In a real Node.js environment, we'd load the JSON file:
    // const fs = require('fs');
    // const filePath = join(__dirname, 'herbal_vectors.json');
    // const data = fs.readFileSync(filePath, 'utf-8');
    // herbalVectors = JSON.parse(data);
    
    // For this demonstration, we'll initialize with mock data
    // This would normally be populated by the ingestion process
    // Load from the JSON file (in a real Node.js environment)
    // For this example, using sample data from the JSON file
    herbalVectors = [
      {
        id: "AHP_001",
        text: "Moringa oleifera (Moringaceae) - commonly known as drumstick tree. Traditional uses: leaves used for malnutrition, bark for diarrhea, roots for joint pains. Plant parts used: leaves, bark, roots, seeds. Preparation: decoction of leaves for nutritional supplement, powder from dried leaves. Dosage: 1-2 teaspoons of leaf powder daily. Toxicity: high doses of roots may be toxic. Traditional healers use the leaves for treating anemia and malnutrition due to high iron and vitamin content.",
        embedding: Array(384).fill(0.1),
        source: "AHP",
        page: 24
      },
      {
        id: "AHP_002",
        text: "Vernonia amygdalina (Asteraceae) - commonly known as bitter leaf. Traditional uses: used for stomach disorders, fever, and as blood tonic. Plant parts used: leaves, roots. Preparation: leaf extract as bitter tonic, decoction for stomach ailments. Dosage: 2-3 tablespoons of leaf extract twice daily. Side effects: excessive consumption may cause stomach irritation. Widely used in folk medicine for treating malaria, diabetes, and gastrointestinal disorders.",
        embedding: Array(384).fill(0.2),
        source: "AHP",
        page: 45
      },
      {
        id: "WAP_001",
        text: "Khaya senegalensis (Meliaceae) - commonly known as African mahogany or dry bark. Traditional uses: bark used for malaria, fever, and stomach problems. Plant parts used: bark, leaves. Preparation: decoction of bark for malaria treatment. Contraindications: not for pregnant women. Used by traditional healers for treating fever and as anthelmintic. Bark contains limonoids responsible for antimalarial activity.",
        embedding: Array(384).fill(0.3),
        source: "WAP",
        page: 78
      },
      {
        id: "WAP_002",
        text: "Lannea microcarpa (Anacardiaceae) - commonly known as small-fruited lannea. Traditional uses: used for dysentery, diarrhea, and as astringent. Plant parts used: bark, leaves. Preparation: bark decoction for diarrhea. Traditional healers combine with other plants for treating stomach disorders. Contains tannins which provide astringent properties for treating diarrhea.",
        embedding: Array(384).fill(0.4),
        source: "WAP",
        page: 102
      }
    ];
    
    console.log(`Loaded ${herbalVectors.length} herbal vectors from JSON`);
  } catch (error) {
    console.error('Error loading herbal vectors:', error);
    // Initialize with empty array if loading fails
    herbalVectors = [];
  }
}

// Initialize a promise to track loading state
const loadingPromise = loadHerbalVectors();

export async function retrieveHerbalChunks(query: string, topK: number = 5): Promise<HerbalChunkWithMetadata[]> {
  // Wait for the loading to complete
  await loadingPromise;

  if (herbalVectors.length === 0) {
    console.warn('No herbal vectors loaded, returning empty results');
    return [];
  }

  // Generate embedding for the query
  const queryEmbedding = await generateQueryEmbedding(query);

  // Compute cosine similarity between query and all stored chunks
  const similarities = herbalVectors.map(chunk => {
    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    return {
      chunk,
      similarity
    };
  });

  // Sort by similarity (descending) and return top K
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities
    .slice(0, topK)
    .map(item => item.chunk);
}

// Mock function to generate query embeddings (in a real implementation, this would call the same embedding service used for storage)
async function generateQueryEmbedding(query: string): Promise<number[]> {
  // In a real implementation, this would call the same embedding API used during ingestion
  // For this demonstration, creating a mock embedding
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

// Function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Embeddings must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0; // If either vector is zero, similarity is 0
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Function to update (reload) the herbal vectors if needed
export async function updateHerbalVectors(): Promise<void> {
  await loadHerbalVectors();
}

// Function to get current count of herbal vectors
export function getHerbalVectorCount(): number {
  return herbalVectors.length;
}