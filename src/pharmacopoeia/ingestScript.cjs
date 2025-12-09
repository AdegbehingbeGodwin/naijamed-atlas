const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.12.313/build/pdf.worker.min.js`;

async function extractPdfText(filePath) {
  try {
    // Read the PDF file
    const dataBuffer = fs.readFileSync(filePath);
    
    // Load the PDF
    const pdf = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
    const pageCount = pdf.numPages;
    
    let fullText = '';
    
    // Extract text from each page
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Join the items to form the page text
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += ` [PAGE ${i}] ${pageText} `;
    }
    
    return fullText;
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error);
    throw error;
  }
}

function splitIntoChunks(text, maxChunkSize = 400) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence + ' ';
      } else {
        // If a single sentence is longer than maxChunkSize, break it
        if (sentence.length > maxChunkSize) {
          const sentenceChunks = breakLongSentence(sentence, maxChunkSize);
          chunks.push(...sentenceChunks);
        }
      }
    } else {
      currentChunk += sentence + ' ';
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function breakLongSentence(sentence, maxChunkSize) {
  const chunks = [];
  const words = sentence.split(/\s+/);
  let currentChunk = '';
  
  for (const word of words) {
    if ((currentChunk + word).length > maxChunkSize) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = word + ' ';
      } else {
        // If a single word is longer than maxChunkSize, force break it
        if (word.length > maxChunkSize) {
          for (let i = 0; i < word.length; i += maxChunkSize) {
            chunks.push(word.substring(i, i + maxChunkSize));
          }
        }
      }
    } else {
      currentChunk += word + ' ';
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// This is a simplified embedding function - in production, you would use a proper embedding API
function createMockEmbedding(text) {
  // Create a simple hash-based embedding for demonstration
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Normalize the hash and create a 128-dimension embedding
  const embedding = new Array(128).fill(0);
  for (let i = 0; i < embedding.length; i++) {
    embedding[i] = Math.abs(Math.sin(hash + i)) % 1;
  }
  
  return embedding;
}

async function processPdf(pdfPath, source) {
  console.log(`Processing ${source} from ${pdfPath}...`);
  
  const text = await extractPdfText(pdfPath);
  
  // Identify plant entries (this is a simple approach - could be made more sophisticated)
  const plantEntries = findPlantEntries(text);
  
  const chunks = [];
  let idCounter = 1;
  
  for (const entry of plantEntries) {
    // Split each plant entry into chunks
    const entryChunks = splitIntoChunks(entry.text);
    
    for (let i = 0; i < entryChunks.length; i++) {
      const chunk = {
        id: `${source}_${idCounter++}`,
        text: entryChunks[i],
        embedding: createMockEmbedding(entryChunks[i]),
        source: source,
        page: entry.page
      };
      chunks.push(chunk);
    }
  }
  
  console.log(`Extracted ${chunks.length} chunks from ${source}`);
  return chunks;
}

function findPlantEntries(text) {
  // This is a simple pattern to identify plant entries in the text
  // In a real implementation, this would be more sophisticated
  const entries = [];
  
  // Split by paragraphs and identify those that likely contain plant information
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    // Look for patterns that indicate plant entries
    if (hasPlantIndicators(paragraph)) {
      // Find the page number this paragraph is from
      const pageMatch = paragraph.match(/\[PAGE (\d+)\]/);
      const page = pageMatch ? parseInt(pageMatch[1]) : 1;
      
      entries.push({
        text: paragraph.replace(/\[PAGE \d+\]/g, '').trim(),
        page: page
      });
    }
  }
  
  return entries;
}

function hasPlantIndicators(text) {
  // Look for common indicators of plant descriptions
  const indicators = [
    // Scientific name patterns (Genus species)
    /[A-Z][a-z]+\s+[a-z]+/,
    // Common plant family names
    /aceae|aceas|acear|idae|anae/i,
    // Keywords related to plants
    /leaf|leaves|bark|root|stem|flower|fruit|seed|traditional|medicinal|ethnobotanical|phytochemical|alkaloid|flavonoid|terpenoid|saponin|tannin/i
  ];
  
  return indicators.some(pattern => pattern.test(text));
}

async function main() {
  try {
    const currentDir = process.cwd();
    
    // Define the PDF paths
    const ahpPdfPath = path.join(currentDir, 'African Pharmacopoeia.pdf');
    const wapPdfPath = path.join(currentDir, 'west-african-herbal-pharmacopoeiaok.pdf');
    
    // Check if PDF files exist
    if (!fs.existsSync(ahpPdfPath)) {
      console.error(`File not found: ${ahpPdfPath}`);
      return;
    }
    
    if (!fs.existsSync(wapPdfPath)) {
      console.error(`File not found: ${wapPdfPath}`);
      return;
    }
    
    // Process both PDFs
    const ahpChunks = await processPdf(ahpPdfPath, 'AHP');
    const wapChunks = await processPdf(wapPdfPath, 'WAP');
    
    // Combine all chunks
    const allChunks = [...ahpChunks, ...wapChunks];
    
    // Save to JSON file
    const outputDir = path.join(currentDir, 'src', 'pharmacopoeia');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, 'herbal_vectors.json');
    fs.writeFileSync(outputPath, JSON.stringify(allChunks, null, 2));
    
    console.log(`Successfully processed ${allChunks.length} chunks and saved to ${outputPath}`);
    console.log('AHP chunks:', ahpChunks.length);
    console.log('WAP chunks:', wapChunks.length);
    
  } catch (error) {
    console.error('Error in ingestion process:', error);
  }
}

// Run the script if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  extractPdfText,
  splitIntoChunks,
  processPdf,
  findPlantEntries
};