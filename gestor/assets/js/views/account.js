// Minha conta: nome e troca de senha.
import { sb, q } from '../supabase.js';
import { state, ROLE_LABEL } from '../auth.js';
import { setTitle } from '../app.js';
import { $, html, toast, fail, validate } from '../ui.js';

export default async function account(el) {
  setTitle('Minha conta');
  const p = state.profile;
  el.innerHTML = String(html`
    <div class="page-head"><div><h2 class="page-h">Minha conta</h2><p class="muted">${p.email} · ${ROLE_LABEL[p.role]}</p></div></div>
    <div class="grid-2">
      <form class="card stack" data-name novalidate>
        <header class="card__head"><h3>Seus dados</h3></header>
        <div class="field"><label for="a-name">Nome completo</label><input id="a-name" name="full_name" value="${p.full_name}"></div>
        <button class="btn btn--primary" type="submit">Salvar nome</button>
      </form>
      <form class="card stack" data-pass novalidate>
        <header class="card__head"><h3>Trocar senha</h3></header>
        <div class="field"><label for="a-p1">Nova senha</label><input id="a-p1" name="p1" type="password" autocomplete="new-password"></div>
        <div class="field"><label for="a-p2">Repita a nova senha</label><input id="a-p2" name="p2" type="password" autocomplete="new-password"></div>
        <button class="btn btn--primary" type="submit">Alterar senha</button>
      </form>
    </div>`);

  $('[data-name]', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!validate(f, { full_name: (v) => (v.length >= 3 ? '' : 'Informe seu nome completo.') })) return;
    try { await q(sb.from('profiles').update({ full_name: f.full_name.value.trim() }).eq('id', p.id)); p.full_name = f.full_name.value.trim(); toast('Nome atualizado.'); }
    catch (err) { fail(err); }
  });
  $('[data-pass]', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!validate(f, { p1: (v) => (v.length >= 8 ? '' : 'Mínimo de 8 caracteres.'), p2: (v) => (v === f.p1.value ? '' : 'As senhas não são iguais.') })) return;
    const { error } = await sb.auth.updateUser({ password: f.p1.value });
    if (error) return fail(error);
    f.reset(); toast('Senha alterada.');
  });
}
