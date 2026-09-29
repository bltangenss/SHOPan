import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Heart, ScanLine, SearchX, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { CATEGORY_LABELS } from '../data/catalog.js';
import { price } from '../api.js';
import ProductImage from './ProductImage.jsx';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PRODUCT_COUNT = { one: 'товар', few: 'товара', many: 'товаров', other: 'товара' };
const pluralRules = new Intl.PluralRules('ru');
const FEATURED = ['tee-milk', 'coat-charcoal', 'dress-tape', 'trousers-charcoal', 'tee-ink', 'dress-muslin', 'trousers-clay', 'coat-ink', 'skirt-clay'];

export default function Catalog({ products, onOpen, onTryOn, onBrowse, filters, onFilters, favorites, onFavorite, favoritesOnly = false }) {
  const [sort, setSort] = useState('featured');
  const [sizes, setSizes] = useState([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStock, setInStock] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanel = useRef(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...filterPanel.current.querySelectorAll('button, input, select')].filter((el) => !el.disabled && el.getClientRects().length);
    focusable()[0]?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') setFiltersOpen(false);
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const onResize = () => { if (window.innerWidth > 850) setFiltersOpen(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); previousFocus?.focus(); };
  }, [filtersOpen]);
  const { query, category, audience } = filters;
  const activeCount = sizes.length + Number(minPrice !== '') + Number(maxPrice !== '') + Number(inStock) + Number(category !== 'all') + Number(audience !== 'all');
  const reset = () => { onFilters({ query: '', category: 'all', audience: 'all' }); setSizes([]); setMinPrice(''); setMaxPrice(''); setInStock(false); };
  const shown = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('ru');
    const rows = products.filter((item) =>
      (!favoritesOnly || favorites.includes(item.id)) &&
      (category === 'all' || item.category === category) &&
      (audience === 'all' || item.audience === audience || item.audience === 'unisex') &&
      (!sizes.length || item.variants.some((v) => sizes.includes(v.size) && v.stock > 0)) &&
      (minPrice === '' || item.price >= Number(minPrice)) &&
      (maxPrice === '' || item.price <= Number(maxPrice)) &&
      (!inStock || item.variants.some((v) => v.stock > 0)) &&
      `${item.name} ${item.description} ${item.fabric}`.toLocaleLowerCase('ru').includes(term));
    rows.sort((a, b) => sort === 'priceAsc' ? a.price - b.price : sort === 'priceDesc' ? b.price - a.price :
      sort === 'name' ? a.name.localeCompare(b.name, 'ru') :
        (FEATURED.indexOf(a.id) < 0 ? 100 : FEATURED.indexOf(a.id)) - (FEATURED.indexOf(b.id) < 0 ? 100 : FEATURED.indexOf(b.id)));
    return rows;
  }, [products, category, audience, query, sort, sizes, minPrice, maxPrice, inStock, favorites, favoritesOnly]);

  return <section className="shop-section" aria-labelledby="catalog-heading">
    <div className="breadcrumbs"><span>SHOPan</span><ChevronRight size={14} /><span>{favoritesOnly ? 'Избранное' : 'Каталог одежды'}</span></div>
    <div className="catalog-heading"><div><h1 id="catalog-heading">{favoritesOnly ? 'Избранное' : query.trim() ? `Поиск: ${query.trim()}` : category !== 'all' ? CATEGORY_LABELS[category] : 'Одежда'}</h1><span className="result-count">{shown.length} {PRODUCT_COUNT[pluralRules.select(shown.length)]}</span></div>
      <button className="fitting-shortcut" type="button" onClick={() => onTryOn()}><ScanLine size={20} /><span>Моя 3D-примерочная</span><ArrowRight size={17} /></button>
    </div>
    <div className="catalog-layout">
      {filtersOpen && <button className="filter-backdrop" aria-label="Закрыть фильтры" onClick={() => setFiltersOpen(false)} />}
      <aside ref={filterPanel} role={filtersOpen ? 'dialog' : undefined} aria-modal={filtersOpen || undefined} className={`catalog-sidebar ${filtersOpen ? 'catalog-sidebar--open' : ''}`} aria-label="Фильтры товаров">
        <div className="filter-heading"><h2>Фильтры</h2><button className="icon-button mobile-filter-close" onClick={() => setFiltersOpen(false)} title="Закрыть фильтры" aria-label="Закрыть фильтры"><X size={20} /></button></div>
        <div className="filter-section"><h3>Категория</h3><div className="category-list">
          {[['all', 'Вся одежда'], ...Object.entries(CATEGORY_LABELS)].map(([value, label]) => <button key={value} type="button" className={category === value ? 'selected' : ''} onClick={() => onFilters({ ...filters, category: value })}>
            <span>{label}</span><span>{products.filter((p) => (value === 'all' || p.category === value) && (!favoritesOnly || favorites.includes(p.id))).length}</span>
          </button>)}
        </div></div>
        <div className="filter-section"><h3>Цена, ₸</h3><div className="price-inputs">
          <label><span>От</span><input type="number" min="0" aria-label="Цена от" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} /></label>
          <label><span>До</span><input type="number" min="0" aria-label="Цена до" placeholder="40 000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></label>
        </div></div>
        <div className="filter-section"><h3>Размер</h3><div className="filter-sizes">{SIZES.map((size) => <button key={size} className={sizes.includes(size) ? 'selected' : ''} type="button" aria-pressed={sizes.includes(size)} onClick={() => setSizes((rows) => rows.includes(size) ? rows.filter((s) => s !== size) : [...rows, size])}>{size}</button>)}</div></div>
        <div className="filter-section"><label className="checkbox-label"><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /><span>Только в наличии</span></label></div>
        {activeCount > 0 && <button className="filter-reset" type="button" onClick={reset}><X size={15} />Сбросить фильтры</button>}
        <button className="btn mobile-filter-apply" type="button" onClick={() => setFiltersOpen(false)}>Показать товары ({shown.length})</button>
      </aside>
      <div className="catalog-results">
        <div className="catalog-toolbar"><div className="audience-tabs" aria-label="Для кого">
          {[['all', 'Всем'], ['female', 'Женщинам'], ['male', 'Мужчинам']].map(([value, label]) => <button type="button" key={value} aria-pressed={audience === value} className={audience === value ? 'active' : ''} onClick={() => onFilters({ ...filters, audience: value })}>{label}</button>)}
        </div><label className="sort-field"><span className="sr-only">Сортировка</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Рекомендуемые</option><option value="priceAsc">Сначала дешевле</option><option value="priceDesc">Сначала дороже</option><option value="name">По названию</option></select></label>
          <button className="filter-toggle" onClick={() => setFiltersOpen(true)} type="button"><SlidersHorizontal size={17} />Фильтры{activeCount > 0 && <span>{activeCount}</span>}</button>
        </div>
        {activeCount > 0 && <div className="active-filters">{category !== 'all' && <button onClick={() => onFilters({ ...filters, category: 'all' })}>{CATEGORY_LABELS[category]}<X size={13} /></button>}{sizes.map((s) => <button key={s} onClick={() => setSizes(sizes.filter((x) => x !== s))}>Размер {s}<X size={13} /></button>)}{(minPrice !== '' || maxPrice !== '') && <button onClick={() => { setMinPrice(''); setMaxPrice(''); }}>{minPrice || '0'} — {maxPrice || '∞'} ₸<X size={13} /></button>}</div>}
        {shown.length ? <div className="product-grid">{shown.map((item) => {
          const available = item.variants.filter((row) => row.stock > 0);
          const variant = available[0] || item.variants[0];
          const liked = favorites.includes(item.id);
          return <article key={item.id} className="product-tile">
            <div className="product-tile__visual"><button className="product-image-link" type="button" aria-label={`Открыть ${item.name}`} onClick={() => onOpen(item.id)}><ProductImage product={item} color={variant?.color} /></button>
              <button type="button" className={`favorite-button ${liked ? 'is-favorite' : ''}`} aria-label={`${liked ? 'Убрать из избранного' : 'В избранное'}: ${item.name}`} title={liked ? 'Убрать из избранного' : 'В избранное'} aria-pressed={liked} onClick={() => onFavorite(item.id)}><Heart size={19} fill={liked ? 'currentColor' : 'none'} /></button>
              {!available.length && <span className="product-tile__tag">Нет в наличии</span>}
            </div>
            <div className="product-tile__details"><strong className="product-tile__price">{price(item.price)}</strong><button className="product-name" onClick={() => onOpen(item.id)}>{item.name}</button>
              <span className="product-tile__category">{CATEGORY_LABELS[item.category]}</span><span className="product-sizes">{[...new Set(available.map((v) => v.size))].join(' · ') || 'Ожидается поступление'}</span>
              <div className="product-tile__actions"><button type="button" className="try-on-button" onClick={() => onTryOn(item.id)}><ScanLine size={16} />Примерить</button><button type="button" className="quick-shop" title="Выбрать размер и купить" aria-label={`Выбрать размер: ${item.name}`} onClick={() => onOpen(item.id)}><ShoppingBag size={18} /></button></div>
            </div>
          </article>;
        })}</div> : <div className="catalog-empty">{favoritesOnly && !favorites.length ? <Heart size={36} /> : <SearchX size={36} />}<h2>{favoritesOnly && !favorites.length ? 'Здесь будут любимые вещи' : 'Ничего не нашлось'}</h2><p>{favoritesOnly && !favorites.length ? 'Пока нет сохранённых товаров.' : 'Для выбранных параметров товаров нет.'}</p><button className="btn btn--ghost" onClick={favoritesOnly && !favorites.length ? onBrowse : reset}>{favoritesOnly && !favorites.length ? 'Перейти в каталог' : 'Сбросить фильтры'}</button></div>}
        <div className="catalog-bottom"><Check size={16} /><span>Цены в тенге · размеры от XS до XXL</span><span>SHOPan</span></div>
      </div>
    </div>
  </section>;
}
