// Usuários e níveis de acesso (somente administradores).
import { sb, q } from '../supabase.js';
import { state, ROLE_LABEL } from '../auth.js';
import { setTitle } from '../app.js';
import { $$, html, raw, icon, date, toast, fail } from '../ui.js';

const PERMS = [
  ['Visão geral, clientes, interessados, orçamentos, agenda, checklist', true, true, true],
  ['Ver valores financeiros, pagamentos e despesas', false, true, true],
  ['Confirmar festas e editar fichas de festa', false, true, true],
  ['Editar pacotes e serviços (catálogo)', false, true, true],
  ['Relatórios', false, true, true],
  ['Configurações do buffet e usuários', false, false, true],
  ['Excluir clientes, orçamentos, festas e pagamentos', false, false, true],
];

export default async function users(el) {
  setTitle('Usuários');
  const rows = await q(sb.from('profiles').select('*').order('created_at'));
  const pending = rows.filter((r) => r.role === 'pendente');
  const yes = raw('<span class="perm perm--yes" aria-label="Sim">✓</span>'), no = raw('<span class="perm" aria-label="Não">—</span>');

  el.innerHTML = String(html`
    <div class="page-head"><div><h2 class="page-h">Usuários e acessos</h2><p class="muted">Novos membros da equipe criam a conta em “Solicitar acesso”, na tela de login, e aparecem aqui como pendentes.</p></div></div>
    ${pending.length ? html`<div class="alert alert--yellow alert--block">${icon('clock')}<span><strong>${pending.length}</strong> pessoa${pending.length > 1 ? 's' : ''} aguardando liberação. Defina o nível de acesso abaixo.</span></div>` : ''}
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Nome</th><th>E-mail</th><th>Nível de acesso</th><th>Ativo</th><th>Desde</th></tr></thead>
      <tbody>${rows.map((u) => html`<tr data-id="${u.id}">
        <td><strong>${u.full_name || '—'}</strong>${u.id === state.profile.id ? html` <span class="badge badge--blue">Você</span>` : ''}</td>
        <td>${u.email}</td>
        <td><select data-role aria-label="Nível de ${u.full_name || u.email}">${Object.entries(ROLE_LABEL).map(([k, l]) => html`<option value="${k}" ${k === u.role ? raw('selected') : ''}>${l}</option>`)}</select></td>
        <td><label class="switch"><input type="checkbox" data-active ${u.active ? raw('checked') : ''} aria-label="Ativo"><span></span></label></td>
        <td>${date(u.created_at)}</td></tr>`)}</tbody>
    </table></div>

    <section class="card">
      <header class="card__head"><h3>O que cada nível pode fazer</h3></header>
      <div class="table-wrap"><table class="table table--compact perms">
        <thead><tr><th>Permissão</th><th>Funcionário</th><th>Gerente</th><th>Administrador</th></tr></thead>
        <tbody>${PERMS.map(([l, f, g, a]) => html`<tr><td>${l}</td><td>${f ? yes : no}</td><td>${g ? yes : no}</td><td>${a ? yes : no}</td></tr>`)}</tbody>
      </table></div>
      <p class="muted small">As permissões valem no próprio banco de dados: mesmo fora desta tela, ninguém acessa o que o seu nível não permite.</p>
    </section>`);

  $$('tr[data-id]', el).forEach((tr) => {
    const id = tr.dataset.id;
    const u = rows.find((r) => r.id === id);
    tr.querySelector('[data-role]').addEventListener('change', async (e) => {
      try { await q(sb.from('profiles').update({ role: e.target.value }).eq('id', id)); u.role = e.target.value; toast('Nível de acesso atualizado.'); }
      catch (err) { fail(err); e.target.value = u.role; }
    });
    tr.querySelector('[data-active]').addEventListener('change', async (e) => {
      try { await q(sb.from('profiles').update({ active: e.target.checked }).eq('id', id)); u.active = e.target.checked; toast(e.target.checked ? 'Usuário ativado.' : 'Usuário desativado.'); }
      catch (err) { fail(err); e.target.checked = u.active; }
    });
  });
}
