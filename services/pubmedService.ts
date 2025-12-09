import { PubMedArticle } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
// For development, the proxy runs on port 5000
// For production, you would deploy this proxy separately

// Common conversational words to strip.
// "treatment" and "cure" are removed to allow finding botanical descriptions that might not explicitly say "treatment" in the title/abstract keywords but contain the info.
const STOP_WORDS = new Set([
  'what', 'is', 'the', 'are', 'how', 'does', 'do', 'can', 'could', 'should',
  'would', 'tell', 'me', 'about', 'find', 'search', 'looking', 'for', 'in',
  'of', 'to', 'a', 'an', 'local', 'name', 'names', 'called', 'known', 'as',
  'medicine', 'traditional', 'herbal', 'remedy', 'cure', 'treatment', 'use', 'uses', 'used',
  'nigeria', 'nigerian' // We add location context manually, so strip it from the keyword to avoid duplication like "Nigeria AND Nigeria"
]);

// Tier 1 & 3 Context: Medical/Ethnobotanical Focus
const MEDICINE_CONTEXT = `(Traditional Medicine OR Herbal Medicine OR Ethnobotany OR Phytomedicine OR
"Medicinal Plants" OR Ethnomedicine OR "Indigenous Knowledge" OR "Folk Medicine" OR
"Plant Extract" OR Bioactive OR Pharmacology OR Toxicity OR Phytochemical OR "Natural Product" OR
"Proximate Analysis" OR "Nutritional Value" OR "Therapeutic")`;

// Tier 3 Location: Regional Fallback
const REGIONAL_CONTEXT = `("West Africa" OR Africa OR Ghana OR Benin OR Cameroon)`;

const LOCATION_CONTEXT = `(Nigeria OR Nigerian)`;

/**
 * Removes stop words to extract core subject matter
 * e.g. "what is the local name for jute leaf in nigeria" -> "jute leaf"
 */
const cleanQuery = (query: string): string => {
  const words = query.toLowerCase().split(/[\s,?.!]+/);
  const filtered = words.filter(word => word.length > 2 && !STOP_WORDS.has(word));
  return filtered.join(' ');
};

const executeSearch = async (term: string): Promise<string[]> => {
  const encodedTerm = encodeURIComponent(term);
  // Using our proxy endpoint instead of direct PubMed API
  const url = `${BASE_URL}/pubmed/search?term=${encodedTerm}`;

  try {
    console.log("Making PubMed search request to:", url);
    const response = await fetch(url);
    console.log("PubMed search proxy response status:", response.status);
    console.log("Response headers:", [...response.headers.entries()]);

    if (!response.ok) {
      console.error(`PubMed search failed with status ${response.status}:`, response.statusText);
      const errorText = await response.text();
      console.error("Error response body:", errorText);
      return [];
    }

    const data = await response.json();
    console.log("PubMed search response data:", data);

    if (!data || !data.esearchresult) {
      console.error("Invalid response format from PubMed proxy:", data);
      return [];
    }

    const idlist = data.esearchresult?.idlist || [];
    console.log(`Found ${idlist.length} IDs for term: ${term}`);
    return idlist;
  } catch (error) {
    console.error("PubMed Search Error:", error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error("Network error - is the backend server running on http://localhost:5000?");
    }
    return [];
  }
};

/**
 * Searches PubMed with a 3-Tier Strategy to maximize results.
 * @param query User's input
 * @param onProgress Callback to update UI status message
 */
