
import { Language, LexicalEntry } from './types';

// ElevenLabs Voice IDs
export const VOICE_MAPPING: Record<Language, string> = {
  German: 'VR6AewLTigWG4xSOukaG',    // Arnold — authoritative male
  Uzbek: '21m00Tcm4TlvDq8ikWAM',     // Rachel — warm female
  English: 'ErXwobaYiN019PkySvjV',   // Antoni — well-rounded male
  Russian: 'AZnzlk1XvdvUeBnXmlld',   // Domi — strong female
  Arabic: 'EXAVITQu4vr4xnSDxMaL',    // Bella — soft melodic female
};

export const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

export const RANKS = [
  { minXp: 0, title: 'Lexical Novice' },
  { minXp: 500, title: 'Archive Scribe' },
  { minXp: 1500, title: 'Polyglot Scholar' },
  { minXp: 4000, title: 'Etymological Dean' },
  { minXp: 10000, title: 'The Lexicon Master' },
];

export const APP_ACCENT = '#7c1a1a';
// Admin Telegram ID — set ADMIN_TELEGRAM_ID in Vercel env vars to override
export const ADMIN_ID: string = (process.env.ADMIN_TELEGRAM_ID as string) || '794464667';

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
