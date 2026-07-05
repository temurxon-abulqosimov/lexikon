
import { Language, LexicalEntry } from './types';

export const VOICE_MAPPING: Record<Language, string> = {
  German: 'Charon',   // Deeper, more mature tone for philological analysis
  Uzbek: 'Zephyr',    // Best suited for Turkic phonetics
  English: 'Fenrir',  // Authoritative and clear
  Russian: 'Charon',  // Strong, resonant voice for Slavic vowels
  Arabic: 'Kore',     // Clear, melodic tone for Semitic phonology
};

export const RANKS = [
  { minXp: 0, title: 'Lexical Novice' },
  { minXp: 500, title: 'Archive Scribe' },
  { minXp: 1500, title: 'Polyglot Scholar' },
  { minXp: 4000, title: 'Etymological Dean' },
  { minXp: 10000, title: 'The Lexicon Master' },
];

export const APP_ACCENT = '#7c1a1a';
export const ADMIN_ID = 794464667;

// Tier 0: Static Seed Manifest for instant hits on common words
export const SEED_ARCHIVE: Partial<Record<string, Partial<LexicalEntry>>> = {
  "hallo-german-uzbek": {
    term: "Hallo",
    mainTranslation: "Salom",
    philology: { 
      partOfSpeech: "Interjektion", 
      etymology: "Standard greeting in German. Derived from Middle High German 'holla'." 
    },
    synonyms: ["Guten Tag", "Servus", "Moin"],
    variations: [{ text: "Assalomu alaykum", confidence: 1, source: 'ai' }],
    literature: [{ text: "Hallo, wie geht es dir?", translation: "Salom, ahvollaring qanday?", source: "General Usage" }]
  },
  "marhaba-arabic-uzbek": {
    term: "مرحبا",
    mainTranslation: "Salom",
    philology: { 
      partOfSpeech: "Interjection", 
      etymology: "Arabic greeting 'Marhaba'. Historically linked to the root r-h-b, meaning 'to be wide/spacious', implying 'welcome to a spacious place'." 
    },
    synonyms: ["أهلاً", "السلام عليكم", "تحية"],
    variations: [{ text: "Xush kelibsiz", confidence: 0.9, source: 'ai' }],
    literature: [{ text: "مرحبا بكم في منزلنا", translation: "Uyimizga xush kelibsiz.", source: "Common Usage" }]
  },
  "wasser-german-uzbek": {
    term: "Wasser",
    mainTranslation: "Suv",
    philology: { 
      partOfSpeech: "Substantiv", 
      gender: "das", 
      etymology: "Essential life-giving liquid. Common Indo-European root." 
    },
    synonyms: ["H2O", "Nass", "Gewässer"],
    variations: [{ text: "Obi hayot", confidence: 1, source: 'ai' }],
    literature: [{ text: "Ein Glas Wasser, please.", translation: "Bir stakan suv, iltimos.", source: "Common Phrase" }]
  },
  "brot-german-uzbek": {
    term: "Brot",
    mainTranslation: "Non",
    philology: { 
      partOfSpeech: "Substantiv", 
      gender: "das", 
      etymology: "Common West Germanic root." 
    },
    culture: {
      usage: "Staple food",
      register: "neutral",
      notes: "In Uzbekistan, 'Non' is sacred and never placed upside down."
    },
    synonyms: ["Laib", "Stulle", "Backware"],
    variations: [{ text: "Yopgan non", confidence: 1, source: 'ai' }],
    literature: [{ text: "Wir kaufen frisches Brot.", translation: "Biz yangi non sotib olamiz.", source: "Everyday German" }]
  }
};
