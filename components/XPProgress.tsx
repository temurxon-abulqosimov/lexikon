
import React from 'react';
import { UserProfile } from '../types';
import { RANKS } from '../constants';

interface Props {
  profile: UserProfile;
}

const XPProgress: React.FC<Props> = ({ profile }) => {
  // Fix: Replaced findLast with reduce to ensure compatibility across all TypeScript target environments
  const currentRank = RANKS.reduce((prev, curr) => profile.xp >= curr.minXp ? curr : prev, RANKS[0]);
  const nextRank = RANKS[RANKS.indexOf(currentRank) + 1];
  
  const progress = nextRank 
    ? ((profile.xp - currentRank.minXp) / (nextRank.minXp - currentRank.minXp)) * 100
    : 100;

  return (
    <div className="w-full bg-stone-200 border border-stone-300 p-4 mb-8">
      <div className="flex justify-between items-end mb-2">
        <div>
          <span className="text-xs uppercase tracking-widest text-stone-500 font-bold">Lexical Ranking</span>
          <h2 className="text-2xl serif font-bold text-stone-900">{currentRank.title}</h2>
        </div>
        <div className="text-right">
          <span className="text-sm font-mono text-[#7c1a1a] font-bold">{profile.xp} XP</span>
        </div>
      </div>
      <div className="w-full h-1 bg-stone-300 relative">
        <div 
          className="absolute top-0 left-0 h-full bg-[#7c1a1a] transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      {nextRank && (
        <p className="text-[10px] text-stone-400 mt-2 uppercase tracking-tighter">
          {nextRank.minXp - profile.xp} XP until {nextRank.title}
        </p>
      )}
    </div>
  );
};

export default XPProgress;
