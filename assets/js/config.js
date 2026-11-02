/* ==========================================================================
   CONFIGURAÇÃO DO SITE — edite aqui os dados do buffet.
   Campos marcados com "A CONFIRMAR" ainda não foram informados.
   Depois de editar, revise também as <meta> e o JSON-LD no <head> do index.html
   (ver README.md › "SEO local").
   ========================================================================== */
export const SITE = {
  name: 'Buffet Magic Star',
  url: 'https://magic-star-lemon.vercel.app', // A CONFIRMAR: domínio definitivo

  // WhatsApp: apenas números, com DDI 55 + DDD. Usado no formulário e nos botões.
  whatsapp: '5511945310974',
  whatsappDisplay: '(11) 94531-0974',
  phone: '+55 11 94531-0974',

  instagram: 'buffetmagicstar',

  address: {
    street: 'Rua Oriente, 931',
    neighborhood: 'Barcelona',
    city: 'São Caetano do Sul',
    state: 'SP',
    zip: '', // A CONFIRMAR
  },
  // Região atendida (adicione cidades vizinhas se fizer sentido, ex.: 'Santo André').
  serviceArea: ['São Caetano do Sul', 'ABC Paulista'],

  // Deixe vazio ('') para mostrar "A confirmar" no rodapé.
  hours: '',

  capacity: '', // A CONFIRMAR — ex.: 'Até 150 convidados'

  // Supabase (banco de dados da Área do Gestor). Em Project Settings → API:
  // "Project URL" e a chave "anon public". A chave anon pode ficar aqui: ela é
  // pública por natureza e o acesso aos dados é controlado pelas regras do banco.
  // NUNCA coloque aqui a chave "service_role".
  supabase: {
    url: 'https://ymrcosfskfsiyveqqsyb.supabase.co',
    anonKey: 'sb_publishable_wFzN_oW_j1YKYIHzqUnY7g_cMvUYzXE',
  },

  // Mensagem padrão dos botões de WhatsApp (fora do formulário).
  defaultMessage: 'Olá! Vi o site do Buffet Magic Star e quero saber mais sobre as festas.',
};

export const waLink = (text = SITE.defaultMessage) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
