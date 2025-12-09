// This is a wrapper service for RAG functionality
// It uses either Gemini or Groq based on the environment variable

import { PubMedArticle } from "../types";
import { generateRAGResponse as generateGeminiRAGResponse } from "./geminiService";
import { generateRAGResponse as generateGroqRAGResponse } from "./groqService";

export const generateRAGResponse = async (query: string, articles: PubMedArticle[]): Promise<string> => {
  const provider = import.meta.env.VITE_AI_PROVIDER || 'groq'; // Default to groq

  try {
    if (provider === 'gemini') {
      return await generateGeminiRAGResponse(query, articles);
    } else {
      return await generateGroqRAGResponse(query, articles);
    }
  } catch (error) {
    console.error("RAG Service Error:", error);
    throw error;
  }
};