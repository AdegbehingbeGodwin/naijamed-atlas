import { ParsedHerbalDocument, HerbalChunk, ChunkHerbalOptions } from './herbalTypes';

export function chunkHerbalDocument(
  parsed: ParsedHerbalDocument,
  options?: ChunkHerbalOptions
): HerbalChunk[] {
  const opts = {
    maxChunkSize: 1000,
    overlap: 100,
    preserveSections: true,
    ...options
  };

  const chunks: HerbalChunk[] = [];

  // Process each plant record separately to maintain context
  parsed.plants.forEach((plant, plantIndex) => {
    // Create chunks for each plant, preserving semantic boundaries
    const plantChunks = createPlantChunks(plant, plantIndex, opts);
    chunks.push(...plantChunks);
  });

  return chunks;
}

function createPlantChunks(plant: any, plantIndex: number, options: ChunkHerbalOptions): HerbalChunk[] {
  const chunks: HerbalChunk[] = [];
  
  // Define sections that should be kept together when possible
  const plantSections = getPlantSections(plant);
  
  // Process each section separately, with additional context chunks
  for (const [sectionName, sectionContent] of Object.entries(plantSections)) {
    if (!sectionContent || typeof sectionContent !== 'string') continue;
    
    if (sectionContent.length <= options.maxChunkSize) {
      // If the section fits in a single chunk, use it as is
      chunks.push({
        content: sectionContent,
        plant: plant.botanicalName,
        section: sectionName,
        plantIndex,
        metadata: { sectionType: sectionName }
      });
    } else {
      // If the section is too long, break it down while preserving meaning
      const sectionChunks = breakLongSection(sectionContent, options);
      
      sectionChunks.forEach((chunkContent, i) => {
        chunks.push({
          content: chunkContent,
          plant: plant.botanicalName,
          section: `${sectionName}-${i+1}`,
          plantIndex,
          metadata: { 
            sectionType: sectionName,
            chunkIndex: i,
            totalChunks: sectionChunks.length
          }
        });
      });
    }
  }
  
  // Create an overview chunk with key information
  const overview = createPlantOverview(plant);
  if (overview.length > 0) {
    chunks.push({
      content: overview,
      plant: plant.botanicalName,
      section: 'overview',
      plantIndex,
      metadata: { sectionType: 'overview' }
    });
  }
  
  return chunks;
}

function getPlantSections(plant: any): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Add botanical information
  if (plant.botanicalName) {
    sections['botanical'] = `Botanical Name: ${plant.botanicalName}`;
    if (plant.plantFamily) {
      sections['botanical'] += `\nFamily: ${plant.plantFamily}`;
    }
    if (plant.synonyms && plant.synonyms.length > 0) {
      sections['botanical'] += `\nSynonyms: ${plant.synonyms.join(', ')}`;
    }
    if (plant.localNames && plant.localNames.length > 0) {
      sections['botanical'] += `\nLocal Names: ${plant.localNames.join(', ')}`;
    }
  }
  
  // Add plant parts used
  if (plant.plantPartsUsed && plant.plantPartsUsed.length > 0) {
    sections['plant_parts'] = `Plant Parts Used: ${plant.plantPartsUsed.join(', ')}`;
  }
  
  // Add phytochemical constituents
  if (plant.phytochemicalConstituents && plant.phytochemicalConstituents.length > 0) {
    sections['phytochemicals'] = `Phytochemical Constituents: ${plant.phytochemicalConstituents.join(', ')}`;
  }
  
  // Add traditional uses
  if (plant.traditionalUses && plant.traditionalUses.length > 0) {
    sections['traditional_uses'] = `Traditional Uses: ${plant.traditionalUses.join('; ')}`;
  }
  
  // Add pharmacological actions
  if (plant.pharmacologicalActions && plant.pharmacologicalActions.length > 0) {
    sections['pharmacological_actions'] = `Pharmacological Actions: ${plant.pharmacologicalActions.join(', ')}`;
  }
  
  // Add preparation methods
  if (plant.preparationMethods) {
    sections['preparation'] = `Preparation Methods: ${plant.preparationMethods}`;
  }
  
  // Add dosage information
  if (plant.dosageAndAdministration) {
    sections['dosage'] = `Dosage and Administration: ${plant.dosageAndAdministration}`;
  }
  
  // Add toxicology information
  if (plant.toxicology) {
    sections['toxicology'] = `Toxicology: ${plant.toxicology}`;
  }
  
  // Add contraindications
  if (plant.contraindications && plant.contraindications.length > 0) {
    sections['contraindications'] = `Contraindications: ${plant.contraindications.join(', ')}`;
  }
  
  // Add drug interactions
  if (plant.drugInteractions && plant.drugInteractions.length > 0) {
    sections['interactions'] = `Drug Interactions: ${plant.drugInteractions.join('; ')}`;
  }
  
  // Add side effects
  if (plant.sideEffects) {
    sections['side_effects'] = `Side Effects: ${plant.sideEffects}`;
  }
  
  // Add conservation and distribution
  if (plant.conservationStatus) {
    sections['conservation'] = `Conservation Status: ${plant.conservationStatus}`;
  }
  if (plant.geographicalDistribution) {
    sections['distribution'] = `Geographical Distribution: ${plant.geographicalDistribution}`;
  }
  
  return sections;
}

function breakLongSection(content: string, options: ChunkHerbalOptions): string[] {
  const chunks: string[] = [];
  const sentences = content.split(/(?<=[.!?])\s+/);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= options.maxChunkSize) {
      currentChunk += sentence + ' ';
    } else {
      // If adding this sentence would exceed the limit
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence + ' ';
      } else {
        // If a single sentence is too long, break it by words
        const words = sentence.split(/\s+/);
        let wordChunk = '';
        
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= options.maxChunkSize) {
            wordChunk += word + ' ';
          } else {
            if (wordChunk.trim().length > 0) {
              chunks.push(wordChunk.trim());
            }
            wordChunk = word + ' ';
          }
        }
        
        if (wordChunk.trim().length > 0) {
          chunks.push(wordChunk.trim());
        }
      }
    }
  }
  
  // Add the last chunk if it exists
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function createPlantOverview(plant: any): string {
  const overviewParts = [];
  
  if (plant.botanicalName) {
    overviewParts.push(`Plant: ${plant.botanicalName}`);
  }
  
  if (plant.plantFamily) {
    overviewParts.push(`Family: ${plant.plantFamily}`);
  }
  
  if (plant.traditionalUses && plant.traditionalUses.length > 0) {
    overviewParts.push(`Traditional Uses: ${plant.traditionalUses.slice(0, 3).join('; ')}`); // Limit to first 3 uses
  }
  
  if (plant.pharmacologicalActions && plant.pharmacologicalActions.length > 0) {
    overviewParts.push(`Pharmacological Actions: ${plant.pharmacologicalActions.slice(0, 3).join(', ')}`); // Limit to first 3 actions
  }
  
  if (plant.plantPartsUsed && plant.plantPartsUsed.length > 0) {
    overviewParts.push(`Parts Used: ${plant.plantPartsUsed.join(', ')}`);
  }
  
  if (plant.phytochemicalConstituents && plant.phytochemicalConstituents.length > 0) {
    overviewParts.push(`Key Phytochemicals: ${plant.phytochemicalConstituents.slice(0, 5).join(', ')}`); // Limit to first 5
  }
  
  return overviewParts.join('\n');
}