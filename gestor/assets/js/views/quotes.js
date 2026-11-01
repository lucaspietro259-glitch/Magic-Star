// Lista de orçamentos com filtros por status e busca.
import { sb, q } from '../supabase.js';
import { setTitle, go } from '../app.js';
import { $, $$, html, icon, brl, date, badge, QUOTE_STATUS, emptyState, quoteCode, downloadCSV, today, addDays } from '../ui.js';

const FILTERS = [['todos', 'Todos'], ['abertos', 'Em aberto'], ['em_elaboracao', 'Em elaboração'], ['enviado', 'Enviados'], ['aguardando_resposta', 'Aguardando'], ['em_negociacao', 'Negociação'], ['aprovado', 'Aprovados'], ['recusado', 'Recusados'], ['expirado', 'Expirados']];
const OPEN = ['enviado', 'aguardando_resposta', 'em_negociacao'];

export default async function quotes(el, { params }) {
  setTitle('Orçamentos');
  let filter = params.status || 'todos';
  let term = '';
  const rows = await q(sb.from('quotes').select('id, number, version, status, total, guests, event_date, valid_until, created_at, child_name, client:clients(id, responsible_name, phone), event:events(id)').order('created_at', { ascending: false }).limit(1000));

  el.innerHTML = String(html`
    <div class="page-head">
      <div><h2 class="page-h">Orçamentos</h2><p class="muted">Monte, envie e acompanhe cada proposta até virar festa.</p></div>
      <div class="page-head__actions">
        <button class="btn btn--ghost" type="button" data-export>${icon('download')}Exportar</button>
        <a class="btn btn--primary" href="#/orcamentos/novo">${icon('plus')}Novo orçamento</a>
      </div>
    </div>
    <div class="tabs tabs--scroll" role="tablist" data-tabs></div>
    <label class="search">${icon('search')}<input type="search" placeholder="Buscar por cliente, criança ou número" data-search aria-label="Buscar orçamentos"></label>
    <div data-list></div>`);

  const match = (x) => {
    if (filter === 'abertos' && !OPEN.includes(x.status)) return false;
    if (!['todos', 'abertos'].includes(filter) && x.status !== filter) return false;
    if (!term) return true;
    const t = term.toLowerCase();
    return [x.client?.responsible_name, x.child_name, quoteCode(x)].some((v) => (v || '').toLowerCase().includes(t));
  };

  const draw = () => {
    $('[data-tabs]', el).innerHTML = String(html`${FILTERS.map(([k, l]) => {
      const n = rows.filter((x) => (k === 'todos' ? true : k === 'abertos' ? OPEN.includes(x.status) : x.status === k)).length;
      return html`<button type="button" role="tab" aria-selected="${filter === k}" data-filter="${k}">${l} <em>${n}</em></button>`;
    })}`);
    $$('[data-filter]', el).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; draw(); }));
    const list = rows.filter(match);
    const box = $('[data-list]', el);
    if (!list.length) { box.innerHTML = String(emptyState('Nenhum orçamento aqui', rows.length ? 'Mude o filtro ou a busca.' : 'Crie o primeiro orçamento para um cliente.', rows.length ? '' : html`<a class="btn btn--primary" href="#/orcamentos/novo">${icon('plus')}Novo orçamento</a>`)); return; }
    const t = today();
    box.innerHTML = String(html`<div class="table-wrap"><table class="table">
      <thead><tr><th>Nº</th><th>Cliente</th><th>Festa</th><th>Convidados</th><th class="num">Valor</th><th>Status</th><th>Validade</th></tr></thead>
      <tbody>${list.map((x) => {
        const soon = OPEN.includes(x.status) && x.valid_until && x.valid_until <= addDays(t, 3);
        return html`<tr data-href="#/orcamentos/${x.id}" tabindex="0">
          <td><strong>${quoteCode(x)}</strong></td>
          <td>${x.client?.responsible_name || '—'}${x.child_name ? html`<small class="muted block">${x.child_name}</small>` : ''}</td>
          <td>${date(x.event_date)}</td><td>${x.guests || '—'}</td>
          <td class="num"><strong>${brl(x.total)}</strong></td>
          <td>${badge(QUOTE_STATUS, x.status)}${(Array.isArray(x.event) ? x.event.length : x.event) ? html` <span class="badge badge--blue">Festa</span>` : ''}</td>
          <td class="${soon ? 'text-red' : ''}">${date(x.valid_until)}</td></tr>`;
      })}</tbody></table></div>`);
    $$('tr[data-href]', box).forEach((tr) => {
      tr.addEventListener('click', () => go(tr.dataset.href));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(tr.dataset.href); });
    });
  };

  let timer;
  $('[data-search]', el).addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { term = e.target.value.trim(); draw(); }, 150); });
  $('[data-export]', el).addEventListener('click', () => downloadCSV('orcamentos-magic-star.csv', [
    ['Número', 'Cliente', 'Criança', 'Data da festa', 'Convidados', 'Valor', 'Status', 'Validade', 'Criado em'],
    ...rows.filter(match).map((x) => [quoteCode(x), x.client?.responsible_name, x.child_name, date(x.event_date), x.guests, String(x.total).replace('.', ','), QUOTE_STATUS[x.status][0], date(x.valid_until), date(x.created_at)]),
  ]));
  draw();
}
