import { FERIEN, FERIEN_BIS } from './ferien.js';
import { packFor, needOf, packText } from './packungen.js';

// Reine Rechenlogik ohne Zugriff auf Seite oder Datenbank.
// Datum, Statistik, Bewertungsregel, Wochenvorschlag, Einkaufsliste.

export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Regel fürs Aussortieren: Schnitt unter 2 Sternen, sobald mindestens 2 Personen bewertet haben.
export const RULE = { threshold: 2, minRaters: 2 };
// Lieblingsgerichte der Familie kommen im Vorschlag etwas häufiger dran.
export const FAVORITE_BONUS = 1.3;
// Jedes Herz als Lieblingsgericht der Woche gibt 10 Prozent Vorsprung, höchstens 50 Prozent.
export const heartFactor = (stat) => 1 + 0.1 * Math.min(5, (stat && stat.hearts) || 0);
// Das Herz der Woche gibt es ab Freitag bis zum Sonntag der Folgewoche.
export function heartOpen(weekStart, today = todayISO()) {
  return today >= addDays(weekStart, 4) && today <= addDays(weekStart, 13);
}

export const DISH_CATS = {
  rind: 'Rind', gefluegel: 'Geflügel', fisch: 'Fisch', schwein: 'Schwein',
  vegan: 'Vegan', veggie: 'Vegetarisch', gemischt: 'Gemischt',
  brotbox: 'Brotbox-Rezept',
};
// Brotbox-Rezepte (Energiebällchen, Muffins …) sind keine Abendessen und kommen nie in den Wochenplan.
export const isDinner = (dish) => dish.category !== 'brotbox';

export const SHOP_CATS = {
  fleisch: 'Fleisch und Fisch', kuehl: 'Kühlregal', obst: 'Obst und Gemüse',
  tk: 'Tiefkühl', brot: 'Brot und Backwaren', vorrat: 'Vorrat', haushalt: 'Haushalt und Meerschweinchen', sonst: 'Sonstiges', vorhanden: 'Schon im Haus',
};
export const SHOP_CAT_ORDER = ['obst', 'brot', 'fleisch', 'kuehl', 'tk', 'vorrat', 'haushalt', 'sonst', 'vorhanden'];

