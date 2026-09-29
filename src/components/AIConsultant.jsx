import { useState } from 'react';
import { askConsultant } from '../utils/consultant.js';

const formatPrice = (v) => `${v.toLocaleString('ru-RU')} ₸`;

export default function AIConsultant({ onPick }) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([
    {
      role: 'ai',
      text: 'Сәлем! Маған бюджет пен қажеттілікті жазыңыз, мысалы: "100000 теңгеге дейін жылы пальто керек".',
      items: [],
    },
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = query.trim();
    if (!text) return;

    const { reply, items } = askConsultant(text);
    setHistory((prev) => [
      ...prev,
      { role: 'user', text, items: [] },
      { role: 'ai', text: reply, items },
    ]);
    setQuery('');
  };

  return (
    <section className="consultant">
      <span className="order-card__label">AI консультант</span>
      <h2 className="catalog__title">Не іздеп жүрсіз?</h2>

      <div className="consultant__log">
        {history.map((msg, idx) => (
          <div key={idx} className={`consultant__msg consultant__msg--${msg.role}`}>
            <p>{msg.text}</p>
            {msg.items.length > 0 && (
              <div className="consultant__items">
                {msg.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="consultant__item"
                    onClick={() => onPick(item)}
                  >
                    <span>{item.name}</span>
                    <strong>{formatPrice(item.price)}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form className="consultant__form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Мысалы: 50000 теңгеге дейін көйлек керек"
        />
        <button type="submit" className="btn btn--small">
          Жіберу
        </button>
      </form>
    </section>
  );
}
