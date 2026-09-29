import { useEffect, useState } from 'react';
import { api, price } from '../api.js';

const NEW_PRODUCT = { id: '', name: '', category: 'top', piece: 'tee', audience: 'unisex',
  description: '', fabric: '', price: 0 };
const NEW_VARIANT = { sku: '', productId: '', size: 'M', color: '#777777', colorName: '', stock: 0 };

export default function Admin({ onCatalogChange }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [product, setProduct] = useState(NEW_PRODUCT);
  const [variant, setVariant] = useState(NEW_VARIANT);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = async () => {
    const [catalog, orderData] = await Promise.all([api('/admin/products'), api('/admin/orders')]);
    setProducts(catalog.products); setOrders(orderData.orders);
  };
  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);
  const action = async (run) => {
    setError(''); setNotice('');
    try { await run(); await refresh(); await onCatalogChange(); setNotice('Сохранено'); }
    catch (err) { setError(err.message); }
  };
  return <section className="admin-page">
    <div className="section-heading"><div><span className="eyebrow">Управление магазином</span><h1>Администрирование</h1></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="success-note" role="status">{notice}</p>}
    <div className="admin-grid">
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); action(async () => {
        await api('/admin/products', { method: 'POST', body: product }); setProduct(NEW_PRODUCT);
      }); }}>
        <h2>Новый товар</h2>
        <label>Код товара<input required pattern="[a-z0-9-]{3,60}" value={product.id} onChange={(event) => setProduct({ ...product, id: event.target.value })} /></label>
        <label>Название<input required value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label>
        <label>Категория<select value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })}>
          <option value="top">Верх</option><option value="bottom">Низ</option><option value="outerwear">Верхняя одежда</option><option value="dress">Платья</option></select></label>
        <label>Модель одежды<select value={product.piece} onChange={(event) => setProduct({ ...product, piece: event.target.value })}>
          <option value="tee">Футболка</option><option value="coat">Пальто</option><option value="trousers">Брюки</option>
          <option value="skirt">Юбка</option><option value="dress">Платье</option></select></label>
        <label>Для кого<select value={product.audience} onChange={(event) => setProduct({ ...product, audience: event.target.value })}>
          <option value="unisex">Унисекс</option><option value="female">Женская</option><option value="male">Мужская</option></select></label>
        <label>Цена, ₸<input type="number" min="0" required value={product.price} onChange={(event) => setProduct({ ...product, price: Number(event.target.value) })} /></label>
        <label>Материал<input value={product.fabric} onChange={(event) => setProduct({ ...product, fabric: event.target.value })} /></label>
        <label>Описание<textarea value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></label>
        <button className="btn" type="submit">Создать товар</button>
      </form>
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); action(async () => {
        await api('/admin/variants', { method: 'POST', body: variant }); setVariant(NEW_VARIANT);
      }); }}>
        <h2>Новый вариант</h2>
        <label>Товар<select required value={variant.productId} onChange={(event) => setVariant({ ...variant, productId: event.target.value })}>
          <option value="">Выберите товар</option>{products.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select></label>
        <label>SKU<input required value={variant.sku} onChange={(event) => setVariant({ ...variant, sku: event.target.value })} /></label>
        <label>Размер<select value={variant.size} onChange={(event) => setVariant({ ...variant, size: event.target.value })}>
          {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => <option key={size}>{size}</option>)}</select></label>
        <label>Цвет<input type="color" value={variant.color} onChange={(event) => setVariant({ ...variant, color: event.target.value })} /></label>
        <label>Название цвета<input value={variant.colorName} onChange={(event) => setVariant({ ...variant, colorName: event.target.value })} /></label>
        <label>Остаток<input type="number" min="0" required value={variant.stock} onChange={(event) => setVariant({ ...variant, stock: Number(event.target.value) })} /></label>
        <button className="btn" type="submit">Добавить вариант</button>
      </form>
    </div>
    <div className="admin-section"><h2>Товары и остатки</h2>
      {products.map((row) => <div className="admin-product" key={row.id}>
        <div><strong>{row.name}</strong> <span className="muted">{row.id} · {price(row.price)} · {row.active ? 'Опубликован' : 'Скрыт'}</span></div>
        <div className="inline-actions"><label>Цена <input type="number" min="0" defaultValue={row.price} key={`${row.id}-${row.price}`}
          onBlur={(event) => { const value = Number(event.target.value); if (value !== row.price) action(() => api(`/admin/products/${row.id}`, { method: 'PATCH', body: { price: value } })); }} /></label>
          <button type="button" className="text-button" onClick={() => action(() => api(`/admin/products/${row.id}`, { method: 'PATCH', body: { active: !row.active } }))}>
            {row.active ? 'Скрыть' : 'Опубликовать'}</button></div>
        <div className="variant-table">{row.variants.map((item) => <label key={item.sku}>{item.size} / {item.color_name} <span className="muted">{item.sku}</span>
          <input type="number" min="0" defaultValue={item.stock} key={`${item.sku}-${item.stock}`}
            onBlur={(event) => { const value = Number(event.target.value); if (value !== item.stock) action(() => api(`/admin/variants/${item.sku}`, { method: 'PATCH', body: { stock: value } })); }} /></label>)}</div>
      </div>)}
    </div>
    <div className="admin-section"><h2>Заказы</h2>
      {orders.length ? orders.map((order) => <div className="admin-order" key={order.id}>
        <span>№ {order.id.slice(0, 8)} · {order.customer_name} · {price(order.total)}</span>
        <span>{order.fulfillment_status} / {order.payment_status}</span>
        <select aria-label={`Статус заказа ${order.id}`} value={order.fulfillment_status}
          disabled={order.fulfillment_status === 'cancelled'} onChange={(event) => action(() => api(`/admin/orders/${order.id}`, {
            method: 'PATCH', body: { fulfillmentStatus: event.target.value },
          }))}><option value="new">Новый</option><option value="processing">В обработке</option>
          <option value="fulfilled">Выдан</option></select>
      </div>) : <p className="muted">Заказов пока нет.</p>}
    </div>
  </section>;
}