/* ---------- Datum ---------- */

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function toISO(dt) {
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${m}-${d}`;
}
// Im Demo-Modus lässt sich ein Testdatum setzen, damit man Bewertungen vorab ausprobieren kann.
export function todayISO() { return globalThis.ESSENSPLAN_HEUTE || toISO(new Date()); }
export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function wdIndex(iso) { return (parseISO(iso).getDay() + 6) % 7; }
export function mondayOf(iso) { return addDays(iso, -wdIndex(iso)); }
export function weekDays(mon) { return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); }
export function diffDays(a, b) { return Math.round((parseISO(a) - parseISO(b)) / 86400000); }
export function fmtShort(iso) {
  const d = parseISO(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}
export function fmtLong(iso) {
  const d = parseISO(iso);
  return `${WEEKDAYS[wdIndex(iso)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}
export function fmtRange(mon) {
  const a = parseISO(mon);
  const b = parseISO(addDays(mon, 6));
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}. bis ${b.getDate()}. ${MONTHS[b.getMonth()]}`;
  return `${a.getDate()}. ${MONTHS[a.getMonth()]} bis ${b.getDate()}. ${MONTHS[b.getMonth()]}`;
}
export function isoWeek(iso) {
  const d = parseISO(iso);
  const thu = new Date(d);
  thu.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(thu.getFullYear(), 0, 4, 12);
  return 1 + Math.round(((thu - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

/* ---------- Schultage in Bayern ---------- */

function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(new Date(y, month - 1, day, 12));
}

const holidayCache = {};
// Gesetzliche Feiertage in Bayern plus Buß- und Bettag, an dem in Bayern kein Unterricht ist.
export function holidaysBY(y) {
  if (holidayCache[y]) return holidayCache[y];
  const e = easter(y);
  const p = (m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const n22 = p(11, 22);
  const bussUndBettag = addDays(n22, -((wdIndex(n22) - 2 + 7) % 7));
  holidayCache[y] = {
    [p(1, 1)]: 'Neujahr', [p(1, 6)]: 'Heilige Drei Könige', [addDays(e, -2)]: 'Karfreitag',
    [addDays(e, 1)]: 'Ostermontag', [p(5, 1)]: 'Tag der Arbeit', [addDays(e, 39)]: 'Christi Himmelfahrt',
    [addDays(e, 50)]: 'Pfingstmontag', [addDays(e, 60)]: 'Fronleichnam', [p(8, 15)]: 'Mariä Himmelfahrt',
    [p(10, 3)]: 'Tag der Deutschen Einheit', [p(11, 1)]: 'Allerheiligen', [bussUndBettag]: 'Buß- und Bettag',
    [p(12, 25)]: '1. Weihnachtstag', [p(12, 26)]: '2. Weihnachtstag',
  };
  return holidayCache[y];
}

// Grund, warum an diesem Tag keine Schule ist, sonst null.
export function schoolFree(iso) {
  if (wdIndex(iso) >= 5) return 'Wochenende';
  const f = FERIEN.find(([a, b]) => iso >= a && iso <= b);
  if (f) return f[2];
  return holidaysBY(Number(iso.slice(0, 4)))[iso] || null;
}
export const isSchoolDay = (iso) => !schoolFree(iso);
export const ferienKnown = (iso) => iso <= FERIEN_BIS;

/* ---------- Zahlen und Zutaten ---------- */

export function fmtNum(q) {
  if (q == null) return '';
  const whole = Math.floor(q);
  const frac = Math.round((q - whole) * 100) / 100;
  if (frac === 0.5) return (whole ? whole : '') + '½';
  if (frac === 0.25) return (whole ? whole : '') + '¼';
  if (frac === 0.75) return (whole ? whole : '') + '¾';
  if (frac === 0) return String(whole);
  return String(Math.round(q * 100) / 100).replace('.', ',');
}
export function fmtStars(avg) {
  return avg == null ? '' : avg.toFixed(1).replace('.', ',');
}

const UNIT_PLURAL = {
  Dose: 'Dosen', Packung: 'Packungen', Glas: 'Gläser', Kugel: 'Kugeln', Scheibe: 'Scheiben',
  Prise: 'Prisen', Kopf: 'Köpfe', Tube: 'Tuben', Knolle: 'Knollen', Zehe: 'Zehen', Becher: 'Becher',
  Stange: 'Stangen', Zweig: 'Zweige',
};
const NAME_PLURAL = {
  'Bio-Ei': 'Bio-Eier', 'Ei': 'Eier', 'Zwiebel': 'Zwiebeln', 'Knoblauchzehe': 'Knoblauchzehen',
  'Bio-Karotte': 'Bio-Karotten', 'Karotte': 'Karotten', 'Avocado': 'Avocados',
  'Bio-Zitrone': 'Bio-Zitronen', 'Zitrone': 'Zitronen', 'Bio-Gurke': 'Bio-Gurken', 'Gurke': 'Gurken',
  'Tomate': 'Tomaten', 'Weizen-Tortilla': 'Weizen-Tortillas', 'Kartoffel': 'Kartoffeln',
  'Apfel': 'Äpfel', 'Orange': 'Orangen', 'Kiwi': 'Kiwis', 'Pita-Brot': 'Pita-Brote',
};

function unitLabel(u, q) {
  if (!u) return '';
  return q != null && q > 1 && UNIT_PLURAL[u] ? UNIT_PLURAL[u] : u;
}
function nameLabel(n, q, u) {
  return !u && q != null && q > 1 && NAME_PLURAL[n] ? NAME_PLURAL[n] : n;
}

// Zutat als Text fürs Rezept: "800 g Bio-Hackfleisch vom Rind"
// Welche Zutaten kommen in einem Kochschritt vor? Abgleich über die Hauptwörter des Zutatennamens
// (großgeschriebene Wörter ohne „Bio“ und Mengenwörter), tolerant bei Mehrzahl und zusammengesetzten Wörtern:
// „Karotten“ findet „Bio-Karotte“, „Brühe“ findet „Gemüsebrühe“, „Hack“ findet „Hackfleisch“.
const ING_SKIP = new Set(['bio', 'el', 'tl', 'dose', 'dosen', 'glas', 'gläser', 'packung', 'packungen', 'pck', 'prise', 'bund', 'stück', 'becher', 'handvoll', 'msp', 'scheibe', 'scheiben', 'zum', 'für', 'den', 'airfryer', 'thermomix', 'pfanne', 'topf', 'backofen']);
const ING_REST = ['fleisch', 'brust', 'brüste', 'filet', 'filets', 'schenkel', 'keule', 'würfel', 'streifen', 'stücke', 'zehe', 'zehen', 'flocken', 'körner'];
const ING_PART = ['saft', 'fleisch', 'schale', 'abrieb', 'stücke', 'würfel', 'scheiben', 'streifen', 'spalten', 'ringe', 'hälften'];
const ingWords = (t) => String(t || '').toLowerCase().split(/[^a-zäöüß]+/).filter(Boolean);
function ingKeys(name) {
  const raw = String(name || '').replace(/\([^)]*\)/g, ' ').split(/[\s\-–,/]+/).filter(Boolean);
  let keys = raw.filter((w) => /^[A-ZÄÖÜ]/.test(w)).map((w) => w.toLowerCase().replace(/[^a-zäöüß]/g, '')).filter((w) => w.length >= 2 && !ING_SKIP.has(w));
  if (!keys.length) keys = ingWords(name).filter((w) => w.length >= 4 && !ING_SKIP.has(w));
  return keys;
}
function wordHits(k, w) {
  if (k === w) return true;
  if (w === 'öl' && k.endsWith('öl')) return true;                         // Öl findet Olivenöl, Rapsöl
  if (k.length <= 3 || w.length <= 3) return [k + 'er', k + 'n', k + 's', k + 'en'].includes(w) || [w + 'er', w + 'n', w + 's', w + 'en'].includes(k);
  const [s, l] = k.length <= w.length ? [k, w] : [w, k];
  if (l.startsWith(s) && l.length - s.length <= 2) return true;            // Mehrzahl, Fälle
  if (k.endsWith(w) && w.length >= 4) return true;                          // Brühe in Gemüsebrühe
  if (w.endsWith(k) && k.length >= 5) return true;                          // Milch in Kokosmilch (Schritt nennt das Längere)
  if (k.startsWith(w) && w.length >= 4 && ING_REST.some((r) => k.slice(w.length).startsWith(r))) return true; // Hack in Hackfleisch, Hähnchen in Hähnchenbrustfilet
  if (w.startsWith(k) && k.length >= 4 && ING_PART.some((r) => w.slice(k.length).replace(/^n/, '') === r)) return true; // Zitronensaft, Avocadofleisch
  return false;
}
export function stepIngredientIdx(step, ingredients) {
  const words = ingWords(step);
  const out = [];
  (ingredients || []).forEach((ing, i) => {
    const keys = ingKeys(ing && ing.n);
    if (keys.some((k) => words.some((w) => wordHits(k, w)))) out.push(i);
  });
  return out;
}

export function fmtIngredient(ing) {
  const { q, u, n } = ing;
  if (q == null) return n;
  if (u === 'g' && q >= 1000) return `${fmtNum(q / 1000)} kg ${n}`;
  if (u === 'ml' && q >= 1000) return `${fmtNum(q / 1000)} l ${n}`;
  const unit = unitLabel(u, q);
  return `${fmtNum(q)}${unit ? ' ' + unit : ''} ${nameLabel(n, q, u)}`;
}

// Menge für die Einkaufsliste, Gramm und Milliliter ab 1000 umgerechnet.
export function fmtQty(q, u) {
  if (q == null) return '';
  if (u === 'g' && q >= 1000) return `${fmtNum(q / 1000)} kg`;
  if (u === 'ml' && q >= 1000) return `${fmtNum(q / 1000)} l`;
  const unit = unitLabel(u, q);
  return `${fmtNum(q)}${unit ? ' ' + unit : ' Stück'}`;
}

// Einheiten, wie man sie in Rezepten schreibt, und ihre Schreibweise in der App.
const UNIT_WORDS = {
  g: 'g', gr: 'g', 'gr.': 'g', gramm: 'g', kg: 'kg', kilo: 'kg', ml: 'ml', cl: 'cl', l: 'l', liter: 'l',
  el: 'EL', 'el.': 'EL', essl: 'EL', 'essl.': 'EL', esslöffel: 'EL', tl: 'TL', 'tl.': 'TL', teel: 'TL', 'teel.': 'TL', teelöffel: 'TL',
  dose: 'Dose', dosen: 'Dose', packung: 'Packung', packungen: 'Packung', pck: 'Packung', 'pck.': 'Packung', pkg: 'Packung',
  'pkg.': 'Packung', päckchen: 'Packung', pack: 'Packung', glas: 'Glas', gläser: 'Glas', kugel: 'Kugel', kugeln: 'Kugel',
  scheibe: 'Scheibe', scheiben: 'Scheibe', prise: 'Prise', prisen: 'Prise', msp: 'Msp.', 'msp.': 'Msp.', bund: 'Bund',
  kopf: 'Kopf', köpfe: 'Kopf', würfel: 'Würfel', tube: 'Tube', tuben: 'Tube', knolle: 'Knolle', knollen: 'Knolle',
  zehe: 'Zehe', zehen: 'Zehe', becher: 'Becher', tasse: 'Tasse', tassen: 'Tasse', handvoll: 'Handvoll',
  stange: 'Stange', stangen: 'Stange', zweig: 'Zweig', zweige: 'Zweig', stück: '', stk: '', 'stk.': '', st: '', 'st.': '',
};
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

// Würzzutaten und Grundvorrat landen nicht auf der Einkaufsliste, auch wenn eine Menge dabeisteht.
const PANTRY = /^(salz|pfeffer|zucker|öl|oliven(öl)?|rapsöl|sonnenblumenöl|bratöl|wasser|gemüsebrühe|brühe|oregano|basilikum getrocknet|thymian|paprikapulver|paprika edelsüß|muskat|muskatnuss|zimt|kreuzkümmel|curry(pulver)?|chili(pulver|flocken)?|backpulver|natron|vanillezucker|essig|senf|ketchup|sojasauce|sesam)\b/i;

const CAT_RULES = [
  ['tk', /tiefgekühlt|tiefkühl|\btk\b/i],
  ['vorrat', /röstzwiebel|gewürzgurke|essiggurke|cornichon|oliven\b|kapern/i],
  ['brot', /brot|brötchen|toast|tortilla|wrap|baguette|fladen|laugen|semmel(?!brösel)/i],
  ['fleisch', /hack|hähnchen|huhn|hühner|pute|rind|schwein|schnitzel|würstchen|bratwurst|wurst|speck|gulasch|filet|kotelett|frikadelle|leberkäse|lachs|fisch|seelachs|kabeljau|forelle|garnele|lamm/i],
  ['kuehl', /milch|sahne|butter|käse|quark|joghurt|skyr|\b(ei|eier)\b|schmand|crème|creme|mozzarella|feta|parmesan|hefe|schinken|prosciutto|salami|tofu|knödel|gnocchi|blätterteig|pizzateig|margarine/i],
  ['obst', /apfel|äpfel|birne|banane|zitrone|limette|orange|mandarine|traube|beere|kiwi|melone|ananas|mango|tomate|gurke|paprika|zwiebel|lauchzwiebel|frühlingszwiebel|knoblauch|karotte|möhre|kartoffel|salat|spinat|zucchini|aubergine|pilz|champignon|lauch|porree|kürbis|blumenkohl|kohl|sellerie|radieschen|petersilie|schnittlauch|basilikum|dill|kräuter|ingwer|avocado|mais(kolben)?\b/i],
  ['vorrat', /dose|nudel|spaghetti|penne|fusilli|makkaroni|lasagne|reis|mehl|grieß|linsen|bohnen|kichererbsen|mais|tomatenmark|passiert|stückige tomaten|haferflocken|semmelbrösel|paniermehl|honig|marmelade|nuss|nüsse|mandel|kakao|schokolade|rosinen|bulgur|couscous|kokosmilch|thunfisch|apfelmus|sauce|soße/i],
];

// Abteilung im Supermarkt anhand des Namens raten.
export function guessCat(name) {
  if (PANTRY.test(name)) return 'basis';
  for (const [cat, re] of CAT_RULES) if (re.test(name)) return cat;
  return 'sonst';
}

// Freitextzeile in eine Zutat umwandeln. Versteht 200g, 1/2, 1 1/2, ½, 2-3, Pck., Stk. und Ähnliches.
export function parseIngredientLine(line, knownCats = {}) {
  let rest = line.trim().replace(/^[-–•*]\s*/, '');
  if (!rest) return null;
  let q = null;
  let m;
  if ((m = rest.match(/^(\d+)\s+(\d+)\/(\d+)/))) q = Number(m[1]) + Number(m[2]) / Number(m[3]);
  else if ((m = rest.match(/^(\d+)\/(\d+)/))) q = Number(m[1]) / Number(m[2]);
  else if ((m = rest.match(/^(\d+(?:[.,]\d+)?)\s*([½¼¾⅓⅔])?/))) q = parseFloat(m[1].replace(',', '.')) + (m[2] ? FRAC[m[2]] : 0);
  else if ((m = rest.match(/^([½¼¾⅓⅔])/))) q = FRAC[m[1]];
  if (m) {
    rest = rest.slice(m[0].length).replace(/^\s*(?:-|–|bis)\s*\d+(?:[.,]\d+)?/, '').trim();
  }
  let u = '';
  if (q != null) {
    const um = rest.match(/^(\S+)\s*(.*)$/);
    const word = um ? um[1].toLowerCase() : '';
    if (um && Object.prototype.hasOwnProperty.call(UNIT_WORDS, word) && um[2]) {
      u = UNIT_WORDS[word];
      rest = um[2];
      if (u === 'kg') { u = 'g'; q *= 1000; }
      if (u === 'l') { u = 'ml'; q *= 1000; }
      if (u === 'cl') { u = 'ml'; q *= 10; }
    }
    q = Math.round(q * 1000) / 1000;
  }
  rest = rest.trim();
  if (!rest) return null;
  const singular = Object.entries(NAME_PLURAL).find(([, p]) => p === rest);
  const n = singular && !u ? singular[0] : rest;
  let c;
  if (q == null) c = 'basis';
  else if (knownCats[n]) c = knownCats[n];
  else c = guessCat(n);
  return { q, u, n, c };
}

// Mengen von x auf 4 Personen umrechnen und sinnvoll runden.
export function scaleQty(q, u, factor) {
  if (q == null || factor === 1) return q;
  const v = q * factor;
  if (['Packung', 'Dose', 'Glas', 'Becher', 'Tube', 'Kugel'].includes(u)) return Math.max(1, Math.ceil(v - 0.01));
  if ((u === 'g' || u === 'ml') && v >= 20) return Math.round(v / 5) * 5;
  return Math.max(0.25, Math.round(v * 4) / 4);
}

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/* ---------- Statistik und Bewertungsregel ---------- */

// Liefert pro Gericht: wie oft dran, zuletzt wann, Schnitt, und ob es aussortiert ist.
export function computeStats(dishes, plan, ratings, today = todayISO(), hearts = []) {
  const stats = {};
  for (const d of dishes) {
    stats[d.id] = {
      served: 0, lastServed: null, nextPlanned: null,
      avg: null, count: 0, perPerson: {},
      ruleAvg: null, ruleRaters: 0, autoArchived: false, archived: false,
      hearts: 0, heartsBy: {},
    };
  }
  for (const h of hearts) {
    const s = stats[h.dish_id];
    if (!s) continue;
    s.hearts += 1;
    s.heartsBy[h.person_id] = (s.heartsBy[h.person_id] || 0) + 1;
  }
  for (const p of plan) {
    const s = stats[p.dish_id];
    if (!s || p.skipped) continue;
    if (p.day <= today) {
      s.served += 1;
      if (!s.lastServed || p.day > s.lastServed) s.lastServed = p.day;
    } else if (!s.nextPlanned || p.day < s.nextPlanned) {
      s.nextPlanned = p.day;
    }
  }
  const acc = {};
  for (const r of ratings) {
    const s = stats[r.dish_id];
    if (!s) continue;
    const a = acc[r.dish_id] || (acc[r.dish_id] = { sum: 0, n: 0, per: {}, rSum: 0, rN: 0, rPersons: new Set() });
    a.sum += r.stars; a.n += 1;
    const pp = a.per[r.person_id] || (a.per[r.person_id] = { sum: 0, n: 0 });
    pp.sum += r.stars; pp.n += 1;
    const dish = dishes.find((d) => d.id === r.dish_id);
    const from = dish && dish.rule_from ? Date.parse(dish.rule_from) : 0;
    const at = r.updated_at ? Date.parse(r.updated_at) : Date.now();
    if (at > from) { a.rSum += r.stars; a.rN += 1; a.rPersons.add(r.person_id); }
  }
  for (const d of dishes) {
    const s = stats[d.id];
    const a = acc[d.id];
    if (a) {
      s.avg = a.sum / a.n;
      s.count = a.n;
      for (const [pid, v] of Object.entries(a.per)) s.perPerson[pid] = v.sum / v.n;
      s.ruleRaters = a.rPersons.size;
      s.ruleAvg = a.rN ? a.rSum / a.rN : null;
      s.autoArchived = s.ruleAvg != null && s.ruleRaters >= RULE.minRaters && s.ruleAvg < RULE.threshold;
    }
    s.archived = !!d.manual_archived || s.autoArchived;
  }
  return stats;
}

// Gute Bewertung heißt höherer Faktor, also früher wieder im Vorschlag.
export function ratingFactor(avg) {
  if (avg == null) return 1;
  return Math.min(2, Math.max(0.25, (avg - 1) / 2));
}
export function rhythmLabel(stat) {
  if (stat.archived) return 'aussortiert';
  if (stat.avg == null) return 'noch ohne Bewertung';
  const f = ratingFactor(stat.avg);
  if (f >= 1.5) return 'kommt oft';
  if (f >= 0.9) return 'kommt regelmäßig';
  return 'kommt selten';
}

/* ---------- Wochenvorschlag ---------- */

// Punktzahl eines Gerichts für die Woche ab weekStart.
export function dishScore(dish, stat, plan, weekStart) {
  let last = null;
  for (const p of plan) {
    if (p.dish_id === dish.id && !p.skipped && p.day < weekStart && (!last || p.day > last)) last = p.day;
  }
  const days = last ? diffDays(weekStart, last) : 42;
  const recency = days <= 7 ? 0.1 : Math.min(3, Math.max(0.1, days / 14));
  const fav = (dish.favorite ? FAVORITE_BONUS : 1) * heartFactor(stat);
  return { score: ratingFactor(stat ? stat.avg : null) * recency * fav, days: last ? days : null };
}

export function rankDishes(dishes, stats, plan, weekStart) {
  return dishes
    .filter((d) => !(stats[d.id] && stats[d.id].archived))
    .map((d) => ({ dish: d, ...dishScore(d, stats[d.id], plan, weekStart) }))
    .sort((a, b) => b.score - a.score || a.dish.name.localeCompare(b.dish.name, 'de'));
}

// Pause: Das Gericht wird bis einschließlich pause_until nicht vorgeschlagen.
export const isPaused = (dish, weekStart) => !!dish.pause_until && weekStart <= dish.pause_until;

// Füllt die freien Tage der Woche. Bereits geplante Tage bleiben, wie sie sind.
// limits: Höchstdauer der Rezepte pro Tag in Minuten. Ohne Angabe 60 Minuten unter der Woche, am Wochenende frei.
// skip: Tage, an denen nichts geplant wird (Urlaub).
export function planWeek(dishes, stats, plan, weekStart, limits = {}, skip = []) {
  const days = weekDays(weekStart);
  const fixed = {};
  for (const p of plan) if (days.includes(p.day) && p.dish_id) fixed[p.day] = p.dish_id;
  const used = new Set(Object.values(fixed));
  const perCat = {};
  for (const id of used) {
    const d = dishes.find((x) => x.id === id);
    if (d) perCat[d.category] = (perCat[d.category] || 0) + 1;
  }
  const free = days.filter((d) => !fixed[d] && !skip.includes(d));
  const ranked = rankDishes(dishes, stats, plan, weekStart).filter((r) => !used.has(r.dish.id) && !isPaused(r.dish, weekStart) && isDinner(r.dish));

  // Auswahl: beste Punktzahl zuerst, höchstens zwei Gerichte je Kategorie.
  const picked = [];
  for (const cap of [2, 99]) {
    for (const r of ranked) {
      if (picked.length >= free.length) break;
      if (picked.includes(r)) continue;
      if ((perCat[r.dish.category] || 0) >= cap) continue;
      picked.push(r);
      perCat[r.dish.category] = (perCat[r.dish.category] || 0) + 1;
    }
  }

  // Verteilung: lange Rezepte aufs Wochenende, Nachbartage möglichst mit anderer Kategorie.
  const result = { ...fixed };
  const pool = [...picked];
  const catOf = (day) => {
    const d = dishes.find((x) => x.id === result[day]);
    return d ? d.category : null;
  };
  const lim = (day) => (limits[day] != null ? limits[day] : wdIndex(day) < 5 ? 60 : Infinity);
  // Lange Rezepte an Tage mit viel Zeit, kurze Tage zuerst besetzen, damit für sie etwas Passendes übrig bleibt.
  const roomy = free.filter((d) => lim(d) > 60);
  for (const day of roomy) {
    const i = pool.findIndex((r) => (r.dish.duration_min || 0) > 60);
    if (i >= 0) result[day] = pool.splice(i, 1)[0].dish.id;
  }
  const order = [...free].sort((a, b) => lim(a) - lim(b) || (a < b ? -1 : 1));
  for (const day of order) {
    if (result[day] || !pool.length) continue;
    const prev = catOf(addDays(day, -1));
    const next = catOf(addDays(day, 1));
    const ok = (r) => (r.dish.duration_min || 0) <= lim(day);
    let i = pool.findIndex((r) => ok(r) && r.dish.category !== prev && r.dish.category !== next);
    if (i < 0) i = pool.findIndex(ok);
    if (i < 0) i = 0;
    result[day] = pool.splice(i, 1)[0].dish.id;
  }
  return days.filter((d) => result[d] && !fixed[d]).map((d) => ({ day: d, dish_id: result[d] }));
}

/* ---------- Einkaufsliste aus dem Wochenplan ---------- */

// factors: Anteil der Portionen pro Tag (1 = alle essen mit). pantry: Vorratsliste [{ label, have }].
const normName = (n) => n.toLowerCase().replace(/^bio[- ]/, '').replace(/\s*\(.*\)\s*/g, '').trim();
export function pantryMatch(name, pantry = []) {
  const n = normName(String(name || ''));
  return (pantry || []).find((x) => {
    if (!x.have) return false;
    const v = normName(String(x.label || ''));
    return v && (n === v || n.startsWith(`${v} `) || n.endsWith(` ${v}`) || v.startsWith(`${n} `));
  }) || null;
}
export const inPantry = (name, pantry = []) => !!pantryMatch(name, pantry);

// Kurzname eines Gerichts für die Einkaufsliste: „Gebackener Seelachs mit Kartoffeln …“ wird „Gebackener Seelachs“.
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export function shortDish(name) {
  return String(name).split(/ mit | in | und | auf | aus /)[0].trim();
}

// Wofür ist ein Posten gedacht? Steht es nicht am Posten, wird es aus dem Wochenplan erraten:
// über die Zutaten der geplanten Gerichte und die Texte der Brotboxen.
const core = (s) => String(s).toLowerCase().replace(/\bbio[\s-]*/g, '').replace(/\(.*?\)/g, '').replace(/[,;„"].*$/, '').replace(/\s+/g, ' ').trim();
const stemOf = (w) => (w.length >= 5 ? w.replace(/(en|er|n|e|s)$/, '') : w);
const ALIAS = { knoblauchzehe: 'knoblauch', sojasoße: 'sojasauce', eier: 'ei' };
const sameThing = (a, b) => {
  const x = stemOf(ALIAS[a] || a);
  const y = stemOf(ALIAS[b] || b);
  return x === y || a.startsWith(`${b} `) || b.startsWith(`${a} `);
};
const fold = (w) => w.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
export function purposeOf(item, plan, dishes) {
  if (item.purpose) return item.purpose;
  if (item.manual || item.category === 'vorhanden') return '';
  const label = core(item.label);
  if (label.length < 3) return '';
  const first = stemOf(label.split(' ')[0]);
  const uses = (dish) => (dish.ingredients || []).some((g) => { const n = core(g.n); return n.length > 1 && sameThing(label, n); });
  const boxRecipes = dishes.filter((d) => d.category === 'brotbox');
  const days = weekDays(item.week_start);
  const out = [];
  for (const p of plan) {
    if (!days.includes(p.day) || p.skipped) continue;
    const wd = WEEKDAYS_SHORT[wdIndex(p.day)];
    const dish = dishes.find((d) => d.id === p.dish_id);
    if (dish && uses(dish)) out.push(`${shortDish(dish.name)} (${wd})`);
    const text = (p.lunchbox || '').toLowerCase();
    if (!text) continue;
    const words = text.split(/[^a-zäöüß-]+/).filter((w) => w.length >= 6);
    const inText = (w) => w.length >= 4 && new RegExp(`(^|[^a-zäöüß])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text);
    if (inText(first) || inText(fold(first)) || words.some((w) => label !== w && label.endsWith(w))) out.push(`Brotbox (${wd})`);
    // Rezepte für die Brotbox, die im Text genannt werden (z. B. Energiebällchen).
    for (const b of boxRecipes) {
      const name = shortDish(b.name).toLowerCase();
      if (text.includes(name) && uses(b)) out.push(`${shortDish(b.name)}, Brotbox (${wd})`);
    }
  }
  return [...new Set(out)].slice(0, 4).join(', ');
}

