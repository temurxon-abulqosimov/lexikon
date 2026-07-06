
import React, { useState, useEffect, useRef } from 'react';
import { Language, LexicalEntry, UserProfile } from '../types';
import { translateWordCore, enrichLexicalEntry } from '../services/cerebras';
import { speak, resumeAudioContext } from '../services/tts';
import { AssemblyAIRecorder, isAssemblyAIAvailable } from '../services/stt';
import { SEED_ARCHIVE } from '../constants';
import { fetchGlobalEntry, saveGlobalEntry, fetchSuggestions } from '../services/supabase';
import ResultCard from './ResultCard';
import HistoryGrid from './HistoryGrid';

interface Props {
  onEntrySaved: (entry: LexicalEntry) => void;
  autoAudio: boolean;
  setAutoAudio: (val: boolean) => void;
  profile: UserProfile;
  history: LexicalEntry[];
  onStartArena: () => void;
  selectedEntry?: LexicalEntry | null;
  onEntryClick: (entry: LexicalEntry) => void;
}

interface SuggestionItem {
  term: string;
  source: 'local' | 'global' | 'seed';
}

const LANGUAGES: Record<Language, string> = {
  German: 'GER',
  Uzbek: 'UZB',
  English: 'ENG',
  Russian: 'RUS',
  Arabic: 'ARA'
};

const LANGUAGES_LIST: Language[] = ['German', 'Uzbek', 'English', 'Russian', 'Arabic'];

