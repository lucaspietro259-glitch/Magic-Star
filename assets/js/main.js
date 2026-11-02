import { SITE, waLink } from './config.js';
import { PHOTOS } from './photos.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const desktop = () => matchMedia('(min-width: 861px)').matches;
const bySrc = Object.fromEntries(PHOTOS.map((p) => [p.src, p]));

const imgUrl = (src, size) => `assets/img/${src}-${size}.webp`;
const srcsetFor = (p) =>
  p.w > p.h
    ? `${imgUrl(p.src, 640)} 640w, ${imgUrl(p.src, 1280)} 1280w, ${imgUrl(p.src, 1920)} 1920w`
    : `${imgUrl(p.src, 640)} 480w, ${imgUrl(p.src, 1280)} 960w`;
const makeImg = (p, sizes) => {
  const im = new Image();
  im.decoding = 'async'; im.alt = p.alt; im.sizes = sizes; im.srcset = srcsetFor(p); im.src = imgUrl(p.src, 1280);
  return im;
};

// Um único laço de scroll para todos os efeitos ligados à rolagem
const scrollFns = [];
const onScrollFrame = (fn) => scrollFns.push(fn);
let ticking = false;
const runScroll = () => { scrollFns.forEach((fn) => fn()); ticking = false; };
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }, { passive: true });
addEventListener('resize', () => requestAnimationFrame(runScroll));

/* ---------- Configuração ---------- */
function applyConfig() {
  $$('[data-wa]').forEach((a) => (a.href = waLink(a.dataset.waMsg || undefined)));
  if (SITE.hours) $$('[data-hours]').forEach((el) => (el.textContent = SITE.hours));
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
}

/* ---------- Cabeçalho, menu e barra do celular ---------- */
function initHeader() {
  const header = $('.header');
  const toggle = $('.menu-toggle');
  const menu = $('#menu-mobile');
  const bar = $('.mobile-bar');
  let lastY = scrollY, formVisible = false;

  onScrollFrame(() => {
    const y = scrollY;
    header.classList.toggle('is-solid', y > 30);
    header.classList.toggle('is-hidden', y > lastY && y > 500 && !document.body.classList.contains('menu-open'));
    lastY = y;
    bar.classList.toggle('is-visible', y > innerHeight * 0.8 && !formVisible);
  });
  new IntersectionObserver(([e]) => { formVisible = e.isIntersecting; runScroll(); }, { threshold: 0.1 }).observe($('#orcamento'));

  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    menu.setAttribute('aria-hidden', !open);
    menu.inert = !open;
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) { header.classList.remove('is-hidden'); setTimeout(() => $('a', menu).focus(), 300); }
  };
  menu.inert = true;
  toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); toggle.focus(); } });
  matchMedia('(min-width: 1081px)').addEventListener('change', (e) => e.matches && setMenu(false));

  const links = $$('.nav a');
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === `#${en.target.id}`));
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((a) => { const s = $(a.getAttribute('href')); s && io.observe(s); });
}

function initReveal() {
  const els = $$('.reveal');
  if (reduceMotion) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  els.forEach((el) => {
    const sibs = [...el.parentElement.children];
    el.style.transitionDelay = `${sibs.indexOf(el) * 0.07}s`;
    io.observe(el);
  });
}