export const searchPubMedIds = async (query: string, onProgress?: (msg: string) => void): Promise<string[]> => {
  const cleanedKeywords = cleanQuery(query);
  const coreQuery = cleanedKeywords || query; 
  
  // STRATEGY 1: Strict National Medical Search
  // High precision: Specific plant/topic + Nigeria + Medical Context
  if (onProgress) onProgress("Searching Nigerian medical archives...");
  const strictTerm = `(${coreQuery}) AND ${LOCATION_CONTEXT} AND ${MEDICINE_CONTEXT}`;
  let ids = await executeSearch(strictTerm);
  if (ids.length > 0) return ids;

  // STRATEGY 2: Broad National Search
  // Medium precision: Just the topic + Nigeria.
  // Useful for agricultural/botanical papers that mention the plant in Nigeria but aren't tagged "Medicine".
  if (onProgress) onProgress("Broadening search to Nigerian botanical records...");
  console.log("Tier 1 empty. Trying Tier 2 (Broad National)...");
  const broadTerm = `(${coreQuery}) AND ${LOCATION_CONTEXT}`;
  ids = await executeSearch(broadTerm);
  if (ids.length > 0) return ids;

  // STRATEGY 3: Regional Ethnobotany Search
  // Broad scope: Topic + West Africa/Africa + Medical Context.
  // "If it grows in Ghana, the traditional use is likely similar."
  if (onProgress) onProgress("Checking West African regional research...");
  console.log("Tier 2 empty. Trying Tier 3 (Regional)...");
  const regionalTerm = `(${coreQuery}) AND ${REGIONAL_CONTEXT} AND ${MEDICINE_CONTEXT}`;
  ids = await executeSearch(regionalTerm);

  return ids;
};

export const fetchArticleDetails = async (ids: string[]): Promise<PubMedArticle[]> => {
  if (ids.length === 0) {
    console.log("No IDs provided to fetchArticleDetails");
    return [];
  }

  // Using our proxy endpoint instead of direct PubMed API
  const idsParam = ids.join(',');
  const url = `${BASE_URL}/pubmed/fetch?ids=${idsParam}`;

  try {
    console.log("Making PubMed fetch request to proxy:", url);
    const response = await fetch(url);
    console.log("PubMed fetch proxy response status:", response.status);
    console.log("Response headers:", [...response.headers.entries()]);

    if (!response.ok) {
      console.error(`PubMed fetch failed with status ${response.status}:`, response.statusText);
      const errorText = await response.text();
      console.error("Error response body:", errorText);
      return [];
    }

    const xmlText = await response.text();
    console.log("PubMed fetch proxy response length:", xmlText.length);

    if (!xmlText || xmlText.length === 0) {
      console.error("Empty response from PubMed fetch proxy");
      return [];
    }

    // Parse the XML response from the proxy
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.error("XML parsing error:", parserError.textContent);
      console.error("Raw XML response:", xmlText.substring(0, 500) + "...");
      return [];
    }

    const articles: PubMedArticle[] = [];
    const pubmedArticles = xmlDoc.getElementsByTagName("PubmedArticle");
    console.log(`Found ${pubmedArticles.length} articles in XML response`);

    if (pubmedArticles.length === 0) {
      console.log("No PubmedArticle elements found in XML response");
      return [];
    }

    for (let i = 0; i < pubmedArticles.length; i++) {
      const articleNode = pubmedArticles[i];

      const pmid = articleNode.querySelector("PMID")?.textContent || "";
      const title = articleNode.querySelector("ArticleTitle")?.textContent || "No Title Available";

      const abstractTexts = articleNode.querySelectorAll("AbstractText");
      let abstract = "";
      abstractTexts.forEach((node) => {
        const label = node.getAttribute("Label");
        abstract += (label ? `**${label}**: ` : "") + (node.textContent || "") + " ";
      });
      if (!abstract) abstract = "No abstract available.";

      const authorNodes = articleNode.querySelectorAll("Author");
      const authors: string[] = [];
      authorNodes.forEach(node => {
        const lastName = node.querySelector("LastName")?.textContent || "";
        const initials = node.querySelector("Initials")?.textContent || "";
        if (lastName) authors.push(`${lastName} ${initials}`);
      });

      const journal = articleNode.querySelector("Title")?.textContent || "Unknown Journal";
      const year = articleNode.querySelector("PubDate > Year")?.textContent || "";
      const month = articleNode.querySelector("PubDate > Month")?.textContent || "";

      articles.push({
        pmid,
        title,
        abstract: abstract.trim(),
        authors: authors.slice(0, 5),
        journal,
        pubDate: `${month} ${year}`.trim(),
      });
    }

    console.log(`Successfully parsed ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error("Error fetching article details:", error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error("Network error - is the backend server running on http://localhost:5000?");
    }
    return [];
  }
};