// Conexão com o Supabase. A URL e a chave anon ficam em /assets/js/config.js.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SITE } from '../../../assets/js/config.js';

export const configured = Boolean(SITE.supabase?.url && SITE.supabase?.anonKey);

export const sb = configured
  ? createClient(SITE.supabase.url, SITE.supabase.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'magicstar-gestor' },
    })
  : null;

// Executa uma consulta e lança o erro, para tratar tudo com try/catch
export async function q(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function rpc(fn, args) {
  return q(sb.rpc(fn, args));
}
