import Groq from 'groq-sdk';
import { PubMedArticle } from '../types';
import { retrieveHerbalChunks } from "../src/pharmacopoeia/localRetriever";

const getClient = () => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GROQ_API_KEY not found in environment variables");
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

    // Pattern for scientific names: Genus species (with optional L. or Linn.)
    const scientificPattern = /\b([A-Z][a-z]+)\s+([a-z]+)\s*(?:L\.|Linn\.)?\b/g;
    const matches = fullText.matchAll(scientificPattern);

    for (const match of matches) {
      const genus = match[1];
      const species = match[2];
      const fullName = `${genus} ${species}`;

      // Filter out common false positives
      const blacklist = [
        'United States', 'New York', 'South Africa', 'North America',
        'West Africa', 'East Asia', 'European Union', 'In vitro',
        'In vivo', 'Et al', 'Per cent', 'Ad libitum'
      ];

      if (!blacklist.some(term => fullName === term) && species.length > 3) {
        plantNames.add(fullName);
      }
    }
  });

  return Array.from(plantNames);
};

/**
 * Fetch Nigerian traditional names using Groq
 */
const fetchNigerianNames = async (scientificName: string): Promise<NigerianPlantNames> => {
  const client = getClient();

  const prompt = `You are an expert ethnobotanist specializing in Nigerian traditional medicine. 

Search your knowledge for Nigerian traditional names for: "${scientificName}"

Return ONLY a valid JSON object (no markdown, no backticks, no extra text) with this exact structure:
{
  "scientificName": "${scientificName}",
  "commonName": "common English name",
  "yoruba": "Yoruba name or null",
  "igbo": "Igbo name or null", 
  "hausa": "Hausa name or null",
  "edo": "Edo name or null",
  "efik": "Efik/Ibibio name or null",
  "pidgin": "Nigerian Pidgin name or null",
  "isNative": true or false,
  "notes": "brief note about plant's presence in Nigeria or null"
}

Rules:
- Use null (not "null" in quotes) for unknown names
- Be accurate - don't guess names
- isNative means native to Nigeria/West Africa region
- Keep notes brief (under 50 words)`;

  try {
    const completion = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 400,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";

    // Clean up any markdown formatting
    const cleanedText = responseText
      .replace(/```json\n?|\n?```/g, '')
      .replace(/```\n?|\n?```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);
    return parsed;
  } catch (error) {
    console.error(`Error fetching Nigerian names for ${scientificName}:`, error);
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
  plantNames: string[]
): Promise<Map<string, NigerianPlantNames>> => {
  const nameMap = new Map<string, NigerianPlantNames>();

  if (plantNames.length === 0) return nameMap;

  console.log(`Fetching Nigerian names for ${plantNames.length} plants...`);

  // Process in smaller batches to avoid rate limits
  const batchSize = 2;
  for (let i = 0; i < plantNames.length; i += batchSize) {
    const batch = plantNames.slice(i, i + batchSize);

    const promises = batch.map(name => fetchNigerianNames(name));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        nameMap.set(batch[index], result.value);
      }
    });

    // Delay between batches to respect rate limits
    if (i + batchSize < plantNames.length) {
      await new Promise(resolve => setTimeout(resolve, 800));
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
    return names.notes
      ? `*[No traditional names found - ${names.notes}]*`
      : '*[No Nigerian traditional names documented]*';
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
    skipNameLookup?: boolean; // Skip the name lookup entirely for faster response
    verbose?: boolean; // Log additional info
  } = {}
): Promise<string> => {
  const { skipNameLookup = false, verbose = false } = options;
  const client = getClient();

  // Step 1: Extract plant names from articles
  const plantNames = extractPlantNames(articles);
  if (verbose) console.log('Extracted plant names:', plantNames);

  // Step 2: Fetch Nigerian traditional names
  let nigerianNamesMap = new Map<string, NigerianPlantNames>();

  if (!skipNameLookup && plantNames.length > 0 && plantNames.length <= 10) {
    try {
      nigerianNamesMap = await fetchAllNigerianNames(plantNames);
      if (verbose) console.log('Fetched names for:', nigerianNamesMap.size, 'plants');
    } catch (error) {
      console.error('Error fetching Nigerian names:', error);
      // Continue without names rather than failing
    }
  } else if (plantNames.length > 10) {
    console.log('Too many plants detected, skipping name lookup to avoid rate limits');
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

  // Step 4: Prepare context with PubMed articles
  let contextText = "";
  articles.forEach((article, index) => {
    contextText += `### SOURCE ${index + 1}
ID: PMID:${article.pmid}
TITLE: ${article.title}
DATE: ${article.pubDate}
TEXT: ${article.abstract}
--------------------------------------------------
`;
  });

  // Combine PubMed and herbal contexts
  contextText = herbalContextText + contextText;

  // Step 4: Add Nigerian names database if available
  const enrichedPlantInfo: string[] = [];

  if (nigerianNamesMap.size > 0) {
    contextText += `\n 🇳🇬 NIGERIAN TRADITIONAL NAMES DATABASE\n`;
    nigerianNamesMap.forEach((names, scientificName) => {
      const formattedNames = formatNigerianNames(names);
      contextText += `
**${scientificName}** (${names.commonName})
- Nigerian Names: ${formattedNames}
- Native to Nigeria/West Africa: ${names.isNative ? 'Yes ✅' : 'No ❌'}
${names.notes ? `- Note: ${names.notes}` : ''}
---
`;
      enrichedPlantInfo.push(
        `${names.commonName} (${scientificName}): ${formattedNames}`
      );
    });
  }

  // Step 5: Enhanced system prompt
  const systemPrompt = `You are the "NaijaMed Atlas Assistant", a world-class AI Ethnobotanist and Research Scientist specialized in Nigerian Traditional Medicine. 

YOUR MISSION:
Synthesize complex scientific abstracts into clear, culturally relevant, and actionable insights for Nigerian users. Bridge the gap between "Western Science" and "Indigenous Knowledge."

CORE GUIDELINES:
1. **Local Identity First**:
   - Always identify plants by Scientific Name AND Nigerian names
   ${enrichedPlantInfo.length > 0 ? `- USE THE PROVIDED NIGERIAN NAMES DATABASE in your response` : '- Add Nigerian names if you know them'}
   - Show native status (Is it native to Nigeria/West Africa?)

2. **Layman Accessibility**:
   - Explain complex terms (e.g., "antinociceptive" → "pain-relieving")
   - Make scientific findings understandable

3. **Strict Citation**:
   - Every claim must cite [PMID:XXXX]
   - Base claims ONLY on provided abstracts

4. **Safety First**:
   - Highlight toxicity, dosage limits, contraindications
   - Create dedicated safety section

5. **Cultural Context**:
   - Note if plants are not native to Nigeria
   - Mention availability in Nigerian markets if relevant

6.  **Pharmacopoeia Data Integration (If Present):**
    - Include traditional medicinal uses from pharmacopoeia sources
    - Include plant parts used (leaf, bark, root, etc.) as specified
    - Include preparation methods (infusion, decoction, maceration, etc.)
    - Include dosage levels if listed in pharmacopoeia
    - Include toxicity and safety warnings from pharmacopoeia sources
    - Cite sources using **[AHP:PageX]** or **[WAP:PageX]** for pharmacopoeia data.`;

  // Step 6: User prompt with structure
  const userPrompt = `USER QUERY: "${query}"

${enrichedPlantInfo.length > 0 ? `
📚 NIGERIAN NAMES DATABASE AVAILABLE:
${enrichedPlantInfo.map(info => `• ${info}`).join('\n')}

⚠️ IMPORTANT: Use these exact names in your response. They are verified traditional names.
` : ''}

RESPONSE FORMAT (Use this Markdown structure):

** 🌿 Summary: [Main Topic] **

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

*2-3 sentences summarizing the main findings for the user.*



**Scientific Evidence:**

**🌿[Plant 1 Common Name] (*Scientific name*)**
**🇳🇬 Nigerian Names:** [From database above]
**Native Status:** [Yes/No]

**[Medical Property/Use 1]:** Detailed explanation of findings... [PMID:XXXX]
**[Medical Property/Use 2]:** Detailed explanation of findings... [PMID:XXXX]

**🌿[Plant 2 Common Name] (*Scientific name*)**
*(Repeat structure for each plant)*

**⚠️ Safety & Precautions**

* **Toxicity Warnings:** Any toxicity mentioned in studies [PMID:XXXX]
* **Dosage Information:** Safe doses if mentioned [PMID:XXXX]
* **Contraindications:** Who should avoid it [PMID:XXXX]
* **Side Effects:** Observed adverse effects [PMID:XXXX]


**🧪 Preparation & Traditional Use**

**Research Preparations:** Extract types used (aqueous, ethanol, methanol) [PMID:XXXX]
**Plant Parts Used:** Leaves, roots, bark, seeds, etc. [PMID:XXXX]
**Traditional Methods:** If mentioned in the research [PMID:XXXX]


**Disclaimer:** This information is for educational purposes only. Always consult a qualified healthcare professional before using any herbal remedy.

CONTEXTUAL DATA TO ANALYZE:
${contextText}`;

  try {
    if (verbose) console.log("Generating NaijaMed Atlas response...");

    const model = import.meta.env.VITE_GROQ_MODEL || "llama-3.3-70b-versatile";

    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
      temperature: 0.4, // Balanced between creativity and accuracy
      max_tokens: 2500, // Increased for comprehensive responses
    });

    const response = chatCompletion.choices[0]?.message?.content;
    return response || "I could not generate a response from the available data.";
  } catch (error: unknown) {
    console.error("GROQ API Error:", error);
    return `**System Error:** Unable to synthesize research at this time. Please try again later.`;
  }
};

/**
 * Utility: Get just the Nigerian names for specific plants (standalone function)
 */
export const getNigerianNamesOnly = async (
  scientificNames: string[]
): Promise<NigerianPlantNames[]> => {
  const nameMap = await fetchAllNigerianNames(scientificNames);
  return Array.from(nameMap.values());
};