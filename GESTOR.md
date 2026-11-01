# Área do Gestor — Buffet Magic Star

Painel administrativo em `/gestor/`, separado do site público, com banco de dados real
no **Supabase** (Postgres + login seguro + permissões no próprio banco).

## Como está montado

```
gestor/index.html            login, solicitar acesso, recuperar e redefinir senha
gestor/app.html              painel (menu lateral + telas)
gestor/assets/js/views/      uma tela por arquivo
gestor/assets/js/ui.js       componentes, formatos, janelas e avisos
gestor/assets/js/auth.js     sessão, níveis de acesso, logout por inatividade (60 min)
proposta.html                página pública da proposta (link enviado ao cliente)
supabase/schema.sql          banco de dados completo: tabelas, regras de acesso, funções
assets/js/config.js          URL e chave pública do Supabase (compartilhado com o site)
```

Sem build e sem servidor próprio: publica na mesma hospedagem do site.

## Configuração (uma vez)

1. **Banco** — no Supabase: *SQL Editor → New query*, cole `supabase/schema.sql` e clique em *Run*.
   (Já feito. Pode rodar de novo sem perder dados se o arquivo for atualizado.)
2. **Chaves** — em *Project Settings → API*, copie **Project URL** e **anon public** para
   `assets/js/config.js`, em `supabase: { url: '...', anonKey: '...' }`.
   A chave *anon* é pública por natureza; quem protege os dados são as regras do banco.
   **Nunca** use a chave `service_role` no site.
3. **Endereços de retorno** — em *Authentication → URL Configuration*:
   - *Site URL*: o endereço do site (ex.: `https://www.buffetmagicstar.com.br`).
   - *Redirect URLs*: adicione `https://www.buffetmagicstar.com.br/gestor/` (e, para testar
     no computador, `http://localhost:5173/gestor/`).
   Isso faz os links de confirmação de e-mail e de recuperação de senha voltarem ao painel.
4. **Primeiro acesso** — abra `/gestor/`, clique em *Solicitar acesso* e crie sua conta.
   **A primeira conta vira Administrador automaticamente.** Se o Supabase pedir confirmação
   de e-mail, confirme pelo link e depois entre.
5. **Equipe** — cada pessoa cria a conta em *Solicitar acesso*; ela fica como *Aguardando
   liberação* até um administrador definir o nível em *Usuários*.

## Níveis de acesso

| | Funcionário | Gerente | Administrador |
|---|:-:|:-:|:-:|
| Visão geral, interessados, clientes, orçamentos, agenda, checklist | ✓ | ✓ | ✓ |
| Financeiro, pagamentos, despesas, relatórios | | ✓ | ✓ |
| Confirmar festas, editar fichas, catálogo | | ✓ | ✓ |
| Configurações, usuários, exclusões | | | ✓ |

As regras ficam no banco (RLS). Mesmo que alguém altere o navegador, não lê nem grava
o que o nível dele não permite.

## Fluxo do dia a dia

1. **Interessados** — pedidos do formulário do site chegam aqui. *Converter em cliente*
   cria a ficha e já abre um orçamento.
2. **Orçamento** — escolha o cliente, preencha a festa, adicione itens do catálogo ou
   personalizados, aplique desconto e taxas e defina entrada e parcelas. Os totais são
   calculados na hora e conferidos pelo banco.
3. **Envio** — *Ver proposta e PDF* (baixar ou imprimir), *Enviar por WhatsApp*, *E-mail*
   ou *Copiar link*. O cliente abre a proposta pelo link e pode **aceitar online**.
4. **Aprovação** — com o status *Aprovado*, use **Aprovar e confirmar festa**. A festa vai para
   a agenda com ficha, checklist e parcelas já lançadas no financeiro. O sistema impede
   duas festas no mesmo horário.
5. **Festa** — acompanhe o checklist, registre recebimentos, extras, descontos, reembolsos
   e despesas. O saldo é atualizado automaticamente.
6. **Painel e relatórios** — os indicadores saem só dos dados cadastrados.

Também existem: versões de orçamento (*Nova versão*), duplicação, histórico de alterações,
expiração automática pela validade, motivo de perda, auditoria de mudanças no banco
(`audit_log`), exportação em CSV e importação das 17 atrações do site no catálogo.

## E-mail

O botão *E-mail* abre o programa de e-mail do computador com a mensagem e o link prontos.
Para envio automático pelo servidor (sem abrir o programa), é preciso um provedor de e-mail
(ex.: Resend) e uma *Edge Function* no Supabase. Isso fica para quando houver credenciais
desse provedor.

## Backup

Exporte as tabelas periodicamente no Supabase (*Table Editor* → tabela → *Export to CSV*).
Os planos pagos do Supabase também fazem backups automáticos diários.
