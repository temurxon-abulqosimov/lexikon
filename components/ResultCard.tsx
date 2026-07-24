
import React, { useState } from 'react';
import { LexicalEntry } from '../types';
import { speak, resumeAudioContext } from '../services/tts';

interface Props {
  entry: LexicalEntry;
  onSearchTerm?: (term: string) => void;
}

const Shimmer: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-stone-100 rounded-sm ${className}`} />
);

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ResultCard: React.FC<Props> = ({ entry, onSearchTerm }) => {
  const isInflected = entry.lemma && entry.lemma.toLowerCase() !== entry.term.toLowerCase();
  const [copied, setCopied] = useState(false);

  const handleSpeak = async (text: string, lang: any) => {
    await resumeAudioContext();
    await speak(text, lang);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers / Telegram webviews without clipboard permission
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const displayIdioms = entry.idioms && entry.idioms.length > 0 
    ? entry.idioms 
    : (entry.realLifeSentences || []);

  const hasSynonyms = entry.synonyms && entry.synonyms.length > 0;
  const hasVariations = entry.variations && entry.variations.length > 0;

  return (
    <div className="bg-white border border-stone-200 shadow-sm rounded-sm animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-hidden">
      {/* Primary Header Section */}
      <div className="p-8 md:p-16 border-b border-stone-100 bg-[#fcfcfb]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-5xl md:text-9xl serif font-black tracking-tighter lowercase leading-none text-stone-900">
                {entry.term}
              </h1>
              <button 
                onClick={() => handleSpeak(entry.term, entry.sourceLang)} 
                className="text-stone-300 hover:text-[#7c1a1a] transition-all p-3 hover:bg-white rounded-full border border-transparent hover:border-stone-100 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              </button>
            </div>

            {isInflected && (
              <div className="mb-6 flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-bold">Lemma Reference:</span>
                <span className="text-2xl serif italic text-[#7c1a1a] lowercase underline decoration-stone-200 underline-offset-8">{entry.lemma}</span>
              </div>
            )}
            
            <div className="flex flex-wrap gap-3">
              <span className="bg-stone-900 text-white text-[9px] px-4 py-1.5 font-black uppercase tracking-[0.3em] rounded-sm">
                {entry.philology.partOfSpeech}
              </span>
              {entry.cefrLevel && entry.sourceLang !== 'Uzbek' && (
                <span className="bg-[#7c1a1a] text-white text-[9px] px-4 py-1.5 font-black uppercase tracking-[0.3em] rounded-sm">
                  {entry.cefrLevel}
                </span>
              )}
              {entry.philology.gender && (
                <span className="border border-stone-200 text-stone-600 text-[9px] px-4 py-1.5 font-black uppercase tracking-[0.3em] rounded-sm">
                  {entry.philology.gender}
                </span>
              )}
              <span className="bg-stone-50 text-stone-400 text-[9px] px-4 py-1.5 font-black uppercase tracking-[0.3em] rounded-sm border border-stone-100">
                {entry.sourceLang.substring(0, 3)}
              </span>
            </div>
          </div>

          <div className="md:text-right border-t md:border-t-0 pt-8 md:pt-0 w-full md:w-auto">
            <span className="text-[10px] uppercase tracking-[0.5em] text-stone-400 font-black block mb-4">Target Inscription ({entry.targetLang.substring(0, 3)})</span>
            <div className="flex items-center md:justify-end gap-6">
              <h2 className="text-5xl md:text-9xl serif font-black tracking-tighter lowercase leading-none text-[#7c1a1a]">
                {entry.mainTranslation}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleSpeak(entry.mainTranslation, entry.targetLang)} 
                  className="text-stone-300 hover:text-[#7c1a1a] transition-all p-3 hover:bg-white rounded-full border border-transparent hover:border-stone-100 shadow-sm"
                  aria-label="Speak translation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                </button>
                <button 
                  onClick={() => handleCopy(entry.mainTranslation)} 
                  className={`transition-all p-3 rounded-full border shadow-sm ${copied ? 'text-green-600 bg-green-50 border-green-200' : 'text-stone-300 hover:text-[#7c1a1a] hover:bg-white border-transparent hover:border-stone-100'}`}
                  aria-label="Copy translation"
                  title={copied ? 'Copied!' : 'Copy translation'}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Source Synonyms Bar */}
      <div className="px-8 md:px-16 py-6 bg-white border-b border-stone-100 flex flex-wrap items-center gap-6 md:gap-10">
        <div className="flex items-center gap-4">
          <span className="text-lg">🔗</span>
          <span className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-black">
            {entry.sourceLang} Synonyms
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {hasSynonyms ? (
            entry.synonyms.map((syn, i) => (
              <button
                key={i}
                onClick={() => onSearchTerm?.(syn)}
                className="text-lg font-sans font-bold text-stone-700 hover:text-[#7c1a1a] transition-colors border-b border-transparent hover:border-[#7c1a1a]/20 pb-0.5"
              >
                {syn}{i < entry.synonyms.length - 1 && ","}
              </button>
            ))
          ) : (
            <div className="flex gap-4">
              <Shimmer className="h-6 w-16" />
              <Shimmer className="h-6 w-20" />
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex flex-col lg:grid lg:grid-cols-12">
        <div className="lg:col-span-7 p-8 md:p-16 space-y-16 order-2 lg:order-1 border-b lg:border-b-0 lg:border-r border-stone-100">
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.5em] text-stone-900 font-black mb-10 flex items-center gap-4">
              <span className="text-lg">📚</span>
              Literary Manifestations
            </h3>
            <div className="space-y-12">
              {entry.literature && entry.literature.length > 0 ? (
                entry.literature.map((lit, i) => (
                  <div key={i} className="relative pl-8 border-l-2 border-stone-100 group">
                    <p className="text-2xl md:text-3xl serif font-medium text-stone-900 mb-4 leading-tight">"{lit.text}"</p>
                    {lit.translation && <p className="text-lg md:text-xl serif italic text-stone-400 mb-6 leading-relaxed">{lit.translation}</p>}
                    <div className="text-[10px] uppercase tracking-[0.3em] font-black text-stone-500 flex items-center gap-3">
                      <span className="text-[#7c1a1a]">{lit.author || 'Anonymous'}</span>
                      <span className="text-stone-200">/</span>
                      <span className="italic">{lit.source}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-8">
                  <Shimmer className="h-8 w-5/6" />
                  <Shimmer className="h-6 w-2/3" />
                  <p className="text-[9px] uppercase tracking-[0.4em] text-stone-300 font-bold italic">Archival Retrieval in progress...</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-[0.5em] text-stone-900 font-black mb-8 flex items-center gap-4">
              <span className="text-lg">🔬</span>
              Philological Etymology
            </h3>
            <div className="bg-stone-50/50 p-8 border border-stone-100/50 rounded-sm">
              {entry.philology.etymology ? (
                <p className="text-xl md:text-2xl serif italic text-stone-700 leading-relaxed first-letter:text-4xl first-letter:font-black first-letter:text-[#7c1a1a] first-letter:mr-1 first-letter:float-left">
                  {entry.philology.etymology}
                </p>
              ) : <Shimmer className="h-20 w-full" />}
            </div>
          </section>

          {entry.culture && (entry.culture.notes || entry.culture.usage) && (
            <section>
              <h3 className="text-[11px] uppercase tracking-[0.5em] text-stone-900 font-black mb-8 flex items-center gap-4">
                <span className="text-lg">🌍</span>
                Cultural Resonance
              </h3>
              <div className="bg-stone-50/50 p-8 border border-stone-100/50 rounded-sm italic text-stone-700">
                <p className="text-xl md:text-2xl serif leading-relaxed">
                  {entry.culture.notes || entry.culture.usage}
                </p>
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-5 bg-[#fcfcfb] p-8 md:p-16 space-y-16 order-1 lg:order-2">
          {/* Target Variations Section */}
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.5em] text-[#7c1a1a] font-black mb-8 flex items-center gap-3">
              <span className="text-lg">🔁</span>
              {entry.targetLang} Variations
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {hasVariations ? (
                entry.variations.map((v, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleSpeak(v.text, entry.targetLang)}
                    className="bg-white border border-stone-200/60 p-6 rounded-sm flex justify-between items-center group hover:border-[#7c1a1a] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
                  >
                    <span className="text-2xl md:text-3xl serif text-stone-900 group-hover:text-[#7c1a1a] transition-colors lowercase tracking-tighter">
                      {v.text}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] font-black text-stone-300 group-hover:text-[#7c1a1a] transition-colors uppercase tracking-widest">
                        {Math.round(v.confidence * 100)}%
                      </span>
                      <div className="w-8 h-[1px] bg-stone-100 group-hover:bg-[#7c1a1a] transition-colors"></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-4">
                  <Shimmer className="h-20 w-full" />
                  <Shimmer className="h-20 w-full" />
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-[0.5em] text-stone-900 font-black mb-8 flex items-center gap-3">
              <span className="text-lg">🗣</span>
              Natural Usage & Idioms
            </h3>
            <div className="space-y-6">
              {displayIdioms.length > 0 ? (
                displayIdioms.map((snt, i) => (
                  <div key={i} className="bg-white p-8 border border-stone-100 shadow-sm rounded-sm group relative">
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-8 w-2 bg-[#7c1a1a] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="text-2xl serif font-black text-stone-900 mb-2 leading-tight">"{snt.text}"</p>
                    <p className="text-lg serif italic text-[#7c1a1a] mb-4">{snt.translation}</p>
                    <div className="flex items-center gap-2">
                       <span className="w-4 h-[1px] bg-stone-200"></span>
                       <p className="text-[9px] text-stone-400 uppercase tracking-widest font-bold">{snt.context}</p>
                    </div>
                  </div>
                ))
              ) : <Shimmer className="h-32 w-full" />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
