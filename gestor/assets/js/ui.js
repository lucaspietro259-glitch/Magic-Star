// Utilitários de interface: HTML seguro, ícones, formatos, avisos, janelas e status.

/* ---------- HTML com escape automático ---------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s ?? ''));
const fmtVal = (v) => (v == null || v === false ? '' : Array.isArray(v) ? v.map(fmtVal).join('') : v instanceof Safe ? v.s : esc(v));
// Template que escapa tudo que é interpolado (proteção contra XSS)
export const html = (strings, ...vals) => new Safe(strings.reduce((out, s, i) => out + s + (i < vals.length ? fmtVal(vals[i]) : ''), ''));

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- Ícones (traço 24px, estilo linear) ---------- */
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  calendar: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4',
  party: 'M5.8 11.3 2 22l10.7-3.8M4 3h.01M22 8h.01M15 2h.01M22 20h.01M22 2l-2.2.7a2 2 0 0 0-1.4 2.2l.1.6a2 2 0 0 1-1.6 2.3L16 8M8.6 8.6a7 7 0 0 1 6.8 6.8',
  wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M21 9h-5a3 3 0 0 0 0 6h5zM16 12h.01',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  chart: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  whatsapp: 'M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3zM9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  printer: 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
  check: 'M5 12.5 10 17l9-10',
  x: 'M6 6l12 12M18 6 6 18',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  star: 'M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  link: 'M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.1-1.1',
  layers: 'M12 3 2 8l10 5 10-5zM2 16l10 5 10-5M2 12l10 5 10-5',
  refresh: 'M20 11a8 8 0 0 0-14.7-4.4L4 8M4 4v4h4M4 13a8 8 0 0 0 14.7 4.4L20 16M20 20v-4h-4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  user: 'M20 21v-1.5A4.5 4.5 0 0 0 15.5 15h-7A4.5 4.5 0 0 0 4 19.5V21M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  money: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  phone: 'M5 3h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 7.1 7.1l1.4-2.3L21 15.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
};
export const icon = (name, cls = '') => raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || P.file}"/></svg>`);

