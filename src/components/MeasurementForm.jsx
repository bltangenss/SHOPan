import { SIZE_CHART, SIZE_ORDER } from '../data/sizeChart.js';
import { suggestedSize } from '../utils/bodyGeometry.js';

const FIELDS = [
  { key: 'height', label: 'Рост', unit: 'см', min: 140, max: 210 },
  { key: 'chest', label: 'Обхват груди', unit: 'см', min: 70, max: 140 },
  { key: 'waist', label: 'Обхват талии', unit: 'см', min: 55, max: 130 },
  { key: 'hips', label: 'Обхват бёдер', unit: 'см', min: 70, max: 150 },
  { key: 'shoulder', label: 'Ширина плеч', unit: 'см', min: 32, max: 55 },
];

export const SKIN_TONES = ['#F4DFCB', '#E4C6A8', '#C99976', '#A9744F', '#7C4D30', '#4A2F1F'];
export const HAIR_COLORS = ['#1C1410', '#3B2A1E', '#6B4226', '#9C6B3E', '#C9A24B', '#D9D2C5'];

export default function MeasurementForm({
  measurements,
  onChange,
  gender,
  onGenderChange,
  skinTone,
  onSkinTone,
  hairColor,
  onHairColor,
}) {
  const handleNumber = (key) => (e) => {
    const value = Number(e.target.value);
    onChange({ ...measurements, [key]: value });
  };

  const activeSize = suggestedSize(measurements.chest);
  const applySize = (size) => {
    const preset = SIZE_CHART[gender]?.[size];
    if (preset) onChange(preset);
  };

  return (
    <div className="order-card">
      <div className="order-card__header">
        <h2>Мои параметры</h2>
      </div>

      <div className="gender-toggle" role="radiogroup" aria-label="Пол модели">
        <button
          type="button"
          role="radio"
          aria-checked={gender === 'female'}
          className={`gender-toggle__btn ${gender === 'female' ? 'gender-toggle__btn--active' : ''}`}
          onClick={() => onGenderChange('female')}
        >
          Женская
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={gender === 'male'}
          className={`gender-toggle__btn ${gender === 'male' ? 'gender-toggle__btn--active' : ''}`}
          onClick={() => onGenderChange('male')}
        >
          Мужская
        </button>
      </div>

      <div className="tape-divider" aria-hidden="true" />

      <div className="size-block">
        <span className="order-card__label">Размер</span>
        <div className="size-row" role="radiogroup" aria-label="Быстрый выбор размера">
          {SIZE_ORDER.map((size) => (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={activeSize === size}
              className={`size-btn ${activeSize === size ? 'size-btn--active' : ''}`}
              onClick={() => applySize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="tape-divider" aria-hidden="true" />

      <div className="field-list">
        {FIELDS.map((f) => (
          <label className="field-row" key={f.key}>
            <span className="field-row__label">{f.label}</span>
            <span className="field-row__control">
              <input
                type="range"
                min={f.min}
                max={f.max}
                value={measurements[f.key]}
                onChange={handleNumber(f.key)}
              />
              <span className="field-row__value">
                {measurements[f.key]} {f.unit}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="tape-divider" aria-hidden="true" />

      <div className="swatch-block">
        <span className="order-card__label">Тон кожи</span>
        <div className="swatch-row">
          {SKIN_TONES.map((tone) => (
            <button
              key={tone}
              type="button"
              className={`swatch ${skinTone === tone ? 'swatch--active' : ''}`}
              style={{ background: tone }}
              aria-label={`Тон кожи ${tone}`}
              onClick={() => onSkinTone(tone)}
            />
          ))}
        </div>
      </div>

      <div className="swatch-block">
        <span className="order-card__label">Цвет волос</span>
        <div className="swatch-row">
          {HAIR_COLORS.map((tone) => (
            <button
              key={tone}
              type="button"
              className={`swatch ${hairColor === tone ? 'swatch--active' : ''}`}
              style={{ background: tone }}
              aria-label={`Цвет волос ${tone}`}
              onClick={() => onHairColor(tone)}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
