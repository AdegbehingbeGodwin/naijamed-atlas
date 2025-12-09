import pdfjsLib from 'pdfjs-dist';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import { ParsedHerbalDocument, HerbalPlantRecord, ParseHerbalOptions } from './herbalTypes';

// Set the worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function parseHerbalPDF(
  filePath: string,
  options?: ParseHerbalOptions
): Promise<ParsedHerbalDocument> {
  const opts = {
    enhanced: true,
    preserveFormatting: true,
    extractTables: true,
    ...options
  };

  try {
    // Load the PDF file
    const response = await fetch(filePath);
    const uint8Array = new Uint8Array(await response.arrayBuffer());
    
    const pdf = await pdfjsLib.getDocument(uint8Array).promise;
    const pageCount = pdf.numPages;
    
    let fullText = '';
    const pageTexts: string[] = [];

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const pageTextContent = await page.getTextContent();
      
      // Join the items to form the page text
      const pageText = pageTextContent.items
        .map((item: any) => item.str)
        .join('');
      
      pageTexts.push(pageText);
      fullText += pageText + ' \n';
    }

    // Parse the herbal document
    const parsedDocument = parseHerbalDocument(fullText, opts);
    parsedDocument.metadata = {
      ...parsedDocument.metadata,
      pageCount,
      source: filePath,
      extractionDate: new Date().toISOString()
    };

    return parsedDocument;
  } catch (error) {
    console.error('Error parsing herbal PDF:', error);
    throw error;
  }
}

function parseHerbalDocument(text: string, options: ParseHerbalOptions): ParsedHerbalDocument {
  const plants: HerbalPlantRecord[] = [];
  const metadata: Record<string, any> = {};

  // Enhanced parsing based on domain knowledge of herbal/pharmacopoeia documents
  const sections = splitByPlantSections(text, options);

  sections.forEach((section, index) => {
    const plantRecord = extractPlantInformation(section, index);
    if (plantRecord && plantRecord.botanicalName) {
      plants.push(plantRecord);
    }
  });

  return {
    plants,
    rawText: text,
    metadata,
    pageCount: undefined // Will be set after PDF loading
  };
}

function splitByPlantSections(text: string, options: ParseHerbalOptions): string[] {
  // Regular expressions to identify plant section breaks
  const plantSectionRegexes = [
    // Matches botanical names (Genus species) at the start of lines
    /(?:^|\n)([A-Z][a-z]+ [a-z]+(?: [a-z]+)?)(?= |\n)/g,
    // Matches common headers for plant entries
    /(?:^|\n)(?:Species|Plant|Botanical|Herb|Phytochemical|Medicinal Plant)[^\n]*\n(?:[A-Z][a-z]+ [a-z]+)/g,
    // Matches "Family: " or "Fam: " entries
    /(?:^|\n)(?:Family|Fam): [A-Z][a-z]+/g
  ];

  // Try to identify plant sections based on botanical nomenclature
  const lines = text.split('\n');
  const sections: string[] = [];
  let currentSection = '';
  
  for (const line of lines) {
    // Check if this line starts a new plant section
    if (isBotanicalNameLine(line)) {
      if (currentSection.trim() !== '') {
        sections.push(currentSection);
      }
      currentSection = line;
    } else {
      currentSection += '\n' + line;
    }
  }
  
  if (currentSection.trim() !== '') {
    sections.push(currentSection);
  }

  return sections;
}

