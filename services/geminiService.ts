import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { PubMedArticle } from "../types";
import { retrieveHerbalChunks } from "../src/pharmacopoeia/localRetriever";

const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
};

const getGroqClient = () => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not found in environment variables");
  }
  return new Groq({ apiKey, dangerouslyAllowBrowser: true });
};

/**
 * Interface for Nigerian plant name data
 */
interface NigerianPlantNames {
  scientificName: string;
  commonName: string;
  yoruba?: string;
  igbo?: string;
  hausa?: string;
  edo?: string;
  efik?: string;
  pidgin?: string;
  isNative: boolean;
  notes?: string;
}

/**
 * Extracts plant scientific names from PubMed articles
 */
const extractPlantNames = (articles: PubMedArticle[]): string[] => {
  const plantNames = new Set<string>();

  articles.forEach(article => {
    const fullText = `${article.title} ${article.abstract}`;

    // Pattern 1: Genus species (italicized or not)
    const scientificPattern = /\b([A-Z][a-z]+)\s+([a-z]+)\s*(?:L\.|Linn\.)?\b/g;
    const matches = fullText.matchAll(scientificPattern);

    for (const match of matches) {
      const genus = match[1];
      const species = match[2];
      const fullName = `${genus} ${species}`;

      // Filter out common false positives
      const blacklist = ['United States', 'New York', 'South Africa', 'North America',
        'West Africa', 'East Asia', 'European Union', 'In vitro',
        'In vivo', 'Et al'];

      if (!blacklist.some(term => fullName === term) && species.length > 3) {
        plantNames.add(fullName);
      }
    }
  });

  return Array.from(plantNames);
};

/**
 * Fetch Nigerian traditional names using Groq (faster, free tier available)
 */
const fetchNigerianNamesGroq = async (scientificName: string): Promise<NigerianPlantNames> => {
  const groq = getGroqClient();

  const prompt = `You are an expert ethnobotanist specializing in Nigerian traditional medicine. 
  
Search your knowledge for Nigerian traditional names for: "${scientificName}"

Provide ONLY a JSON object (no markdown, no backticks, no preamble) with this structure:
{
  "scientificName": "${scientificName}",
  "commonName": "common English name",
  "yoruba": "Yoruba name or null",
  "igbo": "Igbo name or null", 
  "hausa": "Hausa name or null",
  "edo": "Edo name or null",
  "efik": "Efik/Ibibio name or null",
  "pidgin": "Nigerian Pidgin name or null",
  "isNative": true or false (is it native to Nigeria/West Africa),
  "notes": "brief note about availability in Nigeria or null"
}

If you don't know a name, use null. Be accurate - don't guess.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile", // Fast and accurate
      temperature: 0.1,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";

    // Clean up any markdown formatting
    const cleanedText = responseText
      .replace(/```json\n?|\n?```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);
    return parsed;
  } catch (error) {
    console.error(`Error fetching names for ${scientificName}:`, error);
    return {
      scientificName,
      commonName: scientificName,
      isNative: false,
      notes: "Could not retrieve traditional names"
    };
  }
};

/**
 * Fetch Nigerian traditional names using Gemini (with grounding/search)
 */
const fetchNigerianNamesGemini = async (scientificName: string): Promise<NigerianPlantNames> => {
  const genAI = getGeminiClient();

  // Gemini 2.0 Flash has grounding capabilities
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
    }
  });

  const prompt = `Search for Nigerian traditional names for the plant: "${scientificName}"

Look for names in these Nigerian languages:
- Yoruba
- Igbo
- Hausa
- Edo
- Efik/Ibibio
- Nigerian Pidgin

Return ONLY a JSON object (no markdown, no backticks) with this structure:
{
  "scientificName": "${scientificName}",
  "commonName": "common English name",
  "yoruba": "Yoruba name or null",
  "igbo": "Igbo name or null",
  "hausa": "Hausa name or null",
  "edo": "Edo name or null",
  "efik": "Efik name or null",
  "pidgin": "Nigerian Pidgin name or null",
  "isNative": true or false,
  "notes": "brief note or null"
}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean markdown formatting
    const cleanedText = responseText
      .replace(/```json\n?|\n?```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);
    return parsed;
  } catch (error) {
    console.error(`Error fetching names for ${scientificName}:`, error);
    return {
      scientificName,
      commonName: scientificName,
      isNative: false,
      notes: "Could not retrieve traditional names"
    };
  }
};

/**
 * Batch fetch Nigerian names for multiple plants
 */
