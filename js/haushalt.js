// Haushaltsbuch: Kassenzettel, Kategorien, Monatsübersicht. Ohne Zugriff auf Seite oder Datenbank.

import { todayISO } from './logic.js';

// Gleiche Grundwerte wie in der Push-Funktion (KATEGORIEN).
export const KATEGORIEN = [
  'Fleisch und Fisch', 'Obst und Gemüse', 'Milch, Käse und Eier', 'Brot und Backwaren', 'Vorrat und Tiefkühl',
  'Süßes und Snacks', 'Getränke', 'Drogerie und Hygiene', 'Haushalt und Putzen', 'Tierbedarf', 'Sonstiges', 'Pfand und Rabatt',
];

export const MARKETS = ['Aldi Süd', 'Lidl'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function settingsOf(settings) {
  const v = ((settings || []).find((s) => s.key === 'haushalt') || {}).value || {};
  let kategorien = Array.isArray(v.kategorien) && v.kategorien.length ? v.kategorien.map(String).filter(Boolean) : KATEGORIEN.slice();
  if (!kategorien.includes('Sonstiges')) kategorien = [...kategorien, 'Sonstiges'];
  const budget = Number(v.budget) > 0 ? Math.round(Number(v.budget)) : null;
  return { kategorien, budget, merken: v.merken && typeof v.merken === 'object' ? v.merken : {} };
}

export const money = (x) => Math.round((Number(x) || 0) * 100) / 100;
export const euro = (x) => `${money(x).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const euroShort = (x) => `${Math.round(Number(x) || 0).toLocaleString('de-DE')} €`;

export const monthOf = (day) => String(day || todayISO()).slice(0, 7);
export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Summe der Posten eines Kassenzettels.
export const itemsSum = (items) => money((items || []).reduce((a, p) => a + (Number(p.preis) || 0), 0));

// Monatsübersicht. Maßgeblich ist der Betrag auf dem Kassenzettel. Weicht die Summe der Posten davon ab,
// landet der Unterschied unter "Sonstiges", damit die Kategorien zusammen den Gesamtbetrag ergeben.
export function summary(receipts, month) {
  const list = (receipts || []).filter((r) => monthOf(r.day) === month);
  const byCat = {};
  const byShop = {};
  let total = 0;
  for (const r of list) {
    const t = money(r.total);
    total += t;
    const shop = r.shop || 'Ohne Markt';
    byShop[shop] = (byShop[shop] || 0) + t;
    for (const p of r.items || []) byCat[p.kategorie || 'Sonstiges'] = (byCat[p.kategorie || 'Sonstiges'] || 0) + (Number(p.preis) || 0);
    const rest = money(t - itemsSum(r.items));
    if (Math.abs(rest) >= 0.01) byCat.Sonstiges = (byCat.Sonstiges || 0) + rest;
  }
  const sorted = (o) => Object.entries(o).map(([name, sum]) => ({ name, sum: money(sum) })).filter((x) => Math.abs(x.sum) >= 0.01).sort((a, b) => b.sum - a.sum);
  return { month, count: list.length, total: money(total), byCat: sorted(byCat), byShop: sorted(byShop), receipts: list };
}

// Schlüssel, unter dem sich die App die Kategorie eines Artikels merkt.
export const learnKey = (p) => String((p && (p.text || p.name)) || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);

// Gemerkte Kategorien auf neue Posten anwenden (falls Claude anders entschieden hat).
export function applyLearned(items, merken, kategorien) {
  return (items || []).map((p) => {
    const k = merken[learnKey(p)];
    return k && kategorien.includes(k) ? { ...p, kategorie: k } : p;
  });
}

// Neue Zuordnungen aus den Korrekturen der Eltern. Höchstens 300 Einträge, die neuesten gewinnen.
export function learnFrom(merken, items, before) {
  const out = { ...(merken || {}) };
  let changed = false;
  (items || []).forEach((p, n) => {
    const old = before && before[n];
    if (!p.kategorie || !old || old.kategorie === p.kategorie) return;
    const key = learnKey(p);
    if (!key) return;
    delete out[key];
    out[key] = p.kategorie;
    changed = true;
  });
  const keys = Object.keys(out);
  if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete out[k];
  return changed ? out : null;
}

// Einkaufsliste: welche offenen Posten stehen auf dem Kassenzettel?
const norm = (s) => String(s || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]+/g, ' ');
const STOP = new Set(['bio', 'frische', 'frisch', 'packung', 'stuck', 'stueck', 'gramm', 'kilo', 'liter', 'oder', 'fuer', 'mit', 'und', 'von', 'aus']);
export function matchShopping(items, shopping) {
  const names = (items || []).map((p) => ` ${norm(p.name)} ${norm(p.text)} `);
  return (shopping || []).filter((i) => !i.checked).filter((i) => {
    const words = norm(i.label).split(' ').filter((w) => w.length >= 4 && !STOP.has(w));
    if (!words.length) return false;
    const stem = (w) => (w.length > 6 ? w.slice(0, w.length - 1) : w);
    return names.some((n) => words.some((w) => n.includes(stem(w))));
  }).map((i) => i.id);
}

// Ampel für das Monatsbudget, hochgerechnet auf den ganzen Monat.
export function budgetState(total, budget, month, today = todayISO()) {
  if (!budget) return null;
  const share = total / budget;
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const elapsed = monthOf(today) === month ? Number(today.slice(8, 10)) : monthOf(today) > month ? days : 0;
  const expected = elapsed ? total / elapsed * days : total;
  // Hochrechnen erst ab dem 10., vorher sagt sie wenig.
  const projected = elapsed >= 10;
  const level = share >= 1 ? 'rot' : (projected && expected > budget * 1.05) ? 'gelb' : 'gruen';
  return { share, left: money(budget - total), expected: money(expected), level, projected, running: monthOf(today) === month };
}

// Antwort im Demo-Modus: ein typischer Aldi-Zettel, damit sich der Ablauf ausprobieren lässt.
export function demoReceipt(today = todayISO()) {
  const items = [
    ['BIO HAEHN.BR.FIL', 'Bio-Hähnchenbrustfilet', 7.99, 'Fleisch und Fisch'],
    ['SEELACHSFILET TK', 'Seelachsfilet, tiefgekühlt', 3.49, 'Fleisch und Fisch'],
    ['BIO KAROTTEN 1KG', 'Bio-Karotten 1 kg', 1.29, 'Obst und Gemüse'],
    ['SALATGURKE', 'Salatgurke', 0.69, 'Obst und Gemüse'],
    ['BIO VOLLMILCH 1L', 'Bio-Vollmilch 1 l', 1.15, 'Milch, Käse und Eier'],
    ['SKYR NATUR', 'Skyr natur', 1.29, 'Milch, Käse und Eier'],
    ['KRUSTENBROT', 'Krustenbrot', 1.79, 'Brot und Backwaren'],
    ['SPUELMASCH.TABS', 'Spülmaschinentabs', 3.95, 'Haushalt und Putzen'],
    ['PFAND', 'Pfand', 0.25, 'Pfand und Rabatt'],
  ].map(([text, name, preis, kategorie]) => ({ text, name, preis, kategorie }));
  return { markt: 'Aldi Süd', datum: today, summe: itemsSum(items), hinweis: 'Beispiel aus dem Demo-Modus, kein echter Kassenzettel.', posten: items };
}

// Rezept aus Foto im Demo-Modus: so sieht die Antwort der Funktion aus.
export function demoRecipe() {
  return {
    name: 'Linsen-Dal mit Kokosmilch (Beispiel)',
    category: 'vegan', duration_min: 35, tags: ['Thermomix', 'schnell'],
    note: 'Beispiel aus dem Demo-Modus, kein echtes Foto.', prep: '',
    ingredients: [[1, 'Stück', 'Zwiebel', 'obst'], [2, 'Stück', 'Knoblauchzehen', 'obst'], [20, 'g', 'Ingwer', 'obst'], [250, 'g', 'rote Linsen', 'vorrat'],
      [400, 'ml', 'Kokosmilch', 'vorrat'], [400, 'g', 'stückige Tomaten', 'vorrat'], [100, 'g', 'Babyspinat', 'obst'], [250, 'g', 'Basmatireis', 'vorrat'],
      [null, '', 'Currypulver', 'basis'], [null, '', 'Salz', 'basis']],
    steps: ['Zwiebel, Knoblauch und Ingwer in den Mixtopf geben, 5 Sek./Stufe 5 zerkleinern.', 'Öl zugeben und 3 Min./120 °C/Stufe 1 dünsten.',
      'Linsen, Kokosmilch, Tomaten, 300 ml Wasser und Gewürze zugeben, 20 Min./100 °C/Linkslauf/Stufe 1 garen.', 'Spinat unterheben und mit Reis servieren.'],
    nutrition: { kcal: 640, fat: 22, sat: 15, carbs: 85, sugar: 9, fiber: 14, protein: 24, salt: 1.2 },
    meta: { portionen_original: 4, naehrwerte_vom_rezept: false },
  };
}

// Zutaten aus Foto im Demo-Modus.
export function demoIngredients() {
  return {
    gericht: 'Linsen-Dal mit Kokosmilch (Beispiel)', hinweis: 'Beispiel aus dem Demo-Modus, kein echtes Foto.',
    posten: [
      { name: 'Zwiebel', menge: '1 Stück', abteilung: 'obst' }, { name: 'Ingwer', menge: '20 g', abteilung: 'obst' },
      { name: 'Rote Linsen', menge: '250 g', abteilung: 'vorrat' }, { name: 'Kokosmilch', menge: '400 ml', abteilung: 'vorrat' },
      { name: 'Babyspinat', menge: '100 g', abteilung: 'obst' }, { name: 'Basmatireis', menge: '250 g', abteilung: 'vorrat' },
      { name: 'Currypulver', menge: '', abteilung: 'basis' }, { name: 'Salz', menge: '', abteilung: 'basis' },
    ],
  };
}

// Preisgedächtnis: pro Artikel und Markt der übliche (mittlere) und der letzte Preis.
// Gleiche Regeln wie priceTable in der Push-Funktion.
const median = (xs) => { const v = xs.slice().sort((a, b) => a - b); const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
export function priceBook(receipts) {
  const book = new Map();
  for (const r of receipts || []) {
    for (const p of r.items || []) {
      const price = Number(p.preis);
      if (!(price > 0) || p.kategorie === 'Pfand und Rabatt') continue;
      const name = String(p.name || p.text || '').trim();
      const key = name.toLowerCase();
      if (!key) continue;
      const e = book.get(key) || { name, kategorie: p.kategorie, n: 0, shops: new Map() };
      const shop = r.shop || 'anderer Markt';
      const list = e.shops.get(shop) || [];
      list.push({ price, day: r.day });
      e.shops.set(shop, list);
      e.n += 1;
      book.set(key, e);
    }
  }
  return [...book.values()].map((e) => {
    const shops = [...e.shops.entries()].map(([shop, list]) => {
      const sorted = list.slice().sort((a, b) => (a.day < b.day ? -1 : 1));
      const last = sorted[sorted.length - 1];
      return { shop, n: list.length, median: money(median(list.map((x) => x.price))), last: last.price, lastDay: last.day };
    }).sort((a, b) => a.median - b.median);
    return { name: e.name, kategorie: e.kategorie, n: e.n, shops, cheapest: shops.length > 1 ? shops[0].shop : null };
  }).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'de'));
}

// Jahresüberblick: Summe pro Monat, Kategorien im Jahr und Bio-Anteil bei Lebensmitteln.
export const NON_FOOD = ['Drogerie und Hygiene', 'Haushalt und Putzen', 'Tierbedarf', 'Pfand und Rabatt', 'Sonstiges'];
const isBio = (p) => /(^|[^a-zäöü])bio([^a-zäöü]|$)/i.test(`${p.name || ''} ${p.text || ''}`);
export function yearSummary(receipts, year) {
  const months = Array.from({ length: 12 }, (_, m) => ({ month: `${year}-${String(m + 1).padStart(2, '0')}`, total: 0, food: 0, bio: 0, count: 0 }));
  const cats = {};
  let total = 0;
  for (const r of receipts || []) {
    if (String(r.day || '').slice(0, 4) !== String(year)) continue;
    const m = months[Number(String(r.day).slice(5, 7)) - 1];
    if (!m) continue;
    const t = money(r.total);
    m.total += t; m.count += 1; total += t;
    for (const p of r.items || []) {
      const k = p.kategorie || 'Sonstiges';
      const v = Number(p.preis) || 0;
      cats[k] = (cats[k] || 0) + v;
      if (!NON_FOOD.includes(k) && v > 0) { m.food += v; if (isBio(p)) m.bio += v; }
    }
    const rest = money(t - itemsSum(r.items));
    if (Math.abs(rest) >= 0.01) cats.Sonstiges = (cats.Sonstiges || 0) + rest;
  }
  const food = months.reduce((a, m) => a + m.food, 0);
  const bio = months.reduce((a, m) => a + m.bio, 0);
  const active = months.filter((m) => m.count);
  return {
    year, total: money(total), avg: active.length ? money(total / active.length) : 0, activeMonths: active.length,
    bioShare: food ? bio / food : null,
    months: months.map((m) => ({ ...m, total: money(m.total), bioShare: m.food ? m.bio / m.food : null })),
    cats: Object.entries(cats).map(([name, sum]) => ({ name, sum: money(sum), share: total ? sum / total : 0 })).filter((x) => Math.abs(x.sum) >= 0.01).sort((a, b) => b.sum - a.sum),
  };
}

// Grobe Schätzung, was eine Einkaufstour kostet: Preise aus den Kassenzetteln, eine Packung pro Posten,
// bei „2 Packungen“, „3 Stück“ und ähnlichem entsprechend mehr. Posten ohne bekannten Preis zählen nicht mit.
const PACK = /^(\d{1,2})\s*(packung|packungen|pck|stück|stk|dose|dosen|glas|gläser|flasche|flaschen|becher|netz|netze|bund|beutel|schale|schalen|tüte|tüten)\b/i;
export function tripEstimate(items, receipts) {
  const book = priceBook(receipts).map((e) => ({ ...e, key: ` ${norm(e.name)} ` }));
  let sum = 0; let known = 0; let lidl = 0;
  const list = (items || []).filter((i) => i.category !== 'vorhanden');
  for (const i of list) {
    const words = norm(i.label).split(' ').filter((w) => w.length >= 4 && !STOP.has(w));
    if (!words.length) continue;
    const stem = (w) => (w.length > 6 ? w.slice(0, w.length - 1) : w);
    let best = null; let hits = 0;
    for (const e of book) {
      // Nur Wortanfänge zählen: „Butter“ soll nicht „Erdnussbutter“ treffen, „Reis“ nicht „Preis“.
      const h = words.filter((w) => e.key.includes(` ${stem(w)}`)).length;
      if (h > hits) { best = e; hits = h; }
    }
    if (!best) continue;
    const wantLidl = i.shop === 'lidl';
    const pick = best.shops.find((x) => /lidl/i.test(x.shop) === wantLidl) || best.shops[0];
    const m = String(i.qty || '').trim().match(PACK);
    // „10 Stück“ Eier sind eine Packung: Stückzahlen über 4 zählen nicht als mehrere Packungen.
    const n = m ? Number(m[1]) : 1;
    const times = m && /^st/i.test(m[2]) && n > 4 ? 1 : Math.min(6, n);
    const price = pick.median * times;
    sum += price; known += 1;
    if (wantLidl) lidl += price;
  }
  return { sum: money(sum), lidl: money(lidl), known, total: list.length };
}