/* ---------- Lightbox ---------- */
const lightbox = (() => {
  const root = $('[data-lightbox]');
  const img = $('[data-lb-img]', root);
  const caption = $('[data-lb-caption]', root);
  const count = $('[data-lb-count]', root);
  let list = [], index = 0, lastFocus = null;

  const show = (i) => {
    index = (i + list.length) % list.length;
    const p = list[index];
    img.classList.add('is-switching');
    const pre = makeImg(p, '100vw');
    const swap = () => { img.srcset = pre.srcset; img.sizes = '100vw'; img.src = pre.src; img.alt = p.alt; requestAnimationFrame(() => img.classList.remove('is-switching')); };
    pre.decode().then(swap, swap);
    caption.textContent = p.alt;
    count.textContent = `${index + 1} / ${list.length}`;
    makeImg(list[(index + 1) % list.length], '100vw'); // pré-carrega a próxima
  };
  const open = (items, i = 0) => {
    list = items.filter(Boolean); lastFocus = document.activeElement;
    root.classList.add('is-open'); root.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    show(i); $('[data-lb-close]', root).focus();
  };
  const close = () => {
    root.classList.remove('is-open'); root.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (document.fullscreenElement) document.exitFullscreen();
    lastFocus?.focus();
  };
  $('[data-lb-close]', root).addEventListener('click', close);
  $('[data-lb-prev]', root).addEventListener('click', () => show(index - 1));
  $('[data-lb-next]', root).addEventListener('click', () => show(index + 1));
  $('[data-lb-full]', root).addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.().catch(() => {})));
  $('[data-lb-stage]', root).addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
  addEventListener('keydown', (e) => {
    if (!root.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'Tab') {
      const f = $$('button', root).filter((b) => b.offsetParent);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });
  let sx = null;
  root.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  root.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    sx = null;
  });
  return { open };
})();

/* ---------- O buffet: frase que acende palavra por palavra ---------- */
function initStatement() {
  const el = $('[data-statement]');
  // Envolve cada palavra num <span class="w">, mantendo as fotos-pílula no lugar
  [...el.childNodes].forEach((n) => {
    if (n.nodeType !== 3) return;
    const frag = document.createDocumentFragment();
    n.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) frag.append(part);
      else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.append(s); }
    });
    n.replaceWith(frag);
  });
  const parts = [...el.children];
  if (reduceMotion) { parts.forEach((p) => p.classList.add('on')); return; }
  onScrollFrame(() => {
    const r = el.getBoundingClientRect();
    const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35));
    const n = Math.round(p * parts.length);
    parts.forEach((w, i) => w.classList.toggle('on', i < n));
  });
}

/* ---------- Atrações: lista que troca a foto do arco ---------- */
function initAttractions() {
  const stage = $('[data-attr-stage]');
  const tag = $('[data-attr-tag]');
  const items = $$('[data-attr-list] li');
  const photos = items.map((li) => bySrc[$('button', li).dataset.photo]);
  const cache = new Map();
  let current = -1;

  const imgFor = (i) => {
    if (!cache.has(i)) { const im = makeImg(photos[i], '(max-width: 860px) 90vw, 40vw'); stage.append(im); cache.set(i, im); }
    return cache.get(i);
  };
  const activate = (i) => {
    if (i === current) return;
    current = i;
    items.forEach((li, k) => li.classList.toggle('is-active', k === i));
    const im = imgFor(i);
    const show = () => cache.forEach((other) => other.classList.toggle('is-on', other === im));
    im.complete ? show() : im.addEventListener('load', show, { once: true });
    tag.textContent = $('button', items[i]).dataset.tag;
    if (items[i + 1]) imgFor(i + 1);
  };

  items.forEach((li, i) => {
    const btn = $('button', li);
    btn.addEventListener('click', () => lightbox.open(photos, i));
    if (finePointer) btn.addEventListener('mouseenter', () => activate(i));
    btn.addEventListener('focus', () => activate(i));
  });
  // Ao rolar, a atração no centro da tela vira a ativa (funciona no toque também)
  const io = new IntersectionObserver((entries) => entries.forEach((en) => en.isIntersecting && activate(items.indexOf(en.target))),
    { rootMargin: desktop() ? '-48% 0px -48% 0px' : '-62% 0px -30% 0px' });
  items.forEach((li) => io.observe(li));
  activate(0);
}