export function buildShopping(weekStart, plan, dishes, factors = {}, pantry = [], packs = null) {
  const days = weekDays(weekStart);
  const sums = new Map();
  for (const p of plan) {
    if (!days.includes(p.day) || p.skipped) continue;
    const dish = dishes.find((d) => d.id === p.dish_id);
    // Festtags-Gerichte haben ihre eigene Einkaufsliste.
    if (!dish || (dish.tags || []).includes('Festtag')) continue;
    for (const ing of dish.ingredients || []) {
      if (ing.c === 'basis' || ing.q == null) continue;
      const f = factors[p.day] != null ? factors[p.day] : 1;
      // Gleiche Zutat, auch bei Einzahl und Mehrzahl oder Stk. und Stück, kg und g: ein Posten.
      let name = String(ing.n);
      let { q, u } = baseQty(f === 1 ? ing.q : scaleQty(ing.q, ing.u, f), ing.u);
      if (u === 'Zehe' && itemKey(name) === 'knoblauch') { name = 'Knoblauchzehe'; u = ''; }
      const key = `${itemKey(name)}|${u}`;
      const cur = sums.get(key) || { names: [], u, c: ing.c || 'sonst', q: 0, uses: [] };
      if (!cur.names.includes(name)) cur.names.push(name);
      if (cur.c === 'sonst' && ing.c) cur.c = ing.c;
      const use = `${shortDish(dish.name)} (${WEEKDAYS_SHORT[wdIndex(p.day)]})`;
      if (!cur.uses.includes(use)) cur.uses.push(use);
      cur.q += q;
      sums.set(key, cur);
    }
  }
  for (const it of sums.values()) it.n = baseName(it.names, it.q, it.u);
  const list = [...sums.values()].sort((a, b) =>
    SHOP_CAT_ORDER.indexOf(a.c) - SHOP_CAT_ORDER.indexOf(b.c) || a.n.localeCompare(b.n, 'de'));
  // Was laut Vorrat im Haus ist, steht am Ende schon abgehakt auf der Liste.
  return list.filter((it) => it.q > 0).map((it, i) => {
    const have = inPantry(it.n, pantry);
    // Bekannte Packungsgröße: in ganzen Packungen einkaufen.
    const pack = packs && packFor(packs, it.n);
    const need = pack && needOf({ q: it.q, u: it.u });
    const inPacks = need && need.u === pack.u ? `${packText(Math.max(1, Math.ceil(need.q / pack.q - 0.001)), pack)} (für ${fmtQty(it.q, it.u)})` : '';
    return {
      id: uid(), week_start: weekStart, trip: 'Einkauf', category: have ? 'vorhanden' : it.c,
      label: nameLabel(it.n, it.q, it.u), qty: (inPacks || fmtQty(it.q, it.u)) + (have ? ', laut Vorrat im Haus' : ''), sort: i,
      purpose: it.uses.join(', '), missing: false,
      checked: have, checked_by: null, checked_at: null, manual: false,
    };
  });
}

