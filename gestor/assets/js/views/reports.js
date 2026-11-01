// Relatórios para decisão: festas, faturamento, ticket médio, pacotes, adicionais, clientes, conversão e perdas.
import { sb, q } from '../supabase.js';
import { setTitle } from '../app.js';
import { $, $$, html, icon, brl, num, pct, today, downloadCSV, CATEGORY_SINGULAR, emptyState } from '../ui.js';
import { cashIn, periodRange } from '../finance-utils.js';
import { chart, COLORS, PALETTE, moneyAxis, plainAxis } from '../charts.js';

export default async function reports(el) {
  setTitle('Relatórios');
  const y = new Date().getFullYear();
  let from = sessionStorage.getItem('rep-from') || `${y}-01-01`;
  let to = sessionStorage.getItem('rep-to') || `${y}-12-31`;

  const [events, quotes, items, payments] = await Promise.all([
    q(sb.from('events').select('id, event_date, status, contract_value, guests, client_id, client:clients(responsible_name)')),
    q(sb.from('quotes').select('id, status, total, created_at, approved_at, loss_reason, client_id, client:clients(responsible_name)')),
    q(sb.from('quote_items').select('quote_id, category, description, quantity, total')),
    q(sb.from('payments').select('kind, amount, paid_at')),
  ]);

  const draw = () => {
    const inR = (d) => d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
    const t = today();
    const evs = events.filter((e) => e.status !== 'cancelada' && inR(e.event_date));
    const done = evs.filter((e) => e.status === 'realizada' || e.event_date < t);
    const billed = evs.reduce((s, e) => s + Number(e.contract_value), 0);
    const ticket = evs.length ? billed / evs.length : 0;
    const received = cashIn(payments, from, to);
    const qs = quotes.filter((x) => inR(x.created_at));
    const decided = qs.filter((x) => ['aprovado', 'recusado', 'expirado'].includes(x.status));
    const approvedQ = qs.filter((x) => x.status === 'aprovado');
    const conv = decided.length ? (approvedQ.length / decided.length) * 100 : 0;
    const approvedIds = new Set(quotes.filter((x) => x.status === 'aprovado' && inR(x.approved_at || x.created_at)).map((x) => x.id));
    const soldItems = items.filter((i) => approvedIds.has(i.quote_id));

    const group = (list, key, val = () => 1) => Object.entries(list.reduce((m, x) => { const k = key(x); if (!m[k]) m[k] = { n: 0, v: 0 }; m[k].n += 1; m[k].v += val(x); return m; }, {})).sort((a, b) => b[1].n - a[1].n || b[1].v - a[1].v);
    const packages = group(soldItems.filter((i) => i.category === 'pacote'), (i) => i.description, (i) => Number(i.total));
    const extras = group(soldItems.filter((i) => ['servico', 'atracao', 'recreacao', 'personalizado', 'decoracao', 'tema', 'cardapio', 'bebida'].includes(i.category)), (i) => `${i.description}|${i.category}`, (i) => Number(i.total));
    const topClients = group(approvedQ, (x) => x.client?.responsible_name || '—', (x) => Number(x.total)).slice(0, 10);
    const losses = group(qs.filter((x) => x.status === 'recusado'), (x) => x.loss_reason || 'Não informado');

    // Faturamento por mês e por ano (pela data da festa)
    const byMonth = {};
    evs.forEach((e) => { const k = e.event_date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + Number(e.contract_value); });
    const monthKeys = Object.keys(byMonth).sort();
    const byYear = {};
    events.filter((e) => e.status !== 'cancelada').forEach((e) => { const k = e.event_date.slice(0, 4); if (!byYear[k]) byYear[k] = { n: 0, v: 0 }; byYear[k].n++; byYear[k].v += Number(e.contract_value); });

    const table = (head, rows, empty = 'Sem dados no período.') => rows.length ? html`<div class="table-wrap"><table class="table table--compact"><thead><tr>${head.map((h, i) => html`<th class="${i ? 'num' : ''}">${h}</th>`)}</tr></thead><tbody>${rows.map((r) => html`<tr>${r.map((c, i) => html`<td class="${i ? 'num' : ''}">${c}</td>`)}</tr>`)}</tbody></table></div>` : html`<p class="muted">${empty}</p>`;

    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2 class="page-h">Relatórios</h2><p class="muted">Escolha o período. Festas contam pela data da festa; orçamentos, pela data de criação.</p></div>
        <div class="page-head__actions">
          <div class="range"><label>De <input type="date" value="${from}" data-from></label><label>até <input type="date" value="${to}" data-to></label></div>
          <div class="seg" role="group" aria-label="Atalhos">${[['mes', 'Mês'], ['3m', '3 meses'], ['ano', 'Ano']].map(([k, l]) => html`<button type="button" data-quick="${k}">${l}</button>`)}</div>
          <button class="btn btn--ghost" type="button" data-print>${icon('printer')}Imprimir</button>
        </div>
      </div>

      <div class="kpis kpis--5">
        <div class="kpi kpi--static"><span class="kpi__label">Festas no período</span><strong class="kpi__value">${num(evs.length)}</strong><span class="kpi__sub">${num(done.length)} já realizadas</span></div>
        <div class="kpi kpi--static"><span class="kpi__label">Faturamento contratado</span><strong class="kpi__value">${brl(billed)}</strong><span class="kpi__sub">Recebido no período: ${brl(received)}</span></div>
        <div class="kpi kpi--static kpi--blue"><span class="kpi__label">Ticket médio</span><strong class="kpi__value">${brl(ticket)}</strong><span class="kpi__sub">por festa</span></div>
        <div class="kpi kpi--static kpi--green"><span class="kpi__label">Taxa de conversão</span><strong class="kpi__value">${pct(conv)}</strong><span class="kpi__sub">${approvedQ.length} aprovados de ${decided.length} decididos</span></div>
        <div class="kpi kpi--static"><span class="kpi__label">Orçamentos criados</span><strong class="kpi__value">${num(qs.length)}</strong><span class="kpi__sub">${num(qs.length - decided.length)} ainda em aberto</span></div>
      </div>

      <div class="grid-2">
        <section class="card report"><header class="card__head"><h3>Faturamento mensal</h3><button class="link" type="button" data-csv="mensal">CSV</button></header>
          ${monthKeys.length ? html`<div class="chart-box"><canvas data-chart="month"></canvas></div>` : html`<p class="muted">Sem festas no período.</p>`}</section>
        <section class="card report"><header class="card__head"><h3>Faturamento anual</h3><button class="link" type="button" data-csv="anual">CSV</button></header>
          ${table(['Ano', 'Festas', 'Faturamento', 'Ticket médio'], Object.entries(byYear).sort().reverse().map(([k, v]) => [k, num(v.n), brl(v.v), brl(v.v / v.n)]))}</section>
        <section class="card report"><header class="card__head"><h3>Pacotes mais vendidos</h3><button class="link" type="button" data-csv="pacotes">CSV</button></header>
          ${table(['Pacote', 'Vendas', 'Receita'], packages.map(([k, v]) => [k, num(v.n), brl(v.v)]))}</section>
        <section class="card report"><header class="card__head"><h3>Adicionais mais contratados</h3><button class="link" type="button" data-csv="adicionais">CSV</button></header>
          ${table(['Item', 'Vezes', 'Receita'], extras.slice(0, 15).map(([k, v]) => { const [d, c] = k.split('|'); return [html`${d} <small class="muted">${CATEGORY_SINGULAR[c]}</small>`, num(v.n), brl(v.v)]; }))}</section>
        <section class="card report"><header class="card__head"><h3>Clientes que mais fecham</h3><button class="link" type="button" data-csv="clientes">CSV</button></header>
          ${table(['Cliente', 'Orçamentos aprovados', 'Valor'], topClients.map(([k, v]) => [k, num(v.n), brl(v.v)]))}</section>
        <section class="card report"><header class="card__head"><h3>Motivos de perda</h3><button class="link" type="button" data-csv="perdas">CSV</button></header>
          ${losses.length ? html`<div class="chart-box chart-box--donut"><canvas data-chart="loss"></canvas></div>` : html`<p class="muted">Nenhum orçamento recusado no período.</p>`}</section>
      </div>`);

    const setRange = (f, tt) => { from = f; to = tt; sessionStorage.setItem('rep-from', from); sessionStorage.setItem('rep-to', to); draw(); };
    $('[data-from]', el).addEventListener('change', (e) => e.target.value && setRange(e.target.value, to));
    $('[data-to]', el).addEventListener('change', (e) => e.target.value && setRange(from, e.target.value));
    $$('[data-quick]', el).forEach((b) => b.addEventListener('click', () => { const r = periodRange(b.dataset.quick); setRange(r.from, r.to); }));
    $('[data-print]', el).addEventListener('click', () => window.print());

    const csv = {
      mensal: () => [['Mês', 'Faturamento'], ...monthKeys.map((k) => [k, String(byMonth[k].toFixed(2)).replace('.', ',')])],
      anual: () => [['Ano', 'Festas', 'Faturamento'], ...Object.entries(byYear).map(([k, v]) => [k, v.n, String(v.v.toFixed(2)).replace('.', ',')])],
      pacotes: () => [['Pacote', 'Vendas', 'Receita'], ...packages.map(([k, v]) => [k, v.n, String(v.v.toFixed(2)).replace('.', ',')])],
      adicionais: () => [['Item', 'Categoria', 'Vezes', 'Receita'], ...extras.map(([k, v]) => { const [d, c] = k.split('|'); return [d, CATEGORY_SINGULAR[c], v.n, String(v.v.toFixed(2)).replace('.', ',')]; })],
      clientes: () => [['Cliente', 'Aprovados', 'Valor'], ...topClients.map(([k, v]) => [k, v.n, String(v.v.toFixed(2)).replace('.', ',')])],
      perdas: () => [['Motivo', 'Quantidade'], ...losses.map(([k, v]) => [k, v.n])],
    };
    $$('[data-csv]', el).forEach((b) => b.addEventListener('click', () => downloadCSV(`relatorio-${b.dataset.csv}-${from}-a-${to}.csv`, csv[b.dataset.csv]())));

    if (monthKeys.length) chart($('[data-chart="month"]', el), {
      type: 'bar', data: { labels: monthKeys.map((k) => { const [yy, mm] = k.split('-'); return new Date(+yy, +mm - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('. de ', '/').replace('.', ''); }),
        datasets: [{ label: 'Faturamento', data: monthKeys.map((k) => byMonth[k]), backgroundColor: COLORS.azul, borderRadius: 6 }] },
      options: { scales: { y: moneyAxis, x: plainAxis }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => brl(c.raw) } } } },
    });
    if (losses.length) chart($('[data-chart="loss"]', el), {
      type: 'doughnut', data: { labels: losses.map(([k]) => k), datasets: [{ data: losses.map(([, v]) => v.n), backgroundColor: PALETTE, borderColor: '#fff', borderWidth: 2 }] },
      options: { cutout: '60%', plugins: { legend: { position: 'right' } } },
    });
  };
  draw();
}
