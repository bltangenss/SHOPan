import { ALL_ITEMS } from './recommend.js';

// Категория кілтсөздері (қазақша/орысша синонимдер) — сұраныстан категорияны анықтау үшін
const CATEGORY_KEYWORDS = {
  outerwear: ['пальто', 'куртка', 'сырт киім', 'жылы киім', 'верхн'],
  dress: ['платье', 'көйлек', 'дресс'],
  bottom: ['брюки', 'шалбар', 'юбка', 'бөтенбек', 'низ'],
  top: ['футболка', 'жейде', 'верх', 'кофта'],
  accessory: ['белбеу', 'шарф', 'сөмке', 'сумка', 'кроссовки', 'аксессуар'],
};

function parseBudget(text) {
  // "100000 теңге", "100 000 тг", "до 50000", "50к" сияқты форматтарды түсінеді
  const cleaned = text.replace(/\s/g, '');
  const kMatch = cleaned.match(/(\d+)[кk]/i);
  if (kMatch) return Number(kMatch[1]) * 1000;
  const numMatch = cleaned.match(/(\d{3,7})/);
  if (numMatch) return Number(numMatch[1]);
  return null;
}

function parseCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return null;
}

/**
 * AI консультант: пайдаланушының мәтіндік сұранысын талдап (бюджет + категория),
 * каталогтан сәйкес тауарларды таңдап шығарады.
 * Бұл — детерминистік, offline-жұмыс істейтін ереже-негізделген талдау (кілтсөз +
 * фильтр), сыртқы API/интернет қажет етпейді, сондықтан демо/презентацияда тұрақты жұмыс істейді.
 */
export function askConsultant(query) {
  const budget = parseBudget(query);
  const category = parseCategory(query);

  let matches = ALL_ITEMS;
  if (category) matches = matches.filter((i) => i.category === category);
  if (budget) matches = matches.filter((i) => i.price <= budget);

  matches = matches.sort((a, b) => a.price - b.price).slice(0, 3);

  let reply;
  if (matches.length === 0) {
    reply = budget
      ? `Кешіріңіз, ${budget.toLocaleString('ru-RU')} ₸ бюджетіне сәйкес тауар табылмады. Бюджетті арттырып көріңіз.`
      : 'Сұранысыңызды нақтылаңыз: категория (пальто, көйлек, брюки...) немесе бюджет (мысалы, "50000 теңгеге дейін") көрсетіңіз.';
  } else {
    const parts = [];
    if (category) parts.push(`категория бойынша`);
    if (budget) parts.push(`${budget.toLocaleString('ru-RU')} ₸ бюджетке сай`);
    const criteria = parts.length ? ` (${parts.join(', ')})` : '';
    reply = `Сізге мына ${matches.length} тауар сәйкес келеді${criteria}:`;
  }

  return { reply, items: matches, parsed: { budget, category } };
}
