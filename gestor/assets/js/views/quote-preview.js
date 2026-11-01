// Prévia da proposta com PDF, impressão e compartilhamento.
import { sb, q } from '../supabase.js';
import { loadSettings } from '../auth.js';
import { setTitle } from '../app.js';
import { $, html, icon, badge, QUOTE_STATUS, quoteCode, fail, toast, emptyState } from '../ui.js';
import { renderProposal, downloadPDF } from '../proposal.js';
import { sendWhatsApp, sendEmail, copyLink, markSent } from '../quote-utils.js';

export default async function quotePreview(el, { args: [id] }) {
  const settings = await loadSettings();
  const quote = await q(sb.from('quotes').select('*').eq('id', id).maybeSingle());
  if (!quote) { el.innerHTML = String(emptyState('Orçamento não encontrado', '', html`<a class="btn" href="#/orcamentos">Voltar</a>`)); return; }
  const [items, installments, client] = await Promise.all([
    q(sb.from('quote_items').select('*').eq('quote_id', id).order('position')),
    q(sb.from('quote_installments').select('n, due_date, amount').eq('quote_id', id).order('n')),
    q(sb.from('clients').select('*').eq('id', quote.client_id).single()),
  ]);
  setTitle(`Proposta ${quoteCode(quote)}`);
  const fileName = `Proposta ${quoteCode(quote)} - ${(quote.child_name || client.responsible_name).replace(/[\\/:*?"<>|]/g, '')}.pdf`;

  el.innerHTML = String(html`
    <div class="preview-bar no-print">
      <a class="back" href="#/orcamentos/${id}">${icon('left')}Voltar ao orçamento</a>
      <div class="preview-bar__status">${badge(QUOTE_STATUS, quote.status)}</div>
      <div class="preview-bar__actions">
        <button class="btn btn--primary" type="button" data-pdf>${icon('download')}Baixar PDF</button>
        <button class="btn btn--ghost" type="button" data-print>${icon('printer')}Imprimir</button>
        <button class="btn btn--wa" type="button" data-wa>${icon('whatsapp')}WhatsApp</button>
        <button class="btn btn--ghost" type="button" data-mail>${icon('mail')}E-mail</button>
        <button class="btn btn--ghost" type="button" data-link>${icon('link')}Link</button>
      </div>
    </div>
    ${!items.length ? html`<div class="alert alert--yellow alert--block no-print">${icon('alert')}<span>Este orçamento ainda não tem itens.</span></div>` : ''}
    <div class="preview-paper">${renderProposal({ quote, client, items, installments, settings })}</div>`);

  const paper = $('[data-proposal]', el);
  const run = (fn) => async (e) => { const b = e.currentTarget; b.disabled = true; try { await fn(); } catch (err) { fail(err); } finally { b.disabled = false; } };
  $('[data-pdf]', el).addEventListener('click', run(async () => {
    await downloadPDF(paper, fileName);
    await q(sb.from('quote_history').insert({ quote_id: id, action: 'PDF gerado', details: fileName }));
    toast('PDF baixado.');
  }));
  $('[data-print]', el).addEventListener('click', () => window.print());
  $('[data-wa]', el).addEventListener('click', run(async () => { await sendWhatsApp(quote, client, settings); quotePreview(el, { args: [id] }); }));
  $('[data-mail]', el).addEventListener('click', run(() => sendEmail(quote, client, settings)));
  $('[data-link]', el).addEventListener('click', run(async () => { if (quote.status === 'em_elaboracao') await markSent(quote, 'Link copiado'); await copyLink(quote); }));
}
