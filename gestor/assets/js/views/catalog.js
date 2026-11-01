// Catálogo: pacotes, cardápios, decoração, temas, atrações e serviços. Alimenta os orçamentos.
import { sb, q } from '../supabase.js';
import { can } from '../auth.js';
import { setTitle } from '../app.js';
import { $, $$, html, raw, icon, brl, modal, toast, fail, emptyState, CATEGORIES, CATEGORY_SINGULAR, UNITS, formValues, validate, confirmDialog } from '../ui.js';

// Atrações reais do Buffet Magic Star (as mesmas do site), para importar sem digitar
const SITE_ATTRACTIONS = [
  ['Playground de vários andares', 'Tubos, redes, túneis e passarelas, com tobogã.'], ['Tobogã', 'Descida até a piscina de bolinhas.'],
  ['Piscinas de bolinhas', 'Dentro do playground.'], ['Tombo Legal', 'Escada e queda na piscina de bolinhas.'], ['Campinho', 'Grama sintética, rede de proteção e bola.'],
  ['Gira-gira Maçã', 'Brinquedo giratório com cercado.'], ['Torre', 'Brinquedo em torre com cadeirinhas.'], ['Vagão cenográfico', 'Cabine com assentos suspensa no salão.'],
  ['Girafa e carrinho', 'Brinquedos de montar para os menores.'], ['Air game', 'Mesa iluminada.'], ['Máquinas de pelúcia', 'Duas máquinas.'], ['Basquete', 'Cesta eletrônica.'],
  ['Game de movimento (Kinect)', 'Videogame de corpo inteiro.'], ['Sinuca', 'Mesa de sinuca.'], ['Casinha com cozinha', 'Faz de conta.'], ['Fashion Camarim', 'Acessórios para se arrumar.'], ['Penteadeira', 'Espelho com luzes.'],
];

