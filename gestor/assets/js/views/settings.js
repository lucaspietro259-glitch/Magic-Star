// Configurações do buffet: dados que aparecem automaticamente nas propostas e no PDF.
import { sb, q } from '../supabase.js';
import { loadSettings } from '../auth.js';
import { setTitle, dirty } from '../app.js';
import { $, $$, html, icon, toast, fail, formValues, validate, bindPhoneMask, phoneDigits } from '../ui.js';

export default async function settingsView(el) {
  setTitle('Configurações');
  const s = await loadSettings(true);
  let methods = [...(s.payment_methods || [])];

  el.innerHTML = String(html`
    <div class="page-head"><div><h2 class="page-h">Configurações do buffet</h2><p class="muted">Estes dados aparecem automaticamente nas propostas, no PDF e no link enviado ao cliente.</p></div></div>
    <form class="stack-lg" data-form novalidate>
      <section class="card">
        <header class="card__head"><h3>Identidade</h3></header>
        <div class="form-grid">
          <div class="field"><label for="s-name">Nome do buffet</label><input id="s-name" name="buffet_name" value="${s.buffet_name}"></div>
          <div class="field"><label for="s-logo">Logo <span class="opt">(PNG ou JPG, até 2 MB)</span></label>
            <div class="logo-pick">${s.logo_url ? html`<img src="${s.logo_url}" alt="Logo atual" data-logo-img>` : html`<span class="logo-pick__empty" data-logo-img>${icon('star')}</span>`}<input id="s-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-logo></div></div>
          <div class="field"><label for="s-legal">Razão social</label><input id="s-legal" name="legal_name" value="${s.legal_name || ''}"></div>
          <div class="field"><label for="s-doc">CNPJ / CPF</label><input id="s-doc" name="document" value="${s.document || ''}"></div>
        </div>
      </section>
      <section class="card">
        <header class="card__head"><h3>Contato e endereço</h3></header>
        <div class="form-grid">
          <div class="field field--full"><label for="s-addr">Endereço</label><input id="s-addr" name="address" value="${s.address || ''}"></div>
          <div class="field"><label for="s-phone">Telefone</label><input id="s-phone" name="phone" data-phone value="${s.phone || ''}"></div>
          <div class="field"><label for="s-wa">WhatsApp (com DDI e DDD, só números)</label><input id="s-wa" name="whatsapp" inputmode="numeric" value="${s.whatsapp || ''}" placeholder="5511945310974"></div>
          <div class="field"><label for="s-email">E-mail</label><input id="s-email" name="email" type="email" value="${s.email || ''}"></div>
          <div class="field"><label for="s-site">Site</label><input id="s-site" name="website" value="${s.website || ''}"></div>
          <div class="field"><label for="s-ig">Instagram</label><input id="s-ig" name="instagram" value="${s.instagram || ''}"></div>
          <div class="field"><label for="s-fb">Facebook</label><input id="s-fb" name="facebook" value="${s.facebook || ''}"></div>
        </div>
      </section>
      <section class="card">
        <header class="card__head"><h3>Comercial</h3></header>
        <div class="form-grid form-grid--3">
          <div class="field"><label for="s-val">Validade das propostas (dias)</label><input id="s-val" name="quote_validity_days" type="number" min="1" max="365" value="${s.quote_validity_days}"></div>
          <div class="field"><label for="s-st">Horário padrão de início</label><input id="s-st" name="default_start_time" type="time" value="${String(s.default_start_time).slice(0, 5)}"></div>
          <div class="field"><label for="s-dur">Duração padrão (horas)</label><input id="s-dur" name="default_duration_hours" type="number" min="1" max="24" step="0.5" value="${s.default_duration_hours}"></div>
          <div class="field"><label for="s-max">Festas por dia (para alertar data lotada)</label><input id="s-max" name="max_events_per_day" type="number" min="1" max="10" value="${s.max_events_per_day}"></div>
        </div>
        <div class="field"><span class="label">Formas de pagamento aceitas</span>
          <div class="chips-edit" data-methods></div>
          <div class="inline-add"><input placeholder="Adicionar forma (ex.: Boleto)" data-method-new aria-label="Nova forma de pagamento"><button class="btn btn--sm" type="button" data-method-add>${icon('plus')}Adicionar</button></div></div>
      </section>
      <section class="card">
        <header class="card__head"><h3>Textos padrão da proposta</h3></header>
        <div class="field"><label for="s-intro">Apresentação (início da proposta)</label><textarea id="s-intro" name="quote_intro" rows="3">${s.quote_intro || ''}</textarea></div>
        <div class="field"><label for="s-terms">Condições comerciais</label><textarea id="s-terms" name="quote_terms" rows="5" placeholder="Reserva, cancelamento, alteração de convidados, horas extras…">${s.quote_terms || ''}</textarea></div>
        <div class="field"><label for="s-foot">Rodapé</label><textarea id="s-foot" name="quote_footer" rows="2">${s.quote_footer || ''}</textarea></div>
      </section>
      <div class="sticky-save"><button class="btn btn--primary btn--lg" type="submit">${icon('check')}Salvar configurações</button></div>
    </form>`);

  const form = $('[data-form]', el);
  bindPhoneMask(form);
  form.addEventListener('input', () => dirty.set(true));
  const drawMethods = () => {
    $('[data-methods]', el).innerHTML = String(html`${methods.map((m, i) => html`<span class="chip-x">${m}<button type="button" data-rm="${i}" aria-label="Remover ${m}">${icon('x')}</button></span>`)}`);
    $$('[data-rm]', el).forEach((b) => b.addEventListener('click', () => { methods.splice(+b.dataset.rm, 1); dirty.set(true); drawMethods(); }));
  };
  drawMethods();
  const addMethod = () => { const i = $('[data-method-new]', el); const v = i.value.trim(); if (v && !methods.includes(v)) { methods.push(v); dirty.set(true); drawMethods(); } i.value = ''; i.focus(); };
  $('[data-method-add]', el).addEventListener('click', addMethod);
  $('[data-method-new]', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMethod(); } });

  let logoUrl = s.logo_url || '';
  $('[data-logo]', el).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('O logo deve ter até 2 MB.', 'error'); return; }
    try {
      const path = `logo/${Date.now()}.${(file.name.split('.').pop() || 'png').toLowerCase()}`;
      const { error } = await sb.storage.from('arquivos').upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      logoUrl = sb.storage.from('arquivos').getPublicUrl(path).data.publicUrl;
      $('[data-logo-img]', el).outerHTML = String(html`<img src="${logoUrl}" alt="Novo logo" data-logo-img>`);
      dirty.set(true);
      toast('Logo enviado. Clique em salvar.');
    } catch (err) { fail(err); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(form, {
      buffet_name: (v) => (v ? '' : 'Informe o nome.'),
      whatsapp: (v) => (v && phoneDigits(v).length < 12 ? 'Use DDI + DDD + número, ex.: 5511945310974.' : ''),
      email: (v) => (v && !/^\S+@\S+\.\S+$/.test(v) ? 'E-mail inválido.' : ''),
      quote_validity_days: (v) => (+v >= 1 && +v <= 365 ? '' : 'Entre 1 e 365 dias.'),
    })) return;
    const v = formValues(form);
    const btn = $('[type=submit]', form); btn.disabled = true;
    try {
      await q(sb.from('settings').update({
        ...v, whatsapp: phoneDigits(v.whatsapp), logo_url: logoUrl, payment_methods: methods,
        quote_validity_days: +v.quote_validity_days, default_duration_hours: +v.default_duration_hours, max_events_per_day: +v.max_events_per_day,
      }).eq('id', 1));
      await loadSettings(true);
      dirty.set(false);
      toast('Configurações salvas.');
    } catch (err) { fail(err); } finally { btn.disabled = false; }
  });
}