const fetchAllNigerianNames = async (
  plantNames: string[],
  useGroq: boolean = true
): Promise<Map<string, NigerianPlantNames>> => {
  const nameMap = new Map<string, NigerianPlantNames>();

  console.log(`Fetching Nigerian names for ${plantNames.length} plants using ${useGroq ? 'Groq' : 'Gemini'}...`);

  // Process in batches to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < plantNames.length; i += batchSize) {
    const batch = plantNames.slice(i, i + batchSize);

    const promises = batch.map(name =>
      useGroq ? fetchNigerianNamesGroq(name) : fetchNigerianNamesGemini(name)
    );

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        nameMap.set(batch[index], result.value);
      }
    });

    // Small delay between batches
    if (i + batchSize < plantNames.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return nameMap;
};

/**
 * Format Nigerian names for display
 */
const formatNigerianNames = (names: NigerianPlantNames): string => {
  const parts = [];

  if (names.yoruba) parts.push(`Yoruba: *${names.yoruba}*`);
  if (names.igbo) parts.push(`Igbo: *${names.igbo}*`);
  if (names.hausa) parts.push(`Hausa: *${names.hausa}*`);
  if (names.edo) parts.push(`Edo: *${names.edo}*`);
  if (names.efik) parts.push(`Efik: *${names.efik}*`);
  if (names.pidgin) parts.push(`Pidgin: *${names.pidgin}*`);

  if (parts.length === 0) {
    return `*[No Nigerian traditional names found]*${names.notes ? ` - ${names.notes}` : ''}`;
  }

  return parts.join(' • ');
};

/**
 * Generate enriched RAG response with Nigerian traditional names
 */
export const generateRAGResponse = async (
  query: string,
  articles: PubMedArticle[],
  options: {
    useGroq?: boolean; // true = use Groq, false = use Gemini for name lookup
    skipNameLookup?: boolean; // Skip the name lookup entirely
  } = {}
): Promise<string> => {
  const { useGroq = true, skipNameLookup = false } = options;

  // Step 1: Extract plant names from articles
  const plantNames = extractPlantNames(articles);
  console.log('Extracted plant names:', plantNames);

  // Step 2: Fetch Nigerian traditional names
  let nigerianNamesMap = new Map<string, NigerianPlantNames>();

  if (!skipNameLookup && plantNames.length > 0) {
    nigerianNamesMap = await fetchAllNigerianNames(plantNames, useGroq);
  }

  // Step 3: Retrieve herbal pharmacopoeia data
  const herbalChunks = await retrieveHerbalChunks(query);

  // Prepare herbal context
  let herbalContextText = "";
  if (herbalChunks.length > 0) {
    herbalChunks.forEach(chunk => {
      const sourceLabel = chunk.source === "AHP" ? "African Herbal Pharmacopoeia (AHP)" : "West African Pharmacopoeia (WAP)";
      herbalContextText += `### PHARMACOPOEIA SOURCE
SOURCE: ${sourceLabel}
PAGE: ${chunk.page}
TEXT: ${chunk.text}
--------------------------------------------------
`;
    });
  }

  // Step 4: Prepare context with enriched plant information
  let contextText = "";
  const enrichedPlantInfo: string[] = [];

  articles.forEach((article, index) => {
    contextText += `### SOURCE [PMID:${article.pmid}]
TITLE: ${article.title}
DATE: ${article.pubDate}
ABSTRACT: ${article.abstract}
--------------------------------------------------
`;
  });

  // Combine PubMed and herbal contexts
  contextText = herbalContextText + contextText;

  // Step 4: Create enriched plant database section
  if (nigerianNamesMap.size > 0) {
    contextText += `\n### 🇳🇬 NIGERIAN TRADITIONAL NAMES DATABASE\n`;
    nigerianNamesMap.forEach((names, scientificName) => {
      contextText += `
**${scientificName}** (${names.commonName})
- Nigerian Names: ${formatNigerianNames(names)}
- Native to Nigeria: ${names.isNative ? 'Yes' : 'No'}
${names.notes ? `- Notes: ${names.notes}` : ''}
---
`;
      enrichedPlantInfo.push(`${names.commonName} (${scientificName}): ${formatNigerianNames(names)}`);
    });
  }

  // Step 5: Enhanced System Prompt
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2000,
    }
  });

  const prompt = `
You are the **"NaijaMed Atlas Assistant"**, a world-class AI Ethnobotanist and Research Scientist dedicated to Nigerian Traditional Medicine.

**YOUR MISSION:**
Synthesize the provided scientific abstracts into a clear, culturally relevant, and trustworthy guide for Nigerian users. You must act as a bridge between "Western Science" and "Indigenous Knowledge."

**USER QUESTION:** "${query}"

${enrichedPlantInfo.length > 0 ? `
**ENRICHED PLANT DATABASE:**
I have already looked up Nigerian traditional names for the following plants:
${enrichedPlantInfo.join('\n')}