const normalize = (text: string, lang: Language): string => {
  let res = text.trim().toLowerCase();
  if (lang === 'German') {
    res = res.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  } else if (lang === 'Uzbek') {
    res = res.replace(/[‘’`]/g, "'");
  }
  return res;
};

const Dictionary: React.FC<Props> = ({ 
  onEntrySaved, 
  autoAudio, 
  setAutoAudio, 
  profile, 
  history, 
  selectedEntry,
  onEntryClick,
  onStartArena
}) => {
  const [query, setQuery] = useState('');
  
  // Persistent language states
  const [sourceLang, setSourceLang] = useState<Language>(() => {
    const saved = localStorage.getItem('lexSourceLang');
    return (LANGUAGES_LIST.includes(saved as Language) ? (saved as Language) : 'German');
  });
  
  const [targetLang, setTargetLang] = useState<Language>(() => {
    const saved = localStorage.getItem('lexTargetLang');
    return (LANGUAGES_LIST.includes(saved as Language) ? (saved as Language) : 'Uzbek');
  });

  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceStatusMsg, setVoiceStatusMsg] = useState<string | null>(null);
  const [interimText, setInterimText] = useState('');
  const sttRef = useRef<AssemblyAIRecorder | null>(null);
  const [result, setResult] = useState<LexicalEntry | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const suggestionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Silent Feature Detection — AssemblyAI or fallback
  useEffect(() => {
    if (!isAssemblyAIAvailable()) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setVoiceSupported(false);
      }
    }
  }, []);

  // Cleanup STT recorder on unmount
  useEffect(() => {
    return () => {
      sttRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (selectedEntry) {
      setQuery(selectedEntry.term);
      setResult(selectedEntry);
      setSourceLang(selectedEntry.sourceLang);
      setTargetLang(selectedEntry.targetLang);
      setShowSuggestions(false);
      
      localStorage.setItem('lexSourceLang', selectedEntry.sourceLang);
      localStorage.setItem('lexTargetLang', selectedEntry.targetLang);
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedEntry]);

  useEffect(() => {
    if (loading) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    if (result && result.term.toLowerCase() === query.trim().toLowerCase()) {
      setShowSuggestions(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      const trimmedQuery = query.trim().toLowerCase();
      if (trimmedQuery.length >= 2) {
        const localMatches = history
          .filter(e => e.sourceLang === sourceLang && e.term.toLowerCase().startsWith(trimmedQuery))
          .map(e => ({ term: e.term, source: 'local' as const }));

        const seedMatches = Object.values(SEED_ARCHIVE)
          .filter(e => e?.term && e.term.toLowerCase().startsWith(trimmedQuery))
          .map(e => ({ term: e!.term!, source: 'seed' as const }));

        let globalMatches: SuggestionItem[] = [];
        if (localMatches.length + seedMatches.length < 5) {
           try {
            const globalTerms = await fetchSuggestions(query, sourceLang);
            globalMatches = globalTerms.map(term => ({ term, source: 'global' as const }));
          } catch (e) {}
        }

        const combined = [...localMatches, ...seedMatches, ...globalMatches];
        const unique = combined.filter((v, i, a) => 
          a.findIndex(t => t.term.toLowerCase() === v.term.toLowerCase()) === i
        ).slice(0, 8);

        if (!loading && !(result && result.term.toLowerCase() === query.trim().toLowerCase())) {
          setSuggestions(unique);
          setShowSuggestions(unique.length > 0);
          setSelectedIndex(-1);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 150);
    return () => clearTimeout(delayDebounce);
  }, [query, sourceLang, history, loading, result]);

  const handleSourceLangChange = (lang: Language) => {
    setSourceLang(lang);
    localStorage.setItem('lexSourceLang', lang);
    if (lang === targetLang) {
      const nextTarget = (Object.keys(LANGUAGES) as Language[]).find(l => l !== lang) || 'Uzbek';
      setTargetLang(nextTarget);
      localStorage.setItem('lexTargetLang', nextTarget);
    }
  };

  const handleTargetLangChange = (lang: Language) => {
    setTargetLang(lang);
    localStorage.setItem('lexTargetLang', lang);
    if (lang === sourceLang) {
      const nextSource = (Object.keys(LANGUAGES) as Language[]).find(l => l !== lang) || 'German';
      setSourceLang(nextSource);
      localStorage.setItem('lexSourceLang', nextSource);
    }
  };

  const stopVoiceSearch = () => {
    sttRef.current?.stop();
    sttRef.current = null;
    setIsListening(false);
    setInterimText('');
  };

  const startBrowserSTT = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setVoiceStatusMsg("Voice access restricted on this browser");
      setTimeout(() => setVoiceStatusMsg(null), 4000);
      return;
    }

    const recognition = new SpeechRecognition();
    const langCodes: Record<Language, string> = {
      German: 'de-DE', Uzbek: 'uz-UZ', English: 'en-US', Russian: 'ru-RU', Arabic: 'ar-SA'
    };
    
    recognition.lang = langCodes[sourceLang];
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setShowSuggestions(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      handleSearch(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceStatusMsg("Mic permission denied — check Settings > Safari > Microphone");
      } else if (event.error === 'no-speech') {
        setVoiceStatusMsg("No speech detected — try again");
      } else {
        setVoiceStatusMsg("Voice access failed — retry");
      }
      setTimeout(() => setVoiceStatusMsg(null), 5000);
    };

    recognition.onend = () => setIsListening(false);
    
    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const startVoiceSearch = async () => {
    setInterimText('');

    // Try AssemblyAI first (token fetched via server proxy)
    if (isAssemblyAIAvailable()) {
      try {
        const recorder = new AssemblyAIRecorder({
          language: sourceLang,
          onInterim: (text) => {
            setInterimText(text);
            setQuery(text);
          },
          onFinal: (text) => {
            setInterimText('');
            setIsListening(false);
            setQuery(text);
            handleSearch(text);
            sttRef.current = null;
          },
          onError: (err) => {
            console.error("AssemblyAI STT error:", err);
            setIsListening(false);
            setInterimText('');
            setVoiceStatusMsg("Voice error — retry");
            setTimeout(() => setVoiceStatusMsg(null), 3000);
            sttRef.current = null;
          },
        });

        sttRef.current = recorder;

        // CRITICAL for iOS: request mic permission FIRST (synchronously in gesture),
        // then do async work. This keeps the user gesture chain intact.
        const stream = await recorder.requestMicPermission();

        setIsListening(true);
        setShowSuggestions(false);

        // Now safe to do async work (token fetch, WebSocket) — mic permission already granted
        await recorder.start(stream);
        return; // AssemblyAI connected successfully
      } catch (err: any) {
        console.error("AssemblyAI failed, falling back to browser STT:", err);
        sttRef.current = null;
        setIsListening(false);
        setInterimText('');

        // Log specific error for debugging
        const raw = err?.message || String(err);
        console.log("STT error:", raw);

        // Fall through to browser SpeechRecognition below
      }
    }

    // Fallback: browser SpeechRecognition
    startBrowserSTT();
  };

  const handleSearch = async (overrideQuery?: string) => {
    await resumeAudioContext().catch(() => {});
    
    const cleanQuery = (overrideQuery || query).trim();
    if (!cleanQuery) return;
    
    setShowSuggestions(false);
    setSuggestions([]);
    setSearchError(null);
    if (inputRef.current) inputRef.current.blur();
    setQuery(cleanQuery);
    
    const normQuery = normalize(cleanQuery, sourceLang);
    const localHit = history.find(e => normalize(e.term, e.sourceLang) === normQuery && e.sourceLang === sourceLang && e.targetLang === targetLang);
    
    if (localHit) {
      setResult(localHit);
      if (autoAudio) {
        speak(cleanQuery, sourceLang).then(() => speak(localHit.mainTranslation, targetLang)).catch(() => {});
      }
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const globalHit = await fetchGlobalEntry(normQuery, sourceLang, targetLang);
      if (globalHit) {
        setResult(globalHit);
        onEntrySaved(globalHit);
        setLoading(false);
        if (autoAudio) {
          speak(cleanQuery, sourceLang).then(() => speak(globalHit.mainTranslation, targetLang)).catch(() => {});
        }
        return;
      }

      const coreEntry = await translateWordCore(cleanQuery, sourceLang, targetLang);
      coreEntry.normalizedTerm = normQuery;
      
      setResult(coreEntry);
      setLoading(false);

      if (autoAudio) {
        speak(cleanQuery, sourceLang).then(() => speak(coreEntry.mainTranslation, targetLang)).catch(() => {});
      }

      const enrichment = await enrichLexicalEntry(coreEntry);
      const fullEntry = { ...coreEntry, ...enrichment };
      
      setResult(fullEntry);
      onEntrySaved(fullEntry);
      saveGlobalEntry(fullEntry);

    } catch (err: any) {
      const rawMsg = err?.message || String(err);
      console.error("Search failed:", rawMsg);

      let errorMsg: string;
      if (rawMsg.includes('429') || rawMsg.toLowerCase().includes('rate limit')) {
        errorMsg = "Too many requests — wait a moment and try again.";
      } else if (rawMsg.includes('401') || rawMsg.includes('403') || rawMsg.includes('process')) {
        errorMsg = "API key invalid. Check OpenRouter configuration.";
      } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
        errorMsg = "Network unreachable. Check your connection.";
      } else {
        errorMsg = `The archive is silent. ${rawMsg}`;
      }
      setSearchError(errorMsg);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      if (showSuggestions && selectedIndex >= 0) {
        const selectedTerm = suggestions[selectedIndex].term;
        setQuery(selectedTerm);
        handleSearch(selectedTerm);
      } else {
        handleSearch();
      }
      return;
    }

    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    }
    else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-8 md:space-y-16 max-w-7xl mx-auto contain-layout">
      {/* Search Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 pt-4">
        <div className="flex items-center gap-6">
          <div className="space-y-1 border-l-[3px] border-[#7c1a1a] pl-4">
            <span className="text-[9px] uppercase tracking-[0.4em] text-stone-500 font-black">Philological Mastery</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black serif text-stone-900 leading-none">{profile.xp}</span>
              <span className="text-[8px] uppercase tracking-[0.2em] text-stone-400 font-bold">Total XP</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12 w-full md:w-auto">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-stone-100/50 p-2 rounded-sm w-full sm:w-auto border border-stone-200">
             <div className="grid grid-cols-5 bg-white shadow-md overflow-hidden rounded-sm w-full sm:w-auto ring-1 ring-stone-200">
                {(Object.entries(LANGUAGES) as [Language, string][]).map(([full, short]) => (
                  <button key={full} onClick={() => handleSourceLangChange(full)} className={`px-4 py-3 text-[10px] sm:text-[11px] font-black tracking-widest transition-colors ${sourceLang === full ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-700'}`}>
                    {short}
                  </button>
                ))}
             </div>
             <div className="grid grid-cols-5 bg-white shadow-md overflow-hidden rounded-sm w-full sm:w-auto ring-1 ring-stone-200">
                {(Object.entries(LANGUAGES) as [Language, string][]).map(([full, short]) => (
                  <button key={full} onClick={() => handleTargetLangChange(full)} className={`px-4 py-3 text-[10px] sm:text-[11px] font-black tracking-widest transition-colors ${targetLang === full ? 'bg-[#7c1a1a] text-white' : 'text-stone-400 hover:text-stone-700'}`}>
                    {short}
                  </button>
                ))}
             </div>
          </div>
          <button onClick={() => setAutoAudio(!autoAudio)} className={`flex items-center gap-4 px-5 py-2.5 rounded-full border transition-all ${autoAudio ? 'bg-[#7c1a1a]/5 border-[#7c1a1a]/40' : 'bg-stone-50 border-stone-200'}`}>
            <span className={`text-[11px] uppercase tracking-[0.2em] font-black ${autoAudio ? 'text-[#7c1a1a]' : 'text-stone-500'}`}>AUTO-AUDIO</span>
            <div className={`w-3.5 h-3.5 rounded-full ${autoAudio ? 'bg-[#7c1a1a] shadow-[0_0_10px_rgba(124,26,26,0.4)]' : 'bg-stone-300'}`} />
          </button>
        </div>
      </div>

      {/* Search Input Area */}
      <div className="relative w-full" ref={suggestionRef}>
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
          <div className={`bg-white border-2 transition-all rounded-sm overflow-hidden flex items-stretch min-h-[70px] md:min-h-[110px] ${isListening ? 'border-[#7c1a1a] ring-8 ring-[#7c1a1a]/5' : 'border-stone-200 shadow-md focus-within:border-stone-400 focus-within:shadow-lg'}`}>
            <input 
              ref={inputRef}
              type="text" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              onFocus={() => { if (suggestions.length > 0 && !loading && !(result && result.term.toLowerCase() === query.trim().toLowerCase())) setShowSuggestions(true); }}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? (interimText || "Listening...") : voiceStatusMsg || "Summon an inscription..."}
              className={`flex-1 min-w-0 px-6 md:px-10 text-2xl md:text-6xl serif bg-transparent outline-none text-stone-900 lowercase transition-all ${isListening ? 'placeholder:text-[#7c1a1a]/40' : voiceStatusMsg ? 'placeholder:text-[#7c1a1a]' : 'placeholder:text-stone-200'}`} 
            />
            
            <div className="flex flex-shrink-0 items-stretch border-l-2 border-stone-50">
              <button 
                type="button" 
                onClick={isListening ? stopVoiceSearch : startVoiceSearch}
                className={`px-4 md:px-8 transition-all flex flex-shrink-0 items-center justify-center border-r border-stone-50 ${isListening ? 'text-[#7c1a1a] bg-[#7c1a1a]/5' : !voiceSupported ? 'text-stone-200 cursor-not-allowed' : 'text-stone-400 hover:text-[#7c1a1a]'}`}
              >
                <div className="relative">
                  {isListening && <div className="absolute -inset-2 border-2 border-[#7c1a1a]/20 rounded-full animate-ping"></div>}
                  {isListening ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 md:w-9 md:h-9" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 md:w-9 md:h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" x2="12" y1="19" y2="22"/>
                    </svg>
                  )}
                </div>
              </button>

              <button 
                type="submit" 
                disabled={loading} 
                className={`px-5 md:px-10 transition-all flex flex-shrink-0 items-center justify-center ${loading ? 'bg-stone-50' : 'bg-white hover:bg-[#7c1a1a]/5 text-[#7c1a1a]'}`}
              >
                {loading ? (
                  <div className="w-8 h-8 border-4 border-[#7c1a1a] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 md:w-12 md:h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                )}
              </button>
            </div>
          </div>
          {isListening && (
            <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-[#7c1a1a]/10 overflow-hidden">
               <div className="h-full bg-[#7c1a1a] w-1/3 animate-[progress_2s_ease-in-out_infinite]"></div>
            </div>
          )}
        </form>

        {showSuggestions && !loading && (
          <div className="absolute top-full left-0 right-0 bg-white border-2 border-stone-200 shadow-2xl z-20 rounded-b-sm overflow-hidden animate-in fade-in slide-in-from-top-2">
             {suggestions.map((s, idx) => (
               <button 
                 key={idx} 
                 onClick={() => { setQuery(s.term); handleSearch(s.term); }}
                 className={`w-full text-left px-10 py-6 border-b border-stone-100 last:border-0 flex items-center justify-between transition-colors ${selectedIndex === idx ? 'bg-stone-50' : 'hover:bg-stone-50/50'}`}
               >
                 <span className="serif text-2xl md:text-3xl text-stone-700">{s.term}</span>
                 <span className="text-[9px] uppercase tracking-widest font-black text-stone-300">{s.source}</span>
               </button>
             ))}
          </div>
        )}
      </div>

      {/* Arena CTA Hero */}
      {!result && !loading && !searchError && history.length >= 3 && (
        <div className="bg-white border border-stone-100 p-8 md:p-12 shadow-sm rounded-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-start gap-6">
              <div className="w-1.5 h-16 bg-[#7c1a1a] rounded-full"></div>
              <div>
                <h3 className="serif text-3xl md:text-4xl font-black text-stone-900 uppercase tracking-tighter leading-none mb-2">Archival Chronicles</h3>
                <p className="text-sm italic text-stone-400 uppercase tracking-[0.2em] font-medium">Persistent Insights</p>
              </div>
            </div>
            <button 
              onClick={onStartArena}
              className="group relative bg-[#7c1a1a] text-white px-10 py-6 md:px-14 md:py-8 rounded-sm overflow-hidden transition-all active:scale-[0.97] hover:bg-[#8d2020] shadow-xl"
            >
              <div className="relative z-10 flex items-center gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-white" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                <span className="text-[14px] md:text-[18px] font-black uppercase tracking-[0.4em]">Start Arena</span>
              </div>
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </button>
          </div>
        </div>
      )}

      {/* Results Rendering */}
      <div className="min-h-[60px]">
        {loading && (
          <div className="bg-white border border-stone-100 p-16 flex flex-col items-center justify-center space-y-8">
            <div className="w-20 h-20 border-[5px] border-[#7c1a1a] border-t-transparent rounded-full animate-spin"></div>
            <p className="serif text-3xl italic text-stone-300">Consulting the Lexicon...</p>
          </div>
        )}
        
        {/* Error State View */}
        {searchError && (
          <div className="bg-[#7c1a1a] text-stone-100 p-12 md:p-20 rounded-sm shadow-xl animate-in zoom-in-95 duration-500">
             <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="p-6 bg-white/10 rounded-full">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-3xl md:text-5xl serif font-black mb-4">The Archive is Silent.</h3>
                  <p className="text-stone-300 serif italic text-xl md:text-2xl mb-8 opacity-80">{searchError}</p>
                  <button 
                    onClick={() => handleSearch()}
                    className="px-10 py-4 bg-white text-[#7c1a1a] text-[11px] font-black uppercase tracking-[0.4em] hover:bg-stone-100 transition-all rounded-sm shadow-lg active:scale-95"
                  >
                    Retry Invocation
                  </button>
                </div>
             </div>
          </div>
        )}

        {result && <ResultCard entry={result} onSearchTerm={(term) => handleSearch(term)} />}
      </div>

      <div className="pt-16 md:pt-32 border-t border-stone-100">
        <div className="flex justify-between items-center mb-12">
          <div className="border-l-[4px] border-[#7c1a1a] pl-8 py-1">
            <h2 className="text-[14px] uppercase tracking-[0.6em] text-stone-900 font-black">Archival Chronicles</h2>
          </div>
        </div>
        <HistoryGrid history={history} onEntryClick={onEntryClick} />
      </div>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default Dictionary;
