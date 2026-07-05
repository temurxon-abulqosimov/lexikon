
import React from 'react';
import { LexicalEntry } from '../types';

interface Props {
  history: LexicalEntry[];
  onEntryClick?: (entry: LexicalEntry) => void;
}

const HistoryGrid: React.FC<Props> = React.memo(({ history, onEntryClick }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 contain-layout">
      {history.map((entry) => (
        <HistoryItem key={entry.id} entry={entry} onClick={() => onEntryClick?.(entry)} />
      ))}
    </div>
  );
});

const HistoryItem: React.FC<{ entry: LexicalEntry; onClick: () => void }> = React.memo(({ entry, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white border border-stone-200/60 p-6 md:p-8 hover:border-[#7c1a1a]/30 transition-all group cursor-pointer relative overflow-hidden rounded-sm will-change-transform active:scale-[0.98]"
    >
      <div className="absolute top-4 right-6 text-right opacity-30 group-hover:opacity-100 transition-opacity">
         <span className="text-[7px] md:text-[8px] uppercase tracking-[0.2em] text-[#7c1a1a] font-black">
           {entry.sourceLang.substring(0, 3)} → {entry.targetLang.substring(0, 3)}
         </span>
      </div>

      <h3 className="text-2xl md:text-3xl serif font-black text-stone-900 mb-3 lowercase group-hover:text-[#7c1a1a] transition-all tracking-tight">
        {entry.term}
      </h3>
      <div className="flex flex-col gap-0.5">
        <p className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-stone-400 font-black italic">
          {entry.mainTranslation}
        </p>
        <span className="text-[7px] md:text-[8px] uppercase tracking-[0.1em] text-stone-200 font-bold">{entry.philology.partOfSpeech}</span>
      </div>

      <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#7c1a1a] group-hover:w-full transition-all duration-300" />
    </div>
  );
});

export default HistoryGrid;