/* ---------- Espaço: rolagem vertical vira horizontal ---------- */
function initSpaces() {
  const section = $('[data-hscroll]');
  const track = $('[data-hscroll-track]');
  const bar = $('[data-hscroll-bar]');
  const cards = $$('[data-zoom]', track);
  const list = cards.map((b) => bySrc[b.dataset.zoom]);
  cards.forEach((b, i) => b.addEventListener('click', () => lightbox.open(list, i)));

  let distance = 0;
  const measure = () => {
    if (!desktop() || reduceMotion) { section.style.height = ''; track.style.transform = ''; distance = 0; return; }
    distance = Math.max(0, track.scrollWidth - innerWidth);
    section.style.height = `${distance + innerHeight}px`;
  };
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);
  onScrollFrame(() => {
    if (!distance) return;
    const p = clamp(-section.getBoundingClientRect().top / distance);
    track.style.transform = `translate3d(${(-p * distance).toFixed(1)}px, 0, 0)`;
    bar.style.setProperty('--p', p.toFixed(3));
  });
}

/* ---------- Festa: stories ---------- */
const STORY = [
  { title: 'Chegada', items: [
    ['entrada-tapete-vermelho', 'Tapete vermelho e balões esperando os convidados.'],
    ['entrada-colunas-baloes', 'As cores do tema já na porta.'],
    ['letras-nome-aniversariante', 'O nome do aniversariante bem na entrada.'] ] },
  { title: 'Decoração', items: [
    ['palco-mesa-bolo', 'O palco do parabéns montado com o tema escolhido.'],
    ['mesa-decorada-tema', 'Cada detalhe da mesa conversa com o tema.'],
    ['centro-mesa', 'Centros de mesa para os convidados.'] ] },
  { title: 'Parabéns', items: [
    ['bolo-tema', 'O bolo, no centro de tudo.'],
    ['doces-personalizados', 'Doces personalizados com o tema.'],
    ['doces-tema', 'Docinhos decorados um a um.'] ] },
  { title: 'Comes e bebes', items: [
    ['salgados-mesa', 'Salgados servidos à mesa.'],
    ['bebidas-copos', 'Refrigerante e suco para a criançada.'],
    ['estacao-cafe', 'Estação de café para os adultos.'] ] },
  { title: 'Lembrancinhas', items: [
    ['lembrancinhas', 'Uma lembrancinha para cada convidado levar.'],
    ['recepcao', 'Tudo organizado na recepção, na saída.'] ] },
];

