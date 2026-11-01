// Lista de clientes com busca por nome, telefone ou e-mail.
import { sb, q } from '../supabase.js';
import { setTitle, go } from '../app.js';
import { $, html, icon, date, emptyState, badge, QUOTE_STATUS, downloadCSV, phoneDigits } from '../ui.js';
import { editClient } from '../client-form.js';

export default async function clients(el, { params }) {
  setTitle('Clientes');
  let term = params.busca || '';
  let rows = [];

  el.innerHTML = String(html`
    <div class="page-head">
      <div><h2 class="page-h">Clientes</h2><p class="muted">Ficha de cada família, com orçamentos, festas e atendimento.</p></div>
      <div class="page-head__actions">
        <button class="btn btn--ghost" type="button" data-export>${icon('download')}Exportar</button>
        <button class="btn btn--primary" type="button" data-new>${icon('plus')}Novo cliente</button>
      </div>
    </div>
    <label class="search">${icon('search')}<input type="search" placeholder="Buscar por nome, telefone ou e-mail" value="${term}" data-search aria-label="Buscar clientes"></label>
    <div data-list></div>`);

  const list = $('[data-list]', el);
  const fetchRows = async () => {
    let query = sb.from('clients').select('id, responsible_name, phone, email, child_name, child_age, source, created_at, quotes(status, created_at), events(event_date, status)').order('created_at', { ascending: false }).limit(300);
    if (term) {
      const t = term.replace(/[%,()]/g, ' ').trim();
      const digits = phoneDigits(t);
      const ors = [`responsible_name.ilike.%${t}%`, `email.ilike.%${t}%`, `child_name.ilike.%${t}%`];
      if (digits.length >= 4) ors.push(`phone.ilike.%${digits.slice(-4)}%`);
      query = query.or(ors.join(','));
    }
    rows = await q(query);
    // Busca por telefone compara só os dígitos
    const d = phoneDigits(term);
    if (d.length >= 4) rows = rows.filter((c) => phoneDigits(c.phone).includes(d) || c.responsible_name.toLowerCase().includes(term.toLowerCase()) || (c.email || '').toLowerCase().includes(term.toLowerCase()));
    draw();
  };

  const draw = () => {
    if (!rows.length) { list.innerHTML = String(emptyState(term ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado', term ? 'Tente outro nome, telefone ou e-mail.' : 'Cadastre o primeiro cliente ou converta um interessado do site.')); return; }
    list.innerHTML = String(html`
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Responsáveis</th><th>Criança</th><th>Contato</th><th>Último orçamento</th><th>Festas</th><th>Cadastro</th></tr></thead>
        <tbody>${rows.map((c) => {
          const lastQ = [...(c.quotes || [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          const ev = (c.events || []).filter((e) => e.status !== 'cancelada');
          return html`<tr data-href="#/clientes/${c.id}" tabindex="0">
            <td><strong>${c.responsible_name}</strong>${c.source ? html`<small class="muted block">${c.source}</small>` : ''}</td>
            <td>${c.child_name || '—'}${c.child_age ? html`<small class="muted block">${c.child_age}</small>` : ''}</td>
            <td>${c.phone}${c.email ? html`<small class="muted block">${c.email}</small>` : ''}</td>
            <td>${lastQ ? badge(QUOTE_STATUS, lastQ.status) : html`<span class="muted">—</span>`}</td>
            <td>${ev.length || '—'}</td>
            <td>${date(c.created_at)}</td></tr>`;
        })}</tbody>
      </table></div>`);
    list.querySelectorAll('tr[data-href]').forEach((tr) => {
      tr.addEventListener('click', () => go(tr.dataset.href));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(tr.dataset.href); });
    });
  };

  let timer;
  $('[data-search]', el).addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { term = e.target.value.trim(); fetchRows(); }, 250); });
  $('[data-new]', el).addEventListener('click', async () => { const c = await editClient(); if (c) go(`#/clientes/${c.id}`); });
  $('[data-export]', el).addEventListener('click', () => downloadCSV('clientes-magic-star.csv', [
    ['Responsáveis', 'Telefone', 'E-mail', 'Criança', 'Idade', 'Origem', 'Cadastro'],
    ...rows.map((c) => [c.responsible_name, c.phone, c.email, c.child_name, c.child_age, c.source, date(c.created_at)]),
  ]));
  await fetchRows();
}
