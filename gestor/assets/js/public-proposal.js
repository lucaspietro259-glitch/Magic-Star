// Página pública da proposta (link enviado ao cliente). Só lê o orçamento do token.
import { sb, configured } from './supabase.js';
import { $, html, icon, quoteCode, date, errorMessage } from './ui.js';
import { renderProposal, downloadPDF } from './proposal.js';

const root = $('[data-root]');
const token = new URLSearchParams(location.search).get('t');
const fail = (title, text) => { root.innerHTML = String(html`<div class="empty">${icon('alert', 'empty__ic')}<h3>${title}</h3><p>${text}</p><a class="btn" href="./">Conhecer o Buffet Magic Star</a></div>`); };

async function load() {
  if (!configured) return fail('Proposta indisponível', 'O sistema ainda não foi configurado.');
  if (!/^[0-9a-f-]{36}$/i.test(token || '')) return fail('Link inválido', 'Confira se o link foi copiado inteiro.');
  const { data, error } = await sb.rpc('get_public_quote', { p_token: token });
  if (error) return fail('Não foi possível abrir a proposta', errorMessage(error));
  if (!data) return fail('Proposta não encontrada', 'Ela pode ter sido substituída por uma versão nova. Fale com o buffet.');
  const q = data.quote;
  document.title = `Proposta ${quoteCode(q)} | ${data.settings?.buffet_name || 'Buffet'}`;

  const expired = q.status === 'expirado' || (q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10));
  const open = ['enviado', 'aguardando_resposta', 'em_negociacao'].includes(q.status) && !expired;
  const acceptSlot = q.status === 'aprovado'
    ? html`<div class="accept accept--done">${icon('check')}<div><strong>Proposta aceita${q.accepted_name ? ` por ${q.accepted_name}` : ''}</strong><p>Obrigado! A equipe do buffet vai entrar em contato para confirmar os próximos passos.</p></div></div>`
    : open ? html`<form class="accept no-print" data-accept novalidate>
        <div><strong>Gostou? Aceite a proposta por aqui.</strong><p>Digite seu nome completo para registrar o aceite. A data só fica reservada após o pagamento da entrada.</p></div>
        <div class="accept__row"><input name="name" placeholder="Seu nome completo" autocomplete="name" aria-label="Seu nome completo" required><button class="btn btn--success" type="submit">Aceitar proposta</button></div>
        <p class="accept__msg" data-accept-msg></p></form>`
    : html`<div class="accept accept--off">${icon('clock')}<div><strong>${expired ? 'Esta proposta expirou' : 'Proposta indisponível para aceite'}</strong><p>Fale com o buffet pelo WhatsApp para receber uma proposta atualizada.</p></div></div>`;

  root.innerHTML = String(renderProposal(data, { acceptSlot }));
  const bar = $('[data-bar]');
  bar.hidden = false;
  const wa = data.settings?.whatsapp || '';
  $('[data-wa]').href = `https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre a proposta ${quoteCode(q)}${q.child_name ? ` da festa de ${q.child_name}` : ''}.`)}`;
  $('[data-pdf]').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try { await downloadPDF($('[data-proposal]'), `Proposta ${quoteCode(q)}.pdf`); } catch (err) { alert(err.message); }
    e.currentTarget.disabled = false;
  });

  $('[data-accept]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget, msg = $('[data-accept-msg]');
    const name = f.name.value.trim();
    if (name.split(/\s+/).length < 2) { msg.textContent = 'Digite seu nome e sobrenome.'; f.name.focus(); return; }
    f.querySelector('button').disabled = true;
    const { data: res, error } = await sb.rpc('accept_public_quote', { p_token: token, p_name: name });
    if (error) { msg.textContent = errorMessage(error); f.querySelector('button').disabled = false; return; }
    if (res === 'expirado') { msg.textContent = 'Esta proposta expirou. Fale com o buffet para receber uma nova.'; return; }
    load();
  });
}
load().catch((e) => fail('Não foi possível abrir a proposta', errorMessage(e)));
