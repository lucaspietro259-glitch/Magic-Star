// Formulário de cliente reaproveitado em várias telas (novo cliente, editar, converter interessado)
import { sb, q } from './supabase.js';
import { html, modal, validate, formValues, optionList, SOURCES, bindPhoneMask, phoneDigits, toast, $, confirmDialog } from './ui.js';

export function clientFields(c = {}) {
  return html`
    <div class="form-grid">
      <div class="field field--full"><label for="c-resp">Nome completo dos responsáveis</label><input id="c-resp" name="responsible_name" value="${c.responsible_name || ''}" autocomplete="off" placeholder="Ex.: Ana e Carlos Souza"></div>
      <div class="field"><label for="c-phone">Telefone / WhatsApp</label><input id="c-phone" name="phone" data-phone inputmode="tel" value="${c.phone || ''}" placeholder="(11) 90000-0000"></div>
      <div class="field"><label for="c-email">E-mail <span class="opt">(opcional)</span></label><input id="c-email" name="email" type="email" value="${c.email || ''}"></div>
      <div class="field"><label for="c-child">Nome da criança</label><input id="c-child" name="child_name" value="${c.child_name || ''}"></div>
      <div class="field"><label for="c-age">Idade que vai completar</label><input id="c-age" name="child_age" value="${c.child_age || ''}" placeholder="Ex.: 5 anos"></div>
      <div class="field"><label for="c-date">Data desejada da festa</label><input id="c-date" name="desired_date" type="date" value="${c.desired_date || ''}"></div>
      <div class="field"><label for="c-guests">Convidados (aprox.)</label><input id="c-guests" name="guests" type="number" min="1" max="5000" inputmode="numeric" value="${c.guests || ''}"></div>
      <div class="field field--full"><label for="c-source">Como conheceu o buffet</label><select id="c-source" name="source">${optionList(SOURCES, c.source)}</select></div>
      <div class="field field--full"><label for="c-notes">Observações</label><textarea id="c-notes" name="notes" rows="3">${c.notes || ''}</textarea></div>
    </div>`;
}

export const clientRules = {
  responsible_name: (v) => (v.length < 2 ? 'Informe o nome dos responsáveis.' : ''),
  phone: (v) => (phoneDigits(v).length < 10 ? 'Informe um telefone com DDD.' : ''),
  email: (v) => (v && !/^\S+@\S+\.\S+$/.test(v) ? 'E-mail inválido.' : ''),
  guests: (v) => (v && (+v < 1 || +v > 5000) ? 'Número de convidados inválido.' : ''),
};

export function clientPayload(form) {
  const v = formValues(form);
  return {
    responsible_name: v.responsible_name, phone: v.phone, email: v.email || '', child_name: v.child_name || '', child_age: v.child_age || '',
    desired_date: v.desired_date || null, guests: v.guests ? +v.guests : null, source: v.source || '', notes: v.notes || '',
  };
}

// Abre o formulário em uma janela; devolve o cliente salvo (ou null)
export function editClient(existing = null, prefill = {}) {
  const c = existing || prefill;
  return modal({
    title: existing ? 'Editar cliente' : 'Novo cliente',
    size: 'modal--lg',
    body: String(html`<form data-client-form novalidate>${clientFields(c)}</form>`),
    onOpen: ({ el }) => bindPhoneMask(el),
    actions: [
      { label: 'Cancelar', cls: 'btn--ghost', value: null },
      {
        label: existing ? 'Salvar alterações' : 'Cadastrar cliente', cls: 'btn--primary',
        onClick: async ({ el }) => {
          const form = $('[data-client-form]', el);
          if (!validate(form, clientRules)) return false;
          const payload = clientPayload(form);
          if (!existing) {
            const dup = await q(sb.from('clients').select('id, responsible_name').ilike('phone', `%${phoneDigits(payload.phone).slice(-8, -4)}%${phoneDigits(payload.phone).slice(-4)}%`).limit(1));
            if (dup.length && !(await confirmDialog(`Já existe um cliente com telefone parecido: ${dup[0].responsible_name}. Cadastrar mesmo assim?`, { title: 'Possível duplicado', ok: 'Cadastrar mesmo assim' }))) return false;
          }
          const saved = existing
            ? await q(sb.from('clients').update(payload).eq('id', existing.id).select().single())
            : await q(sb.from('clients').insert(payload).select().single());
          toast(existing ? 'Cliente atualizado.' : 'Cliente cadastrado.');
          return saved;
        },
      },
    ],
  });
}

