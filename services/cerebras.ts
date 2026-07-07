
import { Language, LexicalEntry } from "../types";

const PROXY_URL = "/api/nvidia";

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "lex-" + Date.now() + "-" + Math.random().toString(36).substring(2, 11);
};

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * Core fetch helper for NVIDIA Nemotron API (OpenAI-compatible).
 */
async function openrouterRequest<T>(
  systemPrompt: string,
  userPrompt: string,
  retries = 1,
  maxTokens = 2048,
  model?: string
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }

    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 1,
        top_p: 1,
        max_tokens: maxTokens,
        ...(model ? { model } : {}),
      }),
    });

    if (response.status === 429 && attempt < retries) {
      console.warn(`[LEX] Rate limited, retrying (${attempt + 1}/${retries})...`);
      lastError = new Error(`Rate limited (429)`);
      continue;
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NVIDIA API error: ${response.status} – ${errText}`);
    }

    const data = await response.json();
    const rawContent: string = data.choices?.[0]?.message?.content ?? "{}";

    // Extract JSON from possible markdown fences or mixed content
    let cleaned = rawContent.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    } else {
      // Try to find raw JSON object in the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch (e) {
      console.error("JSON parse failed. Raw:", rawContent);
      throw new Error(`Failed to parse AI response: ${(e as Error).message}`);
    }
  }

  throw lastError || new Error("Request failed after retries");
}

/**
 * PHASE 1: Lightning Fast Core Translation
 * Focused strictly on headword data.
 */
export async function translateWordCore(
  query: string,
  sourceLanguage: Language,
  targetLanguage: Language
): Promise<LexicalEntry> {
  const systemPrompt =
    "Output ONLY a valid JSON object. No text, no markdown, no explanation, no thinking. Just the raw JSON object starting with { and ending with }.";

  const userPrompt = `Translate "${query}" (${sourceLanguage} → ${targetLanguage}).
Return a JSON object with these fields:
- "term": the original word/phrase
- "mainTranslation": the primary translation
- "partOfSpeech": grammatical category
- "gender": gender if German (m/f/n), otherwise omit
- "plural": plural form if German, otherwise omit
- "cefrLevel": CEFR level (A1–C2) for non-Uzbek source languages, otherwise omit`;

  const raw = await openrouterRequest<any>(systemPrompt, userPrompt);

  return {
    id: generateId(),
    term: raw.term || query,
    normalizedTerm: query.toLowerCase().trim(),
    mainTranslation: raw.mainTranslation,
    sourceLang: sourceLanguage,
    targetLang: targetLanguage,
    cefrLevel: sourceLanguage !== "Uzbek" ? raw.cefrLevel : undefined,
    philology: {
      etymology: "",
      partOfSpeech: raw.partOfSpeech,
      gender: raw.gender,
      plural: raw.plural,
    },
    culture: { usage: "", register: "neutral", notes: "" },
    synonyms: [],
    variations: [],
    literature: [],
    realLifeSentences: [],
    idioms: [],
    timestamp: Date.now(),
  };
}

/**
 * Combined translation + enrichment in a single API call.
 */
export async function translateAndEnrich(
  query: string,
  sourceLanguage: Language,
  targetLanguage: Language
): Promise<LexicalEntry> {
  const systemPrompt =
    "Output ONLY a valid JSON object. No text, no markdown, no explanation, no thinking. Just the raw JSON object starting with { and ending with }.";

  const userPrompt = `Translate "${query}" from ${sourceLanguage} to ${targetLanguage} and provide full philological analysis.

IMPORTANT LANGUAGE RULES:
- "synonyms" MUST be in ${sourceLanguage} only
- "variations" MUST be in ${targetLanguage} only
- "literature" and "idioms" MUST be in ${sourceLanguage}

Return a JSON object with ALL of these fields:
- "term": the original word/phrase
- "mainTranslation": the primary translation
- "partOfSpeech": grammatical category
- "gender": gender if German (m/f/n), otherwise omit
- "plural": plural form if German, otherwise omit
- "cefrLevel": CEFR level (A1–C2) for non-Uzbek source, otherwise omit
- "etymology": origin/etymology string (in English)
- "synonyms": array of 3 synonyms in ${sourceLanguage}
- "variations": array of 3 variations in ${targetLanguage}, each: { "text", "confidence" (0.0–1.0) }
- "literature": array of 2 concise quotes (max 15 words, in ${sourceLanguage}), each: { "text", "translation" (in ${targetLanguage}), "source", "author" }
- "idioms": array of 2 natural sentences in ${sourceLanguage}, each: { "text", "translation" (in ${targetLanguage}), "context" }`;

  const raw = await openrouterRequest<any>(systemPrompt, userPrompt, 1, 8192);

  const normalizedVariations = (raw.variations || []).map((v: any) => ({
    text: v.text || v.term || "",
    confidence: typeof v.confidence === "number" ? v.confidence : 0.90,
    source: "ai" as const,
  }));

  const normalizedLiterature = (raw.literature || []).map((lit: any) => ({
    text: lit.text || lit.quote || "",
    translation: lit.translation || "",
    source: lit.source || "Literary archive",
    author: lit.author || "Anonymous",
  }));

  const normalizedIdioms = (raw.idioms || []).map((id: any) => ({
    text: id.text || id.sentence || "",
    translation: id.translation || "",
    context: id.context || "Colloquial usage",
  }));

  return {
    id: generateId(),
    term: raw.term || query,
    normalizedTerm: query.toLowerCase().trim(),
    mainTranslation: raw.mainTranslation,
    sourceLang: sourceLanguage,
    targetLang: targetLanguage,
    cefrLevel: sourceLanguage !== "Uzbek" ? raw.cefrLevel : undefined,
    philology: {
      etymology: raw.etymology || "",
      partOfSpeech: raw.partOfSpeech,
      gender: raw.gender,
      plural: raw.plural,
    },
    culture: {
      usage: raw.usage || "Standard scholarly use",
      register: "neutral",
      notes: "",
    },
    synonyms: raw.synonyms || [],
    variations: normalizedVariations,
    literature: normalizedLiterature,
    realLifeSentences: normalizedIdioms,
    idioms: normalizedIdioms,
    timestamp: Date.now(),
  };
}

/**
 * PHASE 2: Comprehensive Archival Enrichment
 */
export async function enrichLexicalEntry(
  entry: LexicalEntry
): Promise<Partial<LexicalEntry>> {
  const systemPrompt =
    "Output ONLY a valid JSON object. No text, no markdown, no explanation, no thinking. Just the raw JSON object starting with { and ending with }.";

  const userPrompt = `Detailed philological analysis for "${entry.term}".
Source language (original word): ${entry.sourceLang}
Target language (translation): ${entry.targetLang}

IMPORTANT LANGUAGE RULES:
- "synonyms" MUST be in ${entry.sourceLang} (the source language only). For example, if source is English, all synonyms must be English words.
- "variations" MUST be in ${entry.targetLang} (the target language only). For example, if target is Uzbek, all variations must be Uzbek words.
- "literature" quotes MUST be in ${entry.sourceLang}
- "idioms" sentences MUST be in ${entry.sourceLang}

Return a JSON object with:
1. "etymology": origin/etymology string (in English)
2. "synonyms": array of 3 synonyms in ${entry.sourceLang} ONLY (NOT in ${entry.targetLang})
3. "variations": array of 3 variations in ${entry.targetLang} ONLY (NOT in ${entry.sourceLang}) — each object: { "text" (variation in ${entry.targetLang}), "confidence" (decimal 0.0–1.0) }
4. "literature": array of 2 concise quotes (max 15 words each, in ${entry.sourceLang}) — each object: { "text" (quote in ${entry.sourceLang}), "translation" (in ${entry.targetLang}), "source", "author" }
5. "idioms": array of 2 natural sentences in ${entry.sourceLang} with translations in ${entry.targetLang} — each object: { "text" (sentence in ${entry.sourceLang}), "translation" (in ${entry.targetLang}), "context" }`;

  try {
    const raw = await openrouterRequest<any>(systemPrompt, userPrompt, 1, 2048, "google/gemma-4-31b-it");
    
    // Normalize variations to always match the SemanticVariation interface { text, confidence, source }
    const normalizedVariations = (raw.variations || []).map((v: any) => ({
      text: v.text || v.term || "",
      confidence: typeof v.confidence === "number" ? v.confidence : 0.90,
      source: "ai" as const
    }));

    // Normalize literature to always match LiteraryReference interface { text, translation, source, author }
    const normalizedLiterature = (raw.literature || []).map((lit: any) => ({
      text: lit.text || lit.quote || "",
      translation: lit.translation || "",
      source: lit.source || "Literary archive",
      author: lit.author || "Anonymous"
    }));

    // Normalize idioms to always match RealLifeSentence interface { text, translation, context }
    const normalizedIdioms = (raw.idioms || []).map((id: any) => ({
      text: id.text || id.sentence || "",
      translation: id.translation || "",
      context: id.context || "Colloquial usage"
    }));

    return {
      synonyms: raw.synonyms || [],
      variations: normalizedVariations,
      philology: { ...entry.philology, etymology: raw.etymology || "Archival record updated." },
      culture: {
        usage: raw.usage || "Standard scholarly use",
        register: "neutral",
        notes: "",
      },
      literature: normalizedLiterature,
      realLifeSentences: normalizedIdioms,
      idioms: normalizedIdioms,
    };
  } catch (err) {
    console.error("OpenRouter Enrichment Error:", err);
    return {};
  }
}

/**
 * Scholarly Daily Insight
 */
export async function getDailyInsight() {
  const systemPrompt = "Output ONLY a valid JSON object. No text, no markdown, no explanation. Just the raw JSON.";
  const userPrompt =
    "Generate a sophisticated 'Linguistic Fact of the Day' about the intersection of German, Uzbek, Arabic, or Russian. Return a JSON object with fields: title, fact, source.";

  try {
    return await openrouterRequest<any>(systemPrompt, userPrompt);
  } catch (err) {
    return { title: "Lexical Continuity", fact: "Linguistic roots bind cultures." };
  }
}

/**
 * Arena Quiz Generation
 */
export async function generateQuiz(entries: LexicalEntry[]) {
  const context = entries.map((e) => `${e.term} ↔ ${e.mainTranslation}`).join(", ");

  const systemPrompt = "Output ONLY a valid JSON object. No text, no markdown, no explanation. Just the raw JSON.";
  const userPrompt = `Create a 3-option multiple-choice quiz based on these terms: ${context}.
Return a JSON object with a "questions" key containing an array of objects.
Each object must have: question, correctAnswer, options (array of 3 strings), explanation.`;

  try {
    const parsed = await openrouterRequest<any>(systemPrompt, userPrompt);
    const questions = parsed.questions || [];
    return questions.map((q: any) => ({
      ...q,
      options: shuffleArray(q.options || []),
    }));
  } catch (err) {
    console.error("OpenRouter Quiz Error:", err);
    return [];
  }
}
