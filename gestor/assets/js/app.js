// Estrutura do painel: autenticação, menu por nível de acesso e roteamento.
import { configured, sb, rpc } from './supabase.js';
import { requireAuth, state, can, loadSettings, signOut, ROLE_LABEL } from './auth.js';
import { $, $$, html, icon, fail, toast, loadingView, confirmDialog } from './ui.js';

if (!configured) location.replace('./');

const NAV = [
  { href: '#/', label: 'Visão geral', icon: 'home', min: 'funcionario' },
  { href: '#/interessados', label: 'Interessados', icon: 'inbox', min: 'funcionario', badge: 'leads' },
  { href: '#/clientes', label: 'Clientes', icon: 'users', min: 'funcionario' },
  { href: '#/orcamentos', label: 'Orçamentos', icon: 'file', min: 'funcionario' },
  { href: '#/agenda', label: 'Agenda de festas', icon: 'calendar', min: 'funcionario' },
  { href: '#/financeiro', label: 'Financeiro', icon: 'wallet', min: 'gerente' },
  { href: '#/catalogo', label: 'Pacotes e serviços', icon: 'box', min: 'funcionario' },
  { href: '#/relatorios', label: 'Relatórios', icon: 'chart', min: 'gerente' },
  { section: 'Administração', min: 'admin' },
  { href: '#/configuracoes', label: 'Configurações', icon: 'settings', min: 'admin' },
  { href: '#/usuarios', label: 'Usuários', icon: 'shield', min: 'admin' },
];

// [padrão, módulo, nível mínimo]
const ROUTES = [
  [/^\/$/, 'dashboard', 'funcionario'],
  [/^\/interessados$/, 'leads', 'funcionario'],
  [/^\/clientes$/, 'clients', 'funcionario'],
  [/^\/clientes\/([\w-]+)$/, 'client', 'funcionario'],
  [/^\/orcamentos$/, 'quotes', 'funcionario'],
  [/^\/orcamentos\/novo$/, 'quote-editor', 'funcionario'],
  [/^\/orcamentos\/([\w-]+)\/previa$/, 'quote-preview', 'funcionario'],
  [/^\/orcamentos\/([\w-]+)$/, 'quote-editor', 'funcionario'],
  [/^\/agenda$/, 'agenda', 'funcionario'],
  [/^\/festas\/([\w-]+)$/, 'event', 'funcionario'],
  [/^\/financeiro$/, 'finance', 'gerente'],
  [/^\/catalogo$/, 'catalog', 'funcionario'],
  [/^\/relatorios$/, 'reports', 'gerente'],
  [/^\/configuracoes$/, 'settings', 'admin'],
  [/^\/usuarios$/, 'users', 'admin'],
  [/^\/minha-conta$/, 'account', 'funcionario'],
];

const view = $('[data-view]');
const app = $('[data-app]');

// Avisa antes de sair de uma tela com alterações não salvas
export const dirty = { on: false, set(v) { this.on = v; } };
addEventListener('beforeunload', (e) => { if (dirty.on) { e.preventDefault(); e.returnValue = ''; } });

export const setTitle = (t) => { $('[data-title]').textContent = t; document.title = `${t} | Magic Star`; };
export const go = (hash) => { location.hash = hash; };

function renderNav() {
  $('[data-nav]').innerHTML = String(html`${NAV.filter((n) => can(n.min)).map((n) => n.section
    ? html`<p class="side__section">${n.section}</p>`
    : html`<a href="${n.href}" data-href="${n.href}">${icon(n.icon)}<span>${n.label}</span>${n.badge ? html`<em class="side__badge" data-badge="${n.badge}" hidden></em>` : ''}</a>`)}`);
  const p = state.profile;
  $('[data-user]').innerHTML = String(html`
    <button class="user__btn" type="button" aria-expanded="false" data-user-btn>
      <span class="avatar">${(p.full_name || p.email || '?').trim().charAt(0).toUpperCase()}</span>
      <span class="user__name"><strong>${p.full_name || p.email}</strong><small>${ROLE_LABEL[p.role]}</small></span>
    </button>
    <div class="user__menu" hidden data-user-menu>
      <a href="#/minha-conta">${icon('user')}Minha conta</a>
      <button type="button" data-logout>${icon('logout')}Sair</button>
    </div>`);
  $('[data-menu]').innerHTML = String(icon('menu'));
  $('[data-new-quote]').innerHTML = String(html`${icon('plus')}<span>Novo orçamento</span>`);
}