function initStory() {
  const root = $('[data-story]');
  const img = $('[data-story-img]', root);
  const cap = $('[data-story-caption]', root);
  const chapterLabel = $('[data-story-chapter]', root);
  const bars = $('[data-story-bars]', root);
  const pauseBtn = $('[data-story-pause]', root);
  const chaptersEl = $('[data-chapters]');
  const DURATION = 4500;
  let c = 0, i = 0, t0 = 0, elapsed = 0, paused = reduceMotion, inView = false, raf = 0;

  const chapterBtns = STORY.map((ch, k) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    const thumb = new Image(); thumb.src = imgUrl(ch.items[0][0], 640); thumb.alt = ''; thumb.loading = 'lazy';
    b.append(thumb, ch.title);
    b.addEventListener('click', () => go(k, 0));
    li.append(b); chaptersEl.append(li);
    return b;
  });

  const renderBars = () => {
    bars.innerHTML = STORY[c].items.map((_, k) => `<span class="${k < i ? 'done' : ''}"><i></i></span>`).join('');
  };
  const go = (ci, ii) => {
    if (ci >= STORY.length) ci = 0;
    if (ci < 0) ci = STORY.length - 1;
    c = ci; i = ii;
    const [src, text] = STORY[c].items[i];
    const p = bySrc[src];
    img.classList.remove('is-new'); void img.offsetWidth; img.classList.add('is-new');
    img.sizes = '(max-width: 860px) 90vw, 420px'; img.srcset = srcsetFor(p); img.src = imgUrl(p.src, 1280); img.alt = p.alt;
    cap.textContent = text;
    chapterLabel.textContent = STORY[c].title;
    chapterBtns.forEach((b, k) => b.setAttribute('aria-current', k === c));
    renderBars();
    elapsed = 0; t0 = performance.now();
    // pré-carrega a próxima foto
    const nx = STORY[c].items[i + 1] || (STORY[c + 1] || STORY[0]).items[0];
    makeImg(bySrc[nx[0]], '420px');
  };
  const next = () => (i + 1 < STORY[c].items.length ? go(c, i + 1) : go(c + 1, 0));
  const prev = () => (i > 0 ? go(c, i - 1) : go(c - 1, STORY[(c - 1 + STORY.length) % STORY.length].items.length - 1));

  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const running = !paused && inView && !document.hidden;
    if (running) elapsed += now - t0;
    t0 = now;
    const bar = bars.children[i]?.firstChild;
    if (bar) bar.style.transform = `scaleX(${clamp(elapsed / DURATION)})`;
    if (elapsed >= DURATION) next();
  };
  const setPaused = (v) => {
    paused = v;
    pauseBtn.innerHTML = `<svg aria-hidden="true"><use href="#i-${v ? 'play' : 'pause'}"/></svg>`;
    pauseBtn.setAttribute('aria-label', v ? 'Continuar' : 'Pausar');
    img.style.animationPlayState = v ? 'paused' : 'running';
  };
  $('[data-story-next]', root).addEventListener('click', next);
  $('[data-story-prev]', root).addEventListener('click', prev);
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  // Segurar o dedo pausa, como no Instagram
  let holdTimer = 0, held = false;
  root.addEventListener('pointerdown', (e) => { if (e.target === pauseBtn) return; holdTimer = setTimeout(() => { held = true; setPaused(true); }, 220); });
  root.addEventListener('pointerup', () => { clearTimeout(holdTimer); if (held) { held = false; setPaused(false); } });
  root.addEventListener('click', (e) => { if (held) e.stopPropagation(); }, true);
  new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0.4 }).observe(root);

  go(0, 0); setPaused(paused);
  raf = requestAnimationFrame(tick);
}

/* ---------- Galeria completa ---------- */
function initGallery() {
  const wrap = $('[data-gallery]');
  const filters = $('[data-gallery-filters]');
  const more = $('[data-gallery-more]');
  const CATS = { all: 'Todas', festa: 'Festas', espaco: 'Espaço', diversao: 'Diversão', gastronomia: 'Comida e bebida' };
  const PAGE = innerWidth < 640 ? 8 : 12;
  let current = 'all', shown = PAGE;

  const order = [...PHOTOS].sort((a, b) => ((PHOTOS.indexOf(a) * 7) % PHOTOS.length) - ((PHOTOS.indexOf(b) * 7) % PHOTOS.length));
  const items = order.map((p) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'masonry__item'; b.style.setProperty('--c', p.color);
    b.setAttribute('aria-label', `Ampliar: ${p.alt}`);
    const im = document.createElement('img');
    im.loading = 'lazy'; im.decoding = 'async'; im.alt = p.alt;
    im.width = p.w > p.h ? 640 : 480; im.height = p.w > p.h ? 427 : 720;
    im.sizes = '(max-width: 640px) 50vw, 25vw'; im.srcset = srcsetFor(p); im.src = imgUrl(p.src, 640);
    im.addEventListener('load', () => im.classList.add('is-loaded'));
    b.append(im);
    b.addEventListener('click', () => { const v = visible(); lightbox.open(v.map((x) => x.p), v.findIndex((x) => x.p === p)); });
    wrap.append(b);
    return { el: b, p };
  });
  const matching = () => items.filter((x) => current === 'all' || x.p.cat === current);
  const visible = () => matching().slice(0, shown);
  const render = () => {
    const m = matching();
    items.forEach((x) => x.el.classList.add('is-hidden'));
    m.slice(0, shown).forEach((x) => x.el.classList.remove('is-hidden'));
    more.hidden = shown >= m.length;
    more.textContent = `Ver mais fotos (${Math.max(0, m.length - shown)})`;
  };
  Object.entries(CATS).forEach(([key, label]) => {
    const n = key === 'all' ? PHOTOS.length : PHOTOS.filter((p) => p.cat === key).length;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', key === 'all');
    b.innerHTML = `${label}<span>${n}</span>`;
    b.addEventListener('click', () => {
      current = key; shown = PAGE;
      $$('.chip', filters).forEach((c) => c.setAttribute('aria-pressed', c === b));
      render();
    });
    filters.append(b);
  });
  more.addEventListener('click', () => { shown += PAGE; render(); });
  render();
}

