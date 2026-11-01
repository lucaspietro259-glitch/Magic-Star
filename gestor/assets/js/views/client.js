// Ficha do cliente: dados, orçamentos, festas, pagamentos e histórico de atendimento.
import { sb, q } from '../supabase.js';
import { can } from '../auth.js';
import { setTitle, go } from '../app.js';
import { $, $$, html, icon, brl, date, dateTime, badge, QUOTE_STATUS, EVENT_STATUS, PAYMENT_KIND, emptyState, fail, toast, waNumber, quoteCode, confirmDialog, time } from '../ui.js';
import { editClient } from '../client-form.js';
import { eventBalance, isOverdue } from '../finance-utils.js';

const KINDS = { nota: 'Anotação', ligacao: 'Ligação', whatsapp: 'WhatsApp', visita: 'Visita ao buffet', email: 'E-mail', site: 'Site', sistema: 'Sistema' };

export default async function client(el, { args: [id] }) {
  const fin = can('gerente');
  const [c, quotes, events, notes, payments, profiles] = await Promise.all([
    q(sb.from('clients').select('*').eq('id', id).maybeSingle()),
    q(sb.from('quotes').select('id, number, version, status, total, event_date, created_at, child_name').eq('client_id', id).order('created_at', { ascending: false })),
    q(sb.from('events').select('id, event_date, start_time, end_time, status, contract_value, child_name, guests').eq('client_id', id).order('event_date', { ascending: false })),
    q(sb.from('client_interactions').select('*').eq('client_id', id).order('created_at', { ascending: false })),
    fin ? q(sb.from('payments').select('*').eq('client_id', id).order('due_date')) : Promise.resolve([]),
    q(sb.from('profiles').select('id, full_name, email')),
  ]);
  if (!c) { el.innerHTML = String(emptyState('Cliente não encontrado', 'Ele pode ter sido excluído.', html`<a class="btn" href="#/clientes">Voltar</a>`)); return; }
  setTitle(c.responsible_name);
  const who = (uid) => { const p = profiles.find((x) => x.id === uid); return p ? (p.full_name || p.email) : 'Sistema'; };
  const negotiated = quotes.filter((x) => x.status === 'aprovado').reduce((s, x) => s + Number(x.total), 0);
  const activeEvents = events.filter((e) => e.status !== 'cancelada');
  const bal = eventBalance(activeEvents.reduce((s, e) => s + Number(e.contract_value), 0), payments.filter((p) => activeEvents.some((e) => e.id === p.event_id) || !p.event_id));

  el.innerHTML = String(html`
    <a class="back" href="#/clientes">${icon('left')}Clientes</a>
    <div class="profile">
      <div class="profile__main">
        <span class="avatar avatar--lg">${c.responsible_name.charAt(0).toUpperCase()}</span>
        <div>
          <h2 class="page-h">${c.responsible_name}</h2>
          <p class="muted">${c.child_name ? `Família de ${c.child_name}${c.child_age ? ` (${c.child_age})` : ''}` : 'Cliente'} · desde ${date(c.created_at)}${c.source ? ` · veio por ${c.source}` : ''}</p>
        </div>
      </div>
      <div class="page-head__actions">
        <a class="btn btn--wa" href="https://wa.me/${waNumber(c.phone)}" target="_blank" rel="noopener">${icon('whatsapp')}WhatsApp</a>
        <button class="btn btn--ghost" type="button" data-edit>${icon('edit')}Editar</button>
        <a class="btn btn--primary" href="#/orcamentos/novo?cliente=${c.id}">${icon('plus')}Novo orçamento</a>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><span>Orçamentos</span><strong>${quotes.length}</strong></div>
      <div class="stat"><span>Festas</span><strong>${activeEvents.length}</strong></div>
      <div class="stat"><span>Valor negociado</span><strong>${brl(negotiated)}</strong></div>
      ${fin ? html`<div class="stat"><span>Recebido</span><strong>${brl(bal.received)}</strong></div>
      <div class="stat ${bal.balance > 0 ? 'stat--warn' : ''}"><span>Saldo a receber</span><strong>${brl(bal.balance)}</strong></div>` : ''}
    </div>

    <div class="grid-2 grid-2--aside">
      <div class="stack-lg">
        <section class="card">
          <header class="card__head"><h3>Orçamentos</h3><a class="link" href="#/orcamentos/novo?cliente=${c.id}">+ Novo</a></header>
          ${quotes.length ? html`<ul class="rows">${quotes.map((x) => html`<li><a href="#/orcamentos/${x.id}">
            <span><strong>${quoteCode(x)}</strong><small class="muted block">Festa em ${date(x.event_date)} · criado em ${date(x.created_at)}</small></span>
            <span class="rows__end"><strong>${brl(x.total)}</strong>${badge(QUOTE_STATUS, x.status)}</span></a></li>`)}</ul>`
            : html`<p class="muted">Nenhum orçamento ainda.</p>`}
        </section>
        <section class="card">
          <header class="card__head"><h3>Festas</h3></header>
          ${events.length ? html`<ul class="rows">${events.map((e) => html`<li><a href="#/festas/${e.id}">
            <span><strong>${e.child_name || 'Aniversário'}</strong><small class="muted block">${date(e.event_date)} · ${time(e.start_time)}–${time(e.end_time)}${e.guests ? ` · ${e.guests} convidados` : ''}</small></span>
            <span class="rows__end"><strong>${brl(e.contract_value)}</strong>${badge(EVENT_STATUS, e.status)}</span></a></li>`)}</ul>`
            : html`<p class="muted">Nenhuma festa confirmada.</p>`}
        </section>
        ${fin ? html`<section class="card">
          <header class="card__head"><h3>Pagamentos</h3></header>
          ${payments.length ? html`<div class="table-wrap"><table class="table table--compact">
            <thead><tr><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead>
            <tbody>${payments.map((p) => html`<tr><td>${PAYMENT_KIND[p.kind]}${p.description ? html`<small class="muted block">${p.description}</small>` : ''}</td><td>${date(p.due_date)}</td><td>${brl(p.amount)}</td>
              <td>${p.paid_at ? html`<span class="badge badge--green">Pago em ${date(p.paid_at)}</span>` : ['desconto'].includes(p.kind) ? html`<span class="badge badge--gray">Concedido</span>` : isOverdue(p) ? html`<span class="badge badge--red">Vencido</span>` : html`<span class="badge badge--yellow">A receber</span>`}</td></tr>`)}</tbody>
          </table></div>` : html`<p class="muted">Nenhum pagamento registrado.</p>`}
        </section>` : ''}
      </div>

      <div class="stack-lg">
        <section class="card">
          <header class="card__head"><h3>Dados</h3></header>
          <dl class="dl">
            <div><dt>Telefone</dt><dd>${c.phone}</dd></div>
            <div><dt>E-mail</dt><dd>${c.email ? html`<a href="mailto:${c.email}">${c.email}</a>` : '—'}</dd></div>
            <div><dt>Criança</dt><dd>${c.child_name || '—'} ${c.child_age ? `(${c.child_age})` : ''}</dd></div>
            <div><dt>Data desejada</dt><dd>${date(c.desired_date)}</dd></div>
            <div><dt>Convidados</dt><dd>${c.guests || '—'}</dd></div>
            <div><dt>Como conheceu</dt><dd>${c.source || '—'}</dd></div>
          </dl>
          ${c.notes ? html`<p class="note">${c.notes}</p>` : ''}
        </section>

        <section class="card">
          <header class="card__head"><h3>Atendimento</h3></header>
          <form class="note-form" data-note novalidate>
            <select name="kind" aria-label="Tipo de contato">${Object.entries(KINDS).filter(([k]) => !['site', 'sistema'].includes(k)).map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select>
            <textarea name="note" rows="2" placeholder="Registre uma ligação, visita ou combinado…" aria-label="Anotação"></textarea>
            <button class="btn btn--sm btn--primary" type="submit">Registrar</button>
          </form>
          ${notes.length ? html`<ol class="timeline">${notes.map((n) => html`<li><span class="timeline__dot"></span>
            <div><strong>${KINDS[n.kind] || n.kind}</strong> <small class="muted">${dateTime(n.created_at)} · ${who(n.created_by)}</small><p>${n.note}</p></div></li>`)}</ol>`
            : html`<p class="muted">Nenhum registro ainda.</p>`}
        </section>
        ${can('admin') ? html`<button class="btn btn--ghost btn--danger-text" type="button" data-delete>${icon('trash')}Excluir cliente</button>` : ''}
      </div>
    </div>`);

  $('[data-edit]', el).addEventListener('click', async () => { if (await editClient(c)) client(el, { args: [id] }); });
  $('[data-note]', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.note.value.trim()) return f.note.focus();
    try {
      await q(sb.from('client_interactions').insert({ client_id: id, kind: f.kind.value, note: f.note.value.trim() }));
      toast('Atendimento registrado.');
      client(el, { args: [id] });
    } catch (err) { fail(err); }
  });
  $('[data-delete]', el)?.addEventListener('click', async () => {
    if (!(await confirmDialog(`Excluir ${c.responsible_name}? Só é possível excluir clientes sem orçamentos ou festas.`, { danger: true, ok: 'Excluir' }))) return;
    try { await q(sb.from('clients').delete().eq('id', id)); toast('Cliente excluído.'); go('#/clientes'); } catch (err) { fail(err); }
  });
}