function isBotanicalNameLine(line: string): boolean {
  // Check if the line contains a potential botanical name
  const trimmedLine = line.trim();
  
  // Look for Latin binomial nomenclature: Genus species
  const binomialRegex = /^[A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?/; // Basic pattern
  
  // Common prefixes that indicate a plant name section
  const prefixes = ['Family:', 'Fam:', 'Species:', 'Plant:', 'Botanical:', 'Herb:'];
  
  // Check if line starts with botanical name pattern
  if (binomialRegex.test(trimmedLine)) {
    // Additional validation: ensure it's not just a regular sentence
    const words = trimmedLine.split(/\s+/);
    if (words.length <= 3) { // Likely a botanical name
      return true;
    }
  }
  
  // Check for section headers that typically precede plant info
  return prefixes.some(prefix => trimmedLine.startsWith(prefix));
}

function extractPlantInformation(section: string, index: number): HerbalPlantRecord | null {
  const record: HerbalPlantRecord = {
    botanicalName: '',
    metadata: {
      pages: [index], // Placeholder - actual page numbers would need more sophisticated tracking
      sections: ['unknown'],
      confidence: 0.8 // Default confidence
    }
  };

  // Extract botanical name (usually the first significant line)
  const lines = section.split('\n');
  for (const line of lines) {
    const botanicalMatch = line.match(/^([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)/);
    if (botanicalMatch) {
      record.botanicalName = botanicalMatch[1].trim();
      break;
    }
  }

  if (!record.botanicalName) {
    return null; // Not a valid plant record
  }

  // Extract plant family
  const familyMatch = section.match(/(?:Family|Fam|Familia):\s*([A-Z][a-z]+)/i);
  if (familyMatch) {
    record.plantFamily = familyMatch[1];
  }

  // Extract local/ethnobotanical names
  const localNamesMatch = section.match(/(?:Local names?|Common names?|Names?):\s*([^\n.]+)/i);
  if (localNamesMatch) {
    record.localNames = parseNamesList(localNamesMatch[1]);
  }

  // Extract synonyms
  const synonymsMatch = section.match(/(?:Synonyms?|Also known as):\s*([^\n.]+)/i);
  if (synonymsMatch) {
    record.synonyms = parseNamesList(synonymsMatch[1]);
  }

  // Extract plant parts used
  const partsMatch = section.match(/(?:Parts used|Plant parts?):\s*([^\n.]+)/i);
  if (partsMatch) {
    record.plantPartsUsed = parseNamesList(partsMatch[1]);
  }

  // Extract phytochemical constituents
  const phytochemicalsMatch = section.match(/(?:Phytochemical|Chemical|Active compounds?):\s*([^\n.]+)/gi);
  if (phytochemicalsMatch) {
    // We need a more sophisticated approach to get all matches
    const allPhytoMatches = section.match(/(?:Phytochemical|Chemical|Active compounds?):\s*([^\n.]+)/gi);
    if (allPhytoMatches) {
      record.phytochemicalConstituents = [];
      for (const match of allPhytoMatches) {
        const constituents = match.replace(/(?:Phytochemical|Chemical|Active compounds?):\s*/i, '').trim();
        record.phytochemicalConstituents.push(...parseNamesList(constituents));
      }
    }
  }

  // Extract traditional uses
  const usesMatch = section.match(/(?:Traditional uses?|Uses?|Medical uses?):\s*([^\n.]+)/i);
  if (usesMatch) {
    record.traditionalUses = [usesMatch[1].trim()];
  }

  // Extract preparation methods
  const prepMatch = section.match(/(?:Preparation|Method|How to use):\s*([^\n.]+)/i);
  if (prepMatch) {
    record.preparationMethods = prepMatch[1].trim();
  }

  // Extract dosage
  const dosageMatch = section.match(/(?:Dosage|Dose|Amount):\s*([^\n.]+)/i);
  if (dosageMatch) {
    record.dosageAndAdministration = dosageMatch[1].trim();
  }

  // Extract toxicology information
  const toxMatch = section.match(/(?:Toxicity|Toxic|Side effects?|Safety):\s*([^\n.]+)/i);
  if (toxMatch) {
    record.toxicology = toxMatch[1].trim();
  }

  // Extract contraindications
  const contraMatch = section.match(/(?:Contraindications?|Avoid if|Not for):\s*([^\n.]+)/i);
  if (contraMatch) {
    record.contraindications = parseNamesList(contraMatch[1]);
  }

  // Extract drug interactions
  const interactionMatch = section.match(/(?:Interactions?|With drugs?|Combines with):\s*([^\n.]+)/i);
  if (interactionMatch) {
    record.drugInteractions = [interactionMatch[1].trim()];
  }

  // Extract geographical distribution
  const geoMatch = section.match(/(?:Distribution|Native to|Found in|Geographic):\s*([^\n.]+)/i);
  if (geoMatch) {
    record.geographicalDistribution = geoMatch[1].trim();
  }

  // Extract conservation status
  const conservationMatch = section.match(/(?:Conservation|Status|Threatened):\s*([^\n.]+)/i);
  if (conservationMatch) {
    record.conservationStatus = conservationMatch[1].trim();
  }

  return record;
}

function parseNamesList(namesString: string): string[] {
  // Split by common delimiters and clean up
  return namesString
    .split(/,|;|and|&/)
    .map(name => name.trim())
    .filter(name => name.length > 0);
}