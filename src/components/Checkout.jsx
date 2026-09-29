import { useState } from 'react';
import { price } from '../api.js';
import ProductImage from './ProductImage.jsx';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';

export default function Checkout({ rows, onQuantity, onRemove, onCheckout, busy, error, user, onBrowse }) {
  const [customer, setCustomer] = useState({ name: user?.name || '', email: user?.email || '', phone: '' });
  const [scenario, setScenario] = useState('success');
  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
  return <section className="checkout-page">
    <div className="section-heading"><div><h1>Корзина</h1><p className="section-subtitle">Ваши покупки в SHOPan</p></div><button className="back-link" onClick={onBrowse}>Продолжить покупки<ArrowRight size={17} /></button></div>
    {!rows.length ? <div className="catalog-empty"><ShoppingBag size={42} /><h2>В корзине пока пусто</h2><p>Самое время найти что-нибудь для себя.</p><button className="btn" onClick={onBrowse}>Перейти в каталог<ArrowRight size={18} /></button></div> :
      <div className="checkout-grid">
        <div>
          <div className="cart-lines">{rows.map(({ sku, quantity, product, variant }) => <div className="cart-line" key={sku}>
            <div className="cart-line__visual"><ProductImage product={product} color={variant.color} /></div>
            <div className="cart-line__body"><strong>{product.name}</strong><span>{variant.size} · {variant.color_name}</span>
              <span>{price(product.price)} / шт.</span></div>
            <div className="cart-line__controls"><label><span className="sr-only">Количество: {product.name}</span><span className="quantity-stepper"><button type="button" aria-label={`Уменьшить количество: ${product.name}`} disabled={quantity <= 1} onClick={() => onQuantity(sku, quantity - 1)}><Minus size={15} /></button>
              <input type="number" aria-label={`Количество: ${product.name}`} min="1" max={variant.stock} value={quantity}
                onChange={(event) => onQuantity(sku, Number(event.target.value))} /><button type="button" aria-label={`Увеличить количество: ${product.name}`} disabled={quantity >= variant.stock} onClick={() => onQuantity(sku, quantity + 1)}><Plus size={15} /></button></span>
              </label><button type="button" className="remove-item" aria-label={`Удалить: ${product.name}`} title="Удалить из корзины" onClick={() => onRemove(sku)}><Trash2 size={17} /></button></div>
            <strong className="cart-line__sum">{price(product.price * quantity)}</strong>
          </div>)}</div>
        </div>
        <form className="checkout-form" onSubmit={(event) => { event.preventDefault(); onCheckout({ customer, paymentScenario: scenario }); }}>
          <h2>Получатель</h2>
          <label>Имя<input required minLength="2" autoComplete="name" value={customer.name}
            onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
          <label>Электронная почта<input required type="email" autoComplete="email" value={customer.email}
            onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label>
          <label>Телефон<input required type="tel" autoComplete="tel" placeholder="+7 700 000 00 00" value={customer.phone}
            onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
          <div className="checkout-form__method"><strong>Получение</strong>
            <p>Самовывоз по согласованию. Место и время уточняются отдельно.</p></div>
          <label>Тестовый сценарий оплаты
            <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
              <option value="success">Успешный тестовый заказ</option>
              <option value="decline">Отклонение тестовой оплаты</option>
            </select></label>
          <div className="totals"><span>Товары <b>{price(subtotal)}</b></span>
            <span>Получение <b>{price(0)}</b></span><strong>Итого <b>{price(subtotal)}</b></strong></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn--wide" type="submit" disabled={busy || !rows.length}>
            {busy ? 'Оформляем…' : 'Подтвердить тестовый заказ'}
          </button>
          <p className="fine-print">Деньги не списываются. Рабочий платёжный сервис не подключён.</p>
        </form>
      </div>}
  </section>;
}
