// Cálculos e envio de orçamentos (usados no editor, na prévia e no PDF).
import { sb, q } from './supabase.js';
import { round2, addMonths, brl, date, waNumber, toast, quoteCode } from './ui.js';

// Mesmo cálculo que o banco faz (supabase/schema.sql › quote_compute_totals)
export function calcQuote(quote, items) {
  const subtotal = round2(items.reduce((s, i) => s + round2((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)), 0));
  const dv = Number(quote.discount_value) || 0;
  const discount = quote.discount_type === 'percentual' ? round2((subtotal * Math.min(dv, 100)) / 100) : Math.min(dv, subtotal);
  const fees = Number(quote.fees_value) || 0;
  const total = Math.max(0, round2(subtotal - discount + fees));
  const perGuest = quote.guests ? round2(total / Number(quote.guests)) : null;
  return { subtotal, discount, fees, total, perGuest };
}

// Gera entrada + parcelas mensais; a última parcela absorve os centavos
export function buildInstallments(total, down, count, firstDue, downDue) {
  const rows = [];
  const d = Math.min(round2(down), total);
  if (d > 0) rows.push({ n: 0, amount: d, due_date: downDue || null });
  const rest = round2(total - d);
  const n = Math.max(0, Math.floor(count));
  if (n > 0 && rest > 0) {
    const each = Math.floor((rest / n) * 100) / 100;
    for (let i = 1; i <= n; i++) {
      rows.push({ n: i, amount: i === n ? round2(rest - each * (n - 1)) : each, due_date: firstDue ? addMonths(firstDue, i - 1) : null });
    }
  }
  return rows;
}

export const publicLink = (quote) => {
  const base = location.pathname.replace(/\/gestor\/.*$/, '/');
  return `${location.origin}${base}proposta.html?t=${quote.share_token}`;
};

export function shareText(quote, client, settings) {
  const first = (client?.responsible_name || '').split(' ')[0];
  const lines = [
    `Olá${first ? `, ${first}` : ''}! Aqui está a proposta do ${settings?.buffet_name || 'buffet'}${quote.child_name ? ` para a festa de ${quote.child_name}` : ''}${quote.event_date ? ` (${date(quote.event_date)})` : ''}:`,
    '',
    publicLink(quote),
    '',
    `Valor total: ${brl(quote.total)}`,
  ];
  if (quote.valid_until) lines.push(`Proposta válida até ${date(quote.valid_until)}.`);
  lines.push('', 'Você pode aceitar a proposta pelo próprio link. Qualquer dúvida, é só responder esta mensagem!');
  return lines.join('\n');
}

// Marca como enviado (se ainda estava em elaboração) e registra no histórico
export async function markSent(quote, how) {
  if (quote.status === 'em_elaboracao') {
    await q(sb.from('quotes').update({ status: 'enviado' }).eq('id', quote.id));
    quote.status = 'enviado';
  }
  await q(sb.from('quote_history').insert({ quote_id: quote.id, action: 'Proposta compartilhada', details: how }));
}

export async function sendWhatsApp(quote, client, settings) {
  if (!client?.phone) return toast('Cadastre o telefone do cliente.', 'error');
  const url = `https://wa.me/${waNumber(client.phone)}?text=${encodeURIComponent(shareText(quote, client, settings))}`;
  const win = window.open(url, '_blank');
  if (win) win.opener = null; else location.href = url;
  await markSent(quote, 'Enviada por WhatsApp');
}

export async function sendEmail(quote, client, settings) {
  if (!client?.email) return toast('Cadastre o e-mail do cliente para enviar por e-mail.', 'error');
  const subject = `Proposta ${quoteCode(quote)} – ${settings?.buffet_name || 'Buffet'}`;
  location.href = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText(quote, client, settings))}`;
  await markSent(quote, 'Enviada por e-mail');
}

export async function copyLink(quote) {
  await navigator.clipboard.writeText(publicLink(quote));
  toast('Link da proposta copiado.');
}