/* ---------- Gleiche Posten zusammenfassen ---------- */
// Schlüssel eines Postens: klein, ohne Umlaute, Bindestrich wie Leerzeichen, das letzte Wort in einer Grundform.
// So landen „Zwiebel“ und „Zwiebeln“, „Knoblauchzehe“ und „Knoblauchzehen“, „Pilz“ und „Pilze“ zusammen.
// „Bio“ und Zusätze in Klammern bleiben Teil des Namens, das sind oft andere Produkte.
const foldKey = (s) => s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
const WORD_SINGULAR = { eier: 'ei' };
function singularWord(w) {
  if (WORD_SINGULAR[w]) return WORD_SINGULAR[w];
  let x = w;
  if (x.length >= 4 && /[elr]n$/.test(x)) x = x.slice(0, -1);
  else if (x.length >= 4 && (/[aiouy]s$/.test(x) || /ons$/.test(x))) x = x.slice(0, -1);
  if (x.length >= 5 && /e$/.test(x)) x = x.slice(0, -1);
  return x;
}
export function itemKey(name) {
  const words = foldKey(String(name || '').toLowerCase()).replace(/[-–]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const last = words.pop();
  return [...words, singularWord(last)].join(' ');
}
// Menge in Grundeinheit: kg in g, l und cl in ml, Stück, Stk. und ohne Einheit gleich.
export function baseQty(q, u) {
  const raw = String(u || '').trim();
  const c = raw ? (UNIT_WORDS[raw.toLowerCase()] ?? raw) : '';
  if (c === 'kg') return { q: q * 1000, u: 'g' };
  if (c === 'l') return { q: q * 1000, u: 'ml' };
  if (c === 'cl') return { q: q * 10, u: 'ml' };
  return { q, u: c };
}
// „2 Stück“, „1,5 kg“, „2 Dosen“, „ca. 300 g“ als Menge. Alles mit weiterem Text („2 Packungen à 400 g“) gibt null.
export function parseQtyText(text) {
  const t = String(text || '').trim().toLowerCase().replace(/^(ca\.?|etwa)\s*/, '');
  const m = t.match(/^(\d+(?:[.,]\d+)?|[½¼¾⅓⅔])\s*([a-zäöüß]+\.?)?$/);
  if (!m) return null;
  const q = FRAC[m[1]] ?? Number(m[1].replace(',', '.'));
  if (!(q > 0)) return null;
  if (m[2] && !(m[2] in UNIT_WORDS)) return null;
  return baseQty(q, m[2] ? UNIT_WORDS[m[2]] : '');
}
// Anzeigename für zusammengefasste Schreibweisen: bekannte Einzahl, sonst bei Stückzahlen über 1 die längere Form.
const SINGULAR_OF = Object.fromEntries(Object.entries(NAME_PLURAL).map(([one, many]) => [many.toLowerCase(), one]));
function baseName(names, q, u) {
  for (const n of names) {
    if (NAME_PLURAL[n]) return n;
    if (SINGULAR_OF[n.toLowerCase()]) return SINGULAR_OF[n.toLowerCase()];
  }
  if (names.length < 2 || u) return names[0];
  return [...names].sort((a, b) => (q > 1 ? b.length - a.length : a.length - b.length))[0];
}
// Fasst gleiche Posten einer Liste zusammen (gleiche Woche, Tour, Einkaufstag, Markt). Behalten wird der erste Posten
// in der Reihenfolge der Liste, damit zwei Geräte unabhängig voneinander zum selben Ergebnis kommen.
// Mengen werden addiert, wenn sie sich lesen lassen und die Einheit passt, sonst stehen sie mit „+“ hintereinander.
export function mergeDuplicates(items, canMerge = () => true) {
  const groups = new Map();
  const order = [...items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.id).localeCompare(String(b.id)));
  for (const it of order) {
    if (!it || !canMerge(it)) continue;
    const k = [it.week_start, it.trip || 'Einkauf', it.due || '', it.shop || '', itemKey(it.label)].join('|');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const changed = [];
  const removed = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const qtys = g.map((x) => String(x.qty || '').trim()).filter(Boolean);
    const parsed = qtys.map(parseQtyText);
    const same = parsed.length && parsed.every((x) => x && x.u === parsed[0].u);
    const sum = same ? Math.round(parsed.reduce((a, x) => a + x.q, 0) * 100) / 100 : null;
    const names = [];
    for (const x of g) if (!names.includes(String(x.label))) names.push(String(x.label));
    const name = baseName(names, sum ?? 1, same ? parsed[0].u : 'x');
    const uses = [];
    for (const x of g) for (const w of String(x.purpose || '').split(/,\s*/)) if (w && !uses.includes(w)) uses.push(w);
    const qty = same ? fmtQty(sum, parsed[0].u) : [...new Set(qtys)].join(' + ');
    changed.push({
      ...g[0],
      label: same ? nameLabel(name, sum, parsed[0].u) : name,
      qty,
      purpose: uses.join(', '),
      category: (g.find((x) => x.category && x.category !== 'sonst') || g[0]).category,
    });
    removed.push(...g.slice(1).map((x) => x.id));
  }
  return { changed, removed };
}
export function mergeList(items, canMerge) {
  const { changed, removed } = mergeDuplicates(items, canMerge);
  if (!removed.length) return items;
  const gone = new Set(removed);
  return items.filter((i) => !gone.has(i.id)).map((i) => changed.find((c) => c.id === i.id) || i);
}

