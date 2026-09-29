import { CATALOG } from '../data/catalog.js';

// Қосымша тауарлар: аксессуарлар (fitting room-ға тікелей қатысы жоқ,
// бірақ ұсыныс жүйесінің "co-purchase" логикасын көрсету үшін керек).
export const ACCESSORIES = [
  {
    id: 'belt-charcoal',
    name: 'Былғары белбеу «Уголь»',
    category: 'accessory',
    price: 5900,
    color: '#2B2B2E',
    description: 'Классикалық белбеу, брюкамен және пальтомен жақсы үйлеседі.',
    goesWith: ['bottom', 'outerwear'],
  },
  {
    id: 'scarf-clay',
    name: 'Кашемир шарф «Терракота»',
    category: 'accessory',
    price: 9800,
    color: '#B1552E',
    description: 'Жұмсақ кашемир шарф, пальто мен куртканы толықтырады.',
    goesWith: ['outerwear'],
  },
  {
    id: 'bag-milk',
    name: 'Қол сөмке «Молоко»',
    category: 'accessory',
    price: 14500,
    color: '#EDE7DD',
    description: 'Күнделікті сөмке, платье және юбкамен үйлесімді.',
    goesWith: ['dress', 'bottom'],
  },
  {
    id: 'sneakers-ink',
    name: 'Кроссовки «Чернила»',
    category: 'accessory',
    price: 18900,
    color: '#221F1C',
    description: 'Кез келген повседневный образға сай аяқ киім.',
    goesWith: ['top', 'bottom'],
  },
];

const ALL_ITEMS = [...CATALOG, ...ACCESSORIES];

/**
 * Пайдаланушы әрекеттерінің (views, cart, tryOn) негізінде "ұсыныстар" есептейді.
 * Бұл ереже-негізделген (rule-based) жеңіл ұсыныс алгоритмі:
 *  - category affinity: пайдаланушы көбірек қараған категорияға salmaq артады
 *  - price affinity: орташа бюджет диапазонына жақын тауарларға бонус
 *  - co-occurrence: себеттегі/киіп көрген заттың категориясына сай аксессуарлар/жиынтық
 *  - "already interacted" элементтер ұсыныстан алынып тасталады
 */
export function getRecommendations({ viewed = [], cart = [], triedOn = [] }, limit = 4) {
  const interactedIds = new Set([...viewed, ...cart, ...triedOn].map((i) => i.id ?? i));
  const interactedItems = [...viewed, ...cart, ...triedOn]
    .map((entry) => (typeof entry === 'string' ? ALL_ITEMS.find((i) => i.id === entry) : entry))
    .filter(Boolean);

  if (interactedItems.length === 0) {
    // Ешбір әрекет болмаса — ең танымал (алдын ала белгіленген) 4 тауарды көрсету
    return ALL_ITEMS.slice(0, limit);
  }

  const categoryScore = {};
  let budgetSum = 0;
  interactedItems.forEach((item) => {
    categoryScore[item.category] = (categoryScore[item.category] || 0) + 1;
    budgetSum += item.price;
  });
  const avgBudget = budgetSum / interactedItems.length;
  const interactedCategories = new Set(interactedItems.map((i) => i.category));

  const scored = ALL_ITEMS
    .filter((item) => !interactedIds.has(item.id))
    .map((item) => {
      let score = 0;

      // 1) категория бойынша сәйкестік
      score += (categoryScore[item.category] || 0) * 3;

      // 2) accessory "goesWith" ережесі — киіп көрген/себеттегі категорияға сай ма
      if (item.category === 'accessory' && item.goesWith) {
        const matches = item.goesWith.filter((c) => interactedCategories.has(c)).length;
        score += matches * 4;
      }

      // 3) бюджет жақындығы (баға айырмашылығы неғұрлым аз болса, соғұрлым жоғары ұпай)
      const priceDiff = Math.abs(item.price - avgBudget);
      score += Math.max(0, 5 - priceDiff / 4000);

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.item);
}

export { ALL_ITEMS };