USE THIS DATABASE in your response to provide accurate local names.
` : ''}

**STRICT GUIDELINES:**
1.  **Identity & Naming (Crucial):**
    * Identify ALL plants/remedies discussed in the research.
    * For EACH plant, provide:
      - Scientific name (Latin)
      - Common English name
      - **Nigerian Local Names** from the database above (Yoruba, Igbo, Hausa, etc.)
      - Native status (Is it native to Nigeria/West Africa?)
    * If multiple plants are discussed, create a section for each one.

2.  **Evidence Grounding:**
    * All medical claims MUST be based **strictly** on the provided abstracts.
    * Cite sources using **[PMID:12345]** immediately after claims.
    * Do NOT hallucinate benefits not found in the research.

3.  **Layman Translation:**
    * Translate complex terms to plain English (e.g., "Antinociceptive" → "Pain-relieving").
    * Explain mechanisms in simple terms.

4.  **Safety First:**
    * Create a dedicated "Safety & Precautions" section.
    * Highlight toxicity, dosage warnings, contraindications, or side effects.

5.  **Cultural Context:**
    * If a plant is NOT native to Nigeria, clearly state this.
    * Mention if it's known by other names in Nigerian markets.

6.  **Pharmacopoeia Data Integration (If Present):**
    * Include traditional medicinal uses from pharmacopoeia sources
    * Include plant parts used (leaf, bark, root, etc.) as specified
    * Include preparation methods (infusion, decoction, maceration, etc.)
    * Include dosage levels if listed in pharmacopoeia
    * Include toxicity and safety warnings from pharmacopoeia sources
    * Cite sources using **[AHP:PageX]** or **[WAP:PageX]** for pharmacopoeia data.

**REQUIRED MARKDOWN FORMAT:**

# 🌿 Research Summary: [Main Topic]

${nigerianNamesMap.size > 0 ? `
## 🇳🇬 Plants Covered & Nigerian Names

${Array.from(nigerianNamesMap.values()).map(names => `
### ${names.commonName}
*Scientific Name: ${names.scientificName}*
**Local Names:** ${formatNigerianNames(names)}
**Native to Nigeria:** ${names.isNative ? '✅ Yes' : '❌ No'}
${names.notes ? `**Note:** ${names.notes}` : ''}
`).join('\n')}

---
` : ''}

## 💡 Quick Summary
*2-3 sentences summarizing the key findings across all research papers.*

## 🔬 What the Research Says

### [Plant 1 Common Name] (*Scientific name*)
* **[Medical Use/Property]:** Detailed explanation... [PMID:XXXX]
* **[Another Finding]:** Explanation... [PMID:XXXX]

### [Plant 2 Common Name] (*Scientific name*) 
*(Repeat structure for each plant)*

## ⚠️ Safety & Precautions
* **Toxicity:** Any warnings from studies [PMID:XXXX]
* **Dosage:** Recommended amounts if mentioned [PMID:XXXX]
* **Contraindications:** Who should avoid it [PMID:XXXX]
* **Side Effects:** Observed adverse effects [PMID:XXXX]

## 🧪 Preparation Methods
* **Traditional Use:** How it's prepared traditionally (if mentioned)
* **Research Preparations:** Extract types used in studies (aqueous, ethanol, etc.) [PMID:XXXX]

## 📊 Research Quality
*Brief note on study types: in vitro, in vivo, clinical trials, etc.*

---
**Disclaimer:** This information is for educational purposes only. Consult a qualified healthcare professional before using any herbal remedy.

**CONTEXT DATA:**
${contextText}

BEGIN YOUR RESPONSE:
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text() || "Unable to generate response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I encountered an error while synthesizing the research. Please check your API configuration.";
  }
};

/**
 * Utility: Get just the Nigerian names for specific plants (standalone function)
 */
export const getNigerianNamesOnly = async (
  scientificNames: string[],
  useGroq: boolean = true
): Promise<NigerianPlantNames[]> => {
  const nameMap = await fetchAllNigerianNames(scientificNames, useGroq);
  return Array.from(nameMap.values());
};