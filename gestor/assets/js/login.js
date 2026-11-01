import { sb, configured, q } from './supabase.js';
import { $, $$, errorMessage } from './ui.js';

const msg = $('[data-msg]');
const TITLES = {
  login: ['Área do Gestor', 'Entre com seu e-mail e senha.'],
  signup: ['Solicitar acesso', 'Crie sua conta. Um administrador libera o acesso.'],
  forgot: ['Recuperar senha', 'Enviamos um link para você criar uma nova senha.'],
  reset: ['Nova senha', 'Escolha uma senha com pelo menos 8 caracteres.'],
};
const show = (name) => {
  $$('[data-form]').forEach((f) => (f.hidden = f.dataset.form !== name));
  $('[data-title]').textContent = TITLES[name][0];
  $('[data-sub]').textContent = TITLES[name][1];
  $(`[data-form="${name}"] input`)?.focus();
};
const say = (text, type = 'error') => { msg.hidden = !text; msg.textContent = text; msg.className = `auth__msg auth__msg--${type}`; };
const busy = (form, on) => { const b = $('button[type=submit]', form); b.disabled = on; b.classList.toggle('is-busy', on); };
const here = () => location.href.split('#')[0].split('?')[0];

$$('[data-go]').forEach((b) => b.addEventListener('click', () => { say(''); show(b.dataset.go); }));

const reason = new URLSearchParams(location.search).get('motivo');
if (reason === 'pendente') say('Sua conta ainda não foi liberada. Peça a um administrador para definir seu nível de acesso.', 'info');
if (reason === 'inatividade') say('Sua sessão foi encerrada por inatividade. Entre novamente.', 'info');

if (!configured) {
  say('O banco de dados ainda não foi configurado. Preencha a URL e a chave do Supabase em assets/js/config.js (veja GESTOR.md).', 'error');
  $$('form button').forEach((b) => (b.disabled = true));
} else {
  // Link de recuperação de senha abre esta página com uma sessão temporária
  sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') show('reset'); });
  const isRecovery = /type=recovery/.test(location.hash);
  if (isRecovery) show('reset');
  else sb.auth.getSession().then(({ data }) => { if (data.session) enter(); });
}

async function enter() {
  const { data: { user } } = await sb.auth.getUser();
  const profile = await q(sb.from('profiles').select('role, active').eq('id', user.id).maybeSingle()).catch(() => null);
  if (!profile || profile.role === 'pendente' || !profile.active) {
    await sb.auth.signOut();
    say('Conta criada! Ela aguarda a liberação de um administrador.', 'info');
    show('login');
    return;
  }
  location.replace('app.html');
}

$('[data-form="login"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (!f.email.value || !f.password.value) return say('Informe e-mail e senha.');
  busy(f, true); say('');
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  busy(f, false);
  if (error) return say(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : /confirm/i.test(error.message) ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : errorMessage(error));
  enter();
});

$('[data-form="signup"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (f.full_name.value.trim().length < 3) return say('Informe seu nome completo.');
  if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) return say('Informe um e-mail válido.');
  if (f.password.value.length < 8) return say('A senha precisa ter pelo menos 8 caracteres.');
  busy(f, true); say('');
  const { data, error } = await sb.auth.signUp({
    email: f.email.value.trim(), password: f.password.value,
    options: { data: { full_name: f.full_name.value.trim() }, emailRedirectTo: here() },
  });
  busy(f, false);
  if (error) return say(/registered/i.test(error.message) ? 'Este e-mail já tem conta. Use "Esqueci minha senha".' : errorMessage(error));
  if (!data.session) { say('Conta criada! Confirme pelo link que enviamos ao seu e-mail e depois entre.', 'ok'); show('login'); return; }
  enter();
});

$('[data-form="forgot"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) return say('Informe um e-mail válido.');
  busy(f, true);
  const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: here() });
  busy(f, false);
  if (error) return say(errorMessage(error));
  say('Se este e-mail tiver conta, você receberá um link para criar uma nova senha.', 'ok');
});

$('[data-form="reset"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (f.password.value.length < 8) return say('A senha precisa ter pelo menos 8 caracteres.');
  if (f.password.value !== f.password2.value) return say('As senhas não são iguais.');
  busy(f, true);
  const { error } = await sb.auth.updateUser({ password: f.password.value });
  busy(f, false);
  if (error) return say(errorMessage(error));
  history.replaceState(null, '', here());
  say('Senha alterada!', 'ok');
  enter();
});
