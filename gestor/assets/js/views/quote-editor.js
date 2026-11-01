// Editor de orçamento: cliente, festa, itens, descontos, pagamento, envio e conversão em festa.
import { sb, q, rpc } from '../supabase.js';
import { can, state, loadSettings } from '../auth.js';
import { setTitle, go, dirty } from '../app.js';
import {
  $, $$, html, raw, icon, brl, date, dateTime, time, today, addDays, addMonths, round2, badge, modal, toast, fail, confirmDialog, emptyState,
  QUOTE_STATUS, CATEGORIES, CATEGORY_SINGULAR, UNITS, LOSS_REASONS, optionList, quoteCode, esc,
} from '../ui.js';
import { editClient } from '../client-form.js';
import { calcQuote, buildInstallments, sendWhatsApp, sendEmail, copyLink, markSent } from '../quote-utils.js';

const QUOTE_FIELDS = ['client_id', 'status', 'child_name', 'child_age', 'theme', 'event_date', 'start_time', 'duration_hours', 'guests',
  'discount_type', 'discount_value', 'fees_value', 'fees_description', 'down_payment', 'installments', 'payment_methods', 'payment_notes',
  'notes', 'internal_notes', 'valid_until', 'loss_reason'];

export default async function quoteEditor(el, { args: [id], params }) {
  const settings = await loadSettings();
  const isNew = !id;
  let quote, items = [], installments = [], client = null, event = null, log = [], versions = [];

  if (isNew) {
    quote = {
      status: 'em_elaboracao', discount_type: 'valor', discount_value: 0, fees_value: 0, fees_description: '', down_payment: 0, installments: 1,
      payment_methods: [...(settings?.payment_methods || [])], payment_notes: '', notes: '', internal_notes: '', theme: '', child_name: '', child_age: '',
      start_time: (settings?.default_start_time || '14:00').slice(0, 5), duration_hours: settings?.default_duration_hours || 4,
      valid_until: addDays(today(), settings?.quote_validity_days || 15), loss_reason: '',
    };
    if (params.cliente) {
      client = await q(sb.from('clients').select('*').eq('id', params.cliente).maybeSingle());
      if (client) Object.assign(quote, { client_id: client.id, child_name: client.child_name, child_age: client.child_age, event_date: client.desired_date, guests: client.guests });
    }
    if (params.data) quote.event_date = params.data;
  } else {
    quote = await q(sb.from('quotes').select('*').eq('id', id).maybeSingle());
    if (!quote) { el.innerHTML = String(emptyState('Orçamento não encontrado', 'Ele pode ter sido excluído.', html`<a class="btn" href="#/orcamentos">Voltar</a>`)); return; }
    const root = quote.root_id || quote.id;
    [items, installments, client, event, log, versions] = await Promise.all([
      q(sb.from('quote_items').select('*').eq('quote_id', id).order('position')),
      q(sb.from('quote_installments').select('n, due_date, amount').eq('quote_id', id).order('n')),
      q(sb.from('clients').select('*').eq('id', quote.client_id).maybeSingle()),
      q(sb.from('events').select('id, status').eq('quote_id', id).maybeSingle()),
      q(sb.from('quote_history').select('*, user:profiles(full_name, email)').eq('quote_id', id).order('created_at', { ascending: false })),
      q(sb.from('quotes').select('id, number, version, status, total, created_at').or(`id.eq.${root},root_id.eq.${root}`).order('version')),
    ]);
    quote.start_time = quote.start_time ? quote.start_time.slice(0, 5) : '';
  }
  items = items.map((i) => ({ ...i, _k: crypto.randomUUID() }));
  let manualInstallments = !isNew && installments.length > 0;
  // Sem data escolhida pelo usuário, as parcelas terminam 7 dias antes da festa
  let firstDueTouched = installments.some((i) => i.n === 1);
  const autoFirstDue = () => {
    const n = Math.max(1, Number(quote.installments) || 1);
    const min = addDays(today(), 7);
    if (!quote.event_date) return addDays(today(), 30);
    const fd = addMonths(addDays(quote.event_date, -7), -(n - 1));
    return fd < min ? min : fd;
  };
  let firstDue = installments.find((i) => i.n === 1)?.due_date || autoFirstDue();
  let downDue = installments.find((i) => i.n === 0)?.due_date || today();
  if (!installments.length) installments = buildInstallments(calcQuote(quote, items).total, quote.down_payment, quote.installments, firstDue, downDue);

  const locked = ['aprovado'].includes(quote.status) && !!event;
  const title = isNew ? 'Novo orçamento' : quoteCode(quote);
  setTitle(title);
  dirty.set(false);
  const markDirty = () => { dirty.set(true); $('[data-save]', el)?.classList.add('is-pulse'); };

  /* ---------------- Layout ---------------- */
  el.innerHTML = String(html`
    <a class="back" href="#/orcamentos">${icon('left')}Orçamentos</a>
    <div class="page-head">
      <div><h2 class="page-h">${title}${quote.version > 1 ? html` <span class="muted">· versão ${quote.version}</span>` : ''}</h2>
        ${!isNew ? html`<p class="muted">Criado em ${dateTime(quote.created_at)}${quote.accepted_name ? html` · <strong class="text-green">Aceito online por ${quote.accepted_name}</strong>` : ''}</p>` : ''}</div>
      <div class="status-pick">
        <label for="q-status" class="muted">Status</label>
        <select id="q-status" data-status ${locked ? raw('disabled') : ''}>${Object.entries(QUOTE_STATUS).map(([k, [l]]) => html`<option value="${k}" ${k === quote.status ? raw('selected') : ''}>${l}</option>`)}</select>
      </div>
    </div>
    ${locked ? html`<div class="alert alert--green alert--block">${icon('check')}<span>Este orçamento já virou festa. Para mudar valores, edite a festa ou crie uma nova versão.</span></div>` : ''}

    <div class="editor">
      <form class="editor__main" data-form novalidate>
        <fieldset ${locked ? raw('disabled') : ''} class="stack-lg">
        <section class="card">
          <header class="card__head"><h3><span class="step-n">1</span>Cliente</h3></header>
          <div data-client></div>
        </section>

        <section class="card">
          <header class="card__head"><h3><span class="step-n">2</span>A festa</h3><span data-availability></span></header>
          <div class="form-grid form-grid--3">
            <div class="field"><label for="q-child">Nome da criança</label><input id="q-child" name="child_name" value="${quote.child_name || ''}"></div>
            <div class="field"><label for="q-age">Idade que vai completar</label><input id="q-age" name="child_age" value="${quote.child_age || ''}" placeholder="Ex.: 5 anos"></div>
            <div class="field"><label for="q-theme">Tema</label><input id="q-theme" name="theme" value="${quote.theme || ''}" list="themes" placeholder="Ex.: Super-heróis"><datalist id="themes" data-themes></datalist></div>
            <div class="field"><label for="q-date">Data da festa</label><input id="q-date" name="event_date" type="date" value="${quote.event_date || ''}"></div>
            <div class="field"><label for="q-start">Início</label><input id="q-start" name="start_time" type="time" value="${quote.start_time || ''}"></div>
            <div class="field"><label for="q-dur">Duração (horas)</label><input id="q-dur" name="duration_hours" type="number" min="0.5" max="24" step="0.5" value="${quote.duration_hours ?? ''}"></div>
            <div class="field"><label for="q-guests">Convidados</label><input id="q-guests" name="guests" type="number" min="1" max="5000" inputmode="numeric" value="${quote.guests ?? ''}"></div>
          </div>
        </section>

        <section class="card">
          <header class="card__head"><h3><span class="step-n">3</span>Itens e serviços</h3>
            <div class="card__actions"><button class="btn btn--sm" type="button" data-catalog>${icon('box')}Do catálogo</button><button class="btn btn--sm btn--ghost" type="button" data-custom>${icon('plus')}Item personalizado</button></div></header>
          <div data-items></div>
        </section>

        <section class="card">
          <header class="card__head"><h3><span class="step-n">4</span>Descontos e taxas</h3></header>
          <div class="form-grid form-grid--3">
            <div class="field"><label for="q-dt">Tipo de desconto</label><select id="q-dt" name="discount_type"><option value="valor" ${quote.discount_type === 'valor' ? raw('selected') : ''}>Valor (R$)</option><option value="percentual" ${quote.discount_type === 'percentual' ? raw('selected') : ''}>Percentual (%)</option></select></div>
            <div class="field"><label for="q-dv">Desconto</label><input id="q-dv" name="discount_value" type="number" min="0" step="0.01" inputmode="decimal" value="${quote.discount_value || ''}" placeholder="0"></div>
            <div class="field"></div>
            <div class="field"><label for="q-fv">Taxas adicionais (R$)</label><input id="q-fv" name="fees_value" type="number" min="0" step="0.01" inputmode="decimal" value="${quote.fees_value || ''}" placeholder="0"></div>
            <div class="field field--span2"><label for="q-fd">Descrição das taxas</label><input id="q-fd" name="fees_description" value="${quote.fees_description || ''}" placeholder="Ex.: Taxa de serviço, hora extra"></div>
          </div>
        </section>

        <section class="card">
          <header class="card__head"><h3><span class="step-n">5</span>Condições de pagamento</h3></header>
          <div class="form-grid form-grid--3">
            <div class="field"><label for="q-down">Entrada (R$)</label><input id="q-down" name="down_payment" type="number" min="0" step="0.01" inputmode="decimal" value="${quote.down_payment || ''}" placeholder="0"></div>
            <div class="field"><label for="q-downdue">Vencimento da entrada</label><input id="q-downdue" name="_down_due" type="date" value="${downDue || ''}"></div>
            <div class="field"><label for="q-inst">Parcelas (após a entrada)</label><input id="q-inst" name="installments" type="number" min="0" max="48" inputmode="numeric" value="${quote.installments ?? 1}"></div>
            <div class="field"><label for="q-first">1º vencimento das parcelas</label><input id="q-first" name="_first_due" type="date" value="${firstDue || ''}"></div>
            <div class="field field--span2"><span class="label">Formas de pagamento</span>
              <div class="checks">${(settings?.payment_methods || []).map((m) => html`<label class="check"><input type="checkbox" name="payment_methods" data-multi value="${m}" ${quote.payment_methods?.includes(m) ? raw('checked') : ''}>${m}</label>`)}</div></div>
          </div>
          <div data-installments></div>
          <div class="field"><label for="q-pn">Observações comerciais</label><textarea id="q-pn" name="payment_notes" rows="2" placeholder="Ex.: Parcelas no cartão sem juros; Pix com 5% de desconto">${quote.payment_notes || ''}</textarea></div>
        </section>

        <section class="card">
          <header class="card__head"><h3><span class="step-n">6</span>Proposta</h3></header>
          <div class="form-grid">
            <div class="field"><label for="q-valid">Válida até</label><input id="q-valid" name="valid_until" type="date" value="${quote.valid_until || ''}"></div>
            <div class="field" data-loss ${quote.status === 'recusado' ? '' : raw('hidden')}><label for="q-loss">Motivo da perda</label><select id="q-loss" name="loss_reason">${optionList(LOSS_REASONS, quote.loss_reason)}</select></div>
            <div class="field field--full"><label for="q-notes">Observações para o cliente</label><textarea id="q-notes" name="notes" rows="3" placeholder="Aparece na proposta">${quote.notes || ''}</textarea></div>
            <div class="field field--full"><label for="q-int">Anotações internas</label><textarea id="q-int" name="internal_notes" rows="2" placeholder="Só a equipe vê">${quote.internal_notes || ''}</textarea></div>
          </div>
        </section>
        </fieldset>

        ${!isNew ? html`<section class="card">
          <header class="card__head"><h3>Histórico de alterações</h3>${versions.length > 1 ? html`<span class="muted">${versions.length} versões</span>` : ''}</header>
          ${versions.length > 1 ? html`<div class="versions">${versions.map((v) => html`<a class="chip ${v.id === quote.id ? 'is-current' : ''}" href="#/orcamentos/${v.id}">v${v.version} · ${brl(v.total)} · ${QUOTE_STATUS[v.status][0]}</a>`)}</div>` : ''}
          <ol class="timeline">${log.map((h) => html`<li><span class="timeline__dot"></span><div><strong>${h.action}</strong> <small class="muted">${dateTime(h.created_at)}${h.user ? ` · ${h.user.full_name || h.user.email}` : ''}</small>${h.details ? html`<p>${h.details.replace(/\b(em_elaboracao|enviado|aguardando_resposta|em_negociacao|aprovado|recusado|expirado)\b/g, (k) => QUOTE_STATUS[k][0])}</p>` : ''}</div></li>`)}</ol>
        </section>` : ''}
      </form>

      <aside class="editor__aside">
        <div class="summary card" data-summary></div>
      </aside>
    </div>`);

  const form = $('[data-form]', el);

  /* ---------------- Cliente ---------------- */
  const drawClient = () => {
    const box = $('[data-client]', el);
    if (client) {
      box.innerHTML = String(html`<div class="picked">
        <span class="avatar">${client.responsible_name.charAt(0).toUpperCase()}</span>
        <div><strong>${client.responsible_name}</strong><small class="muted block">${client.phone}${client.email ? ` · ${client.email}` : ''}</small></div>
        <a class="btn btn--sm btn--ghost" href="#/clientes/${client.id}">Ver ficha</a>
        ${!locked ? html`<button class="btn btn--sm btn--ghost" type="button" data-change-client>Trocar</button>` : ''}</div>`);
      $('[data-change-client]', box)?.addEventListener('click', () => { client = null; quote.client_id = null; markDirty(); drawClient(); });
      return;
    }
    box.innerHTML = String(html`<div class="client-search">
      <label class="search">${icon('search')}<input type="search" placeholder="Buscar cliente por nome ou telefone" data-csearch aria-label="Buscar cliente"></label>
      <button class="btn btn--primary" type="button" data-cnew>${icon('plus')}Cadastrar novo cliente</button>
      <ul class="results" data-cresults></ul></div>`);
    let t;
    $('[data-csearch]', box).addEventListener('input', (e) => {
      clearTimeout(t);
      const term = e.target.value.trim().replace(/[%,()]/g, ' ');
      t = setTimeout(async () => {
        const ul = $('[data-cresults]', box);
        if (term.length < 2) { ul.innerHTML = ''; return; }
        const rows = await q(sb.from('clients').select('*').or(`responsible_name.ilike.%${term}%,phone.ilike.%${term}%,child_name.ilike.%${term}%`).limit(8)).catch(fail);
        ul.innerHTML = String(html`${(rows || []).map((c) => html`<li><button type="button" data-pick="${c.id}"><strong>${c.responsible_name}</strong><small>${c.phone}${c.child_name ? ` · ${c.child_name}` : ''}</small></button></li>`)}${rows?.length ? '' : html`<li class="muted">Nenhum cliente encontrado.</li>`}`);
        $$('[data-pick]', ul).forEach((b) => b.addEventListener('click', () => pickClient(rows.find((c) => c.id === b.dataset.pick))));
      }, 220);
    });
    $('[data-cnew]', box).addEventListener('click', async () => { const c = await editClient(); if (c) pickClient(c); });
  };
  const pickClient = (c) => {
    client = c; quote.client_id = c.id;
    const setIfEmpty = (name, v) => { const inp = form.elements[name]; if (inp && !inp.value && v) { inp.value = v; quote[name] = v; } };
    setIfEmpty('child_name', c.child_name); setIfEmpty('child_age', c.child_age); setIfEmpty('event_date', c.desired_date); setIfEmpty('guests', c.guests);
    markDirty(); drawClient(); checkAvailability(); update();
  };

  /* ---------------- Itens ---------------- */
  const drawItems = () => {
    const box = $('[data-items]', el);
    if (!items.length) { box.innerHTML = String(html`<div class="items-empty">${icon('layers')}<p>Adicione pacotes, cardápios, decoração e serviços do catálogo ou crie itens personalizados.</p></div>`); return; }
    box.innerHTML = String(html`<div class="items">
      <div class="items__head"><span>Item</span><span>Qtd.</span><span>Valor unit.</span><span class="num">Total</span><span></span></div>
      ${items.map((it, i) => html`<div class="item" data-k="${it._k}">
        <div class="item__desc">
          <select name="category" aria-label="Categoria">${Object.entries(CATEGORY_SINGULAR).map(([k, l]) => html`<option value="${k}" ${k === it.category ? raw('selected') : ''}>${l}</option>`)}</select>
          <input name="description" value="${it.description}" placeholder="Descrição do item" aria-label="Descrição">
          <input name="details" value="${it.details || ''}" placeholder="Detalhes (opcional)" aria-label="Detalhes" class="item__details">
        </div>
        <input name="quantity" type="number" min="0.01" step="any" inputmode="decimal" value="${it.quantity}" aria-label="Quantidade">
        <input name="unit_price" type="number" min="0" step="0.01" inputmode="decimal" value="${it.unit_price}" aria-label="Valor unitário">
        <strong class="num" data-line>${brl(round2(it.quantity * it.unit_price))}</strong>
        <div class="item__tools">
          <button type="button" class="icon-btn icon-btn--sm" data-move="-1" aria-label="Subir" ${i === 0 ? raw('disabled') : ''}>${icon('up')}</button>
          <button type="button" class="icon-btn icon-btn--sm" data-move="1" aria-label="Descer" ${i === items.length - 1 ? raw('disabled') : ''}>${icon('down')}</button>
          <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-remove aria-label="Remover item">${icon('trash')}</button>
        </div>
      </div>`)}</div>`);
    $$('.item', box).forEach((row) => {
      const it = items.find((x) => x._k === row.dataset.k);
      $$('input, select', row).forEach((inp) => inp.addEventListener('input', () => {
        it[inp.name] = ['quantity', 'unit_price'].includes(inp.name) ? Number(inp.value) || 0 : inp.value;
        $('[data-line]', row).textContent = brl(round2(it.quantity * it.unit_price));
        markDirty(); update();
      }));
      $('[data-remove]', row).addEventListener('click', () => { items = items.filter((x) => x !== it); markDirty(); drawItems(); update(); });
      $$('[data-move]', row).forEach((b) => b.addEventListener('click', () => {
        const i = items.indexOf(it), j = i + Number(b.dataset.move);
        [items[i], items[j]] = [items[j], items[i]]; markDirty(); drawItems();
      }));
    });
  };
  const addItem = (it) => { items.push({ _k: crypto.randomUUID(), category: 'personalizado', description: '', details: '', quantity: 1, unit_price: 0, ...it }); markDirty(); drawItems(); update(); };

  $('[data-custom]', el).addEventListener('click', () => { addItem({}); $$('.item [name=description]', el).at(-1)?.focus(); });
  $('[data-catalog]', el).addEventListener('click', openCatalog);

  async function openCatalog() {
    const catalog = await q(sb.from('catalog_items').select('*').eq('available', true).order('category').order('name')).catch(fail);
    if (!catalog) return;
    if (!catalog.length) {
      return modal({ title: 'Catálogo vazio', body: String(html`<p>Ainda não há pacotes ou serviços cadastrados.</p>${can('gerente') ? html`<p>Cadastre em <a href="#/catalogo">Pacotes e serviços</a> e eles aparecem aqui com o preço pronto.</p>` : html`<p>Peça a um gerente para cadastrar o catálogo.</p>`}`), actions: [{ label: 'Entendi', cls: 'btn--primary' }] });
    }
    let added = 0;
    const guests = Number(form.elements.guests.value) || 1;
    const hours = Number(form.elements.duration_hours.value) || 1;
    await modal({
      title: 'Adicionar do catálogo', size: 'modal--lg',
      body: String(html`<label class="search">${icon('search')}<input type="search" placeholder="Buscar no catálogo" data-cat-search aria-label="Buscar no catálogo"></label>
        <div class="catalog-pick" data-cat-list>${Object.entries(CATEGORIES).map(([cat, label]) => {
          const list = catalog.filter((c) => c.category === cat);
          return list.length ? html`<h4>${label}</h4>${list.map((c) => html`<button type="button" class="pick" data-add="${c.id}" data-name="${c.name.toLowerCase()} ${(c.description || '').toLowerCase()}">
            ${c.image_url ? html`<img src="${c.image_url}" alt="" loading="lazy">` : html`<span class="pick__ic">${icon('box')}</span>`}
            <span class="pick__main"><strong>${c.name}</strong><small>${c.description || ''}</small></span>
            <span class="pick__price">${brl(c.price)}<small>${UNITS[c.unit]}</small></span><span class="pick__add">${icon('plus')}</span></button>`)}` : '';
        })}</div><p class="muted" data-added>Clique nos itens para adicionar. A quantidade usa o nº de convidados (${guests}) ou a duração (${hours}h) quando o preço é por convidado ou por hora.</p>`),
      onOpen: ({ el: m }) => {
        $('[data-cat-search]', m).addEventListener('input', (e) => {
          const t = e.target.value.toLowerCase();
          $$('[data-add]', m).forEach((b) => (b.hidden = t && !b.dataset.name.includes(t)));
        });
        $$('[data-add]', m).forEach((b) => b.addEventListener('click', () => {
          const c = catalog.find((x) => x.id === b.dataset.add);
          addItem({ catalog_item_id: c.id, category: c.category, description: c.name, details: c.description || '', unit_price: Number(c.price), quantity: c.unit === 'convidado' ? guests : c.unit === 'hora' ? hours : 1 });
          added++; b.classList.add('is-added');
          $('[data-added]', m).textContent = `${added} ${added === 1 ? 'item adicionado' : 'itens adicionados'}.`;
        }));
      },
      actions: [{ label: 'Concluir', cls: 'btn--primary' }],
    });
  }

  /* ---------------- Parcelas ---------------- */
  const drawInstallments = () => {
    const box = $('[data-installments]', el);
    const { total } = calcQuote(quote, items);
    const sum = round2(installments.reduce((s, i) => s + Number(i.amount), 0));
    box.innerHTML = String(html`${installments.length ? html`<div class="inst">
      ${installments.map((r, i) => html`<div class="inst__row" data-i="${i}"><span>${r.n === 0 ? 'Entrada' : `Parcela ${r.n}`}</span>
        <input type="date" name="due_date" value="${r.due_date || ''}" aria-label="Vencimento">
        <input type="number" name="amount" min="0" step="0.01" inputmode="decimal" value="${r.amount}" aria-label="Valor"></div>`)}
      </div>` : ''}
      <p class="inst__foot ${Math.abs(sum - total) > 0.009 ? 'text-red' : 'muted'}">
        ${installments.length ? `Soma: ${brl(sum)}${Math.abs(sum - total) > 0.009 ? ` · diferente do total (${brl(total)})` : ' · confere com o total'}` : 'Sem parcelas definidas.'}
        ${manualInstallments || firstDueTouched ? html` <button type="button" class="link" data-regen>Recalcular automaticamente</button>` : ''}</p>
      ${quote.event_date && installments.some((r) => r.due_date && r.due_date > quote.event_date) ? html`<p class="alert alert--yellow alert--block">${icon('alert')}<span>Há parcela vencendo depois da festa (${date(quote.event_date)}). Ajuste o 1º vencimento ou o número de parcelas.</span></p>` : ''}`);
    $$('.inst__row', box).forEach((row) => $$('input', row).forEach((inp) => inp.addEventListener('input', () => {
      const r = installments[+row.dataset.i];
      r[inp.name] = inp.name === 'amount' ? Number(inp.value) || 0 : inp.value;
      manualInstallments = true; markDirty(); drawInstallmentsFoot();
    })));
    $('[data-regen]', box)?.addEventListener('click', () => { manualInstallments = false; firstDueTouched = false; markDirty(); regen(); });
  };
  const drawInstallmentsFoot = () => { const f = $('.inst__foot', el); const { total } = calcQuote(quote, items); const sum = round2(installments.reduce((s, i) => s + Number(i.amount), 0)); f.classList.toggle('text-red', Math.abs(sum - total) > 0.009); f.firstChild.textContent = `Soma: ${brl(sum)}${Math.abs(sum - total) > 0.009 ? ` · diferente do total (${brl(total)})` : ' · confere com o total'} `; renderSummary(); };
  const regen = () => {
    const { total } = calcQuote(quote, items);
    if (!firstDueTouched) { firstDue = autoFirstDue(); if (form.elements._first_due) form.elements._first_due.value = firstDue; }
    installments = buildInstallments(total, Number(quote.down_payment) || 0, Number(quote.installments) || 0, firstDue, downDue);
    drawInstallments(); renderSummary();
  };

  /* ---------------- Resumo lateral ---------------- */
  function renderSummary() {
    const c = calcQuote(quote, items);
    const box = $('[data-summary]', el);
    const saved = !isNew;
    const eventCan = saved && can('gerente') && !event && !['recusado', 'expirado'].includes(quote.status);
    box.innerHTML = String(html`
      <h3>Resumo</h3>
      <dl class="sum">
        <div><dt>Subtotal <small>${items.length} ${items.length === 1 ? 'item' : 'itens'}</small></dt><dd>${brl(c.subtotal)}</dd></div>
        ${c.discount ? html`<div class="sum__neg"><dt>Desconto${quote.discount_type === 'percentual' ? ` (${quote.discount_value}%)` : ''}</dt><dd>− ${brl(c.discount)}</dd></div>` : ''}
        ${c.fees ? html`<div><dt>Taxas adicionais</dt><dd>+ ${brl(c.fees)}</dd></div>` : ''}
        <div class="sum__total"><dt>Total</dt><dd>${brl(c.total)}</dd></div>
        ${c.perGuest ? html`<div class="sum__small"><dt>Por convidado</dt><dd>${brl(c.perGuest)}</dd></div>` : ''}
        ${installments.length ? html`<div class="sum__small"><dt>Pagamento</dt><dd>${installments.some((i) => i.n === 0) ? `Entrada ${brl(installments.find((i) => i.n === 0).amount)}` : ''}${installments.filter((i) => i.n > 0).length ? `${installments.some((i) => i.n === 0) ? ' + ' : ''}${installments.filter((i) => i.n > 0).length}× ${brl(installments.find((i) => i.n > 0).amount)}` : ''}</dd></div>` : ''}
      </dl>
      ${!locked ? html`<button class="btn btn--primary btn--block btn--lg" type="button" data-save>${icon('check')}${isNew ? 'Salvar orçamento' : 'Salvar alterações'}</button>` : ''}
      ${saved ? html`<div class="sum__actions">
        <a class="btn btn--block" href="#/orcamentos/${quote.id}/previa">${icon('eye')}Ver proposta e PDF</a>
        <button class="btn btn--block btn--wa" type="button" data-wa>${icon('whatsapp')}Enviar por WhatsApp</button>
        <div class="btn-row">
          <button class="btn btn--ghost" type="button" data-mail>${icon('mail')}E-mail</button>
          <button class="btn btn--ghost" type="button" data-link>${icon('link')}Copiar link</button>
        </div>
        <div class="btn-row">
          <button class="btn btn--ghost" type="button" data-dup>${icon('copy')}Duplicar</button>
          <button class="btn btn--ghost" type="button" data-version>${icon('layers')}Nova versão</button>
        </div>
        ${event ? html`<a class="btn btn--block btn--success" href="#/festas/${event.id}">${icon('party')}Ver festa confirmada</a>`
          : eventCan ? html`<button class="btn btn--block btn--success" type="button" data-convert>${icon('party')}Aprovar e confirmar festa</button>` : ''}
        ${can('admin') && !event ? html`<button class="btn btn--block btn--ghost btn--danger-text" type="button" data-delete>${icon('trash')}Excluir orçamento</button>` : ''}
      </div>` : html`<p class="muted small">Depois de salvar, você pode gerar o PDF, enviar pelo WhatsApp e confirmar a festa.</p>`}`);
    bindSummary();
  }

  function bindSummary() {
    const box = $('[data-summary]', el);
    $('[data-save]', box)?.addEventListener('click', save);
    const needSaved = (fn) => async () => { if (dirty.on) { toast('Salve as alterações antes de enviar.', 'error'); return; } try { await fn(); refreshAfter(); } catch (e) { fail(e); } };
    $('[data-wa]', box)?.addEventListener('click', needSaved(() => { if (!items.length) throw new Error('Adicione itens antes de enviar.'); return sendWhatsApp(quote, client, settings); }));
    $('[data-mail]', box)?.addEventListener('click', needSaved(() => sendEmail(quote, client, settings)));
    $('[data-link]', box)?.addEventListener('click', needSaved(async () => { if (quote.status === 'em_elaboracao') await markSent(quote, 'Link copiado'); await copyLink(quote); }));
    $('[data-dup]', box)?.addEventListener('click', async () => { try { const nid = await rpc('duplicate_quote', { p_quote: quote.id, p_new_version: false }); toast('Orçamento duplicado.'); dirty.set(false); go(`#/orcamentos/${nid}`); } catch (e) { fail(e); } });
    $('[data-version]', box)?.addEventListener('click', async () => { try { const nid = await rpc('duplicate_quote', { p_quote: quote.id, p_new_version: true }); toast('Nova versão criada.'); dirty.set(false); go(`#/orcamentos/${nid}`); } catch (e) { fail(e); } });
    $('[data-convert]', box)?.addEventListener('click', convert);
    $('[data-delete]', box)?.addEventListener('click', async () => {
      if (!(await confirmDialog('Excluir este orçamento e todo o histórico dele? Esta ação não pode ser desfeita.', { danger: true, ok: 'Excluir' }))) return;
      try { await q(sb.from('quotes').delete().eq('id', quote.id)); dirty.set(false); toast('Orçamento excluído.'); go('#/orcamentos'); } catch (e) { fail(e); }
    });
  }
  const refreshAfter = () => { quoteEditor(el, { args: [quote.id], params: {} }); };

  /* ---------------- Atualização geral ---------------- */
  function update() {
    if (!manualInstallments) regen(); else { drawInstallments(); renderSummary(); }
  }

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.closest('.item') || t.closest('.inst__row') || !t.name) return;
    if (t.name === 'payment_methods') quote.payment_methods = $$('[name=payment_methods]', form).filter((x) => x.checked).map((x) => x.value);
    else if (t.name === '_first_due') { firstDue = t.value; firstDueTouched = !!t.value; }
    else if (t.name === '_down_due') downDue = t.value;
    else quote[t.name] = t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value;
    if (['down_payment', 'installments', '_first_due', '_down_due'].includes(t.name)) manualInstallments = false;
    if (t.name === 'event_date' || t.name === 'start_time' || t.name === 'duration_hours') checkAvailability();
    markDirty();
    if (['discount_type', 'discount_value', 'fees_value', 'guests', 'down_payment', 'installments', '_first_due', '_down_due', 'event_date'].includes(t.name)) update();
  });

  // Status: muda na hora (com motivo da perda quando recusado)
  $('[data-status]', el).addEventListener('change', async (e) => {
    const next = e.target.value;
    let loss = quote.loss_reason;
    if (next === 'recusado') {
      loss = await modal({ title: 'Motivo da perda', body: String(html`<p>Por que o cliente não fechou? Isso alimenta o relatório de perdas.</p><div class="field"><select data-loss-pick>${optionList(LOSS_REASONS, quote.loss_reason)}</select></div>`),
        actions: [{ label: 'Cancelar', cls: 'btn--ghost', value: null }, { label: 'Salvar', cls: 'btn--primary', onClick: ({ el: m }) => $('[data-loss-pick]', m).value || 'Não informado' }] });
      if (!loss) { e.target.value = quote.status; return; }
    }
    $('[data-loss]', el).hidden = next !== 'recusado';
    if (form.elements.loss_reason) form.elements.loss_reason.value = next === 'recusado' ? loss : '';
    if (isNew) { quote.status = next; quote.loss_reason = loss; markDirty(); return; }
    try {
      await q(sb.from('quotes').update({ status: next, loss_reason: next === 'recusado' ? loss : quote.loss_reason }).eq('id', quote.id));
      quote.status = next; quote.loss_reason = loss;
      toast(`Status: ${QUOTE_STATUS[next][0]}.`);
      if (next === 'aprovado' && can('gerente') && !event && !dirty.on) {
        if (await confirmDialog('Orçamento aprovado! Quer confirmar a festa na agenda agora?', { title: 'Confirmar festa', ok: 'Confirmar festa' })) return convert();
      }
      renderSummary();
    } catch (err) { fail(err); e.target.value = quote.status; }
  });

  /* ---------------- Disponibilidade da data ---------------- */
  let availTimer;
  function checkAvailability() {
    clearTimeout(availTimer);
    availTimer = setTimeout(async () => {
      const box = $('[data-availability]', el);
      const d = form.elements.event_date.value;
      if (!d) { box.innerHTML = ''; return; }
      const evs = await q(sb.from('events').select('id, start_time, end_time, child_name, quote_id').eq('event_date', d).neq('status', 'cancelada')).catch(() => null);
      if (!evs) return;
      const others = evs.filter((x) => x.quote_id !== quote.id);
      const st = form.elements.start_time.value;
      const dur = Number(form.elements.duration_hours.value) || 0;
      const toMin = (t) => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + m; };
      const conflict = st && dur && others.some((x) => toMin(st) < toMin(x.end_time) && toMin(st) + dur * 60 > toMin(x.start_time));
      const max = settings?.max_events_per_day || 2;
      box.innerHTML = String(!others.length ? html`<span class="badge badge--green">${icon('check')}Data livre</span>`
        : conflict ? html`<span class="badge badge--red" title="${others.map((x) => `${time(x.start_time)}–${time(x.end_time)}`).join(', ')}">${icon('alert')}Conflito de horário</span>`
        : html`<span class="badge badge--${others.length >= max ? 'red' : 'yellow'}">${others.length} festa${others.length > 1 ? 's' : ''} nesse dia: ${others.map((x) => `${time(x.start_time)}–${time(x.end_time)}`).join(', ')}</span>`);
    }, 300);
  }

  /* ---------------- Salvar ---------------- */
  async function save() {
    if (!client) { toast('Escolha ou cadastre o cliente.', 'error'); $('[data-csearch]', el)?.focus(); return; }
    const bad = items.findIndex((i) => !String(i.description).trim() || !(Number(i.quantity) > 0) || Number(i.unit_price) < 0);
    if (bad >= 0) { toast(`Confira o item ${bad + 1}: descrição, quantidade e valor.`, 'error'); $$('.item', el)[bad]?.querySelector('[name=description]')?.focus(); return; }
    if (form.elements.guests.value && (+form.elements.guests.value < 1)) { toast('Número de convidados inválido.', 'error'); return; }
    const btn = $('[data-save]', el);
    btn.disabled = true; btn.classList.add('is-busy');
    try {
      const payload = Object.fromEntries(QUOTE_FIELDS.map((k) => [k, quote[k]]));
      Object.assign(payload, {
        client_id: client.id,
        event_date: quote.event_date || null, start_time: quote.start_time || null,
        duration_hours: quote.duration_hours || null, guests: quote.guests || null,
        discount_value: Number(quote.discount_value) || 0, fees_value: Number(quote.fees_value) || 0,
        down_payment: Number(quote.down_payment) || 0, installments: Number(quote.installments) || 0,
        valid_until: quote.valid_until || null, loss_reason: quote.status === 'recusado' ? (form.elements.loss_reason.value || quote.loss_reason || '') : '',
      });
      const saved = isNew
        ? await q(sb.from('quotes').insert(payload).select().single())
        : await q(sb.from('quotes').update(payload).eq('id', quote.id).select().single());
      const qid = saved.id;
      await q(sb.from('quote_items').delete().eq('quote_id', qid));
      if (items.length) await q(sb.from('quote_items').insert(items.map((it, i) => ({
        quote_id: qid, catalog_item_id: it.catalog_item_id || null, category: it.category, description: String(it.description).trim(),
        details: it.details || '', quantity: Number(it.quantity), unit_price: Number(it.unit_price), position: i,
      }))));
      await q(sb.from('quote_installments').delete().eq('quote_id', qid));
      if (installments.length) await q(sb.from('quote_installments').insert(installments.map((r) => ({ quote_id: qid, n: r.n, due_date: r.due_date || null, amount: Number(r.amount) || 0 }))));
      const fresh = await q(sb.from('quotes').select('total').eq('id', qid).single());
      await q(sb.from('quote_history').insert({ quote_id: qid, action: isNew ? 'Itens adicionados' : 'Orçamento editado', details: `${items.length} ${items.length === 1 ? 'item' : 'itens'} · total ${brl(fresh.total)}` }));
      dirty.set(false);
      toast('Orçamento salvo.');
      if (isNew) { history.replaceState(null, '', `#/orcamentos/${qid}`); }
      quoteEditor(el, { args: [qid], params: {} });
    } catch (e) { fail(e); btn.disabled = false; btn.classList.remove('is-busy'); }
  }

  /* ---------------- Confirmar festa ---------------- */
  async function convert() {
    if (dirty.on) { toast('Salve as alterações antes de confirmar a festa.', 'error'); return; }
    if (!quote.event_date) { toast('Defina a data da festa e salve antes de confirmar.', 'error'); form.elements.event_date.focus(); return; }
    const st = (quote.start_time || settings?.default_start_time || '14:00').slice(0, 5);
    const durMin = Math.round((Number(quote.duration_hours) || Number(settings?.default_duration_hours) || 4) * 60);
    const [h, m] = st.split(':').map(Number);
    const endMin = Math.min(h * 60 + m + durMin, 23 * 60 + 59);
    const en = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    const evs = await q(sb.from('events').select('start_time, end_time, child_name').eq('event_date', quote.event_date).neq('status', 'cancelada')).catch(() => []);
    const id2 = await modal({
      title: 'Confirmar festa na agenda',
      body: String(html`<p>A festa de <strong>${quote.child_name || client.responsible_name}</strong> será criada em <strong>${date(quote.event_date)}</strong>, com a ficha, o checklist e os pagamentos já preenchidos a partir deste orçamento.</p>
        <div class="form-grid"><div class="field"><label for="cv-st">Início</label><input id="cv-st" type="time" value="${st}" data-cv-st></div><div class="field"><label for="cv-en">Término</label><input id="cv-en" type="time" value="${en}" data-cv-en></div></div>
        ${evs.length ? html`<p class="alert alert--yellow alert--block">${icon('calendar')}<span>Já reservado nesse dia: ${evs.map((x) => `${time(x.start_time)}–${time(x.end_time)} (${x.child_name || 'festa'})`).join(', ')}</span></p>` : html`<p class="muted">Nenhuma outra festa nesse dia.</p>`}`),
      actions: [{ label: 'Cancelar', cls: 'btn--ghost', value: null }, {
        label: 'Confirmar festa', cls: 'btn--success',
        onClick: async ({ el: m }) => rpc('convert_quote_to_event', { p_quote: quote.id, p_start: $('[data-cv-st]', m).value, p_end: $('[data-cv-en]', m).value }),
      }],
    });
    if (id2) { toast('Festa confirmada na agenda!'); go(`#/festas/${id2}`); }
  }

  // Temas sugeridos a partir do catálogo
  q(sb.from('catalog_items').select('name').eq('category', 'tema').eq('available', true)).then((rows) => {
    $('[data-themes]', el).innerHTML = String(html`${rows.map((r) => html`<option value="${r.name}">`)}`);
  }).catch(() => {});

  drawClient(); drawItems(); drawInstallments(); renderSummary(); checkAvailability();
  if (isNew && client) markDirty();
}
