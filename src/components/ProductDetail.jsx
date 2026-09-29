import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Heart, PackageCheck, Ruler, ScanLine, ShoppingBag, X, ZoomIn } from 'lucide-react';
import ProductImage from './ProductImage.jsx';
import { price } from '../api.js';
import { suggestedSize } from '../utils/bodyGeometry.js';
import { CATEGORY_LABELS } from '../data/catalog.js';
import { SIZE_CHART, SIZE_ORDER } from '../data/sizeChart.js';

export default function ProductDetail({ product, chestCm, gender, onBack, onTryOn, onAddToCart, favorite, onFavorite }) {
  const recommended = suggestedSize(chestCm);
  const first = product.variants.find((v) => v.size === recommended && v.stock > 0) || product.variants.find((v) => v.stock > 0) || product.variants[0];
  const [sku, setSku] = useState(first?.sku || '');
  const [chartGender, setChartGender] = useState(gender || 'female');
  const sizeDialog = useRef(null);
  const imageDialog = useRef(null);
  useEffect(() => setSku(first?.sku || ''), [product.id]);
  const selected = product.variants.find((v) => v.sku === sku) || first;
  const colors = [...new Map(product.variants.map((v) => [v.color, v])).values()];
  const sizes = product.variants.filter((v) => v.color === selected?.color);

  return <section className="product-page">
    <div className="breadcrumbs"><button onClick={onBack}>Каталог</button><ChevronRight size={14} /><span>{CATEGORY_LABELS[product.category]}</span><ChevronRight size={14} /><span>{product.name}</span></div>
    <button className="back-link product-back" type="button" onClick={onBack}><ArrowLeft size={16} />Назад к товарам</button>
    <div className="product-page__grid">
      <div className="product-gallery"><div className="product-page__visual"><ProductImage product={product} color={selected?.color} />
        <button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} aria-label={favorite ? 'Убрать из избранного' : 'В избранное'} title={favorite ? 'Убрать из избранного' : 'В избранное'} aria-pressed={favorite} onClick={onFavorite}><Heart size={22} fill={favorite ? 'currentColor' : 'none'} /></button>
        <button className="image-zoom icon-button" aria-label="Увеличить изображение" title="Увеличить изображение" onClick={() => imageDialog.current.showModal()}><ZoomIn size={21} /></button>
      </div><p className="image-caption">Визуализация товара. Оттенок и детали могут отличаться.</p></div>
      <div className="product-page__info"><div className="product-brand">SHOPan <Check size={13} /></div><h1>{product.name}</h1><span className="product-article">Артикул: {product.id}</span>
        <p className="product-page__price">{price(product.price)}</p>
        <div className="option-block"><span>Цвет <small>{selected?.color_name}</small></span><div className="swatch-row">{colors.map((v) => <button key={v.color} type="button" className={`swatch ${selected?.color === v.color ? 'swatch--active' : ''}`} style={{ background: v.color }} title={v.color_name} aria-label={`Цвет ${v.color_name}`} aria-pressed={selected?.color === v.color} onClick={() => setSku(product.variants.find((row) => row.color === v.color && row.size === selected?.size)?.sku || v.sku)} />)}</div></div>
        <div className="option-block"><span>Размер <button className="size-guide-link" onClick={() => sizeDialog.current.showModal()}><Ruler size={16} />Таблица размеров</button></span><div className="size-row">{sizes.map((v) => <button key={v.sku} type="button" className={`size-btn ${selected?.sku === v.sku ? 'size-btn--active' : ''}`} aria-pressed={selected?.sku === v.sku} disabled={!v.stock} onClick={() => setSku(v.sku)}>{v.size}</button>)}</div></div>
        <p className="stock-line"><span className={selected?.stock ? 'stock-dot' : 'stock-dot stock-dot--empty'} />{selected?.stock ? `В наличии · ${selected.stock} шт.` : 'Нет в наличии'}</p>
        <div className="product-actions"><button className="btn btn--wide" type="button" disabled={!selected?.stock} onClick={() => onAddToCart(selected.sku)}><ShoppingBag size={20} />Добавить в корзину</button><button className="btn btn--fitting btn--wide" type="button" disabled={!selected} onClick={() => onTryOn(product.id, selected.sku)}><ScanLine size={21} />Примерить на себе<ChevronRight size={18} /></button></div>
        <p className="fit-disclaimer">Примерка приблизительная. Ориентир по вашей мерке груди: {recommended}.</p>
        <div className="product-fulfillment"><PackageCheck size={22} /><div><strong>Получение по согласованию</strong><span>Самовывоз. Место и время уточняются при заказе.</span></div></div>
        <details className="product-description" open><summary>Описание и состав</summary><p>{product.description}</p><dl><div><dt>Состав</dt><dd>{product.fabric}</dd></div><div><dt>Категория</dt><dd>{CATEGORY_LABELS[product.category]}</dd></div></dl></details>
      </div>
    </div>
    <dialog className="size-dialog" ref={sizeDialog} aria-label="Таблица размеров"><div className="dialog-heading"><h2>Размеры SHOPan</h2><button className="icon-button" aria-label="Закрыть таблицу размеров" onClick={() => sizeDialog.current.close()}><X size={22} /></button></div><p className="muted">Ориентир по меркам тела, в сантиметрах.</p><div className="audience-tabs"><button className={chartGender === 'female' ? 'active' : ''} aria-pressed={chartGender === 'female'} onClick={() => setChartGender('female')}>Женские</button><button className={chartGender === 'male' ? 'active' : ''} aria-pressed={chartGender === 'male'} onClick={() => setChartGender('male')}>Мужские</button></div><div className="size-table-wrap"><table><thead><tr><th>Размер</th><th>Грудь</th><th>Талия</th><th>Бёдра</th></tr></thead><tbody>{SIZE_ORDER.map((size) => { const row = SIZE_CHART[chartGender][size]; return <tr key={size} className={size === recommended ? 'recommended' : ''}><th>{size}</th><td>{row.chest}</td><td>{row.waist}</td><td>{row.hips}</td></tr>; })}</tbody></table></div><p className="fine-print">Для точного выбора учитывайте крой и замеры изделия.</p></dialog>
    <dialog className="image-dialog" ref={imageDialog}><button className="icon-button" aria-label="Закрыть изображение" onClick={() => imageDialog.current.close()}><X size={24} /></button><ProductImage product={product} color={selected?.color} /></dialog>
  </section>;
}
