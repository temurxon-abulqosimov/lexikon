
import React from 'react';
import { LexicalEntry } from '../types';
import HistoryGrid from './HistoryGrid';

interface Props {
  history: LexicalEntry[];
  onEntryClick: (entry: LexicalEntry) => void;
}

const Archive: React.FC<Props> = ({ history, onEntryClick }) => {
  return (
    <div className="py-12">
      <div className="mb-12 border-l-[3px] border-[#7c1a1a] pl-8">
        <h1 className="text-5xl serif font-bold text-stone-900 mb-2">The Archive</h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-bold">
          Persistent memory of {history.length} lexical inscriptions
        </p>
      </div>

      {history.length === 0 ? (
        <div className="py-40 text-center bg-white border border-stone-100">
           <p className="serif text-2xl italic text-stone-300">No records found in the archive.</p>
        </div>
      ) : (
        <HistoryGrid history={history} onEntryClick={onEntryClick} />
      )}
    </div>
  );
};

export default Archive;
