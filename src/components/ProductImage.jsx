import GarmentThumb from './GarmentThumb.jsx';

const CELLS = {
  'tee-milk': [0, 0], 'tee-ink': [1, 0], 'coat-charcoal': [2, 0],
  'coat-ink': [0, 1], 'trousers-charcoal': [1, 1], 'trousers-clay': [2, 1],
  'dress-tape': [0, 2], 'dress-muslin': [1, 2], 'skirt-clay': [2, 2],
};
const ROWS = [{ top: 0, height: 402 }, { top: 402, height: 408 }, { top: 810, height: 444 }];

export default function ProductImage({ product, color, className = '' }) {
  const cell = CELLS[product.id];
  const row = cell && ROWS[cell[1]];
  return <div className={`product-image ${className}`} role="img" aria-label={`Визуализация: ${product.name}`}>
    {cell ? <div className="product-image__crop" style={{
      width: `${Math.min(1, 418 / row.height) * 100}%`, aspectRatio: `418 / ${row.height}`,
      backgroundImage: 'url(/images/shopan-products.png)',
      backgroundSize: `300% ${1254 / row.height * 100}%`,
      backgroundPosition: `${cell[0] * 50}% ${row.top / (1254 - row.height) * 100}%`,
    }} /> : <GarmentThumb piece={product.piece} color={color || product.variants?.[0]?.color || '#6b7280'} size={180} />}
  </div>;
}
