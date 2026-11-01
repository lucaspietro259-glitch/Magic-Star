// Sessão, perfil do usuário e permissões.
// As permissões abaixo controlam o que aparece na tela; quem garante a
// segurança de verdade são as regras (RLS) do banco em supabase/schema.sql.
import { sb, q } from './supabase.js';

export const LEVEL = { pendente: 0, funcionario: 1, gerente: 2, admin: 3 };
export const ROLE_LABEL = { pendente: 'Aguardando liberação', funcionario: 'Funcionário', gerente: 'Gerente', admin: 'Administrador' };

export const state = { session: null, profile: null, settings: null };

export const can = (min) => LEVEL[state.profile?.role || 'pendente'] >= LEVEL[min];

const IDLE_MINUTES = 60; // encerra a sessão após 1 hora sem uso

export async function loadProfile() {
  const { data: { session } } = await sb.auth.getSession();
  state.session = session;
  if (!session) return null;
  state.profile = await q(sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle());
  return state.profile;
}

export async function loadSettings(force = false) {
  if (state.settings && !force) return state.settings;
  state.settings = await q(sb.from('settings').select('*').eq('id', 1).maybeSingle());
  return state.settings;
}

export async function signOut(reason = '') {
  try { await sb.auth.signOut(); } catch {}
  location.replace(`./${reason ? `?motivo=${encodeURIComponent(reason)}` : ''}`);
}

// Protege as páginas: sem sessão ou sem liberação → volta ao login
export async function requireAuth() {
  const profile = await loadProfile().catch(() => null);
  if (!state.session) { location.replace('./'); return false; }
  if (!profile || !profile.active || profile.role === 'pendente') { await signOut('pendente'); return false; }

  sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') location.replace('./'); });

  // Encerra por inatividade
  let last = Date.now();
  ['pointerdown', 'keydown', 'scroll'].forEach((ev) => addEventListener(ev, () => (last = Date.now()), { passive: true }));
  setInterval(() => { if (Date.now() - last > IDLE_MINUTES * 60000) signOut('inatividade'); }, 60000);
  return true;
}
