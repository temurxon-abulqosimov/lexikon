
import { createClient } from '@supabase/supabase-js';
import { LexicalEntry, UserProfile, Language } from '../types';


const supabaseUrl = process.env.SUPABASE_URL || 'https://pfykbgifzgfgeuiadebm.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeWtiZ2lmemdmZ2V1aWFkZWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTY5ODMsImV4cCI6MjA4MzAzMjk4M30.tSh8OgqVw3yk4JgCs7jzz21SJLKaotce_8AVAJdi9Z0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simple suggestion cache to prevent hammering the database
const suggestionCache = new Map<string, string[]>();

/**
 * Handles Supabase errors and checks if the error is specifically a missing table (404 / PGRST205).
 */
const handleSupabaseError = (error: any, tableName: string) => {
  if (error?.code === 'PGRST204' || error?.code === 'PGRST205' || error?.status === 404 || error?.message?.includes('does not exist')) {
    console.warn(`Supabase Alert: Table '${tableName}' not found. Falling back to primary application state.`);
    return true; // Table missing
  }
  if (error) console.error(`Supabase Error [${tableName}]:`, error);
  return false;
};

/**
 * Fetches users list, falling back to lex_profiles if the identity table is missing.
 */
export async function fetchAdminUsers() {
  try {
    // 1. Try `lex_profiles` first (primary user registry)
    const { data: profileData, error: profileError } = await supabase
      .from('lex_profiles')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!profileError && profileData && profileData.length > 0) {
      return profileData.map(p => ({
        username: p.username,
        first_name: p.first_name || p.username || 'Scholar',
        last_name: p.last_name || '',
        created_at: p.updated_at
      }));
    }

    if (profileError) {
      console.warn(`[fetchAdminUsers] lex_profiles query failed, falling back to users:`, profileError);
    }

    // 2. Fallback to `users` table
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('username, first_name, created_at')
      .order('created_at', { ascending: false });

    if (!usersError && usersData && usersData.length > 0) {
      return usersData.map(u => ({
        username: u.username,
        first_name: u.first_name || u.username || 'Scholar',
        last_name: u.last_name || '',
        created_at: u.created_at
      }));
    }

    if (usersError) {
      console.warn(`[fetchAdminUsers] users table also failed:`, usersError);
      handleSupabaseError(usersError, 'users');
    }

    return [];
  } catch (err) {
    console.error("[fetchAdminUsers] Failed:", err);
    return [];
  }
}

