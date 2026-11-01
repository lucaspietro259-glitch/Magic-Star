// Financeiro: contas a receber, recebidas, vencidas, despesas e fluxo de caixa.
import { sb, q } from '../supabase.js';
import { can, loadSettings } from '../auth.js';
import { setTitle } from '../app.js';
import { $, $$, html, raw, icon, brl, date, today, badge, modal, toast, fail, emptyState, PAYMENT_KIND, downloadCSV, formValues, validate, confirmDialog } from '../ui.js';
import { PERIODS, periodRange, inPeriod, isOverdue, RECEIVABLE, cashIn } from '../finance-utils.js';
import { chart, lastMonths, moneyAxis, plainAxis, COLORS } from '../charts.js';

const TABS = [['receber', 'A receber'], ['vencidas', 'Vencidas'], ['recebidas', 'Recebidas'], ['despesas', 'Despesas'], ['fluxo', 'Fluxo de caixa']];
const EXPENSE_CATS = ['Aluguel', 'Água, luz e internet', 'Alimentação', 'Bebidas', 'Decoração', 'Equipe', 'Manutenção', 'Marketing', 'Impostos', 'Material', 'Outros'];

export default async function finance(el, { params }) {
  setTitle('Financeiro');
  const settings = await loadSettings();
  let tab = params.aba || 'receber';
  let period = sessionStorage.getItem('fin-period') || 'mes';

  const [payments, expenses, events] = await Promise.all([
    q(sb.from('payments').select('*, event:events(id, child_name, event_date, status), client:clients(id, responsible_name)').order('due_date', { nullsFirst: false })),
    q(sb.from('expenses').select('*, event:events(id, child_name, event_date)').order('date', { ascending: false })),
    q(sb.from('events').select('id, child_name, event_date, status, contract_value').neq('status', 'cancelada').order('event_date', { ascending: false })),
  ]);

  const draw = () => {
    const P = periodRange(period);
    const t = today();
    const open = payments.filter((p) => RECEIVABLE.includes(p.kind) && !p.paid_at && p.event?.status !== 'cancelada');
    const overdue = open.filter(isOverdue);
    const received = payments.filter((p) => p.paid_at && (RECEIVABLE.includes(p.kind) || p.kind === 'reembolso') && inPeriod(p.paid_at, P));
    const exps = expenses.filter((x) => inPeriod(x.date, P));
    const inSum = cashIn(payments, P.from, P.to);
    const outSum = exps.filter((x) => x.paid).reduce((s, x) => s + Number(x.amount), 0);
    const openSum = open.reduce((s, p) => s + Number(p.amount), 0);
    const overdueSum = overdue.reduce((s, p) => s + Number(p.amount), 0);
    const billed = events.filter((e) => inPeriod(e.event_date, P)).reduce((s, e) => s + Number(e.contract_value), 0);

    const payRow = (p) => html`<tr>
      <td><strong>${p.event?.child_name ? `Festa de ${p.event.child_name}` : p.client?.responsible_name || '—'}</strong><small class="muted block">${p.client?.responsible_name || ''}${p.event ? ` · festa ${date(p.event.event_date)}` : ''}</small></td>
      <td>${PAYMENT_KIND[p.kind]}${p.description ? html`<small class="muted block">${p.description}</small>` : ''}</td>
      <td>${date(p.due_date)}</td>
      <td class="num ${p.kind === 'reembolso' ? 'text-red' : ''}"><strong>${p.kind === 'reembolso' ? '−' : ''}${brl(p.amount)}</strong></td>
      <td>${p.paid_at ? html`<span class="badge badge--green">${date(p.paid_at)}</span>${p.method ? html`<small class="muted block">${p.method}</small>` : ''}` : isOverdue(p) ? html`<span class="badge badge--red">Vencido há ${Math.round((new Date(t) - new Date(p.due_date)) / 864e5)} dia(s)</span>` : html`<span class="badge badge--yellow">A receber</span>`}</td>
      <td class="row-actions">${!p.paid_at ? html`<button class="btn btn--sm btn--success" type="button" data-receive="${p.id}">Recebido</button>` : ''}${p.event ? html`<a class="icon-btn icon-btn--sm" href="#/festas/${p.event.id}" aria-label="Abrir festa">${icon('right')}</a>` : ''}</td></tr>`;
    const payTable = (list, empty) => list.length ? html`<div class="table-wrap"><table class="table">
      <thead><tr><th>Festa / cliente</th><th>Tipo</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>${list.map(payRow)}</tbody></table></div>` : emptyState(empty, '');

    let body;
    if (tab === 'receber') body = payTable(open, 'Nada a receber');
    else if (tab === 'vencidas') body = payTable(overdue, 'Nenhuma conta vencida');
    else if (tab === 'recebidas') body = payTable(received.sort((a, b) => b.paid_at.localeCompare(a.paid_at)), 'Nenhum recebimento no período');
    else if (tab === 'despesas') body = html`<div class="toolbar"><button class="btn btn--primary btn--sm" type="button" data-add-exp>${icon('plus')}Nova despesa</button></div>
      ${exps.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead>
        <tbody>${exps.map((x) => html`<tr><td><strong>${x.description}</strong>${x.event ? html`<small class="muted block">Festa de ${x.event.child_name || ''} · ${date(x.event.event_date)}</small>` : ''}</td><td>${x.category}</td><td>${date(x.date)}</td>
          <td class="num text-red"><strong>− ${brl(x.amount)}</strong></td><td>${x.paid ? html`<span class="badge badge--green">Pago</span>` : html`<span class="badge badge--yellow">A pagar</span>`}</td>
          <td class="row-actions"><button class="icon-btn icon-btn--sm" type="button" data-edit-exp="${x.id}" aria-label="Editar">${icon('edit')}</button></td></tr>`)}</tbody></table></div>` : emptyState('Nenhuma despesa no período', 'Lance aluguel, contas, equipe e compras para acompanhar o resultado.')}`;
    else {
      body = html`<section class="card"><header class="card__head"><h3>Entradas e saídas</h3><span class="muted">Últimos 12 meses</span></header><div class="chart-box"><canvas data-flow></canvas></div></section>
        <div class="table-wrap"><table class="table"><thead><tr><th>Mês</th><th class="num">Entradas</th><th class="num">Saídas</th><th class="num">Saldo</th><th class="num">Acumulado</th></tr></thead><tbody data-flow-rows></tbody></table></div>`;
    }

    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2 class="page-h">Financeiro</h2><p class="muted">Cada pagamento está ligado à sua festa.</p></div>
        <div class="page-head__actions">
          <div class="seg" role="group" aria-label="Período">${Object.entries(PERIODS).map(([k, l]) => html`<button type="button" data-period="${k}" aria-pressed="${k === period}">${l}</button>`)}</div>
          <button class="btn btn--ghost" type="button" data-export>${icon('download')}Exportar</button>
        </div>
      </div>
      <div class="kpis kpis--5">
        <div class="kpi kpi--static"><span class="kpi__label">Faturamento (festas no período)</span><strong class="kpi__value">${brl(billed)}</strong><span class="kpi__sub">${PERIODS[period]}</span></div>
        <div class="kpi kpi--static kpi--green"><span class="kpi__label">Recebido</span><strong class="kpi__value">${brl(inSum)}</strong><span class="kpi__sub">${PERIODS[period]}</span></div>
        <div class="kpi kpi--static"><span class="kpi__label">Despesas pagas</span><strong class="kpi__value">${brl(outSum)}</strong><span class="kpi__sub">${PERIODS[period]}</span></div>
        <div class="kpi kpi--static ${inSum - outSum < 0 ? 'kpi--red' : 'kpi--blue'}"><span class="kpi__label">Saldo do caixa</span><strong class="kpi__value">${brl(inSum - outSum)}</strong><span class="kpi__sub">Recebido − despesas</span></div>
        <div class="kpi kpi--static ${overdueSum ? 'kpi--red' : ''}"><span class="kpi__label">A receber</span><strong class="kpi__value">${brl(openSum)}</strong><span class="kpi__sub">${overdueSum ? `${brl(overdueSum)} vencido` : 'Nada vencido'}</span></div>
      </div>
      <div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<button type="button" role="tab" aria-selected="${tab === k}" data-tab="${k}">${l}${k === 'vencidas' && overdue.length ? html` <em class="em-red">${overdue.length}</em>` : k === 'receber' ? html` <em>${open.length}</em>` : ''}</button>`)}</div>
      <div data-body>${body}</div>`);

    $$('[data-tab]', el).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
    $$('[data-period]', el).forEach((b) => b.addEventListener('click', () => { period = b.dataset.period; sessionStorage.setItem('fin-period', period); draw(); }));
    $$('[data-receive]', el).forEach((b) => b.addEventListener('click', () => receive(payments.find((p) => p.id === b.dataset.receive))));
    $('[data-add-exp]', el)?.addEventListener('click', () => expenseForm());
    $$('[data-edit-exp]', el).forEach((b) => b.addEventListener('click', () => expenseForm(expenses.find((x) => x.id === b.dataset.editExp))));
    $('[data-export]', el).addEventListener('click', () => exportCSV(tab, { open, overdue, received, exps }));

    if (tab === 'fluxo') {
      const months = lastMonths(12);
      let acc = 0;
      const rows = months.map((m) => {
        const [y, mo] = m.key.split('-').map(Number);
        const from = `${m.key}-01`, to = `${m.key}-${new Date(y, mo, 0).getDate()}`;
        const inn = cashIn(payments, from, to);
        const out = expenses.filter((x) => x.paid && x.date >= from && x.date <= to).reduce((s, x) => s + Number(x.amount), 0);
        acc += inn - out;
        return { ...m, inn, out, bal: inn - out, acc };
      });
      $('[data-flow-rows]', el).innerHTML = String(html`${rows.map((r) => html`<tr><td>${r.label}</td><td class="num text-green">${brl(r.inn)}</td><td class="num text-red">${brl(r.out)}</td><td class="num"><strong class="${r.bal < 0 ? 'text-red' : ''}">${brl(r.bal)}</strong></td><td class="num">${brl(r.acc)}</td></tr>`)}`);
      chart($('[data-flow]', el), {
        type: 'bar',
        data: { labels: rows.map((r) => r.label), datasets: [
          { label: 'Entradas', data: rows.map((r) => r.inn), backgroundColor: COLORS.verde, borderRadius: 6 },
          { label: 'Saídas', data: rows.map((r) => -r.out), backgroundColor: COLORS.cereja, borderRadius: 6 },
          { label: 'Saldo', type: 'line', data: rows.map((r) => r.bal), borderColor: COLORS.tinta, backgroundColor: COLORS.tinta, tension: 0.3, pointRadius: 3 },
        ] },
        options: { scales: { y: moneyAxis, x: { ...plainAxis, stacked: true } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${brl(Math.abs(c.raw))}` } } } },
      });
    }
  };

  async function receive(p) {
    const r = await modal({
      title: 'Confirmar recebimento',
      body: String(html`<p><strong>${PAYMENT_KIND[p.kind]}</strong>${p.description ? ` · ${p.description}` : ''} · <strong>${brl(p.amount)}</strong><br><span class="muted">${p.client?.responsible_name || ''}</span></p>
        <div class="form-grid"><div class="field"><label for="r-d">Data do recebimento</label><input id="r-d" type="date" value="${today()}" data-d></div>
        <div class="field"><label for="r-m">Forma</label><select id="r-m" data-m><option value="">—</option>${(settings?.payment_methods || []).map((m) => html`<option>${m}</option>`)}</select></div></div>`),
      actions: [{ label: 'Cancelar', cls: 'btn--ghost', value: null }, { label: 'Confirmar', cls: 'btn--success', onClick: async ({ el: m }) => {
        const upd = { paid_at: $('[data-d]', m).value || today(), method: $('[data-m]', m).value };
        await q(sb.from('payments').update(upd).eq('id', p.id)); Object.assign(p, upd); return true;
      } }],
    });
    if (r) { toast('Recebimento registrado.'); draw(); }
  }

  async function expenseForm(x = null) {
    const actions = [{ label: 'Cancelar', cls: 'btn--ghost', value: null }];
    if (x && can('admin')) actions.unshift({ label: 'Excluir', cls: 'btn--ghost btn--danger-text', onClick: async () => {
      if (!(await confirmDialog('Excluir esta despesa?', { danger: true, ok: 'Excluir' }))) return false;
      await q(sb.from('expenses').delete().eq('id', x.id)); expenses.splice(expenses.indexOf(x), 1); return true;
    } });
    actions.push({ label: 'Salvar', cls: 'btn--primary', onClick: async ({ el: m }) => {
      const f = $('[data-exp-form]', m);
      if (!validate(f, { description: (v) => (v ? '' : 'Descreva a despesa.'), amount: (v) => (Number(v) > 0 ? '' : 'Informe o valor.') })) return false;
      const v = formValues(f);
      const payload = { description: v.description, category: v.category, amount: Number(v.amount), date: v.date || today(), paid: v.paid, event_id: v.event_id || null };
      const saved = x ? await q(sb.from('expenses').update(payload).eq('id', x.id).select('*, event:events(id, child_name, event_date)').single())
        : await q(sb.from('expenses').insert(payload).select('*, event:events(id, child_name, event_date)').single());
      if (x) Object.assign(x, saved); else expenses.unshift(saved);
      return true;
    } });
    const r = await modal({
      title: x ? 'Editar despesa' : 'Nova despesa',
      body: String(html`<form data-exp-form novalidate class="form-grid">
        <div class="field field--full"><label for="x-desc">Descrição</label><input id="x-desc" name="description" value="${x?.description || ''}"></div>
        <div class="field"><label for="x-cat">Categoria</label><select id="x-cat" name="category">${EXPENSE_CATS.map((c) => html`<option ${c === x?.category ? raw('selected') : ''}>${c}</option>`)}</select></div>
        <div class="field"><label for="x-amt">Valor (R$)</label><input id="x-amt" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${x?.amount || ''}"></div>
        <div class="field"><label for="x-date">Data</label><input id="x-date" name="date" type="date" value="${x?.date || today()}"></div>
        <div class="field"><label for="x-ev">Festa relacionada <span class="opt">(opcional)</span></label><select id="x-ev" name="event_id"><option value="">Nenhuma (despesa geral)</option>${events.slice(0, 80).map((e) => html`<option value="${e.id}" ${e.id === x?.event_id ? raw('selected') : ''}>${date(e.event_date)} · ${e.child_name || 'Festa'}</option>`)}</select></div>
        <div class="field field--full"><label class="check"><input type="checkbox" name="paid" ${x && !x.paid ? '' : raw('checked')}>Já foi paga</label></div>
      </form>`),
      actions,
    });
    if (r) { toast('Despesa salva.'); draw(); }
  }

  function exportCSV(which, { open, overdue, received, exps }) {
    if (which === 'despesas') return downloadCSV('despesas.csv', [['Descrição', 'Categoria', 'Data', 'Valor', 'Paga', 'Festa'], ...exps.map((x) => [x.description, x.category, date(x.date), String(x.amount).replace('.', ','), x.paid ? 'Sim' : 'Não', x.event?.child_name || ''])]);
    const list = which === 'vencidas' ? overdue : which === 'recebidas' ? received : open;
    downloadCSV(`financeiro-${which}.csv`, [['Cliente', 'Festa', 'Data da festa', 'Tipo', 'Descrição', 'Vencimento', 'Valor', 'Pago em', 'Forma'],
      ...list.map((p) => [p.client?.responsible_name, p.event?.child_name, date(p.event?.event_date), PAYMENT_KIND[p.kind], p.description, date(p.due_date), String(p.amount).replace('.', ','), date(p.paid_at), p.method])]);
  }

  draw();
}