async function refreshBadges() {
  try {
    const { count } = await sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'novo');
    const b = $('[data-badge="leads"]');
    if (b) { b.hidden = !count; b.textContent = count > 99 ? '99+' : count; }
  } catch {}
}
export { refreshBadges };

let current = 0;
async function route() {
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const params = Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || ''));
  const match = ROUTES.find(([re]) => re.test(path));
  $$('[data-href]').forEach((a) => {
    const h = a.dataset.href.slice(1);
    a.classList.toggle('is-active', h === '/' ? path === '/' : path === h || path.startsWith(`${h}/`));
  });
  document.body.classList.remove('side-open');
  // Fecha janelas abertas da tela anterior
  document.querySelectorAll('.modal-back').forEach((m) => m.remove());
  document.documentElement.classList.remove('no-scroll');
  refreshBadges();
  const token = ++current;
  view.innerHTML = String(loadingView());
  if (!match) { view.innerHTML = String(html`<div class="empty"><h3>Página não encontrada</h3><p><a href="#/">Voltar à visão geral</a></p></div>`); return; }
  const [re, mod, min] = match;
  if (!can(min)) { view.innerHTML = String(html`<div class="empty">${icon('shield', 'empty__ic')}<h3>Acesso restrito</h3><p>Seu nível de acesso não permite abrir esta área.</p></div>`); setTitle('Acesso restrito'); return; }
  try {
    const m = await import(`./views/${mod}.js`);
    if (token !== current) return;
    const args = path.match(re).slice(1);
    await m.default(view, { args, params, isCurrent: () => token === current });
    view.focus({ preventScroll: true });
    scrollTo(0, 0);
  } catch (e) {
    if (token !== current) return;
    fail(e);
    view.innerHTML = String(html`<div class="empty">${icon('alert', 'empty__ic')}<h3>Não foi possível carregar</h3><p>${e.message || ''}</p><button class="btn" type="button" onclick="location.reload()">Tentar de novo</button></div>`);
  }
}

let lastHash = location.hash;
addEventListener('hashchange', async () => {
  if (dirty.on) {
    const target = location.hash;
    history.replaceState(null, '', lastHash || '#/');
    if (!(await confirmDialog('Existem alterações não salvas nesta tela. Sair mesmo assim?', { title: 'Sair sem salvar?', ok: 'Sair sem salvar', danger: true }))) return;
    dirty.set(false);
    history.replaceState(null, '', target);
  }
  lastHash = location.hash;
  route();
});

async function start() {
  if (!(await requireAuth())) return;
  await loadSettings().catch(fail);
  renderNav();
  app.hidden = false;
  $('[data-boot]').remove();

  $('[data-menu]').addEventListener('click', () => document.body.classList.toggle('side-open'));
  $('[data-side-back]').addEventListener('click', () => document.body.classList.remove('side-open'));
  const ub = $('[data-user-btn]'), um = $('[data-user-menu]');
  ub.addEventListener('click', (e) => { e.stopPropagation(); um.hidden = !um.hidden; ub.setAttribute('aria-expanded', String(!um.hidden)); });
  document.addEventListener('click', () => { um.hidden = true; ub.setAttribute('aria-expanded', 'false'); });
  $('[data-logout]').addEventListener('click', () => signOut());

  rpc('expire_quotes').catch(() => {});
  refreshBadges();
  setInterval(refreshBadges, 60000);
  route();
}
start().catch((e) => { fail(e); toast('Falha ao iniciar o painel.', 'error'); });

