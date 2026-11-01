// Agenda: visão mensal, semanal e diária das festas, com pré-reservas e alertas.
import { sb, q } from '../supabase.js';
import { state, can } from '../auth.js';
import { setTitle, go } from '../app.js';
import { $, $$, html, icon, brl, time, iso, today, addDays, badge, EVENT_STATUS, QUOTE_STATUS, dateLong, date, quoteCode } from '../ui.js';
import { isOverdue } from '../finance-utils.js';

const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const OPEN = ['enviado', 'aguardando_resposta', 'em_negociacao', 'aprovado'];

export default async function agenda(el, { params }) {
  setTitle('Agenda de festas');
  let mode = params.modo || sessionStorage.getItem('agenda-mode') || (innerWidth < 760 ? 'dia' : 'mes');
  let cursor = params.data || today();
  const max = state.settings?.max_events_per_day || 2;

  const range = () => {
    const d = new Date(`${cursor}T12:00:00`);
    if (mode === 'mes') {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const start = addDays(iso(first), -((first.getDay() + 6) % 7));
      return { start, end: addDays(start, 41) };
    }
    if (mode === 'semana') { const start = addDays(cursor, -((d.getDay() + 6) % 7)); return { start, end: addDays(start, 6) }; }
    return { start: cursor, end: cursor };
  };

  async function draw() {
    const { start, end } = range();
    const [events, holds, payments] = await Promise.all([
      q(sb.from('events').select('id, event_date, start_time, end_time, status, child_name, guests, package_name, contract_value, client:clients(responsible_name)').gte('event_date', start).lte('event_date', end).order('start_time')),
      q(sb.from('quotes').select('id, number, version, event_date, start_time, duration_hours, status, child_name, guests, client:clients(responsible_name), event:events(id)').in('status', OPEN).gte('event_date', start).lte('event_date', end)),
      can('gerente') ? q(sb.from('payments').select('event_id, kind, amount, due_date, paid_at').not('event_id', 'is', null)) : Promise.resolve([]),
    ]);
    const pre = holds.filter((h) => !(Array.isArray(h.event) ? h.event.length : h.event));
    const byDay = (d) => events.filter((e) => e.event_date === d);
    const preByDay = (d) => pre.filter((h) => h.event_date === d);
    const owes = (id) => payments.some((p) => p.event_id === id && isOverdue(p));
    const t = today();

    const d0 = new Date(`${cursor}T12:00:00`);
    const label = mode === 'mes' ? (([m]) => m.charAt(0).toUpperCase() + m.slice(1))([d0.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })])
      : mode === 'semana' ? `${date(start)} – ${date(end)}` : dateLong(cursor);

    const evChip = (e) => html`<a class="ev ev--${e.status} ${owes(e.id) ? 'ev--owes' : ''}" href="#/festas/${e.id}" title="${e.child_name || ''} · ${e.client?.responsible_name || ''}">
      <span class="ev__time">${time(e.start_time)}</span><span class="ev__name">${e.child_name || e.client?.responsible_name || 'Festa'}</span>${owes(e.id) ? icon('alert', 'ev__warn') : ''}</a>`;
    const preChip = (h) => html`<a class="ev ev--pre" href="#/orcamentos/${h.id}" title="Pré-reserva: ${QUOTE_STATUS[h.status][0]}"><span class="ev__time">${h.start_time ? time(h.start_time) : '—'}</span><span class="ev__name">${h.child_name || h.client?.responsible_name || 'Orçamento'}</span></a>`;

    let body;
    if (mode === 'mes') {
      const month = d0.getMonth();
      body = html`<div class="cal">
        ${WEEK.map((w) => html`<div class="cal__dow">${w}</div>`)}
        ${Array.from({ length: 42 }, (_, i) => {
          const day = addDays(start, i);
          const evs = byDay(day).filter((e) => e.status !== 'cancelada');
          const full = evs.length >= max;
          const dd = new Date(`${day}T12:00:00`);
          return html`<div class="cal__day ${dd.getMonth() !== month ? 'is-out' : ''} ${day === t ? 'is-today' : ''} ${full ? 'is-full' : ''} ${day < t ? 'is-past' : ''}" data-day="${day}">
            <button type="button" class="cal__num" data-open-day="${day}" aria-label="${dateLong(day)}">${dd.getDate()}</button>
            ${full ? html`<span class="cal__full" title="Data lotada">Lotado</span>` : ''}
            <div class="cal__evs">${byDay(day).map(evChip)}${preByDay(day).map(preChip)}</div>
          </div>`;
        })}</div>`;
    } else if (mode === 'semana') {
      body = html`<div class="week">${Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i);
        const evs = byDay(day), pr = preByDay(day);
        return html`<div class="week__col ${day === t ? 'is-today' : ''}">
          <button type="button" class="week__head" data-open-day="${day}"><span>${WEEK[i]}</span><strong>${day.slice(8)}</strong></button>
          ${evs.length || pr.length ? html`${evs.map((e) => html`<a class="week__ev ev--${e.status}" href="#/festas/${e.id}"><strong>${time(e.start_time)}–${time(e.end_time)}</strong><span>${e.child_name || 'Festa'}</span><small>${e.client?.responsible_name || ''}${e.guests ? ` · ${e.guests} conv.` : ''}</small></a>`)}
            ${pr.map((h) => html`<a class="week__ev ev--pre" href="#/orcamentos/${h.id}"><strong>${h.start_time ? time(h.start_time) : '—'}</strong><span>${h.child_name || 'Pré-reserva'}</span><small>${QUOTE_STATUS[h.status][0]}</small></a>`)}`
            : html`<p class="week__free">Livre</p>`}
        </div>`;
      })}</div>`;
    } else {
      const evs = byDay(cursor), pr = preByDay(cursor);
      body = html`<div class="day">
        ${evs.length ? evs.map((e) => html`<a class="day__ev card" href="#/festas/${e.id}">
          <div class="day__time"><strong>${time(e.start_time)}</strong><span>${time(e.end_time)}</span></div>
          <div class="day__main"><h3>${e.child_name || 'Aniversário'}</h3><p class="muted">${e.client?.responsible_name || ''}${e.package_name ? ` · ${e.package_name}` : ''}</p>
            <p>${e.guests ? `${e.guests} convidados` : ''}${can('gerente') ? ` · ${brl(e.contract_value)}` : ''}</p></div>
          <div class="day__side">${badge(EVENT_STATUS, e.status)}${owes(e.id) ? html`<span class="badge badge--red">Pagamento vencido</span>` : ''}</div></a>`)
          : html`<div class="empty empty--sm">${icon('calendar', 'empty__ic')}<h3>Nenhuma festa neste dia</h3><p>Horários livres para novas reservas.</p><a class="btn btn--primary" href="#/orcamentos/novo?data=${cursor}">${icon('plus')}Novo orçamento para esta data</a></div>`}
        ${pr.length ? html`<h4 class="day__sub">Pré-reservas (orçamentos em aberto)</h4>${pr.map((h) => html`<a class="day__ev card day__ev--pre" href="#/orcamentos/${h.id}"><div class="day__time"><strong>${h.start_time ? time(h.start_time) : '—'}</strong></div><div class="day__main"><h3>${h.child_name || 'Orçamento'} <small class="muted">${quoteCode(h)}</small></h3><p class="muted">${h.client?.responsible_name || ''}</p></div><div class="day__side">${badge(QUOTE_STATUS, h.status)}</div></a>`)}` : ''}
      </div>`;
    }

    // Alertas do período visível
    const upcoming = events.filter((e) => e.event_date >= t && e.status !== 'cancelada');
    const soon = upcoming.filter((e) => e.event_date <= addDays(t, 7));
    const waiting = upcoming.filter((e) => e.status === 'aguardando_confirmacao');
    const owing = upcoming.filter((e) => owes(e.id));
    const counts = {}; upcoming.forEach((e) => (counts[e.event_date] = (counts[e.event_date] || 0) + 1));
    const full = Object.keys(counts).filter((d) => counts[d] >= max);

    el.innerHTML = String(html`
      <div class="page-head">
        <div class="cal-nav">
          <button class="icon-btn" type="button" data-nav="-1" aria-label="Anterior">${icon('left')}</button>
          <button class="btn btn--sm btn--ghost" type="button" data-today>Hoje</button>
          <button class="icon-btn" type="button" data-nav="1" aria-label="Próximo">${icon('right')}</button>
          <h2 class="page-h cal-nav__label">${label}</h2>
        </div>
        <div class="seg" role="group" aria-label="Visualização">${[['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia']].map(([k, l]) => html`<button type="button" data-mode="${k}" aria-pressed="${mode === k}">${l}</button>`)}</div>
      </div>
      ${soon.length || waiting.length || owing.length || full.length ? html`<div class="alerts">
        ${soon.length ? html`<span class="alert alert--blue">${icon('party')}<span><strong>${soon.length}</strong> festa${soon.length > 1 ? 's' : ''} nos próximos 7 dias</span></span>` : ''}
        ${waiting.length ? html`<span class="alert alert--yellow">${icon('clock')}<span><strong>${waiting.length}</strong> aguardando confirmação</span></span>` : ''}
        ${owing.length ? html`<span class="alert alert--red">${icon('alert')}<span><strong>${owing.length}</strong> com pagamento vencido</span></span>` : ''}
        ${full.length ? html`<span class="alert alert--purple">${icon('calendar')}<span>Datas lotadas: ${full.map((d) => date(d).slice(0, 5)).join(', ')}</span></span>` : ''}
      </div>` : ''}
      <div class="legend"><span class="ev ev--confirmada">Confirmada</span><span class="ev ev--aguardando_confirmacao">Aguardando</span><span class="ev ev--realizada">Realizada</span><span class="ev ev--pre">Pré-reserva</span><span class="ev ev--cancelada">Cancelada</span></div>
      ${body}`);

    $$('[data-nav]', el).forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.nav);
      if (mode === 'mes') { const d = new Date(`${cursor}T12:00:00`); cursor = iso(new Date(d.getFullYear(), d.getMonth() + n, 1)); }
      else cursor = addDays(cursor, n * (mode === 'semana' ? 7 : 1));
      draw();
    }));
    $('[data-today]', el).addEventListener('click', () => { cursor = today(); draw(); });
    $$('[data-mode]', el).forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; sessionStorage.setItem('agenda-mode', mode); draw(); }));
    $$('[data-open-day]', el).forEach((b) => b.addEventListener('click', () => { cursor = b.dataset.openDay; mode = 'dia'; draw(); }));
  }
  await draw();
}
