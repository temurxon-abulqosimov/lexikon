
export type Language = 'German' | 'Uzbek' | 'English' | 'Russian' | 'Arabic';

export interface SemanticVariation {
  text: string;
  confidence: number;
  source: 'human' | 'ai';
}

export interface LiteraryReference {
  text: string;
  translation?: string;
  source: string;
  author?: string;
}

export interface RealLifeSentence {
  text: string;
  translation: string;
  context: string;
}

export interface LexicalEntry {
  id: string;
  term: string;
  lemma?: string;
  inflection?: string;
  normalizedTerm: string;
  mainTranslation: string;
  sourceLang: Language;
  targetLang: Language;
  cefrLevel?: string;
  
  // 🔬 Philological Analysis
  philology: {
    etymology: string;
    historicalNotes?: string;
    inflectionNotes?: string;
    partOfSpeech: string;
    gender?: string;
    plural?: string;
  };

  // 🌍 Cultural / Language Context
  culture: {
    usage: string;
    register: 'formal' | 'informal' | 'neutral';
    notes: string;
  };

  // 📖 Lexical Relations
  synonyms: string[];

  // 🔁 Semantic Variations (Target Language)
  variations: SemanticVariation[];
  
  // 📚 Literary Manifestations (Simplified)
  literature: LiteraryReference[];
  
  // 🗣 Real-life usage
  realLifeSentences: RealLifeSentence[];
  
  // 🏛 Curated Idioms & Natural Usage
  idioms: RealLifeSentence[];

  timestamp: number;
  isPreinstalled?: boolean;
}

export interface UserProfile {
  username: string;
  firstName?: string;
  lastName?: string;
  telegramId?: number;
  phoneNumber?: string;
  languageCode?: string;
  xp: number;
  rank: string;
  searchCount: number;
  arenaWins: number;
  accuracy: number;
  streak: number;
}

export enum AppMode {
  DICTIONARY = 'DICTIONARY',
  ARENA = 'ARENA',
  ARCHIVE = 'ARCHIVE',
  ADMIN = 'ADMIN'
}