export default async function catalog(el) {
  setTitle('Pacotes e serviços');
  const edit = can('gerente');
  let items = await q(sb.from('catalog_items').select('*').order('category').order('name'));
  let cat = 'todos', term = '';

  const draw = () => {
    const list = items.filter((i) => (cat === 'todos' || i.category === cat) && (!term || `${i.name} ${i.description}`.toLowerCase().includes(term)));
    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2 class="page-h">Pacotes e serviços</h2><p class="muted">Tudo o que o buffet oferece, com preço. É daqui que saem os itens dos orçamentos.</p></div>
        ${edit ? html`<div class="page-head__actions">
          ${!items.some((i) => i.category === 'atracao') ? html`<button class="btn btn--ghost" type="button" data-import>${icon('download')}Importar as 17 atrações do site</button>` : ''}
          <button class="btn btn--primary" type="button" data-new>${icon('plus')}Novo item</button></div>` : ''}
      </div>
      <div class="tabs tabs--scroll" role="tablist">${[['todos', 'Todos'], ...Object.entries(CATEGORIES)].map(([k, l]) => html`<button type="button" role="tab" aria-selected="${cat === k}" data-cat="${k}">${l} <em>${k === 'todos' ? items.length : items.filter((i) => i.category === k).length}</em></button>`)}</div>
      <label class="search">${icon('search')}<input type="search" placeholder="Buscar item" value="${term}" data-search aria-label="Buscar no catálogo"></label>
      ${list.length ? html`<div class="catalog">${list.map((i) => html`<article class="cat-card ${i.available ? '' : 'is-off'}">
        <div class="cat-card__img">${i.image_url ? html`<img src="${i.image_url}" alt="" loading="lazy">` : icon('box')}</div>
        <div class="cat-card__body">
          <span class="cat-card__cat">${CATEGORY_SINGULAR[i.category]}${i.available ? '' : ' · indisponível'}</span>
          <h3>${i.name}</h3>${i.description ? html`<p>${i.description}</p>` : ''}
          <p class="cat-card__price">${Number(i.price) ? brl(i.price) : 'Incluso / sem custo'} <small>${UNITS[i.unit]}</small></p>
          ${i.notes ? html`<p class="muted small">${i.notes}</p>` : ''}
        </div>
        ${edit ? html`<button class="icon-btn cat-card__edit" type="button" data-edit="${i.id}" aria-label="Editar ${i.name}">${icon('edit')}</button>` : ''}
      </article>`)}</div>`
        : emptyState(items.length ? 'Nada encontrado' : 'Catálogo vazio', items.length ? 'Mude o filtro ou a busca.' : 'Cadastre pacotes, cardápios, decorações, temas e serviços com o preço. Eles aparecem prontos na hora de montar o orçamento.')}`);

    $$('[data-cat]', el).forEach((b) => b.addEventListener('click', () => { cat = b.dataset.cat; draw(); }));
    $('[data-search]', el).addEventListener('input', (e) => { term = e.target.value.toLowerCase(); const pos = e.target.selectionStart; draw(); const s = $('[data-search]', el); s.focus(); s.setSelectionRange(pos, pos); });
    $('[data-new]', el)?.addEventListener('click', () => form());
    $$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => form(items.find((i) => i.id === b.dataset.edit))));
    $('[data-import]', el)?.addEventListener('click', async () => {
      if (!(await confirmDialog('Adicionar as 17 atrações do site como itens da categoria "Atrações", com preço R$ 0 (inclusas)? Você pode editar depois.', { ok: 'Importar' }))) return;
      try {
        const rows = await q(sb.from('catalog_items').insert(SITE_ATTRACTIONS.map(([name, description]) => ({ name, description, category: 'atracao', price: 0, unit: 'festa' }))).select());
        items = [...items, ...rows]; toast('Atrações importadas.'); draw();
      } catch (e) { fail(e); }
    });
  };

  async function form(item = null) {
    const actions = [{ label: 'Cancelar', cls: 'btn--ghost', value: null }];
    if (item) actions.unshift({ label: 'Excluir', cls: 'btn--ghost btn--danger-text', onClick: async () => {
      if (!(await confirmDialog(`Excluir "${item.name}"? Orçamentos antigos não são afetados.`, { danger: true, ok: 'Excluir' }))) return false;
      await q(sb.from('catalog_items').delete().eq('id', item.id)); items = items.filter((x) => x.id !== item.id); return true;
    } });
    actions.push({ label: 'Salvar', cls: 'btn--primary', onClick: async ({ el: m }) => {
      const f = $('[data-cat-form]', m);
      if (!validate(f, { name: (v) => (v ? '' : 'Informe o nome.'), price: (v) => (v === '' || Number(v) >= 0 ? '' : 'Preço inválido.') })) return false;
      const v = formValues(f);
      let image_url = item?.image_url || '';
      const file = f.image.files[0];
      if (file) {
        if (file.size > 3 * 1024 * 1024) throw new Error('A imagem deve ter até 3 MB.');
        const path = `catalogo/${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
        const { error } = await sb.storage.from('arquivos').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        image_url = sb.storage.from('arquivos').getPublicUrl(path).data.publicUrl;
      }
      if (v.remove_image) image_url = '';
      const payload = { name: v.name, description: v.description, category: v.category, price: Number(v.price) || 0, unit: v.unit, available: v.available, notes: v.notes, image_url };
      const saved = item ? await q(sb.from('catalog_items').update(payload).eq('id', item.id).select().single()) : await q(sb.from('catalog_items').insert(payload).select().single());
      items = item ? items.map((x) => (x.id === saved.id ? saved : x)) : [...items, saved];
      return true;
    } });
    const r = await modal({
      title: item ? 'Editar item' : 'Novo item do catálogo', size: 'modal--lg',
      body: String(html`<form data-cat-form novalidate class="form-grid">
        <div class="field field--full"><label for="k-name">Nome</label><input id="k-name" name="name" value="${item?.name || ''}" placeholder="Ex.: Pacote Estrela (até 80 convidados)"></div>
        <div class="field"><label for="k-cat">Categoria</label><select id="k-cat" name="category">${Object.entries(CATEGORY_SINGULAR).map(([k, l]) => html`<option value="${k}" ${k === (item?.category || (cat !== 'todos' ? cat : 'pacote')) ? raw('selected') : ''}>${l}</option>`)}</select></div>
        <div class="field"><label for="k-unit">Cobrança</label><select id="k-unit" name="unit">${Object.entries(UNITS).map(([k, l]) => html`<option value="${k}" ${k === (item?.unit || 'festa') ? raw('selected') : ''}>${l}</option>`)}</select></div>
        <div class="field"><label for="k-price">Preço (R$)</label><input id="k-price" name="price" type="number" min="0" step="0.01" inputmode="decimal" value="${item?.price ?? ''}"></div>
        <div class="field"><label class="check check--top"><input type="checkbox" name="available" ${item && !item.available ? '' : raw('checked')}>Disponível para orçamentos</label></div>
        <div class="field field--full"><label for="k-desc">Descrição</label><textarea id="k-desc" name="description" rows="3" placeholder="Aparece na proposta para o cliente">${item?.description || ''}</textarea></div>
        <div class="field field--full"><label for="k-img">Imagem <span class="opt">(opcional, até 3 MB)</span></label><input id="k-img" name="image" type="file" accept="image/*">
          ${item?.image_url ? html`<label class="check"><input type="checkbox" name="remove_image">Remover imagem atual</label>` : ''}</div>
        <div class="field field--full"><label for="k-notes">Observações internas</label><input id="k-notes" name="notes" value="${item?.notes || ''}"></div>
      </form>`),
      actions,
    });
    if (r) { toast('Catálogo atualizado.'); draw(); }
  }
  draw();
}
