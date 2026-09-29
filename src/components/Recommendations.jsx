import { getRecommendations } from '../utils/recommend.js';

const formatPrice = (v) => `${v.toLocaleString('ru-RU')} ₸`;

export default function Recommendations({ viewed, cart, triedOn, onPick }) {
  const items = getRecommendations({ viewed, cart, triedOn }, 4);
  if (items.length === 0) return null;

  return (
    <section className="recs">
      <span className="order-card__label">Recommendation Engine</span>
      <h2 className="catalog__title">Сізге ұнауы мүмкін</h2>

      <div className="recs__grid">
        {items.map((item) => (
          <button key={item.id} type="button" className="recs__card" onClick={() => onPick(item)}>
            <span
              className="recs__swatch"
              style={{ background: item.color }}
              aria-hidden="true"
            />
            <span className="recs__name">{item.name}</span>
            <span className="recs__price">{formatPrice(item.price)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
