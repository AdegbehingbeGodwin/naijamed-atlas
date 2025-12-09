export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  pubDate: string;
  doi?: string;
  imageUrl?: string;  // Optional URL for image associated with the article
  imageAlt?: string;  // Alternative text for the image
  imageCaption?: string;  // Caption for the image
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isError?: boolean;
}

export enum AppMode {
  LANDING = 'LANDING',
  SEARCHING = 'SEARCHING',
  RESULTS = 'RESULTS'
}

// Nigerian plant data structure for OrisaBot
export interface NigerianPlantData {
  scientificName: string;
  commonName: string;
  names: {
    yoruba?: string;
    igbo?: string;
    hausa?: string;
    edo?: string;
    efik?: string;
    fulfulde?: string;
    urhobo?: string;
    pidgin?: string;
  };
  metadata: {
    isNative: boolean;
    availability: 'common' | 'seasonal' | 'rare' | 'imported';
    regions: string[];
    conservationStatus?: 'safe' | 'vulnerable' | 'endangered';
  };
  traditionalUses: {
    condition: string;
    preparation: string;
    dosage: string;
    warning?: string;
  }[];
  pharmacologicalData?: {
    keyCompounds: string[];
    mechanisms: string[];
    clinicalTrialPhase?: 1 | 2 | 3 | 4;
  };
  lastUpdated: Date;
  confidenceScore: number; // 0-100
}

export interface UserProfile {
  age: number;
  location: string;
  interests?: string[];
  healthConditions?: string[];
}

export interface SearchContext {
  query: string;
  timestamp: Date;
  articleCount: number;
}