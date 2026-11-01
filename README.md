# Site — Buffet Magic Star

Site de uma página para o Buffet Magic Star (Rua Oriente, 931, Barcelona, São Caetano do Sul).
HTML, CSS e JavaScript puros: **não precisa instalar nada nem rodar build**. É só subir os arquivos.

## Estrutura

```
index.html              página completa (11 seções, SEO, dados estruturados)
assets/css/style.css    estilos (cores e fontes no topo, em :root)
assets/js/config.js     ← DADOS DO BUFFET (WhatsApp, endereço, horário...)
assets/js/main.js       menu, atrações, espaço, stories, galeria, lightbox, trilho, FAQ, formulário
assets/js/hero3d.js     cena 3D do topo: estrela metalizada, balões e confetes (Three.js)
assets/js/photos.js     catálogo das 70 fotos reais usadas na galeria
assets/img/             fotos otimizadas em WebP (640, 1280 e 1920 px)
assets/og-image.jpg     imagem de compartilhamento (WhatsApp, Facebook)
robots.txt, sitemap.xml, site.webmanifest
```

## Ver no computador

Na pasta do projeto:

```bash
python3 -m http.server 5173
```

Abra http://localhost:5173. (Abrir o `index.html` com duplo clique não funciona,
porque os scripts são módulos e o navegador exige um servidor.)

## Publicar

Qualquer hospedagem de site estático serve. Envie **todo o conteúdo da pasta**:

- **Hostinger / cPanel**: Gerenciador de Arquivos → `public_html` → envie os arquivos.
- **Netlify**: arraste a pasta em app.netlify.com/drop.
- **Vercel**: `vercel` na pasta, ou importe o repositório (framework: "Other").

Depois de definir o domínio, troque `https://www.buffetmagicstar.com.br` (provisório) em:
`index.html` (canonical, og:url, og:image, JSON-LD), `robots.txt`, `sitemap.xml` e `assets/js/config.js`.

## O que editar

| O quê | Onde |
|---|---|
| WhatsApp, Instagram, endereço, horário, capacidade | `assets/js/config.js` |
| Textos das seções | `index.html` (cada seção está marcada com um comentário) |
| Depoimentos (hoje são **exemplos marcados**) | `index.html`, seção `#depoimentos` |
| Lista das 17 atrações | `index.html`, seção `#atracoes` (`data-photo` = nome da foto) |
| Capítulos dos Stories da festa | `assets/js/main.js`, constante `STORY` |
| Respostas a confirmar no FAQ | `index.html`, trechos `<span class="tbc">` |
| Cores e fontes | topo de `assets/css/style.css` |
| Fotos da galeria | `assets/js/photos.js` + arquivos em `assets/img/` |

### Informações ainda pendentes (aparecem como "A confirmar")

- Horário de atendimento (rodapé e `config.js › hours`)
- Capacidade de convidados (FAQ)
- Pacotes, dias e duração das festas (FAQ)
- Condições de reserva/sinal (FAQ)
- Dias e horários de visita (FAQ)
- Temas de decoração disponíveis (FAQ)
- CEP e domínio definitivo
- Logo oficial em arquivo (hoje o cabeçalho usa uma estrela + "Buffet Magic Star" em texto;
  para usar o logo, salve `assets/logo.svg` e troque o bloco `.brand` no `index.html`)
- Depoimentos reais de clientes (com autorização)

## Formulário de orçamento

Valida os campos obrigatórios, monta a mensagem e abre o WhatsApp do buffet
(`config.js › whatsapp`) com tudo preenchido. Nenhum dado fica guardado em servidor.

## Desempenho e acessibilidade

- Fotos em WebP com `srcset` e carregamento preguiçoso; a foto do topo é pré-carregada.
- A cena 3D só carrega depois da página pronta, pausa fora da tela e não roda em
  aparelhos modestos (memória/CPU baixas ou economia de dados): nesses, entram balões em CSS.
- Com "reduzir movimento" ativado no sistema, todas as animações e o 3D são desligados.
- Navegação por teclado, foco visível, lightbox com Esc/setas e menu com Esc.

## Fotos

As 95 fotos do ZIP foram analisadas; 70 entraram no site, com correção de exposição
(só luz e contraste, como faria um fotógrafo: o conteúdo das fotos não foi alterado). Ficaram de fora fotos repetidas
e as que mostram a equipe filmando.
As fotos da festa mostram uma decoração temática de super-herói (personagens licenciados) e o
nome de uma criança: confirme se a família autorizou o uso antes de publicar.
