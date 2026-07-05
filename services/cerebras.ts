
import { Language, LexicalEntry } from "../types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o";

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
 * Core fetch helper for OpenRouter.
 * Uses plain fetch() for maximum iOS WebKit compatibility — no SDK required.
 */
async function openrouterRequest<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY || "";

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://uzger-lexicon.app",
      "X-Title": "Uzger Lexicon",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} – ${errText}`);
  }

  const data = await response.json();
  const rawContent: string = data.choices?.[0]?.message?.content ?? "{}";

  // Strip any accidental markdown fences GPT sometimes adds
  const cleaned = rawContent.replace(/```(?:json)?\s*([\s\S]*?)```/i, "$1").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error("OpenRouter JSON parse failed. Raw:", rawContent);
    throw new Error(`Failed to parse AI response: ${(e as Error).message}`);
  }
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
    "You are a scholarly philologist providing concise lexical data in JSON format. Always respond with valid JSON only, no markdown.";

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
 * PHASE 2: Comprehensive Archival Enrichment
 */
export async function enrichLexicalEntry(
  entry: LexicalEntry
): Promise<Partial<LexicalEntry>> {
  const systemPrompt =
    "You are a deep-learning philologist providing structured linguistic data in JSON format. Always respond with valid JSON only, no markdown.";

  const userPrompt = `Detailed philological analysis for "${entry.term}" (${entry.sourceLang} → ${entry.targetLang}).
Return a JSON object with:
1. "etymology": origin/etymology string
2. "synonyms": array of 3 synonyms in ${entry.sourceLang}
3. "variations": array of 3 variations in ${entry.targetLang} (each object must have: "text" (variation term/phrase), "confidence" (decimal between 0.0 and 1.0))
4. "literature": array of 2 concise quotes (max 15 words each, in ${entry.sourceLang}) — each object: { "text" (quote in ${entry.sourceLang}), "translation", "source", "author" }
5. "idioms": array of 2 natural sentences in ${entry.sourceLang} with translations — each object: { "text" (sentence in ${entry.sourceLang}), "translation", "context" }`;

  try {
    const raw = await openrouterRequest<any>(systemPrompt, userPrompt);
    
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
  const systemPrompt = "You are a linguistic historian. Always respond with valid JSON only, no markdown.";
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

  const systemPrompt = "You are a language teacher. Always respond with valid JSON only, no markdown.";
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
