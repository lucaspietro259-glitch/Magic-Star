// Visão geral: indicadores e gráficos calculados a partir dos dados cadastrados.
import { sb, q } from '../supabase.js';
import { can, state } from '../auth.js';
import { setTitle } from '../app.js';
import { $, $$, html, icon, brl, num, pct, date, dateShort, time, today, addDays, badge, EVENT_STATUS, emptyState } from '../ui.js';
import { chart, lastMonths, monthKey, moneyAxis, plainAxis, countAxis, COLORS, PALETTE } from '../charts.js';
import { PERIODS, periodRange, inPeriod, cashIn, isOverdue, RECEIVABLE } from '../finance-utils.js';

const SENT = ['enviado', 'aguardando_resposta', 'em_negociacao', 'aprovado', 'recusado', 'expirado'];
const OPEN = ['enviado', 'aguardando_resposta', 'em_negociacao'];

export default async function dashboard(el) {
  setTitle('Visão geral');
  const fin = can('gerente');
  const [quotes, events, clients, leads, profiles, payments] = await Promise.all([
    q(sb.from('quotes').select('id, status, total, created_at, sent_at, approved_at, valid_until, created_by, event_date')),
    q(sb.from('events').select('id, event_date, start_time, end_time, status, contract_value, child_name, guests, client:clients(responsible_name)').order('event_date')),
    q(sb.from('clients').select('id, source, created_at')),
    q(sb.from('leads').select('id, status, created_at')),
    q(sb.from('profiles').select('id, full_name, email')),
    fin ? q(sb.from('payments').select('kind, amount, due_date, paid_at, event_id')) : Promise.resolve([]),
  ]);
  const max = state.settings?.max_events_per_day || 2;
  let period = sessionStorage.getItem('dash-period') || 'mes';

  const draw = () => {
    const P = periodRange(period);
    const t = today();
    const activeEvents = events.filter((e) => e.status !== 'cancelada');
    const upcoming = activeEvents.filter((e) => e.event_date >= t && e.status !== 'realizada');
    const next30 = upcoming.filter((e) => e.event_date <= addDays(t, 30));
    const sent = quotes.filter((x) => SENT.includes(x.status) && inPeriod(x.sent_at || x.created_at, P));
    const approved = quotes.filter((x) => x.status === 'aprovado' && inPeriod(x.approved_at, P));
    const waiting = quotes.filter((x) => OPEN.includes(x.status));
    const forecast = activeEvents.filter((e) => inPeriod(e.event_date, P)).reduce((s, e) => s + Number(e.contract_value), 0);
    const received = cashIn(payments, P.from, P.to);
    const pending = payments.filter((p) => RECEIVABLE.includes(p.kind) && !p.paid_at);
    const pendingSum = pending.reduce((s, p) => s + Number(p.amount), 0);
    const overdueSum = payments.filter(isOverdue).reduce((s, p) => s + Number(p.amount), 0);
    const newLeads = leads.filter((l) => l.status === 'novo').length;
    const newClients = clients.filter((c) => inPeriod(c.created_at, P)).length;

    // Alertas
    const perDay = {};
    upcoming.forEach((e) => (perDay[e.event_date] = (perDay[e.event_date] || 0) + 1));
    const fullDays = Object.entries(perDay).filter(([, n]) => n >= max);
    const awaiting = upcoming.filter((e) => e.status === 'aguardando_confirmacao');
    const week = upcoming.filter((e) => e.event_date <= addDays(t, 7));
    const expiring = quotes.filter((x) => OPEN.includes(x.status) && x.valid_until && x.valid_until >= t && x.valid_until <= addDays(t, 3));
    const overdueCount = payments.filter(isOverdue).length;

    const card = (label, value, sub, ic, href, tone = '') => html`<a class="kpi ${tone}" href="${href}"><span class="kpi__ic">${icon(ic)}</span><span class="kpi__label">${label}</span><strong class="kpi__value">${value}</strong><span class="kpi__sub">${sub}</span></a>`;

    el.innerHTML = String(html`
      <div class="page-head">
        <div><p class="eyebrow-txt">Olá, ${(state.profile.full_name || '').split(' ')[0] || 'gestor'}</p><h2 class="page-h">Como está o buffet</h2></div>
        <div class="seg" role="group" aria-label="Período">${Object.entries(PERIODS).map(([k, l]) => html`<button type="button" data-period="${k}" aria-pressed="${k === period}">${l}</button>`)}</div>
      </div>

      ${week.length || awaiting.length || overdueCount || fullDays.length || expiring.length ? html`
      <div class="alerts">
        ${week.length ? html`<a class="alert alert--blue" href="#/agenda">${icon('party')}<span><strong>${week.length} festa${week.length > 1 ? 's' : ''}</strong> nos próximos 7 dias</span></a>` : ''}
        ${awaiting.length ? html`<a class="alert alert--yellow" href="#/agenda">${icon('clock')}<span><strong>${awaiting.length}</strong> aguardando confirmação</span></a>` : ''}
        ${fin && overdueCount ? html`<a class="alert alert--red" href="#/financeiro?aba=vencidas">${icon('alert')}<span><strong>${overdueCount} pagamento${overdueCount > 1 ? 's' : ''} vencido${overdueCount > 1 ? 's' : ''}</strong> · ${brl(overdueSum)}</span></a>` : ''}
        ${fullDays.length ? html`<a class="alert alert--purple" href="#/agenda">${icon('calendar')}<span><strong>${fullDays.length} data${fullDays.length > 1 ? 's' : ''} lotada${fullDays.length > 1 ? 's' : ''}</strong>: ${fullDays.slice(0, 3).map(([d]) => dateShort(d)).join(', ')}</span></a>` : ''}
        ${expiring.length ? html`<a class="alert alert--yellow" href="#/orcamentos?status=abertos">${icon('file')}<span><strong>${expiring.length} proposta${expiring.length > 1 ? 's' : ''}</strong> vence${expiring.length > 1 ? 'm' : ''} em até 3 dias</span></a>` : ''}
      </div>` : ''}

      <div class="kpis">
        ${card('Orçamentos enviados', num(sent.length), PERIODS[period], 'file', '#/orcamentos')}
        ${card('Aguardando resposta', num(waiting.length), 'Enviados e em negociação', 'clock', '#/orcamentos?status=abertos', 'kpi--yellow')}
        ${card('Orçamentos aprovados', num(approved.length), sent.length ? `${pct((approved.length / sent.length) * 100)} dos enviados` : PERIODS[period], 'check', '#/orcamentos?status=aprovado', 'kpi--green')}
        ${card('Festas confirmadas', num(upcoming.filter((e) => e.status === 'confirmada').length), 'Daqui para frente', 'party', '#/agenda')}
        ${card('Festas próximas', num(next30.length), 'Nos próximos 30 dias', 'calendar', '#/agenda')}
        ${card('Novos interessados', num(newLeads), `${num(newClients)} cliente${newClients === 1 ? '' : 's'} novo${newClients === 1 ? '' : 's'} no período`, 'inbox', '#/interessados', newLeads ? 'kpi--blue' : '')}
        ${fin ? card('Faturamento previsto', brl(forecast), `Festas com data em: ${PERIODS[period].toLowerCase()}`, 'chart', '#/financeiro') : ''}
        ${fin ? card('Faturamento recebido', brl(received), PERIODS[period], 'wallet', '#/financeiro?aba=recebidas', 'kpi--green') : ''}
        ${fin ? card('Pendente de pagamento', brl(pendingSum), overdueSum ? `${brl(overdueSum)} vencido` : 'Nada vencido', 'money', '#/financeiro', overdueSum ? 'kpi--red' : '') : ''}
      </div>

      <div class="grid-2">
        <section class="card">
          <header class="card__head"><h3>${fin ? 'Faturamento mensal' : 'Orçamentos por mês'}</h3><span class="muted">Últimos 12 meses</span></header>
          <div class="chart-box"><canvas data-chart="revenue"></canvas></div>
        </section>
        <section class="card">
          <header class="card__head"><h3>Festas por mês</h3><span class="muted">Pela data da festa</span></header>
          <div class="chart-box"><canvas data-chart="events"></canvas></div>
        </section>
        <section class="card">
          <header class="card__head"><h3>Conversão de orçamentos</h3><span class="muted">Aprovados ÷ decididos</span></header>
          <div class="chart-box"><canvas data-chart="conversion"></canvas></div>
        </section>
        <section class="card">
          <header class="card__head"><h3>Origem dos clientes</h3><span class="muted">Como conheceram o buffet</span></header>
          <div class="chart-box chart-box--donut"><canvas data-chart="sources"></canvas></div>
        </section>
        <section class="card">
          <header class="card__head"><h3>Desempenho comercial</h3><span class="muted">${PERIODS[period]}</span></header>
          <div class="chart-box"><canvas data-chart="team"></canvas></div>
        </section>
        <section class="card">
          <header class="card__head"><h3>Próximas festas</h3><a class="link" href="#/agenda">Ver agenda</a></header>
          ${upcoming.length ? html`<ul class="mini-list">${upcoming.slice(0, 6).map((e) => html`
            <li><a href="#/festas/${e.id}"><span class="date-chip"><strong>${String(e.event_date).slice(8, 10)}</strong>${new Date(`${e.event_date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
              <span class="mini-list__main"><strong>${e.child_name || 'Aniversário'}</strong><small>${e.client?.responsible_name || ''} · ${time(e.start_time)}–${time(e.end_time)}${e.guests ? ` · ${e.guests} convidados` : ''}</small></span>
              ${badge(EVENT_STATUS, e.status)}</a></li>`)}</ul>`
            : emptyState('Nenhuma festa agendada', 'Quando um orçamento for aprovado e confirmado, a festa aparece aqui.')}
        </section>
      </div>`);

    $$('[data-period]', el).forEach((b) => b.addEventListener('click', () => { period = b.dataset.period; sessionStorage.setItem('dash-period', period); draw(); }));

    // ---- Gráficos ----
    const months = lastMonths(12);
    const byMonth = (list, getDate, value = () => 1) => months.map((m) => list.filter((x) => monthKey(getDate(x)) === m.key).reduce((s, x) => s + value(x), 0));

    if (fin) {
      const recByMonth = months.map((m) => {
        const [y, mo] = m.key.split('-').map(Number);
        const last = new Date(y, mo, 0).getDate();
        return cashIn(payments, `${m.key}-01`, `${m.key}-${last}`);
      });
      chart($('[data-chart="revenue"]', el), {
        type: 'bar',
        data: { labels: months.map((m) => m.label), datasets: [
          { label: 'Recebido', data: recByMonth, backgroundColor: COLORS.azul, borderRadius: 6, order: 2 },
          { label: 'Previsto (festas)', type: 'line', data: byMonth(activeEvents, (e) => e.event_date, (e) => Number(e.contract_value)), borderColor: COLORS.sol, backgroundColor: COLORS.sol, tension: 0.35, pointRadius: 3, order: 1 },
        ] },
        options: { scales: { y: moneyAxis, x: plainAxis }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${brl(c.raw)}` } } } },
      });
    } else {
      chart($('[data-chart="revenue"]', el), {
        type: 'bar',
        data: { labels: months.map((m) => m.label), datasets: [{ label: 'Orçamentos', data: byMonth(quotes, (x) => x.created_at), backgroundColor: COLORS.azul, borderRadius: 6 }] },
        options: { scales: { y: countAxis, x: plainAxis }, plugins: { legend: { display: false } } },
      });
    }

    chart($('[data-chart="events"]', el), {
      type: 'bar',
      data: { labels: months.map((m) => m.label), datasets: [{ label: 'Festas', data: byMonth(activeEvents, (e) => e.event_date), backgroundColor: COLORS.sol, borderRadius: 6 }] },
      options: { scales: { y: countAxis, x: plainAxis }, plugins: { legend: { display: false } } },
    });

    const conv = months.map((m) => {
      const decided = quotes.filter((x) => monthKey(x.created_at) === m.key && ['aprovado', 'recusado', 'expirado'].includes(x.status));
      return decided.length ? Math.round((decided.filter((x) => x.status === 'aprovado').length / decided.length) * 100) : null;
    });
    chart($('[data-chart="conversion"]', el), {
      type: 'line',
      data: { labels: months.map((m) => m.label), datasets: [{ label: 'Conversão', data: conv, borderColor: COLORS.verde, backgroundColor: 'rgba(31,163,107,.12)', fill: true, tension: 0.35, spanGaps: true, pointRadius: 3 }] },
      options: { scales: { y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` }, grid: { color: '#eef1f7' }, border: { display: false } }, x: plainAxis }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw}% aprovados` } } } },
    });

    const src = {};
    clients.forEach((c) => { const k = c.source || 'Não informado'; src[k] = (src[k] || 0) + 1; });
    const srcEntries = Object.entries(src).sort((a, b) => b[1] - a[1]);
    if (srcEntries.length) {
      chart($('[data-chart="sources"]', el), {
        type: 'doughnut',
        data: { labels: srcEntries.map(([k]) => k), datasets: [{ data: srcEntries.map(([, v]) => v), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }] },
        options: { cutout: '62%', plugins: { legend: { position: 'right' } } },
      });
    } else $('[data-chart="sources"]', el).replaceWith(Object.assign(document.createElement('p'), { className: 'muted center', textContent: 'Cadastre clientes informando como conheceram o buffet.' }));

    const periodQuotes = quotes.filter((x) => inPeriod(x.created_at, P));
    const team = profiles.map((p) => ({ name: (p.full_name || p.email).split(' ')[0], created: periodQuotes.filter((x) => x.created_by === p.id).length, approved: quotes.filter((x) => x.created_by === p.id && x.status === 'aprovado' && inPeriod(x.approved_at, P)).length }))
      .filter((p) => p.created || p.approved);
    if (team.length) {
      chart($('[data-chart="team"]', el), {
        type: 'bar',
        data: { labels: team.map((p) => p.name), datasets: [
          { label: 'Orçamentos criados', data: team.map((p) => p.created), backgroundColor: COLORS.azul, borderRadius: 6 },
          { label: 'Aprovados', data: team.map((p) => p.approved), backgroundColor: COLORS.verde, borderRadius: 6 },
        ] },
        options: { scales: { y: countAxis, x: plainAxis } },
      });
    } else $('[data-chart="team"]', el).replaceWith(Object.assign(document.createElement('p'), { className: 'muted center', textContent: 'Nenhum orçamento criado no período.' }));
  };
  draw();
}
