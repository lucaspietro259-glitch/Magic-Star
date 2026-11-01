// Documento da proposta. Usado na prévia do painel, no PDF e na página pública.
// Recebe o mesmo formato devolvido por get_public_quote() no banco.
import { html, raw, brl, date, dateLong, time, CATEGORY_SINGULAR, quoteCode } from './ui.js';

const STAR = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l2.9 6.5 7.1.7-5.3 4.8 1.5 7-6.2-3.6-6.2 3.6 1.5-7L2 9l7.1-.7z"/></svg>');

export function renderProposal({ quote: q, client, items = [], installments = [], settings: s = {} }, { acceptSlot = '' } = {}) {
  const end = q.start_time && q.duration_hours ? (() => {
    const [h, m] = String(q.start_time).slice(0, 5).split(':').map(Number);
    const t = h * 60 + m + Math.round(Number(q.duration_hours) * 60);
    return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  })() : '';
  const perGuest = q.guests ? Number(q.total) / Number(q.guests) : 0;
  const entry = installments.find((i) => i.n === 0);
  const parcels = installments.filter((i) => i.n > 0);

  return html`<article class="proposal" data-proposal>
    <header class="proposal__head">
      <div class="proposal__brand">
        ${s.logo_url ? html`<img src="${s.logo_url}" alt="${s.buffet_name}" crossorigin="anonymous">` : html`<span class="proposal__badge">${STAR}</span>`}
        <div><strong>${s.buffet_name || 'Buffet'}</strong><small>${s.address || ''}</small></div>
      </div>
      <div class="proposal__code"><span>Proposta</span><strong>${quoteCode(q)}</strong><small>Emitida em ${date(q.created_at)}</small></div>
    </header>

    <section class="proposal__hero">
      <p class="proposal__kicker">Proposta de festa para</p>
      <h1>${q.child_name ? `Aniversário de ${q.child_name}` : 'Festa de aniversário'}${q.child_age ? html` <span>· ${q.child_age}</span>` : ''}</h1>
      <p class="proposal__to">Preparada para <strong>${client?.responsible_name || ''}</strong></p>
      ${s.quote_intro ? html`<p class="proposal__intro">${s.quote_intro}</p>` : ''}
    </section>

    <dl class="proposal__facts">
      <div><dt>Data</dt><dd>${q.event_date ? dateLong(q.event_date) : 'A definir'}</dd></div>
      <div><dt>Horário</dt><dd>${q.start_time ? `${time(q.start_time)}${end ? ` às ${end}` : ''}` : 'A definir'}</dd></div>
      <div><dt>Convidados</dt><dd>${q.guests || 'A definir'}</dd></div>
      ${q.theme ? html`<div><dt>Tema</dt><dd>${q.theme}</dd></div>` : ''}
    </dl>

    <section class="proposal__block">
      <h2>O que está incluído</h2>
      <table class="proposal__items">
        <thead><tr><th>Item</th><th class="num">Qtd.</th><th class="num">Valor unit.</th><th class="num">Total</th></tr></thead>
        <tbody>${items.map((i) => html`<tr>
          <td><span class="proposal__cat">${CATEGORY_SINGULAR[i.category] || ''}</span><strong>${i.description}</strong>${i.details ? html`<small>${i.details}</small>` : ''}</td>
          <td class="num">${Number(i.quantity).toLocaleString('pt-BR')}</td><td class="num">${brl(i.unit_price)}</td><td class="num">${brl(i.total ?? i.quantity * i.unit_price)}</td></tr>`)}</tbody>
      </table>
      <dl class="proposal__totals">
        <div><dt>Subtotal</dt><dd>${brl(q.subtotal)}</dd></div>
        ${Number(q.discount_amount) ? html`<div class="neg"><dt>Desconto</dt><dd>− ${brl(q.discount_amount)}</dd></div>` : ''}
        ${Number(q.fees_value) ? html`<div><dt>${q.fees_description || 'Taxas adicionais'}</dt><dd>+ ${brl(q.fees_value)}</dd></div>` : ''}
        <div class="total"><dt>Valor total</dt><dd>${brl(q.total)}</dd></div>
        ${perGuest ? html`<div class="small"><dt>Equivale a</dt><dd>${brl(perGuest)} por convidado</dd></div>` : ''}
      </dl>
    </section>

    <section class="proposal__block proposal__pay">
      <h2>Condições de pagamento</h2>
      ${installments.length ? html`<ul class="proposal__inst">
        ${entry ? html`<li><span>Entrada</span><span>${entry.due_date ? date(entry.due_date) : 'Na reserva'}</span><strong>${brl(entry.amount)}</strong></li>` : ''}
        ${parcels.map((p) => html`<li><span>Parcela ${p.n} de ${parcels.length}</span><span>${date(p.due_date)}</span><strong>${brl(p.amount)}</strong></li>`)}
      </ul>` : html`<p>A combinar.</p>`}
      ${q.payment_methods?.length ? html`<p><strong>Formas de pagamento:</strong> ${q.payment_methods.join(', ')}.</p>` : ''}
      ${q.payment_notes ? html`<p>${q.payment_notes}</p>` : ''}
    </section>

    ${q.notes ? html`<section class="proposal__block"><h2>Observações</h2><p class="pre">${q.notes}</p></section>` : ''}
    ${s.quote_terms ? html`<section class="proposal__block proposal__terms"><h2>Condições gerais</h2><p class="pre">${s.quote_terms}</p></section>` : ''}

    <section class="proposal__validity">${STAR}<span>Proposta válida até <strong>${q.valid_until ? date(q.valid_until) : '—'}</strong>.</span></section>

    <section class="proposal__accept">
      ${acceptSlot || html`<div class="proposal__sign"><span></span><small>Aceite do cliente: ${client?.responsible_name || ''}</small></div><div class="proposal__sign"><span></span><small>Data</small></div>`}
    </section>

    <footer class="proposal__foot">
      ${s.quote_footer ? html`<p>${s.quote_footer}</p>` : ''}
      <p>${[s.phone && `WhatsApp ${s.phone}`, s.instagram, s.email, s.document && `${s.legal_name ? `${s.legal_name} · ` : ''}${s.document}`].filter(Boolean).join('  ·  ')}</p>
    </footer>
  </article>`;
}

// PDF de verdade (arquivo), gerado no navegador
let pdfLib;
export async function downloadPDF(element, filename) {
  pdfLib ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js';
    s.onload = () => resolve(window.html2pdf); s.onerror = () => { pdfLib = null; reject(new Error('Não foi possível carregar o gerador de PDF. Verifique a internet ou use "Imprimir" → "Salvar como PDF".')); };
    document.head.append(s);
  });
  const html2pdf = await pdfLib;
  element.classList.add('is-pdf');
  try {
    await html2pdf().set({
      margin: [8, 8, 10, 8], filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.proposal__block h2', '.proposal__totals', '.proposal__inst li', '.proposal__accept'] },
    }).from(element).save();
  } finally { element.classList.remove('is-pdf'); }
}
