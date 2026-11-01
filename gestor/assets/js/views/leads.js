// Interessados: pedidos que chegam pelo formulário do site.
import { sb, q } from '../supabase.js';
import { can } from '../auth.js';
import { setTitle, go, refreshBadges } from '../app.js';
import { $, $$, html, icon, date, dateTime, badge, LEAD_STATUS, emptyState, fail, toast, waNumber, confirmDialog } from '../ui.js';
import { editClient } from '../client-form.js';

export default async function leads(el) {
  setTitle('Interessados');
  let filter = 'abertos';
  const load = () => q(sb.from('leads').select('*').order('created_at', { ascending: false }).limit(500));
  let rows = await load();

  const draw = () => {
    const list = rows.filter((l) => (filter === 'abertos' ? ['novo', 'em_contato'].includes(l.status) : filter === 'todos' ? true : l.status === filter));
    const count = (k) => rows.filter((l) => (k === 'abertos' ? ['novo', 'em_contato'].includes(l.status) : l.status === k)).length;
    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2 class="page-h">Interessados do site</h2><p class="muted">Pedidos enviados pelo formulário de orçamento do site. Converta em cliente para montar o orçamento.</p></div>
      </div>
      <div class="tabs" role="tablist">
        ${[['abertos', 'Em aberto'], ['novo', 'Novos'], ['em_contato', 'Em contato'], ['convertido', 'Convertidos'], ['descartado', 'Descartados'], ['todos', 'Todos']].map(([k, l]) =>
          html`<button type="button" role="tab" aria-selected="${filter === k}" data-filter="${k}">${l}${k !== 'todos' ? html` <em>${count(k)}</em>` : ''}</button>`)}
      </div>
      ${list.length ? html`<div class="cards-list">${list.map((l) => html`
        <article class="lead" data-id="${l.id}">
          <header><strong>${l.parent_name}</strong>${badge(LEAD_STATUS, l.status)}</header>
          <dl class="lead__meta">
            <div><dt>Aniversariante</dt><dd>${l.child_name || '—'}${l.child_age ? ` · ${l.child_age}${/^\d+$/.test(l.child_age) ? ' anos' : ''}` : ''}</dd></div>
            <div><dt>Data desejada</dt><dd>${date(l.event_date)}</dd></div>
            <div><dt>Convidados</dt><dd>${l.guests || '—'}</dd></div>
            <div><dt>Recebido em</dt><dd>${dateTime(l.created_at)}</dd></div>
          </dl>
          ${l.message ? html`<p class="lead__msg">“${l.message}”</p>` : ''}
          <footer>
            <a class="btn btn--sm btn--wa" href="https://wa.me/${waNumber(l.phone)}" target="_blank" rel="noopener">${icon('whatsapp')}${l.phone}</a>
            ${l.status === 'convertido' && l.client_id ? html`<a class="btn btn--sm" href="#/clientes/${l.client_id}">${icon('user')}Ver cliente</a>`
              : html`<button class="btn btn--sm btn--primary" type="button" data-convert>${icon('plus')}Converter em cliente</button>`}
            ${l.status === 'novo' ? html`<button class="btn btn--sm btn--ghost" type="button" data-status="em_contato">Marcar em contato</button>` : ''}
            ${['novo', 'em_contato'].includes(l.status) ? html`<button class="btn btn--sm btn--ghost" type="button" data-status="descartado">Descartar</button>` : ''}
            ${can('admin') ? html`<button class="icon-btn" type="button" data-delete aria-label="Excluir">${icon('trash')}</button>` : ''}
          </footer>
        </article>`)}</div>`
        : emptyState('Nenhum interessado aqui', filter === 'abertos' ? 'Quando alguém preencher o formulário de orçamento do site, o pedido aparece aqui.' : 'Nada nesta categoria.')}`);

    $$('[data-filter]', el).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; draw(); }));
    $$('.lead', el).forEach((card) => {
      const lead = rows.find((l) => l.id === card.dataset.id);
      $('[data-convert]', card)?.addEventListener('click', () => convert(lead));
      $$('[data-status]', card).forEach((b) => b.addEventListener('click', async () => {
        try { await q(sb.from('leads').update({ status: b.dataset.status }).eq('id', lead.id)); lead.status = b.dataset.status; draw(); refreshBadges(); }
        catch (e) { fail(e); }
      }));
      $('[data-delete]', card)?.addEventListener('click', async () => {
        if (!(await confirmDialog('Excluir este pedido definitivamente?', { danger: true, ok: 'Excluir' }))) return;
        try { await q(sb.from('leads').delete().eq('id', lead.id)); rows = rows.filter((x) => x.id !== lead.id); draw(); refreshBadges(); }
        catch (e) { fail(e); }
      });
    });
  };

  async function convert(lead) {
    const ageNum = /^\d+$/.test(lead.child_age || '') ? `${lead.child_age} anos` : lead.child_age;
    const client = await editClient(null, {
      responsible_name: lead.parent_name, phone: lead.phone, child_name: lead.child_name, child_age: ageNum,
      desired_date: lead.event_date, guests: lead.guests, source: 'Site', notes: lead.message,
    });
    if (!client) return;
    try {
      await q(sb.from('leads').update({ status: 'convertido', client_id: client.id }).eq('id', lead.id));
      await q(sb.from('client_interactions').insert({ client_id: client.id, kind: 'site', note: `Pedido de orçamento recebido pelo site${lead.message ? `: “${lead.message}”` : '.'}` }));
      refreshBadges();
      toast('Cliente criado. Agora monte o orçamento.');
      go(`#/orcamentos/novo?cliente=${client.id}`);
    } catch (e) { fail(e); }
  }

  draw();
}
