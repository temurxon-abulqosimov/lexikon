
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppMode, LexicalEntry, UserProfile } from './types';
import Dictionary from './components/Dictionary';
import Arena from './components/Arena';
import Archive from './components/Archive';
import AdminPanel from './components/AdminPanel';
import { RANKS, ADMIN_ID } from './constants';
import { 
  fetchProfile, 
  upsertProfile, 
  fetchUserHistory, 
  saveUserHistoryEntry 
} from './services/supabase';
import { resumeAudioContext } from './services/tts';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.DICTIONARY);
  const [history, setHistory] = useState<LexicalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<LexicalEntry | null>(null);
  const [autoAudio, setAutoAudio] = useState(() => localStorage.getItem('autoAudio') === 'true');
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudActive, setCloudActive] = useState(false);
  
  const initialHydrationRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const profileRef = useRef<UserProfile | null>(null);

  // Profile is intentionally NOT cached in localStorage.
  // XP, rank, and stats are the source of truth in Supabase so they persist across devices/sessions.
  const [profile, setProfile] = useState<UserProfile>({
    username: 'Scholar',
    xp: 0,
    rank: RANKS[0].title,
    searchCount: 0,
    arenaWins: 0,
    accuracy: 100,
    streak: 0
  });

  // Admin check — reads directly from Telegram SDK and profile
  const [isAdmin, setIsAdmin] = useState(false);

  // Check on mount from Telegram WebApp SDK
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const tgUserId = tg?.initDataUnsafe?.user?.id;
    const raw = tgUserId !== undefined ? String(tgUserId) : 'N/A';
    const match = tgUserId !== undefined && String(tgUserId) === ADMIN_ID;
    console.log(`[LEX] Admin check: tgId="${raw}" profileId="${profile.telegramId}" admin="${ADMIN_ID}" match=${match}`);
    if (match) setIsAdmin(true);
  }, []);

  // Re-check when profile hydrates from cloud
  useEffect(() => {
    if (profile.telegramId) {
      const match = String(profile.telegramId) === ADMIN_ID;
      console.log(`[LEX] Admin recheck: profileId="${profile.telegramId}" match=${match}`);
      if (match) setIsAdmin(true);
    }
  }, [profile.telegramId]);

  // Global iOS Audio Unlock
  useEffect(() => {
    const handleFirstInteraction = async () => {
      await resumeAudioContext();
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('mousedown', handleFirstInteraction);
    };
    document.addEventListener('touchstart', handleFirstInteraction);
    document.addEventListener('mousedown', handleFirstInteraction);
    return () => {
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('mousedown', handleFirstInteraction);
    };
  }, []);

  const syncProfileToCloud = useCallback(async (newProfile: UserProfile) => {
    if (!newProfile.telegramId) return;
    setIsSyncing(true);
    try {
      await upsertProfile(newProfile);
      console.log(`[LEX] Cloud sync succeeded: xp=${newProfile.xp}`);
      setCloudActive(true);
    } catch (err) {
      console.error("[LEX] Cloud Archive Sync Failed:", err);
      setCloudActive(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (initialHydrationRef.current) return;
    initialHydrationRef.current = true;

    const performHydration = async () => {
      const savedHistory = localStorage.getItem('lexHistory');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser) {
          const telegramId = Number(tgUser.id);
          
          try {
            // Try to fetch profile from cloud database
            let cloudProfile = await fetchProfile(telegramId);
            if (!cloudProfile) {
              // Setup new profile structure for the first time
              cloudProfile = {
                username: tgUser.username || `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() || 'Scholar',
                firstName: tgUser.first_name,
                lastName: tgUser.last_name,
                telegramId: telegramId,
                xp: 0,
                rank: RANKS[0].title,
                searchCount: 0,
                arenaWins: 0,
                accuracy: 100,
                streak: 0
              };
              // Upload immediately to save to Supabase
              await upsertProfile(cloudProfile);
            } else {
              // Ensure we reflect any latest changes in name or username from Telegram
              cloudProfile.username = tgUser.username || cloudProfile.username;
              cloudProfile.firstName = tgUser.first_name || cloudProfile.firstName;
              cloudProfile.lastName = tgUser.last_name || cloudProfile.lastName;
            }

            // Critical: telegramId must be present or cloud sync will be skipped.
            cloudProfile.telegramId = telegramId;

            // Ensure xp and other numeric fields are never undefined/NaN
            cloudProfile.xp = typeof cloudProfile.xp === 'number' ? cloudProfile.xp : 0;
            cloudProfile.searchCount = typeof cloudProfile.searchCount === 'number' ? cloudProfile.searchCount : 0;
            cloudProfile.arenaWins = typeof cloudProfile.arenaWins === 'number' ? cloudProfile.arenaWins : 0;
            cloudProfile.accuracy = typeof cloudProfile.accuracy === 'number' ? cloudProfile.accuracy : 100;
            cloudProfile.streak = typeof cloudProfile.streak === 'number' ? cloudProfile.streak : 0;
            cloudProfile.rank = cloudProfile.rank || RANKS[0].title;

            // Merge any progress earned before hydration completed (e.g., user searched immediately).
            const localProfile = profileRef.current;
            if (localProfile && (localProfile.xp > 0 || localProfile.searchCount > 0 || localProfile.arenaWins > 0)) {
              cloudProfile.xp = Math.max(cloudProfile.xp, localProfile.xp);
              cloudProfile.searchCount = Math.max(cloudProfile.searchCount, localProfile.searchCount);
              cloudProfile.arenaWins = Math.max(cloudProfile.arenaWins, localProfile.arenaWins);
              cloudProfile.streak = Math.max(cloudProfile.streak, localProfile.streak);
              if (localProfile.accuracy !== 100) {
                cloudProfile.accuracy = Math.round((cloudProfile.accuracy + localProfile.accuracy) / 2);
              }
              // Recalculate rank from merged XP
              cloudProfile.rank = RANKS.reduce((prev, curr) => cloudProfile.xp >= curr.minXp ? curr : prev, RANKS[0]).title;
            }
            
            setProfile(cloudProfile);
            setCloudActive(true);
            hasHydratedRef.current = true;

            // Retrieve and merge history entries from Supabase
            const cloudHistory = await fetchUserHistory(telegramId);
            if (cloudHistory && cloudHistory.length > 0) {
              setHistory(cloudHistory);
            }
          } catch (err) {
            console.error("Telegram Auth/Cloud Sync failed:", err);
            // Even on error, mark hydration as done so local changes can still attempt to sync.
            hasHydratedRef.current = true;
          }
        } else {
          // No Telegram user; allow local-only mode to sync if needed.
          hasHydratedRef.current = true;
        }
      } else {
        hasHydratedRef.current = true;
      }
    };

    performHydration();
  }, []);

  useEffect(() => {
    localStorage.setItem('lexHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    // Keep ref in sync with state so hydration can merge pre-hydration progress.
    profileRef.current = profile;

    // Do not cache profile in localStorage. XP/rank must be persisted in Supabase only.
    if (hasHydratedRef.current && profile.telegramId) {
      console.log(`[LEX] Syncing profile to cloud: id=${profile.telegramId}, xp=${profile.xp}, searches=${profile.searchCount}`);
      syncProfileToCloud(profile);
    }
  }, [profile, syncProfileToCloud]);

  useEffect(() => {
    localStorage.setItem('autoAudio', String(autoAudio));
  }, [autoAudio]);

  const addEntry = async (entry: LexicalEntry) => {
    setHistory(prev => {
      const filtered = prev.filter(p => p.term.toLowerCase() !== entry.term.toLowerCase());
      return [entry, ...filtered].slice(0, 50);
    });
    
    const newXp = profile.xp + 2;
    const newRank = RANKS.reduce((prev, curr) => newXp >= curr.minXp ? curr : prev, RANKS[0]);
    const newProfile = { 
      ...profile, 
      xp: newXp, 
      rank: newRank.title,
      searchCount: profile.searchCount + 1 
    };

    setProfile(newProfile);

    if (newProfile.telegramId) {
      try {
        await saveUserHistoryEntry(newProfile.telegramId, entry);
      } catch (err) {
        console.warn("Cloud persistence failed.");
      }
    }
  };

  const handleArenaResult = (correctCount: number, totalQuestions: number) => {
    const earnedXp = correctCount * 5;
    const sessionAccuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    
    const newXp = profile.xp + earnedXp;
    const newRank = RANKS.reduce((prev, curr) => newXp >= curr.minXp ? curr : prev, RANKS[0]);
    const newAccuracy = profile.accuracy === 100 ? sessionAccuracy : (profile.accuracy + sessionAccuracy) / 2;
    
    const newProfile = { 
      ...profile, 
      xp: newXp, 
      rank: newRank.title,
      arenaWins: profile.arenaWins + 1,
      accuracy: Math.round(newAccuracy),
      streak: correctCount === totalQuestions ? profile.streak + 1 : 0
    };

    setProfile(newProfile);
  };

  const handleHistoryItemClick = (entry: LexicalEntry) => {
    setActiveEntry(entry);
    setMode(AppMode.DICTIONARY);
  };

  const handleSupportClick = () => {
    window.open('https://t.me/lex_uz_support', '_blank');
  };

  return (
    <div className="min-h-screen bg-[#fcfcfb] flex flex-col selection:bg-[#7c1a1a]/10 selection:text-[#7c1a1a]">
      {/* Header with iOS Safe Area support */}
      <header className="px-6 md:px-12 pt-10 pb-10 pt-safe max-w-[1400px] mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
        <div className="flex items-center gap-6 md:gap-8">
          <span 
            onClick={() => { setActiveEntry(null); setMode(AppMode.DICTIONARY); }}
            className="text-4xl md:text-5xl serif font-black tracking-tighter cursor-pointer text-[#7c1a1a] hover:scale-105 transition-transform"
          >
            LEX.
          </span>
          <div className="h-10 md:h-12 w-[1.5px] bg-stone-200"></div>
          <div className="flex flex-col">
            <span className="text-[10px] md:text-[12px] uppercase tracking-[0.4em] md:tracking-[0.6em] text-stone-900 font-black leading-none mb-1.5">
              Polyglot Insight Engine
            </span>
            <span className="text-[8px] md:text-[9px] uppercase tracking-[0.3em] text-stone-400 font-bold">
              Archival Philology
            </span>
          </div>
        </div>
        
        <nav className="flex flex-wrap justify-center items-center gap-6 md:gap-12 text-[11px] md:text-[14px] uppercase tracking-[0.2em] md:tracking-[0.4em] font-black text-stone-400">
          <button 
            onClick={() => { setActiveEntry(null); setMode(AppMode.DICTIONARY); }} 
            className={`hover:text-[#7c1a1a] transition-all border-b-[3px] py-1.5 ${mode === AppMode.DICTIONARY ? 'border-[#7c1a1a] text-stone-900' : 'border-transparent'}`}
          >
            Encyclopedia
          </button>
          <button 
            onClick={() => { setMode(AppMode.ARENA); }} 
            className={`hover:text-[#7c1a1a] transition-all border-b-[3px] py-1.5 ${mode === AppMode.ARENA ? 'border-[#7c1a1a] text-stone-900' : 'border-transparent'}`}
          >
            Arena
          </button>
          <button 
            onClick={() => { setMode(AppMode.ARCHIVE); }} 
            className={`hover:text-[#7c1a1a] transition-all border-b-[3px] py-1.5 ${mode === AppMode.ARCHIVE ? 'border-[#7c1a1a] text-stone-900' : 'border-transparent'}`}
          >
            Chronicles
          </button>
          
          {isAdmin && (
            <button 
              onClick={() => { setMode(AppMode.ADMIN); }} 
              className={`hover:text-[#7c1a1a] transition-all border-b-[3px] py-1.5 ${mode === AppMode.ADMIN ? 'border-[#7c1a1a] text-stone-900' : 'border-transparent'} flex items-center gap-2`}
            >
              <span className="w-2 h-2 rounded-full bg-[#7c1a1a] animate-pulse"></span>
              Curator
            </button>
          )}

          <button 
            onClick={handleSupportClick} 
            className="hover:text-[#7c1a1a] transition-all border-b-[3px] py-1.5 border-transparent flex items-center gap-2.5 group"
          >
            Support
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 group-hover:opacity-100 transition-opacity"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </button>
        </nav>
      </header>

      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 pb-20">
          {mode === AppMode.DICTIONARY && (
            <Dictionary 
              onEntrySaved={addEntry} 
              autoAudio={autoAudio} 
              setAutoAudio={setAutoAudio}
              profile={profile}
              history={history}
              onStartArena={() => { setMode(AppMode.ARENA); }}
              selectedEntry={activeEntry}
              onEntryClick={handleHistoryItemClick}
            />
          )}
          
          {mode === AppMode.ARENA && (
            <Arena history={history} onResult={handleArenaResult} />
          )}
          
          {mode === AppMode.ARCHIVE && (
            <Archive history={history} onEntryClick={handleHistoryItemClick} />
          )}

          {mode === AppMode.ADMIN && isAdmin && (
            <AdminPanel />
          )}
        </div>
      </main>

      {/* Footer with iOS Safe Area support */}
      <footer className="py-10 border-t border-stone-100 bg-white/50 pb-safe">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] md:text-[12px] uppercase tracking-[0.4em] text-stone-500 font-black">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
             <div className="flex items-center gap-4 md:gap-6">
                <span>&copy; 2025 LEXICON PHILOLOGY</span>
                <span className="text-stone-300 hidden md:block">/</span>
                <span className={`flex items-center gap-2.5 transition-all duration-500 ${isSyncing ? 'text-[#7c1a1a] animate-pulse' : 'text-stone-500'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-[#7c1a1a]' : cloudActive ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-stone-300'}`} />
                  {isSyncing ? 'Syncing...' : cloudActive ? 'Cloud Active' : 'Unverified Scribe'}
                </span>
             </div>
          </div>
          <div className="flex items-center gap-6 md:gap-10 overflow-x-auto w-full md:w-auto justify-center md:justify-end">
             <span className="flex items-center gap-3 whitespace-nowrap">
              <span className={`w-2.5 h-2.5 rounded-full ${isAdmin ? 'bg-yellow-500' : 'bg-stone-300'}`}></span>
              {profile.rank}
            </span>
            <span className="text-stone-900 whitespace-nowrap">LVL {Math.floor(profile.xp / 1000) + 1}</span>
            <span className="text-stone-400 whitespace-nowrap">{profile.accuracy}% ACCURACY</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;