/* ---------- Formatos ---------- */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (n) => BRL.format(Number(n) || 0);
export const num = (n) => new Intl.NumberFormat('pt-BR').format(Number(n) || 0);
export const pct = (n) => `${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const parseDate = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); }
  return new Date(d);
};
export const date = (d) => (d ? parseDate(d).toLocaleDateString('pt-BR') : '—');
export const dateLong = (d) => (d ? parseDate(d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—');
export const dateShort = (d) => (d ? parseDate(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '—');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const time = (t) => (t ? String(t).slice(0, 5) : '—');
export const iso = (d) => { const x = parseDate(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const today = () => iso(new Date());
export const addDays = (d, n) => { const x = parseDate(d); x.setDate(x.getDate() + n); return iso(x); };
export const addMonths = (d, n) => { const x = parseDate(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return iso(x); };
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const phoneDigits = (p) => String(p || '').replace(/\D/g, '');
export const waNumber = (p) => { const d = phoneDigits(p); return d.length <= 11 ? `55${d}` : d; };
export const maskPhone = (v) => {
  let d = phoneDigits(v).slice(0, 11);
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d.length ? `(${d}` : '';
};
export const quoteCode = (q) => `ORC-${String(q.number).padStart(4, '0')}${q.version > 1 ? `-v${q.version}` : ''}`;

/* ---------- Status ---------- */
export const QUOTE_STATUS = {
  em_elaboracao: ['Em elaboração', 'gray'],
  enviado: ['Enviado', 'blue'],
  aguardando_resposta: ['Aguardando resposta', 'yellow'],
  em_negociacao: ['Em negociação', 'purple'],
  aprovado: ['Aprovado', 'green'],
  recusado: ['Recusado', 'red'],
  expirado: ['Expirado', 'gray'],
};
export const EVENT_STATUS = {
  aguardando_confirmacao: ['Aguardando confirmação', 'yellow'],
  confirmada: ['Confirmada', 'green'],
  realizada: ['Realizada', 'blue'],
  cancelada: ['Cancelada', 'red'],
};
export const LEAD_STATUS = {
  novo: ['Novo', 'blue'], em_contato: ['Em contato', 'yellow'], convertido: ['Convertido', 'green'], descartado: ['Descartado', 'gray'],
};
export const CATEGORIES = {
  pacote: 'Pacotes', cardapio: 'Cardápios', bebida: 'Bebidas', decoracao: 'Decoração', tema: 'Temas',
  recreacao: 'Recreação', atracao: 'Atrações', servico: 'Serviços adicionais', personalizado: 'Itens personalizados',
};
export const CATEGORY_SINGULAR = {
  pacote: 'Pacote', cardapio: 'Cardápio', bebida: 'Bebida', decoracao: 'Decoração', tema: 'Tema',
  recreacao: 'Recreação', atracao: 'Atração', servico: 'Serviço', personalizado: 'Personalizado',
};
export const UNITS = { festa: 'por festa', convidado: 'por convidado', hora: 'por hora', unidade: 'por unidade' };
export const PAYMENT_KIND = { entrada: 'Entrada', parcela: 'Parcela', extra: 'Pagamento extra', desconto: 'Desconto', reembolso: 'Reembolso' };
export const SOURCES = ['Instagram', 'Google', 'Indicação', 'Site', 'Facebook', 'Passou em frente', 'Já foi cliente', 'Outro'];
export const LOSS_REASONS = ['Preço', 'Data indisponível', 'Escolheu outro buffet', 'Desistiu da festa', 'Sem resposta', 'Capacidade', 'Outro'];

export const badge = (map, key) => { const [label, color] = map[key] || [key, 'gray']; return html`<span class="badge badge--${color}">${label}</span>`; };

/* ---------- Avisos (toast) ---------- */
export function toast(message, type = 'ok') {
  let wrap = $('.toasts');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toasts'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite'); document.body.append(wrap); }
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.innerHTML = String(html`${icon(type === 'error' ? 'alert' : 'check')}<span>${message}</span>`);
  wrap.append(t);
  setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 300); }, type === 'error' ? 6000 : 3200);
}

// Mensagens de erro do banco traduzidas para o usuário
export function errorMessage(e) {
  const m = String(e?.message || e || '');
  if (/row-level security|permission denied|42501/i.test(m)) return 'Você não tem permissão para esta ação.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  if (/JWT|refresh token|not authenticated/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
  if (/violates foreign key.*clients/i.test(m)) return 'Este cliente tem orçamentos ou festas e não pode ser excluído.';
  if (/duplicate key/i.test(m)) return 'Este registro já existe.';
  if (/check constraint/i.test(m)) return 'Algum valor está fora do permitido. Confira os campos.';
  return m || 'Algo deu errado. Tente de novo.';
}
export const fail = (e) => { console.error(e); toast(errorMessage(e), 'error'); };

/* ---------- Janela modal ---------- */
export function modal({ title, body, actions = [], size = '', onOpen }) {
  return new Promise((resolve) => {
    const last = document.activeElement;
    const root = document.createElement('div');
    root.className = 'modal-back';
    root.innerHTML = String(html`<div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal__head"><h2 id="modal-title">${title}</h2><button class="icon-btn" type="button" data-close aria-label="Fechar">${icon('x')}</button></header>
      <div class="modal__body">${raw(body)}</div>
      ${actions.length ? html`<footer class="modal__foot">${actions.map((a, i) => html`<button type="button" class="btn ${a.cls || ''}" data-act="${i}">${a.label}</button>`)}</footer>` : ''}
    </div>`);
    document.body.append(root);
    document.documentElement.classList.add('no-scroll');
    const close = (val) => { root.classList.add('is-out'); document.documentElement.classList.remove('no-scroll'); setTimeout(() => root.remove(), 200); last?.focus?.(); resolve(val); };
    const api = { el: root, close };
    root.addEventListener('click', async (e) => {
      if (e.target === root || e.target.closest('[data-close]')) return close(null);
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = actions[+b.dataset.act];
      if (a.onClick) {
        b.disabled = true;
        try { const r = await a.onClick(api); if (r !== false) close(r ?? true); } catch (err) { fail(err); } finally { b.disabled = false; }
      } else close(a.value ?? null);
    });
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
    requestAnimationFrame(() => ($('input, select, textarea, button:not([data-close])', root) || $('button', root))?.focus());
    onOpen?.(api);
  });
}

export const confirmDialog = (text, { title = 'Confirmar', ok = 'Confirmar', danger = false } = {}) =>
  modal({ title, body: String(html`<p>${text}</p>`), actions: [{ label: 'Cancelar', cls: 'btn--ghost', value: false }, { label: ok, cls: danger ? 'btn--danger' : 'btn--primary', value: true }] });

/* ---------- Formulários ---------- */
export const formValues = (form) => {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') { if (el.dataset.multi) { (out[el.name] ||= []); if (el.checked) out[el.name].push(el.value); } else out[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim();
  }
  return out;
};
export const nullIfEmpty = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v]));

// Valida campos obrigatórios e mostra o erro ao lado de cada um
export function validate(form, rules) {
  let first = null;
  for (const [name, rule] of Object.entries(rules)) {
    const el = form.elements[name];
    if (!el) continue;
    const msg = rule(el.value.trim(), el);
    const field = el.closest('.field');
    field?.classList.toggle('is-invalid', !!msg);
    let err = field?.querySelector('.field__error');
    if (field && !err) { err = document.createElement('span'); err.className = 'field__error'; field.append(err); }
    if (err) err.textContent = msg || '';
    if (msg && !first) first = el;
  }
  first?.focus();
  return !first;
}
export const required = (label) => (v) => (v ? '' : `Informe ${label}.`);

export const options = (map, selected) => Object.entries(map).map(([v, l]) => html`<option value="${v}" ${v === selected ? raw('selected') : ''}>${Array.isArray(l) ? l[0] : l}</option>`);
export const optionList = (list, selected, empty = '') => [empty !== null ? html`<option value="">${empty || 'Selecione'}</option>` : '', ...list.map((v) => html`<option ${v === selected ? raw('selected') : ''}>${v}</option>`)];

export function bindPhoneMask(root = document) {
  $$('input[data-phone]', root).forEach((el) => el.addEventListener('input', () => (el.value = maskPhone(el.value))));
}

/* ---------- CSV ---------- */
export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => { const s = String(c ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Estados ---------- */
export const loadingView = () => html`<div class="loading"><span class="spinner"></span>Carregando…</div>`;
export const emptyState = (title, text, action = '') => html`<div class="empty">${icon('star', 'empty__ic')}<h3>${title}</h3><p>${text}</p>${action}</div>`;