/* ---------- Como funciona: o vagão anda no trilho ---------- */
function initTrack() {
  const section = $('[data-track]');
  const rail = $('#rail');
  const svg = $('.track__rail');
  const wagon = $('[data-wagon]');
  const stops = $$('.track__stops li');
  const len = rail.getTotalLength();
  onScrollFrame(() => {
    if (!svg.getBoundingClientRect().width) return;
    const r = section.getBoundingClientRect();
    const p = reduceMotion ? 1 : clamp((innerHeight * 0.6 - r.top) / (innerHeight * 0.6 + r.height * 0.4));
    const w = svg.clientWidth / 1000, h = svg.clientHeight / 220;
    const a = rail.getPointAtLength(len * p);
    const b = rail.getPointAtLength(Math.min(len, len * p + 4));
    const c0 = rail.getPointAtLength(Math.max(0, len * p - 4));
    const ang = Math.atan2((b.y - c0.y) * h, (b.x - c0.x) * w) * 180 / Math.PI;
    wagon.style.transform = `translate(${(a.x * w).toFixed(1)}px, ${(a.y * h).toFixed(1)}px) rotate(${ang.toFixed(1)}deg)`;
    stops.forEach((s, k) => s.classList.toggle('is-passed', p >= k / (stops.length - 1) - 0.02));
  });
}

/* ---------- FAQ ---------- */
function initFaq() {
  const qs = $$('[data-faq] .faq__q');
  qs.forEach((q) => q.addEventListener('click', () => {
    const open = q.getAttribute('aria-expanded') === 'true';
    qs.forEach((o) => o.setAttribute('aria-expanded', 'false'));
    q.setAttribute('aria-expanded', String(!open));
  }));
}