export async function fetchAdminStats() {
  try {
    // Determine the user source table based on what exists
    const [profiles, entries, history, recent, userList] = await Promise.all([
      supabase.from('lex_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('lex_entries').select('*', { count: 'exact', head: true }),
      supabase.from('lex_user_history').select('*', { count: 'exact', head: true }),
      supabase.from('lex_entries').select('term, source_lang, target_lang, created_at').order('created_at', { ascending: false }).limit(10),
      fetchAdminUsers()
    ]);

    return {
      totalUsers: profiles.count || 0,
      totalEntries: entries.count || 0,
      totalHistory: history.count || 0,
      recentActivity: recent.data || [],
      users: userList
    };
  } catch (err) {
    console.error("Admin Stats Fetch Failed:", err);
    return { totalUsers: 0, totalEntries: 0, totalHistory: 0, recentActivity: [], users: [] };
  }
}

export async function fetchSuggestions(query: string, sourceLang: Language): Promise<string[]> {
  const cleanQuery = query.toLowerCase().trim();
  if (cleanQuery.length < 2) return [];

  const cacheKey = `${sourceLang}:${cleanQuery}`;
  if (suggestionCache.has(cacheKey)) {
    return suggestionCache.get(cacheKey)!;
  }

  try {
    const { data, error } = await supabase
      .from('lex_entries')
      .select('term')
      .eq('source_lang', sourceLang)
      .ilike('normalized_term', `${cleanQuery}%`)
      .limit(8);

    if (error) {
      handleSupabaseError(error, 'lex_entries');
      return [];
    }

    const results: string[] = Array.from(
      new Set(
        (data?.map(d => (d as any).term) || [])
          .filter((t): t is string => typeof t === 'string' && !!t)
      )
    );

    suggestionCache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

export async function fetchGlobalEntry(
  normalizedTerm: string,
  sourceLang: Language,
  targetLang: Language
): Promise<LexicalEntry | null> {
  try {
    const { data, error } = await supabase
      .from('lex_entries')
      .select('entry_data')
      .eq('normalized_term', normalizedTerm)
      .eq('source_lang', sourceLang)
      .eq('target_lang', targetLang)
      .maybeSingle();

    if (error) {
      handleSupabaseError(error, 'lex_entries');
      return null;
    }
    return (data?.entry_data as LexicalEntry) || null;
  } catch {
    return null;
  }
}

export async function saveGlobalEntry(entry: LexicalEntry) {
  try {
    const { error } = await supabase
      .from('lex_entries')
      .upsert({
        term: entry.term,
        normalized_term: entry.normalizedTerm,
        source_lang: entry.sourceLang,
        target_lang: entry.targetLang,
        entry_data: entry,
        created_at: new Date().toISOString()
      }, { onConflict: 'normalized_term,source_lang,target_lang' });
    if (error) handleSupabaseError(error, 'lex_entries');
  } catch (err) {
    console.warn("[saveGlobalEntry] Failed:", err);
  }
}

export async function fetchProfile(telegramId: number): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('lex_profiles')
      .select('profile_data')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (error) {
      handleSupabaseError(error, 'lex_profiles');
      return null;
    }
    return (data?.profile_data as UserProfile) || null;
  } catch (err) {
    console.error("Profile Fetch Failed:", err);
    return null;
  }
}

export async function fetchUserHistory(telegramId: number): Promise<LexicalEntry[]> {
  try {
    const { data, error } = await supabase
      .from('lex_user_history')
      .select('entry_data')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      handleSupabaseError(error, 'lex_user_history');
      return [];
    }
    return data?.map(d => d.entry_data as LexicalEntry) || [];
  } catch {
    return [];
  }
}

export async function saveUserHistoryEntry(telegramId: number, entry: LexicalEntry) {
  try {
    const { error } = await supabase
      .from('lex_user_history')
      .upsert({
        telegram_id: telegramId,
        entry_id: entry.id,
        entry_data: entry,
        created_at: new Date().toISOString()
      }, { onConflict: 'telegram_id,entry_id' });
    
    if (error) handleSupabaseError(error, 'lex_user_history');
  } catch (err) {
    console.error("History Sync Failed:", err);
  }
}

export async function upsertProfile(profile: UserProfile) {
  if (!profile.telegramId) return;
  try {
    // 1. Sync identity (Mirror)
    // We run this as a separate, non-blocking call. If it fails (e.g., 404), it doesn't stop the app sync.
    supabase
      .from('users')
      .upsert({
        telegram_id: profile.telegramId,
        username: profile.username || 'Scholar',
        first_name: profile.firstName || '',
        last_name: profile.lastName || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'telegram_id' })
      .then(({ error }) => {
        if (error) handleSupabaseError(error, 'users');
      });

    // 2. Sync app state (Primary Source of Truth)
    const { error } = await supabase
      .from('lex_profiles')
      .upsert({ 
        telegram_id: profile.telegramId,
        username: profile.username || 'Scholar',
        first_name: profile.firstName || '',
        last_name: profile.lastName || '',
        profile_data: profile,
        updated_at: new Date().toISOString() 
      }, { onConflict: 'telegram_id' });
    
    if (error) handleSupabaseError(error, 'lex_profiles');
  } catch (err) {
    console.error("Profile Upsert Failed:", err);
  }
}
