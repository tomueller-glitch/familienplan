// Packungsgrößen: was es bei Aldi Süd (oder Lidl) wirklich zu kaufen gibt, und wie ein Rezept dazu passt.
// Reine Rechenlogik ohne Zugriff auf Seite oder Datenbank. Gespeichert wird in ep_settings unter "packungen":
// { schlüssel: { name, q, u, markt, quelle: 'hand' | 'kassenzettel', at } }.

// Schlüssel eines Produkts: klein, ohne „Bio“, ohne Klammern, Mengen und Zusätze nach einem Komma.
export function packKey(name) {
  const words = String(name || '').toLowerCase()
    .replace(/\(.*?\)/g, ' ').replace(/[,;].*$/, '')
    .replace(/\bbio[\s-]*/g, ' ').replace(/\d+([.,]\d+)?\s*(kg|g|ml|l|stück|stk\.?)\b/g, ' ')
    .replace(/[^a-zäöüß\s-]/g, ' ').split(/[\s-]+/).filter((w) => w.length > 1);
  const stem = (w) => (w.length >= 5 ? w.replace(/(en|er|n|e|s)$/, '') : w);
  return words.map(stem).join(' ');
}

// „400 g“, „1 kg“, „0,5 l“, „6 Stück“ in eine Menge mit Grundeinheit g, ml oder Stück.
export function parseSize(text) {
  const m = String(text || '').trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(kg|g|gramm|ml|l|liter|stück|stk\.?|st\.?)?/);
  if (!m) return null;
  let q = Number(m[1]);
  let u = m[2] || 'Stück';
  if (!(q > 0)) return null;
  if (u === 'kg') { q *= 1000; u = 'g'; } else if (u === 'gramm') u = 'g';
  else if (u === 'l' || u === 'liter') { q *= 1000; u = 'ml'; } else if (/^st/.test(u)) u = 'Stück';
  return { q: Math.round(q * 100) / 100, u };
}

const num = (q) => (Number.isInteger(q) ? String(q) : String(Math.round(q * 10) / 10).replace('.', ','));
export function fmtSize(q, u) {
  if (u === 'g' && q >= 1000) return `${num(q / 1000)} kg`;
  if (u === 'ml' && q >= 1000) return `${num(q / 1000)} l`;
  return `${num(q)} ${u}`;
}
export const packText = (n, p) => `${n} ${n === 1 ? 'Packung' : 'Packungen'} à ${fmtSize(p.q, p.u)}`;

// Bekannte Packung zu einem Posten oder einer Zutat. Gleicher Schlüssel, oder einer steckt ganz im anderen.
export function packFor(packs, label) {
  const k = packKey(label);
  if (!k || !packs) return null;
  const hit = Object.entries(packs).find(([key]) => key === k)
    || Object.entries(packs).find(([key]) => ` ${k} `.includes(` ${key} `) || ` ${key} `.includes(` ${k} `));
  return hit ? { key: hit[0], ...hit[1] } : null;
}

// Was das Rezept braucht, in Grundeinheit. Nur g, ml und Stück lassen sich mit einer Packung vergleichen.
export function needOf(ing) {
  if (!ing || ing.q == null) return null;
  const u = ing.u || 'Stück';
  if (u === 'kg') return { q: ing.q * 1000, u: 'g' };
  if (u === 'l') return { q: ing.q * 1000, u: 'ml' };
  if (u === 'g' || u === 'ml' || u === 'Stück') return { q: ing.q, u };
  return null;
}

// Drei Wege, wenn die Packung nicht zur Rezeptmenge passt.
// a: Rezept auf 1 Packung umrechnen, b: auf 2 Packungen, c: Rezept lassen und den Rest übrig behalten.
export function packOptions(need, pack) {
  if (!need || !pack || need.u !== pack.u || !(pack.q > 0)) return null;
  const f1 = pack.q / need.q;
  const f2 = (2 * pack.q) / need.q;
  const count = Math.max(1, Math.ceil(need.q / pack.q - 0.001));
  const rest = Math.round((count * pack.q - need.q) * 100) / 100;
  const fits = Math.abs(f1 - 1) < 0.01;
  // Vorschlag: Liegt eine oder zwei Packungen nah an der Rezeptmenge, wird umgerechnet, sonst bleibt das Rezept.
  const d1 = Math.abs(f1 - 1);
  const d2 = Math.abs(f2 - 1);
  const rec = fits ? null : Math.min(d1, d2) <= 0.25 ? (d1 <= d2 ? 'a' : 'b') : f2 > 1 && f2 <= 2.1 ? 'b' : 'c';
  return { f1, f2, count, rest, fits, rec };
}

// Mengen eines Rezepts mit einem Faktor umrechnen. Die Hauptzutat wird genau auf die Packungen gesetzt.
const roundQ = (q, u) => {
  if (u === 'g' || u === 'ml') return q >= 20 ? Math.round(q / 5) * 5 : Math.round(q);
  if (['Packung', 'Dose', 'Glas', 'Becher', 'Tube', 'Kugel', 'Stk.', 'Stück'].includes(u)) return Math.max(1, Math.round(q));
  return Math.max(0.25, Math.round(q * 4) / 4);
};
export function scaleRecipe(ingredients, factor, mainIndex, mainQ) {
  return (ingredients || []).map((ing, i) => {
    if (i === mainIndex) return { ...ing, q: mainQ };
    if (ing.c === 'basis' || ing.q == null) return ing;
    return { ...ing, q: roundQ(ing.q * factor, ing.u) };
  });
}

// Index der Rezeptzutat, um die es geht (gleicher Schlüssel wie der Posten).
export function findIngredient(ingredients, label) {
  const k = packKey(label);
  const list = ingredients || [];
  let i = list.findIndex((g) => g.q != null && packKey(g.n) === k);
  if (i < 0) i = list.findIndex((g) => g.q != null && (` ${packKey(g.n)} `.includes(` ${k} `) || ` ${k} `.includes(` ${packKey(g.n)} `)));
  return i;
}

// Frisches hält nicht lange: Fleisch, Fisch, Kühlregal, Obst und Gemüse, Brot.
export const isFresh = (category) => ['fleisch', 'kuehl', 'obst', 'brot'].includes(category);

// Packungsgrößen aus Kassenzetteln übernehmen. Was die Familie von Hand eingetragen hat, bleibt.
export function learnFromReceipt(packs, items, shop, at) {
  const out = { ...(packs || {}) };
  let added = 0;
  for (const it of items || []) {
    const size = parseSize(it.packung);
    const key = packKey(it.name);
    if (!size || !key || (out[key] && out[key].quelle === 'hand')) continue;
    out[key] = { name: String(it.name), q: size.q, u: size.u, markt: /lidl/i.test(shop || '') ? 'lidl' : '', quelle: 'kassenzettel', at };
    added += 1;
  }
  return { packs: out, added };
}

// Text für Claude: eine Zeile pro Produkt.
export function packLines(packs) {
  return Object.values(packs || {}).sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map((p) => `${p.name}: ${fmtSize(p.q, p.u)}${p.markt === 'lidl' ? ' (Lidl)' : ''}`);
}

// Portionen nach dem Umrechnen. Ab 5 Portionen bleibt für den nächsten Tag etwas übrig.
export const servingsFor = (factor) => Math.max(1, Math.round(4 * factor));