/* ---------- Wofür ein Posten ist, und auf welche Tour er gehört ---------- */
// „Hackbällchen (Mo), Brotbox (Do)“ als Liste.
export const usesOf = (purpose) => String(purpose || '').split(/,\s*/).map((x) => x.trim()).filter(Boolean);
const USE_RE = /^(.*\S)\s*\((Mo|Di|Mi|Do|Fr|Sa|So)\)$/;
const useDay = (use, weekStart) => { const m = USE_RE.exec(use); return m ? addDays(weekStart, WEEKDAYS_SHORT.indexOf(m[2])) : null; };
// Steht ein Zweck für ein Abendessen? dinnerNames: Kurznamen der Abendessen, klein geschrieben.
// Alles andere (Brotbox, Frühstück, Snack) lässt sich nicht aus Rezepten neu berechnen.
export function isDinnerUse(use, dinnerNames) {
  const m = USE_RE.exec(use);
  return !!m && dinnerNames.has(shortDish(m[1]).toLowerCase());
}
export const dinnerNamesOf = (dishes, more = []) => new Set([...dishes.filter(isDinner).map((d) => d.name), ...more].filter(Boolean).map((n) => shortDish(String(n)).toLowerCase()));
// Touren einer Liste nach Datum: [{ trip, due }].
export function tripsOf(items) {
  const seen = new Map();
  for (const i of items) if (i && !i.manual && !seen.has(i.trip || 'Einkauf')) seen.set(i.trip || 'Einkauf', i.due || null);
  return [...seen.entries()].map(([trip, due]) => ({ trip, due })).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
}
// Tour für einen Posten, wie Claude sie verteilt: Frisches (Fleisch und Fisch, Salat, Gemüse und Obst, Brot) auf die letzte
// Tour bis zum ersten Gebrauch, also Feldsalat für Freitag auf den Frischeeinkauf am Mittwoch. Alles, was hält
// (Vorrat, Tiefkühl, Kühlregal, Kartoffeln, Zwiebeln, Äpfel), auf den ersten Einkauf.
const FRESH = new Set(['fleisch', 'obst', 'brot']);
const KEEPS = /kartoffel|zwiebel|knoblauch|schalotte|möhre|karotte|kürbis|rotkohl|weißkohl|kohlrabi|sellerie|rote bete|ingwer|apfel|äpfel|zitrone|limette|orange|mandarine|clementine|tiefgekühlt|\btk\b/i;
export const isFresh = (item) => FRESH.has(item.category) && !KEEPS.test(String(item.label || item.n || ''));
export function tripFor(item, trips, weekStart) {
  if (!trips.length) return { trip: 'Einkauf', due: null };
  const first = usesOf(item.purpose).map((u) => useDay(u, weekStart)).filter(Boolean).sort()[0];
  const before = trips.filter((t) => t.due && first && t.due <= first);
  const t = isFresh(item) && before.length ? before[before.length - 1] : trips[0];
  return { trip: t.trip, due: t.due };
}

