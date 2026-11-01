// Ficha da festa confirmada: dados, checklist operacional, pagamentos e despesas.
import { sb, q } from '../supabase.js';
import { can, loadSettings } from '../auth.js';
import { setTitle, go } from '../app.js';
import {
  $, $$, html, raw, icon, brl, date, dateLong, dateTime, time, today, badge, modal, toast, fail, confirmDialog, emptyState,
  EVENT_STATUS, PAYMENT_KIND, quoteCode, waNumber, formValues, validate,
} from '../ui.js';
import { eventBalance, isOverdue } from '../finance-utils.js';

const EXPENSE_CATS = ['Alimentação', 'Bebidas', 'Decoração', 'Equipe', 'Recreação', 'Limpeza', 'Material', 'Outros'];

export default async function eventView(el, { args: [id] }) {
  const fin = can('gerente');
  const settings = await loadSettings();
  const ev = await q(sb.from('events').select('*, client:clients(*), quote:quotes(id, number, version, total, share_token)').eq('id', id).maybeSingle());
  if (!ev) { el.innerHTML = String(emptyState('Festa não encontrada', '', html`<a class="btn" href="#/agenda">Voltar à agenda</a>`)); return; }
  const [checklist, payments, expenses, profiles] = await Promise.all([
    q(sb.from('event_checklist').select('*').eq('event_id', id).order('position')),
    fin ? q(sb.from('payments').select('*').eq('event_id', id).order('due_date', { nullsFirst: false })) : Promise.resolve([]),
    fin ? q(sb.from('expenses').select('*').eq('event_id', id).order('date')) : Promise.resolve([]),
    q(sb.from('profiles').select('id, full_name, email')),
  ]);
  const who = (uid) => { const p = profiles.find((x) => x.id === uid); return p ? (p.full_name || p.email).split(' ')[0] : ''; };
  setTitle(`Festa de ${ev.child_name || ev.client?.responsible_name || ''}`);
  const bal = eventBalance(ev.contract_value, payments);
  const done = checklist.filter((c) => c.done).length;
  const expSum = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const canEdit = can('gerente');

  el.innerHTML = String(html`
    <a class="back" href="#/agenda">${icon('left')}Agenda</a>
    <div class="event-hero">
      <div class="event-hero__date"><strong>${String(ev.event_date).slice(8, 10)}</strong><span>${new Date(`${ev.event_date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}</span></div>
      <div class="event-hero__main">
        <h2 class="page-h">${ev.child_name ? `Aniversário de ${ev.child_name}` : 'Festa'}${ev.child_age ? html` <span class="muted">· ${ev.child_age}</span>` : ''}</h2>
        <p class="muted">${dateLong(ev.event_date)} · ${time(ev.start_time)} às ${time(ev.end_time)}${ev.guests ? ` · ${ev.guests} convidados` : ''}</p>
        <p><a href="#/clientes/${ev.client_id}">${ev.client?.responsible_name}</a> · ${ev.client?.phone || ''}
          ${ev.quote ? html` · <a href="#/orcamentos/${ev.quote.id}">Orçamento ${quoteCode(ev.quote)}</a>` : ''}</p>
      </div>
      <div class="event-hero__side">
        ${canEdit ? html`<select class="status-select" data-status aria-label="Status da festa">${Object.entries(EVENT_STATUS).map(([k, [l]]) => html`<option value="${k}" ${k === ev.status ? raw('selected') : ''}>${l}</option>`)}</select>` : badge(EVENT_STATUS, ev.status)}
        <a class="btn btn--wa btn--sm" href="https://wa.me/${waNumber(ev.client?.phone)}" target="_blank" rel="noopener">${icon('whatsapp')}WhatsApp</a>
      </div>
    </div>

    ${fin ? html`<div class="stats">
      <div class="stat"><span>Valor contratado</span><strong>${brl(bal.contract)}</strong>${bal.extras || bal.discounts ? html`<small>${bal.extras ? `+${brl(bal.extras)} extras ` : ''}${bal.discounts ? `−${brl(bal.discounts)} descontos` : ''}</small>` : ''}</div>
      <div class="stat stat--ok"><span>Recebido</span><strong>${brl(bal.received)}</strong></div>
      <div class="stat ${bal.balance > 0 ? 'stat--warn' : 'stat--ok'}"><span>Saldo restante</span><strong>${brl(bal.balance)}</strong>${bal.overdue ? html`<small class="text-red">${brl(bal.overdue)} vencido</small>` : ''}</div>
      <div class="stat"><span>Despesas da festa</span><strong>${brl(expSum)}</strong><small>Resultado: ${brl(bal.owed - expSum)}</small></div>
    </div>` : ''}

    <div class="grid-2 grid-2--aside">
      <div class="stack-lg">
        <section class="card">
          <header class="card__head"><h3>Ficha da festa</h3>${canEdit ? html`<button class="btn btn--sm btn--ghost" type="button" data-edit>${icon('edit')}Editar</button>` : ''}</header>
          <dl class="dl dl--2">
            <div><dt>Pacote</dt><dd>${ev.package_name || '—'}</dd></div>
            <div><dt>Tema</dt><dd>${ev.theme || '—'}</dd></div>
            <div><dt>Cardápio e bebidas</dt><dd>${ev.menu || '—'}</dd></div>
            <div><dt>Decoração</dt><dd>${ev.decoration || '—'}</dd></div>
            <div class="dl__full"><dt>Serviços e atrações contratados</dt><dd>${ev.services || '—'}</dd></div>
            <div class="dl__full"><dt>Informações especiais</dt><dd class="pre">${ev.special_info || '—'}</dd></div>
            <div class="dl__full"><dt>Restrições e observações do cliente</dt><dd class="pre ${ev.restrictions ? 'text-red' : ''}">${ev.restrictions || '—'}</dd></div>
          </dl>
          ${ev.status === 'realizada' && canEdit ? html`<div class="rating"><span>Avaliação da festa</span>${[1, 2, 3, 4, 5].map((n) => html`<button type="button" data-rate="${n}" class="${ev.rating >= n ? 'is-on' : ''}" aria-label="${n} estrela${n > 1 ? 's' : ''}">${icon('star')}</button>`)}</div>` : ''}
        </section>

        ${fin ? html`<section class="card">
          <header class="card__head"><h3>Pagamentos</h3><button class="btn btn--sm btn--primary" type="button" data-add-pay>${icon('plus')}Registrar</button></header>
          ${bal.unscheduled > 0.009 ? html`<p class="alert alert--yellow alert--block">${icon('alert')}<span>${brl(bal.unscheduled)} do contrato ainda não tem parcela lançada.</span></p>` : ''}
          ${(() => { const open = payments.filter((p) => ['entrada', 'parcela', 'extra'].includes(p.kind) && !p.paid_at).reduce((t, p) => t + Number(p.amount), 0); return open - bal.balance > 0.009 ? html`<p class="alert alert--yellow alert--block">${icon('alert')}<span>As parcelas em aberto somam ${brl(open)}, mais que o saldo de ${brl(bal.balance)}. Edite uma parcela para refletir o desconto.</span></p>` : ''; })()}
          ${payments.length ? html`<div class="table-wrap"><table class="table table--compact">
            <thead><tr><th>Tipo</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead>
            <tbody>${payments.map((p) => html`<tr>
              <td><strong>${PAYMENT_KIND[p.kind]}</strong>${p.description ? html`<small class="muted block">${p.description}</small>` : ''}</td>
              <td>${date(p.due_date)}</td>
              <td class="num ${['desconto', 'reembolso'].includes(p.kind) ? 'text-red' : ''}">${['desconto', 'reembolso'].includes(p.kind) ? '−' : ''}${brl(p.amount)}</td>
              <td>${p.kind === 'desconto' ? html`<span class="badge badge--gray">Concedido</span>` : p.paid_at ? html`<span class="badge badge--green">${p.kind === 'reembolso' ? 'Devolvido' : 'Pago'} ${date(p.paid_at)}</span>${p.method ? html`<small class="muted block">${p.method}</small>` : ''}` : isOverdue(p) ? html`<span class="badge badge--red">Vencido</span>` : html`<span class="badge badge--yellow">${p.kind === 'reembolso' ? 'A devolver' : 'A receber'}</span>`}</td>
              <td class="row-actions">${!p.paid_at && p.kind !== 'desconto' ? html`<button class="btn btn--sm btn--success" type="button" data-pay="${p.id}">${p.kind === 'reembolso' ? 'Devolvido' : 'Recebido'}</button>` : ''}
                <button class="icon-btn icon-btn--sm" type="button" data-edit-pay="${p.id}" aria-label="Editar">${icon('edit')}</button></td></tr>`)}</tbody>
          </table></div>` : html`<p class="muted">Nenhum pagamento lançado.</p>`}
        </section>

        <section class="card">
          <header class="card__head"><h3>Despesas da festa</h3><button class="btn btn--sm btn--ghost" type="button" data-add-exp>${icon('plus')}Lançar despesa</button></header>
          ${expenses.length ? html`<ul class="rows">${expenses.map((x) => html`<li><span><strong>${x.description}</strong><small class="muted block">${x.category} · ${date(x.date)}${x.paid ? '' : ' · a pagar'}</small></span><span class="rows__end"><strong class="text-red">− ${brl(x.amount)}</strong></span></li>`)}</ul>` : html`<p class="muted">Nenhuma despesa lançada para esta festa.</p>`}
        </section>` : ''}
      </div>

      <div class="stack-lg">
        <section class="card">
          <header class="card__head"><h3>Checklist</h3><span class="muted">${done} de ${checklist.length}</span></header>
          <div class="progress"><span style="width:${checklist.length ? Math.round((done / checklist.length) * 100) : 0}%"></span></div>
          <ul class="checklist">${checklist.map((c) => html`<li class="${c.done ? 'is-done' : ''}">
            <label><input type="checkbox" data-check="${c.id}" ${c.done ? raw('checked') : ''}><span class="checklist__box">${icon('check')}</span>
              <span><strong>${c.step}</strong>${c.done && c.done_at ? html`<small>${who(c.done_by)} · ${dateTime(c.done_at)}</small>` : ''}</span></label></li>`)}</ul>
        </section>
        ${can('admin') ? html`<button class="btn btn--ghost btn--danger-text" type="button" data-delete>${icon('trash')}Excluir festa</button>` : ''}
      </div>
    </div>`);

  const reload = () => eventView(el, { args: [id] });

  $$('[data-check]', el).forEach((cb) => cb.addEventListener('change', async () => {
    try { await q(sb.from('event_checklist').update({ done: cb.checked }).eq('id', cb.dataset.check)); reload(); }
    catch (e) { fail(e); cb.checked = !cb.checked; }
  }));

  $('[data-status]', el)?.addEventListener('change', async (e) => {
    const next = e.target.value;
    if (next === 'cancelada' && !(await confirmDialog('Cancelar esta festa? O horário volta a ficar livre na agenda.', { danger: true, ok: 'Cancelar festa' }))) { e.target.value = ev.status; return; }
    try { await q(sb.from('events').update({ status: next }).eq('id', id)); toast(`Festa: ${EVENT_STATUS[next][0]}.`); reload(); }
    catch (err) { fail(/overlap|exclusion|conflicting/i.test(err.message) ? new Error('Já existe outra festa nesse horário.') : err); e.target.value = ev.status; }
  });

  $$('[data-rate]', el).forEach((b) => b.addEventListener('click', async () => {
    try { await q(sb.from('events').update({ rating: Number(b.dataset.rate) }).eq('id', id)); reload(); } catch (e) { fail(e); }
  }));

  $('[data-edit]', el)?.addEventListener('click', async () => {
    const r = await modal({
      title: 'Editar ficha da festa', size: 'modal--lg',
      body: String(html`<form data-ev-form novalidate class="form-grid">
        <div class="field"><label for="e-date">Data</label><input id="e-date" name="event_date" type="date" value="${ev.event_date}"></div>
        <div class="field"><label for="e-st">Início</label><input id="e-st" name="start_time" type="time" value="${time(ev.start_time)}"></div>
        <div class="field"><label for="e-en">Término</label><input id="e-en" name="end_time" type="time" value="${time(ev.end_time)}"></div>
        <div class="field"><label for="e-g">Convidados</label><input id="e-g" name="guests" type="number" min="1" value="${ev.guests || ''}"></div>
        <div class="field"><label for="e-child">Criança</label><input id="e-child" name="child_name" value="${ev.child_name || ''}"></div>
        <div class="field"><label for="e-age">Idade</label><input id="e-age" name="child_age" value="${ev.child_age || ''}"></div>
        <div class="field"><label for="e-pkg">Pacote</label><input id="e-pkg" name="package_name" value="${ev.package_name || ''}"></div>
        <div class="field"><label for="e-theme">Tema</label><input id="e-theme" name="theme" value="${ev.theme || ''}"></div>
        <div class="field field--full"><label for="e-menu">Cardápio e bebidas</label><textarea id="e-menu" name="menu" rows="2">${ev.menu || ''}</textarea></div>
        <div class="field field--full"><label for="e-deco">Decoração</label><textarea id="e-deco" name="decoration" rows="2">${ev.decoration || ''}</textarea></div>
        <div class="field field--full"><label for="e-serv">Serviços e atrações</label><textarea id="e-serv" name="services" rows="2">${ev.services || ''}</textarea></div>
        <div class="field field--full"><label for="e-info">Informações especiais</label><textarea id="e-info" name="special_info" rows="2">${ev.special_info || ''}</textarea></div>
        <div class="field field--full"><label for="e-res">Restrições e observações (alergias, acessibilidade…)</label><textarea id="e-res" name="restrictions" rows="2">${ev.restrictions || ''}</textarea></div>
        <div class="field"><label for="e-val">Valor contratado (R$)</label><input id="e-val" name="contract_value" type="number" min="0" step="0.01" value="${ev.contract_value}"></div>
      </form>`),
      actions: [{ label: 'Cancelar', cls: 'btn--ghost', value: null }, {
        label: 'Salvar', cls: 'btn--primary', onClick: async ({ el: m }) => {
          const f = $('[data-ev-form]', m);
          if (!validate(f, { event_date: (v) => (v ? '' : 'Informe a data.'), end_time: (v) => (v && f.start_time.value && v <= f.start_time.value ? 'O término precisa ser depois do início.' : '') })) return false;
          const v = formValues(f);
          try {
            await q(sb.from('events').update({ ...v, guests: v.guests ? +v.guests : null, contract_value: Number(v.contract_value) || 0 }).eq('id', id));
          } catch (err) {
            if (/overlap|exclusion|conflicting/i.test(err.message)) throw new Error('Já existe outra festa nesse dia e horário.');
            throw err;
          }
          return true;
        },
      }],
    });
    if (r) { toast('Ficha atualizada.'); reload(); }
  });

  // ---- Pagamentos ----
  const payForm = (p = {}) => html`<form data-pay-form novalidate class="form-grid">
    <div class="field"><label for="p-kind">Tipo</label><select id="p-kind" name="kind">${Object.entries(PAYMENT_KIND).map(([k, l]) => html`<option value="${k}" ${k === (p.kind || 'parcela') ? raw('selected') : ''}>${l}</option>`)}</select></div>
    <div class="field"><label for="p-amount">Valor (R$)</label><input id="p-amount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${p.amount || ''}"></div>
    <div class="field field--full"><label for="p-desc">Descrição</label><input id="p-desc" name="description" value="${p.description || ''}" placeholder="Ex.: Parcela 2, hora extra, pula-pula adicional"></div>
    <div class="field"><label for="p-due">Vencimento</label><input id="p-due" name="due_date" type="date" value="${p.due_date || today()}"></div>
    <div class="field"><label for="p-paid">Pago em <span class="opt">(deixe vazio se ainda não pagou)</span></label><input id="p-paid" name="paid_at" type="date" value="${p.paid_at || ''}"></div>
    <div class="field field--full"><label for="p-method">Forma de pagamento</label><select id="p-method" name="method"><option value="">—</option>${(settings?.payment_methods || []).map((m) => html`<option ${m === p.method ? raw('selected') : ''}>${m}</option>`)}</select></div>
    <div class="field field--full"><label for="p-notes">Observações</label><input id="p-notes" name="notes" value="${p.notes || ''}"></div>
  </form>`;
  const payRules = { amount: (v) => (Number(v) > 0 ? '' : 'Informe um valor maior que zero.') };
  const payPayload = (f) => { const v = formValues(f); return { kind: v.kind, amount: Number(v.amount), description: v.description, due_date: v.due_date || null, paid_at: v.kind === 'desconto' ? null : v.paid_at || null, method: v.method, notes: v.notes }; };

  $('[data-add-pay]', el)?.addEventListener('click', async () => {
    const r = await modal({ title: 'Registrar pagamento', body: String(payForm()), actions: [{ label: 'Cancelar', cls: 'btn--ghost', value: null }, {
      label: 'Salvar', cls: 'btn--primary', onClick: async ({ el: m }) => { const f = $('[data-pay-form]', m); if (!validate(f, payRules)) return false; await q(sb.from('payments').insert({ ...payPayload(f), event_id: id, client_id: ev.client_id })); return true; },
    }] });
    if (r) { toast('Pagamento registrado.'); reload(); }
  });
  $$('[data-edit-pay]', el).forEach((b) => b.addEventListener('click', async () => {
    const p = payments.find((x) => x.id === b.dataset.editPay);
    const actions = [{ label: 'Cancelar', cls: 'btn--ghost', value: null }];
    if (can('admin')) actions.unshift({ label: 'Excluir', cls: 'btn--ghost btn--danger-text', onClick: async () => { await q(sb.from('payments').delete().eq('id', p.id)); return true; } });
    actions.push({ label: 'Salvar', cls: 'btn--primary', onClick: async ({ el: m }) => { const f = $('[data-pay-form]', m); if (!validate(f, payRules)) return false; await q(sb.from('payments').update(payPayload(f)).eq('id', p.id)); return true; } });
    if (await modal({ title: 'Editar pagamento', body: String(payForm(p)), actions })) { toast('Pagamento atualizado.'); reload(); }
  }));
  $$('[data-pay]', el).forEach((b) => b.addEventListener('click', async () => {
    const p = payments.find((x) => x.id === b.dataset.pay);
    const r = await modal({
      title: p.kind === 'reembolso' ? 'Confirmar devolução' : 'Confirmar recebimento',
      body: String(html`<p><strong>${PAYMENT_KIND[p.kind]}</strong> ${p.description ? `· ${p.description}` : ''} · ${brl(p.amount)}</p>
        <div class="form-grid"><div class="field"><label for="pp-d">Data</label><input id="pp-d" type="date" value="${today()}" data-pp-date></div>
        <div class="field"><label for="pp-m">Forma</label><select id="pp-m" data-pp-method><option value="">—</option>${(settings?.payment_methods || []).map((m) => html`<option>${m}</option>`)}</select></div></div>`),
      actions: [{ label: 'Cancelar', cls: 'btn--ghost', value: null }, { label: 'Confirmar', cls: 'btn--success', onClick: async ({ el: m }) => {
        await q(sb.from('payments').update({ paid_at: $('[data-pp-date]', m).value || today(), method: $('[data-pp-method]', m).value }).eq('id', p.id)); return true;
      } }],
    });
    if (r) { toast('Pagamento confirmado.'); reload(); }
  }));

  // ---- Despesas ----
  $('[data-add-exp]', el)?.addEventListener('click', async () => {
    const r = await modal({
      title: 'Lançar despesa da festa',
      body: String(html`<form data-exp-form novalidate class="form-grid">
        <div class="field field--full"><label for="x-desc">Descrição</label><input id="x-desc" name="description" placeholder="Ex.: Bolo, monitores extras"></div>
        <div class="field"><label for="x-cat">Categoria</label><select id="x-cat" name="category">${EXPENSE_CATS.map((c) => html`<option>${c}</option>`)}</select></div>
        <div class="field"><label for="x-amt">Valor (R$)</label><input id="x-amt" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal"></div>
        <div class="field"><label for="x-date">Data</label><input id="x-date" name="date" type="date" value="${today()}"></div>
        <div class="field"><label class="check"><input type="checkbox" name="paid" checked>Já foi pago</label></div>
      </form>`),
      actions: [{ label: 'Cancelar', cls: 'btn--ghost', value: null }, { label: 'Salvar', cls: 'btn--primary', onClick: async ({ el: m }) => {
        const f = $('[data-exp-form]', m);
        if (!validate(f, { description: (v) => (v ? '' : 'Descreva a despesa.'), amount: (v) => (Number(v) > 0 ? '' : 'Informe o valor.') })) return false;
        const v = formValues(f);
        await q(sb.from('expenses').insert({ event_id: id, description: v.description, category: v.category, amount: Number(v.amount), date: v.date || today(), paid: v.paid }));
        return true;
      } }],
    });
    if (r) { toast('Despesa lançada.'); reload(); }
  });

  $('[data-delete]', el)?.addEventListener('click', async () => {
    if (!(await confirmDialog('Excluir esta festa, o checklist e os pagamentos ligados a ela? Prefira "Cancelada" para manter o histórico.', { danger: true, ok: 'Excluir' }))) return;
    try { await q(sb.from('events').delete().eq('id', id)); toast('Festa excluída.'); go('#/agenda'); } catch (e) { fail(e); }
  });
}
