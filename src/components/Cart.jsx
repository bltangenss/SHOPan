import { useState } from 'react';

const formatPrice = (v) => `${v.toLocaleString('ru-RU')} ₸`;

export default function Cart({ items, onRemove, onCheckout }) {
  const [open, setOpen] = useState(false);
  const total = items.reduce((sum, i) => sum + i.price, 0);

  return (
    <>
      <button type="button" className="cart-toggle" onClick={() => setOpen(true)}>
        🛒 Себет ({items.length})
      </button>

      {open && (
        <div className="item-modal" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="item-modal__card cart-drawer" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="item-modal__close" onClick={() => setOpen(false)} aria-label="Жабу">
              ×
            </button>
            <h3>Себет</h3>

            {items.length === 0 ? (
              <p className="item-modal__desc">Себет бос.</p>
            ) : (
              <>
                <ul className="cart-drawer__list">
                  {items.map((item, idx) => (
                    <li key={`${item.id}-${idx}`}>
                      <span>{item.name}</span>
                      <span>{formatPrice(item.price)}</span>
                      <button type="button" className="btn--text" onClick={() => onRemove(idx)}>
                        Жою
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="item-modal__price">Барлығы: {formatPrice(total)}</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    onCheckout();
                    setOpen(false);
                  }}
                >
                  Тапсырыс беру
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