// Was der Wochenplan aus dem Vorrat nimmt: Zutaten der geplanten Gerichte, die laut Vorrat da sind und deshalb
// nicht (oder nur abgehakt) auf der Einkaufsliste stehen. Pro Zutat einmal, mit Menge, Gerichten und Vorrat-Eintrag.
// minDay: Tage davor zählen nicht mehr, da ist schon gekocht.
export function fromPantry(weekStart, plan, dishes, pantry = [], factors = {}, minDay = '') {
  const days = weekDays(weekStart).filter((d) => d >= minDay);
  const sums = new Map();
  for (const p of plan) {
    if (!days.includes(p.day) || p.skipped) continue;
    const dish = dishes.find((d) => d.id === p.dish_id);
    if (!dish || (dish.tags || []).includes('Festtag')) continue;
    for (const ing of dish.ingredients || []) {
      if (ing.c === 'basis' || ing.q == null) continue;
      const row = pantryMatch(ing.n, pantry);
      if (!row) continue;
      const f = factors[p.day] != null ? factors[p.day] : 1;
      const { q, u } = baseQty(f === 1 ? ing.q : scaleQty(ing.q, ing.u, f), ing.u);
      const key = itemKey(ing.n);
      const cur = sums.get(key) || { key, names: [], parts: new Map(), c: ing.c || 'sonst', uses: [], pantryId: row.id };
      if (!cur.names.includes(String(ing.n))) cur.names.push(String(ing.n));
      cur.parts.set(u, (cur.parts.get(u) || 0) + q);
      const use = `${shortDish(dish.name)} (${WEEKDAYS_SHORT[wdIndex(p.day)]})`;
      if (!cur.uses.includes(use)) cur.uses.push(use);
      sums.set(key, cur);
    }
  }
  return [...sums.values()].map((x) => {
    const parts = [...x.parts.entries()];
    const one = parts.length === 1 ? parts[0] : null;
    const name = baseName(x.names, one ? one[1] : 1, one ? one[0] : 'x');
    return {
      key: x.key, pantryId: x.pantryId, category: x.c, purpose: x.uses.join(', '),
      label: one ? nameLabel(name, one[1], one[0]) : name,
      qty: parts.map(([u, q]) => fmtQty(Math.round(q * 100) / 100, u)).join(' + '),
    };
  }).sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

// Zuordnung Zutat zu Abteilung aus allen bekannten Gerichten, fürs Bearbeiten-Formular.
export function knownIngredientCats(dishes) {
  const map = {};
  for (const d of dishes) for (const ing of d.ingredients || []) map[ing.n] = ing.c;
  return map;
}

/* ---------- Auswertung für Claude ---------- */

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// Fasst Gerichte, Bewertungen und Brotboxen so zusammen, dass Claude daraus Vorlieben ableiten kann.
export function buildExport(data, stats, today = todayISO(), nutritionOf = null) {
  const { persons, dishes, plan, ratings, lunchRatings } = data;
  const events = data.events || [];
  const hearts = data.hearts || [];
  const nameOf = (id) => (persons.find((p) => p.id === id) || {}).name || id;
  const dishName = (id) => (dishes.find((d) => d.id === id) || {}).name || id;
  const stars = (rows) => Object.fromEntries(rows.map((r) => [nameOf(r.person_id), r.stars]));
  const past = plan.filter((p) => p.day <= today).sort((a, b) => (a.day < b.day ? -1 : 1));
  const dinners = past.filter((p) => p.dish_id).map((p) => ({
    tag: p.day,
    wochentag: WEEKDAYS[wdIndex(p.day)],
    gericht: dishName(p.dish_id),
    ...(p.skipped ? { ausgefallen: true } : {}),
    sterne: stars(ratings.filter((r) => r.day === p.day)),
  }));
  const lunches = past.filter((p) => p.lunchbox && isSchoolDay(p.day)).map((p) => ({
    tag: p.day,
    text: p.lunchbox,
    sterne: stars((lunchRatings || []).filter((r) => r.day === p.day && r.lunchbox === p.lunchbox)),
  }));
  const notesAll = ((data.settings || []).find((x) => x.key === 'rezept_notizen') || {}).value || {};
  const dishRows = dishes.map((d) => {
    const s = stats[d.id];
    const notes = Array.isArray(notesAll[d.id]) ? notesAll[d.id].map((n) => String(n.text || '')).filter(Boolean) : [];
    return {
      name: d.name,
      art: DISH_CATS[d.category] || d.category,
      dauer_min: d.duration_min,
      stichworte: d.tags || [],
      lieblingsgericht: !!d.favorite,
      ...(d.pause_until && d.pause_until >= today ? { nicht_einplanen_bis: d.pause_until } : {}),
      herzen: s.hearts,
      herzen_von: Object.fromEntries(Object.entries(s.heartsBy).map(([pid, n]) => [nameOf(pid), n])),
      status: s.autoArchived ? 'aussortiert durch Bewertung' : d.manual_archived ? 'von Hand aussortiert' : 'im Umlauf',
      mal_gegessen: s.served,
      zuletzt: s.lastServed,
      naechstes_mal: s.nextPlanned,
      sterne_schnitt: round1(s.avg),
      anzahl_bewertungen: s.count,
      sterne_pro_person: Object.fromEntries(Object.entries(s.perPerson).map(([pid, v]) => [nameOf(pid), round1(v)])),
      hauptzutaten: (d.ingredients || []).filter((x) => x.c !== 'basis' && x.q != null).map((x) => x.n),
      ...(d.prep ? { am_vorabend: d.prep } : {}),
      ...(notes.length ? { notizen_der_familie: notes } : {}),
      ...(nutritionOf && nutritionOf(d) ? { naehrwerte_pro_portion: nutritionOf(d) } : {}),
    };
  }).sort((a, b) => (b.sterne_schnitt ?? 0) - (a.sterne_schnitt ?? 0) || b.mal_gegessen - a.mal_gegessen);
  return {
    typ: 'essensplan-auswertung',
    version: 1,
    erstellt: today,
    zeitraum: { von: past.length ? past[0].day : null, bis: today },
    hinweis: 'Export aus der Familien-App Familienplan. Sterne von 1 bis 5. Gerichte mit weniger als '
      + `${RULE.threshold} Sternen im Schnitt bei mindestens ${RULE.minRaters} Bewertenden sortiert die App aus. `
      + 'Brotboxen bewerten nur die Kinder. Am Ende jeder Woche vergeben die Kinder ein Herz für ihr Lieblingsgericht der Woche. '
      + 'Den nächsten Plan bitte als Import für die App liefern.',
    familie: persons.map((p) => ({ name: p.name, rolle: p.adult ? 'erwachsen' : 'kind' })),
    essenszeit: 'Abendessen um 18:30 bis 19:00 Uhr, später nur wenn jemand später heimkommt. Ziel: gemeinsam essen.',
    termine: events.filter((e) => e.active !== false).map((e) => ({
      was: e.title,
      wer: (e.who || []).map(nameOf),
      tage: (e.weekdays || []).slice().sort().map((w) => WEEKDAYS[w]),
      von: e.start_time, bis: e.end_time || null, zu_hause: e.home_time || e.end_time || null,
      pause_in_ferien: !!e.pause_ferien,
    })),
    gerichte: dishRows,
    abendessen: dinners,
    brotboxen: lunches,
    lieblinge_der_woche: [...hearts].sort((a, b) => (a.week_start < b.week_start ? -1 : 1))
      .map((h) => ({ woche_ab: h.week_start, kind: nameOf(h.person_id), gericht: dishName(h.dish_id) })),
    geplant: plan.filter((p) => p.day > today && p.dish_id).sort((a, b) => (a.day < b.day ? -1 : 1))
      .map((p) => ({ tag: p.day, gericht: dishName(p.dish_id) })),
  };
}

export const EXPORT_INTRO = 'Auswertung aus unserer Familienplan-App. Bitte leite daraus die Vorlieben der Familie ab und passe den nächsten Wochenplan daran an. '
  + 'Für den Import: bei jedem Einkaufsposten "purpose" angeben (wofür, z. B. "Brotbox (Do)"), Angebote nur nennen, wenn sie auf aldi-sued.de oder lidl.de stehen, und dazuschreiben, ob sie Bio sind. '
  + 'Bevorzugter Markt ist Aldi Süd (Coburg-Creidlitz). Was bei Lidl (Coburg-Ketschendorf) im Angebot deutlich günstiger oder besser ist oder nur dort zu haben ist, bekommt beim Einkaufsposten "shop": "lidl". '
  + 'Pro Tag optional "prep" (was am Vorabend vorzubereiten ist, z. B. für die Brotbox), pro Gericht optional "prep" und "nutrition".';

/* ---------- Was mögen wir? ---------- */

// Auswertung der Bewertungen, Herzen und gekochten Gerichte eines Jahres.
export function familyReport(data, year, today = todayISO()) {
  const y = String(year);
  const dishes = Object.fromEntries((data.dishes || []).map((d) => [d.id, d]));
  const ratings = (data.ratings || []).filter((r) => String(r.day).slice(0, 4) === y && dishes[r.dish_id]);
  const per = {};
  for (const r of ratings) {
    const p = per[r.person_id] || (per[r.person_id] = { sum: 0, n: 0, dishes: {} });
    p.sum += r.stars; p.n += 1;
    const d = p.dishes[r.dish_id] || (p.dishes[r.dish_id] = { sum: 0, n: 0 });
    d.sum += r.stars; d.n += 1;
  }
  const people = (data.persons || []).filter((p) => per[p.id]).map((p) => {
    const list = Object.entries(per[p.id].dishes).map(([id, v]) => ({ dish: dishes[id], avg: v.sum / v.n, n: v.n }));
    const top = list.slice().sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 3);
    const flop = list.filter((x) => x.avg <= 2.5).sort((a, b) => a.avg - b.avg || b.n - a.n)[0] || null;
    return { person: p, avg: per[p.id].sum / per[p.id].n, n: per[p.id].n, top, flop };
  });
  const byDish = {};
  for (const r of ratings) {
    const d = byDish[r.dish_id] || (byDish[r.dish_id] = { sum: 0, n: 0, raters: new Set() });
    d.sum += r.stars; d.n += 1; d.raters.add(r.person_id);
  }
  const ranked = Object.entries(byDish).filter(([, v]) => v.raters.size >= 2).map(([id, v]) => ({ dish: dishes[id], avg: v.sum / v.n, n: v.n }));
  const cooked = {};
  for (const p of data.plan || []) {
    if (String(p.day).slice(0, 4) !== y || p.day > today || p.skipped || !dishes[p.dish_id]) continue;
    cooked[p.dish_id] = (cooked[p.dish_id] || 0) + 1;
  }
  const hearts = {};
  for (const h of data.hearts || []) if (String(h.week_start).slice(0, 4) === y && dishes[h.dish_id]) hearts[h.dish_id] = (hearts[h.dish_id] || 0) + 1;
  const sortEntries = (o) => Object.entries(o).map(([id, n]) => ({ dish: dishes[id], n })).sort((a, b) => b.n - a.n || a.dish.name.localeCompare(b.dish.name, 'de'));
  const firstServed = {};
  for (const p of data.plan || []) if (!p.skipped && dishes[p.dish_id] && p.day <= today && (!firstServed[p.dish_id] || p.day < firstServed[p.dish_id])) firstServed[p.dish_id] = p.day;
  return {
    year: Number(y), ratings: ratings.length,
    people: people.sort((a, b) => a.avg - b.avg),
    best: ranked.slice().sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 5),
    worst: ranked.filter((x) => x.avg < 3).sort((a, b) => a.avg - b.avg).slice(0, 3),
    cooked: sortEntries(cooked).slice(0, 5),
    dinners: Object.values(cooked).reduce((a, n) => a + n, 0),
    different: Object.keys(cooked).length,
    newDishes: Object.values(firstServed).filter((d) => String(d).slice(0, 4) === y).length,
    hearts: sortEntries(hearts).slice(0, 3),
  };
}
