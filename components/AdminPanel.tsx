
import React, { useEffect, useState } from 'react';
import { fetchAdminStats } from '../services/supabase';
import { ADMIN_ID } from '../constants';

interface Stats {
  totalUsers: number;
  totalEntries: number;
  totalHistory: number;
  recentActivity: any[];
  users: any[];
}

const AdminPanel: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    const data = await fetchAdminStats();
    setStats(data as Stats);
    setLoading(false);
  };

  const handlePurgeCache = () => {
    setActionLoading('purge');
    setTimeout(() => {
      localStorage.removeItem('lexHistory');
      setActionLoading(null);
      alert("Local Archive Purged. System will resync on next reload.");
    }, 1500);
  };

  const handleGlobalSync = () => {
    setActionLoading('sync');
    setTimeout(() => {
      loadStats();
      setActionLoading(null);
    }, 2000);
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-16 h-16 border-[4px] border-[#7c1a1a] border-t-transparent rounded-full animate-spin mb-8" />
        <p className="serif text-2xl italic text-stone-300">Summoning the Ledger...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
        <div className="border-l-[4px] border-[#7c1a1a] pl-8">
          <h1 className="text-6xl serif font-black text-stone-900 mb-2 lowercase tracking-tighter">The Curator's Ledger</h1>
          <p className="text-[10px] uppercase tracking-[0.5em] text-stone-400 font-black">Administrative Overview & System Health</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleGlobalSync}
            disabled={!!actionLoading}
            className="px-6 py-3 bg-stone-900 text-white text-[9px] uppercase tracking-[0.3em] font-black hover:bg-stone-800 transition-all rounded-sm flex items-center gap-3 disabled:opacity-50"
          >
            {actionLoading === 'sync' ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>}
            Global Sync
          </button>
          <button 
            onClick={handlePurgeCache}
            disabled={!!actionLoading}
            className="px-6 py-3 border border-stone-200 text-stone-400 text-[9px] uppercase tracking-[0.3em] font-black hover:text-[#7c1a1a] hover:border-[#7c1a1a] transition-all rounded-sm flex items-center gap-3 disabled:opacity-50"
          >
            {actionLoading === 'purge' ? <div className="w-3 h-3 border-2 border-[#7c1a1a]/20 border-t-[#7c1a1a] rounded-full animate-spin" /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>}
            Purge Local
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white border border-stone-200 p-10 rounded-sm shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-black block mb-4">Scholar Registry</span>
          <h2 className="text-7xl serif font-bold text-stone-900 leading-none">{stats?.totalUsers}</h2>
          <p className="text-[9px] uppercase tracking-widest text-stone-300 mt-4 font-bold italic">Total registered identities</p>
        </div>

        <div className="bg-white border border-stone-200 p-10 rounded-sm shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <span className="text-[10px] uppercase tracking-[0.4em] text-[#7c1a1a] font-black block mb-4">Lexical Inscriptions</span>
          <h2 className="text-7xl serif font-bold text-[#7c1a1a] leading-none">{stats?.totalEntries}</h2>
          <p className="text-[9px] uppercase tracking-widest text-stone-300 mt-4 font-bold italic">Global philological records</p>
        </div>

        <div className="bg-white border border-stone-200 p-10 rounded-sm shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-black block mb-4">Archival Chronicles</span>
          <h2 className="text-7xl serif font-bold text-stone-900 leading-none">{stats?.totalHistory}</h2>
          <p className="text-[9px] uppercase tracking-widest text-stone-300 mt-4 font-bold italic">Total user interaction history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <section>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[12px] uppercase tracking-[0.5em] text-stone-900 font-black flex items-center gap-3">
              <span className="w-8 h-[1px] bg-[#7c1a1a]"></span>
              Recent Global Inscriptions
            </h3>
            <button onClick={loadStats} className="text-stone-300 hover:text-[#7c1a1a] transition-all">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            </button>
          </div>
          <div className="bg-white border border-stone-100 rounded-sm divide-y divide-stone-50 overflow-hidden mb-12">
            {stats?.recentActivity.map((act, i) => (
              <div key={i} className="p-6 flex items-center justify-between group hover:bg-stone-50 transition-colors">
                <div>
                  <p className="serif text-xl font-bold text-stone-900 lowercase">{act.term}</p>
                  <p className="text-[9px] uppercase tracking-widest text-stone-400 font-bold mt-1">
                    {act.source_lang} → {act.target_lang}
                  </p>
                </div>
                <span className="text-[9px] font-mono text-stone-300">
                  {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {stats?.recentActivity.length === 0 && (
              <div className="p-12 text-center text-stone-300 serif italic">No recent inscriptions cataloged.</div>
            )}
          </div>

          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[12px] uppercase tracking-[0.5em] text-[#7c1a1a] font-black flex items-center gap-3">
              <span className="w-8 h-[1px] bg-[#7c1a1a]"></span>
              Scholar Directory
            </h3>
          </div>
          <div className="bg-white border border-stone-100 rounded-sm divide-y divide-stone-50 overflow-hidden">
             {stats?.users.map((u, i) => {
               const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || 'Unknown Scholar';
               return (
               <div key={i} className="p-6 flex items-center justify-between group hover:bg-stone-50 transition-colors">
                 <div>
                    <p className="serif text-xl font-bold text-stone-900">{displayName}</p>
                    <p className="text-[9px] uppercase tracking-widest text-[#7c1a1a] font-bold mt-1">{u.username ? `@${u.username}` : u.telegram_id ? `ID: ${u.telegram_id}` : ''}</p>
                 </div>
                 <span className="text-[9px] font-mono text-stone-300">
                   {u.created_at ? new Date(u.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                 </span>
               </div>
               );
             })}
             {stats?.users.length === 0 && (
               <div className="p-12 text-center text-stone-300 serif italic">No scholars found in registry.</div>
             )}
          </div>
        </section>

        <section className="bg-stone-900 text-white p-12 rounded-sm shadow-xl h-fit">
          <h3 className="text-[12px] uppercase tracking-[0.5em] text-[#7c1a1a] font-black mb-10 flex items-center gap-3">
            <span className="w-8 h-[1px] bg-[#7c1a1a]"></span>
            System Manifest
          </h3>
          <div className="space-y-8 font-mono">
            <div className="flex justify-between border-b border-stone-800 pb-4">
              <span className="text-stone-500 uppercase text-[10px]">Cloud Provider</span>
              <span className="text-stone-200">Supabase Archival</span>
            </div>
            <div className="flex justify-between border-b border-stone-800 pb-4">
              <span className="text-stone-500 uppercase text-[10px]">Linguistic Engine</span>
              <span className="text-stone-200">Cerebras-Llama-3.1</span>
            </div>
            <div className="flex justify-between border-b border-stone-800 pb-4">
              <span className="text-stone-500 uppercase text-[10px]">Mini-App Integration</span>
              <span className="text-stone-200 text-green-500">Active (v6.0)</span>
            </div>
            <div className="flex justify-between border-b border-stone-800 pb-4">
              <span className="text-stone-500 uppercase text-[10px]">Archival Integrity</span>
              <span className="text-stone-200">Verified</span>
            </div>
            <div className="flex justify-between border-b border-stone-800 pb-4">
              <span className="text-stone-500 uppercase text-[10px]">Curator ID</span>
              <span className="text-[#7c1a1a] font-bold">{ADMIN_ID} (Authorized)</span>
            </div>
          </div>
          <div className="mt-16 pt-10 border-t border-stone-800">
             <p className="serif italic text-stone-400 text-xl leading-relaxed">
               "The true librarian is a curator of thought, a shepherd of inscriptions that define our collective identity."
             </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminPanel;