/* ---------- Formulário + convite ao vivo ---------- */
function initForm() {
  const form = $('#form-orcamento');
  const status = $('.form__status', form);
  const phone = $('#f-whats');
  const date = $('#f-data');
  const inv = Object.fromEntries($$('[data-inv]').map((el) => [el.dataset.inv, el]));
  const DRAFT = 'magicstar-orcamento';
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  date.min = iso(new Date());

  const fmtDate = (v) => {
    if (!v) return 'a definir';
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const bump = (el) => { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); };
  const updateInvite = (name) => {
    const f = form.elements;
    if (!name || name === 'crianca') { inv.crianca.textContent = f.crianca.value.trim() || 'seu filho'; name && bump(inv.crianca); }
    if (!name || name === 'idade') { inv.idade.textContent = f.idade.value || '?'; name && bump(inv.idade.parentElement); }
    if (!name || name === 'data') { inv.data.textContent = fmtDate(f.data.value); name && bump(inv.data); }
  };

  phone.addEventListener('input', () => {
    let v = phone.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    else if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    else if (v.length) v = `(${v}`;
    phone.value = v;
  });

  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT) || '{}');
    Object.entries(saved).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v; });
  } catch {}
  updateInvite();
  form.addEventListener('input', (e) => {
    updateInvite(e.target.name);
    try { localStorage.setItem(DRAFT, JSON.stringify(Object.fromEntries(new FormData(form)))); } catch {}
  });

  const rules = {
    pais: (v) => (v.trim().length < 2 ? 'Informe o seu nome.' : ''),
    whatsapp: (v) => (v.replace(/\D/g, '').length < 10 ? 'Informe um WhatsApp com DDD.' : ''),
    crianca: (v) => (!v.trim() ? 'Informe o nome da criança.' : ''),
    idade: (v) => (!v ? 'Selecione a idade.' : ''),
    data: (v) => (!v ? 'Escolha a data da festa.' : v < date.min ? 'Escolha uma data a partir de hoje.' : ''),
    convidados: (v) => (!v || +v < 1 ? 'Informe quantos convidados, mesmo que aproximado.' : ''),
  };
  const check = (name) => {
    const el = form.elements[name];
    const msg = rules[name](el.value);
    const field = el.closest('.field');
    field.classList.toggle('is-invalid', !!msg);
    el.setAttribute('aria-invalid', !!msg);
    $('.field__error', field).textContent = msg;
    return !msg;
  };
  Object.keys(rules).forEach((n) => {
    form.elements[n].addEventListener('blur', () => form.elements[n].value && check(n));
    form.elements[n].addEventListener('change', () => form.elements[n].closest('.is-invalid') && check(n));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = Object.keys(rules).filter((n) => !check(n));
    if (bad.length) { form.elements[bad[0]].focus(); return; }
    const d = Object.fromEntries(new FormData(form));
    const [y, m, dd] = d.data.split('-');
    const idade = form.elements.idade.selectedOptions[0].textContent;
    const lines = [
      '*Pedido de orçamento — site Buffet Magic Star*',
      '',
      `👤 *Responsável:* ${d.pais.trim()}`,
      `📱 *WhatsApp:* ${d.whatsapp}`,
      `🎂 *Aniversariante:* ${d.crianca.trim()}`,
      `🎈 *Idade que vai completar:* ${idade}`,
      `📅 *Data desejada:* ${dd}/${m}/${y}`,
      `👨‍👩‍👧 *Convidados (aprox.):* ${d.convidados}`,
    ];
    if (d.mensagem.trim()) lines.push('', `💬 *Mensagem:* ${d.mensagem.trim()}`);
    const url = waLink(lines.join('\n'));
    // Sem 'noopener' nas features: com ele o navegador retorna null e não dá para detectar bloqueio de pop-up
    const win = window.open(url, '_blank');
    if (win) win.opener = null;
    else location.href = url;
    saveLead({ parent_name: d.pais.trim(), phone: d.whatsapp, child_name: d.crianca.trim(), child_age: idade, event_date: d.data, guests: Number(d.convidados) || null, message: d.mensagem.trim() });
    status.textContent = 'Pronto! Abrimos o WhatsApp com a sua mensagem. É só tocar em enviar.';
    status.classList.add('is-visible');
    try { localStorage.removeItem(DRAFT); } catch {}
  });

  // O convite inclina levemente com o mouse
  const card = $('[data-invite]');
  if (finePointer && !reduceMotion) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 8}deg) translateY(-6px)`;
    });
    card.addEventListener('pointerleave', () => (card.style.transform = ''));
  }
}

/* ---------- Pedido também vai para a Área do Gestor (aba Interessados) ---------- */
// Não bloqueia nada: se o banco não estiver configurado ou falhar, o WhatsApp já abriu.
async function saveLead(lead) {
  if (!SITE.supabase?.url || !SITE.supabase?.anonKey) return;
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    const client = createClient(SITE.supabase.url, SITE.supabase.anonKey, { auth: { persistSession: false } });
    const { error } = await client.from('leads').insert({ ...lead, source: 'site' });
    if (error) console.warn('Pedido não registrado no painel:', error.message);
  } catch (e) { console.warn('Pedido não registrado no painel:', e); }
}

applyConfig();
initHeader();
initReveal();
initStatement();
initAttractions();
initSpaces();
initStory();
initGallery();
initTrack();
initFaq();
initForm();
runScroll();
