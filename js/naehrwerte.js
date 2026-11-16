// Nährwerte pro Portion, geschätzt aus den Zutaten eines Rezepts.
// Grundlage sind übliche Durchschnittswerte je 100 g. Das ersetzt keine Packungsangabe:
// Die Zahlen sind Näherungen, Salz zum Abschmecken („Salz, Pfeffer“) ist nicht enthalten.
// Trägt man bei einem Gericht eigene Werte ein (z. B. von einer Rezeptkarte), gelten diese.

import { parseIngredientLine } from './logic.js';

export const FIELDS = [
  ['kcal', 'Brennwert', 'kcal'],
  ['fat', 'Fett', 'g'],
  ['sat', 'davon gesättigte Fettsäuren', 'g'],
  ['carbs', 'Kohlenhydrate', 'g'],
  ['sugar', 'davon Zucker', 'g'],
  ['fiber', 'Ballaststoffe', 'g'],
  ['protein', 'Eiweiß', 'g'],
  ['salt', 'Salz', 'g'],
];

// [Muster, kcal, Fett, gesättigt, Kohlenhydrate, Zucker, Ballaststoffe, Eiweiß, Salz, Zusatz]
// Zusatz: stk = Gramm pro Stück, Dose, Packung usw., el/tl = Gramm pro Löffel.
// Reihenfolge zählt: Das erste passende Muster gewinnt, deshalb Spezielles vor Allgemeinem.
const T = [
  // Gewürze, Wasser und anderes ohne nennenswerte Nährwerte
  [/wasser|backpulver|natron|pfeffer|paprikapulver|kreuzkümmel|oregano|muskat|zimt|chili(pulver|flocken)|curry|kurkuma|thymian|rosmarin|basilikum|lorbeer|vanille(?!zucker)|ingwer/, 0, 0, 0, 0, 0, 0, 0, 0],
  [/^salz|meersalz|jodsalz/, 0, 0, 0, 0, 0, 0, 0, 100, { tl: 5, el: 15 }],
  // Fleisch und Wurst
  [/hackfleisch|rinderhack|gehacktes|hack\b/, 240, 17, 7.5, 0, 0, 0, 20, 0.2],
  [/hähnchen|hühnchen|huhn|poularde/, 107, 1.5, 0.5, 0, 0, 0, 23, 0.15],
  [/pute|truthahn/, 110, 1.5, 0.5, 0, 0, 0, 24, 0.15],
  [/schinken|prosciutto|aufschnitt/, 110, 3, 1, 1, 1, 0, 20, 2, { stk: 20 }],
  [/speck|bacon/, 300, 27, 10, 0.5, 0.5, 0, 15, 3],
  [/bratwurst|würstchen|wiener|wurst/, 280, 25, 9, 1, 0.5, 0, 13, 2, { stk: 80 }],
  [/rindfleisch|rinder(steak|gulasch|filet)|steak|gulasch/, 130, 4.5, 2, 0, 0, 0, 22, 0.15],
  [/schwein|schnitzel|kotelett/, 140, 6, 2.2, 0, 0, 0, 21, 0.15],
  // Fisch
  [/räucherlachs/, 180, 11, 2.2, 0, 0, 0, 21, 3],
  [/seelachs|kabeljau|rotbarsch|pangasius|schlemmerfilet|fischfilet/, 78, 0.8, 0.2, 0, 0, 0, 17.5, 0.3],
  [/fischstäbchen/, 200, 9, 1, 17, 1, 1, 12.5, 0.9, { stk: 30 }],
  [/lachs/, 200, 13, 3, 0, 0, 0, 20, 0.1],
  [/thunfisch/, 110, 1, 0.3, 0, 0, 0, 25, 1, { stk: 140 }],
  [/garnele|shrimp/, 85, 1, 0.2, 0, 0, 0, 18, 1],
  // Eier und Milchprodukte
  [/(^|[\s-])ei(er)?$|eigelb|eiweiß$/, 150, 11, 3.3, 1, 1, 0, 12.5, 0.3, { stk: 55 }],
  [/kokosmilch/, 190, 19, 17, 3, 2, 0, 1.8, 0.05],
  [/hafer(drink|milch)|mandel(drink|milch)|soja(drink|milch)/, 45, 1.5, 0.2, 6.5, 4, 0.8, 1, 0.1],
  [/buttermilch/, 37, 0.5, 0.3, 4, 4, 0, 3.3, 0.1],
  [/milch/, 64, 3.5, 2.3, 4.8, 4.8, 0, 3.4, 0.1],
  [/saure sahne|schmand|cr[eè]me fra[iî]che/, 180, 17, 11, 3.2, 3.2, 0, 2.8, 0.1],
  [/kochsahne|cremefine/, 165, 15, 10, 4, 4, 0, 3, 0.1],
  [/sahne/, 300, 31, 20, 3, 3, 0, 2.4, 0.1],
  [/skyr/, 63, 0.2, 0.1, 4, 4, 0, 11, 0.1],
  [/quark/, 68, 0.3, 0.2, 4, 4, 0, 12, 0.1],
  [/joghurt/, 65, 3.5, 2.3, 4.5, 4.5, 0, 3.8, 0.1],
  [/frischkäse/, 250, 23, 15, 3, 3, 0, 6, 0.8],
  [/mozzarella/, 250, 19, 13, 1, 1, 0, 18, 0.5, { stk: 125 }],
  [/feta|hirtenkäse/, 265, 21, 14, 1, 1, 0, 17, 2.5],
  [/parmesan|grana/, 400, 29, 19, 0, 0, 0, 33, 1.6, { el: 8 }],
  [/hüttenkäse|körniger/, 95, 4, 2.6, 2, 2, 0, 12.5, 0.8],
  [/käse|gouda|emmentaler|cheddar/, 350, 28, 18, 0, 0, 0, 25, 1.8, { stk: 25 }],
  [/erdnuss(mus|butter)/, 610, 50, 9, 12, 6, 7, 26, 0.5, { el: 16, tl: 6 }],
  [/butter|margarine/, 740, 82, 54, 0.7, 0.7, 0, 0.7, 0.02, { el: 12, tl: 5 }],
  // Fette
  [/olivenöl/, 880, 100, 14, 0, 0, 0, 0, 0, { el: 12, tl: 4 }],
  [/(^|[\s-])(raps|sonnenblumen|brat|sesam|kokos)?öl(\s|$|,)/, 880, 100, 8, 0, 0, 0, 0, 0, { el: 12, tl: 4 }],
  [/mayonnaise|mayo/, 700, 77, 6, 2, 2, 0, 1, 1, { el: 15 }],
  // Getreide, Nudeln, Brot
  [/udon/, 135, 0.5, 0.1, 27, 0.5, 1, 4, 0.5],
  [/gnocchi/, 160, 0.5, 0.2, 34, 1, 2, 4, 1],
  [/nudel|spaghetti|penne|fusilli|makkaroni|tagliatelle|lasagneplatten|spätzle/, 355, 1.5, 0.3, 71, 3, 3, 12.5, 0],
  [/reis/, 350, 0.6, 0.2, 78, 0.2, 1.4, 7, 0],
  [/bulgur|couscous/, 345, 1.3, 0.2, 69, 0.5, 8, 12, 0],
  [/linsen/, 340, 1.5, 0.2, 50, 1.5, 11, 25, 0],
  [/haferflocken/, 370, 7, 1.3, 59, 1, 10, 13.5, 0, { el: 8 }],
  [/semmelbrösel|paniermehl/, 360, 2, 0.5, 72, 5, 4, 11, 1.2, { el: 10 }],
  [/speisestärke|stärke/, 350, 0, 0, 86, 0, 0, 0.5, 0, { el: 10, tl: 3 }],
  [/mehl/, 345, 1, 0.2, 72, 1, 3, 10, 0, { el: 10, tl: 3 }],
  [/knödel/, 190, 3.5, 1, 32, 3, 1.5, 6.5, 1.2, { stk: 390 }],
  [/tortilla|wrap/, 300, 7, 3, 50, 2, 2.5, 8, 1.2, { stk: 60 }],
  [/pita|fladenbrot/, 265, 1.5, 0.3, 53, 2, 2.5, 9, 1, { stk: 80 }],
  [/blätterteig/, 380, 26, 13, 31, 2, 1.5, 5, 0.9, { stk: 275 }],
  [/pizzateig/, 250, 4, 0.6, 45, 2, 2, 7, 1.2, { stk: 400 }],
  [/toast/, 260, 3.5, 0.5, 48, 4, 3, 8, 1.2, { stk: 25 }],
  [/brötchen|burger.?buns?/, 270, 2, 0.4, 53, 3, 3, 9, 1.3, { stk: 60 }],
  [/brot/, 230, 1.5, 0.3, 44, 3, 6, 7, 1.2, { stk: 45 }],
  [/hefe/, 100, 1, 0.2, 7, 0, 7, 12, 0, { stk: 42 }],
  // Hülsenfrüchte und Konserven
  [/kidneybohnen|weiße bohnen|schwarze bohnen/, 105, 0.6, 0.1, 13, 1, 7, 8, 0.6, { stk: 255 }],
  [/kichererbsen/, 120, 2.5, 0.3, 15, 0.5, 6, 7, 0.5, { stk: 240 }],
  [/mais/, 80, 1.2, 0.2, 13, 5, 3, 3, 0.5, { stk: 285 }],
  [/erbsen/, 80, 0.5, 0.1, 10, 4, 5, 5.5, 0],
  [/tofu/, 125, 7.5, 1.2, 1.5, 0.5, 1, 13, 0],
  [/tomatenmark/, 85, 0.5, 0.1, 14, 13, 3, 4.5, 0.5, { el: 15, tl: 6 }],
  [/passierte tomaten|gehackte tomaten|stückige tomaten|dosentomaten|tomatensauce|tomatensoße/, 28, 0.2, 0, 4.5, 4.5, 1.2, 1.3, 0.3, { stk: 400 }],
  [/apfelmus/, 80, 0.2, 0, 18, 16, 1.5, 0.3, 0, { stk: 360, el: 20 }],
  // Gemüse und Obst
  [/datteltomate|cherrytomate|cocktailtomate|tomate/, 19, 0.2, 0, 2.8, 2.8, 1, 0.9, 0, { stk: 100 }],
  [/dattel/, 290, 0.5, 0.1, 65, 63, 8, 2, 0, { stk: 8 }],
  [/süßkartoffel/, 86, 0.1, 0, 20, 4, 3, 1.6, 0.1, { stk: 250 }],
  [/kartoffel/, 77, 0.1, 0, 16, 0.8, 2, 2, 0, { stk: 120 }],
  [/karotte|möhre/, 33, 0.2, 0, 6.5, 6, 3, 0.9, 0.1, { stk: 80 }],
  [/frühlingszwiebel|lauchzwiebel/, 28, 0.2, 0, 4, 3, 2, 1.5, 0, { stk: 15 }],
  [/zwiebel|schalotte/, 30, 0.2, 0, 5, 5, 1.8, 1.2, 0, { stk: 80 }],
  [/knoblauch/, 140, 0.1, 0, 28, 1, 2, 6, 0, { stk: 3 }],
  [/paprika/, 30, 0.3, 0, 5, 5, 2, 1, 0, { stk: 150 }],
  [/gurke/, 13, 0.2, 0, 1.8, 1.8, 0.5, 0.6, 0, { stk: 400 }],
  [/zucchini/, 19, 0.3, 0.1, 2.2, 2.2, 1, 1.6, 0, { stk: 250 }],
  [/aubergine/, 20, 0.2, 0, 2.5, 2.5, 3, 1, 0, { stk: 300 }],
  [/champignon|pilze/, 22, 0.3, 0.1, 0.6, 0.3, 2, 3, 0, { stk: 20 }],
  [/pak choi|chinakohl|weißkohl|spitzkohl|rotkohl|wirsing/, 20, 0.2, 0, 2.5, 2, 1.8, 1.5, 0.1, { stk: 800 }],
  [/spinat/, 22, 0.4, 0.1, 0.6, 0.5, 2.2, 2.7, 0.1],
  [/blumenkohl|brokkoli|kohlrabi/, 28, 0.3, 0, 2.5, 2.3, 2.5, 2.5, 0, { stk: 500 }],
  [/lauch|porree|sellerie|fenchel/, 27, 0.3, 0, 3.3, 3, 2.3, 1.8, 0.1, { stk: 200 }],
  [/kürbis/, 28, 0.1, 0, 5, 3, 2, 1.1, 0, { stk: 1000 }],
  [/grüne bohnen|bohnen/, 33, 0.2, 0, 5, 2.5, 3, 2.2, 0],
  [/salat|rucola/, 14, 0.2, 0, 1.8, 1.8, 1.3, 1, 0, { stk: 300 }],
  [/avocado/, 160, 15, 2.2, 2, 0.5, 6.7, 2, 0, { stk: 150 }],
  [/zitrone|limette/, 30, 0.3, 0, 3, 2.5, 0, 0.5, 0, { stk: 40 }],
  [/schnittlauch|petersilie|dill|kräuter|koriander|minze/, 35, 0.6, 0.1, 3, 2, 3, 3, 0, { stk: 25, el: 3 }],
  [/banane/, 93, 0.2, 0.1, 21, 17, 2, 1.1, 0, { stk: 120 }],
  [/apfel|birne/, 54, 0.2, 0, 12, 11, 2, 0.3, 0, { stk: 150 }],
  [/beeren|himbeer|erdbeer|heidelbeer/, 40, 0.4, 0, 6, 5.5, 3.5, 1, 0],
  [/orangensaft|apfelsaft|saft/, 45, 0.1, 0, 9.5, 9, 0.2, 0.6, 0],
  [/orange|mandarine/, 45, 0.2, 0, 9, 8.5, 2, 0.9, 0, { stk: 150 }],
  [/rosinen|trockenobst/, 300, 0.5, 0.2, 68, 65, 5, 2.5, 0],
  // Nüsse, Saaten, Süßes
  [/kokosraspel/, 610, 62, 53, 6, 6, 16, 6, 0, { el: 6 }],
  [/sesam/, 595, 50, 7, 10, 0.5, 11, 20, 0, { el: 9, tl: 3 }],
  [/mandel|walnuss|haselnuss|cashew|nüsse|erdnüsse|pinienkern|sonnenblumenkern|kürbiskern/, 610, 53, 5, 7, 4, 9, 21, 0, { el: 10 }],
  [/kakao/, 350, 21, 13, 13, 1, 30, 20, 0, { el: 7, tl: 3 }],
  [/schokolade|schokodrops/, 530, 32, 19, 50, 47, 6, 6, 0.1],
  [/honig|ahornsirup|agavendicksaft|sirup/, 310, 0, 0, 77, 76, 0, 0.3, 0, { el: 20, tl: 7 }],
  [/zucker/, 400, 0, 0, 100, 100, 0, 0, 0, { el: 15, tl: 5, stk: 8 }],
  // Soßen und Würzmittel
  [/soja(so|sau)/, 60, 0, 0, 6, 2, 0, 8, 14, { el: 16, tl: 6 }],
  [/sweet.?chili/, 230, 0.5, 0.1, 55, 50, 1, 0.5, 2.5, { el: 18 }],
  [/ketchup/, 100, 0.1, 0, 24, 22, 0.5, 1.2, 2, { el: 17 }],
  [/senf/, 90, 5, 0.3, 4, 3, 2, 5, 3.5, { el: 15, tl: 6 }],
  [/pesto/, 450, 44, 7, 6, 4, 2, 5, 2.5, { el: 15 }],
  [/balsamico/, 90, 0, 0, 17, 15, 0, 0.5, 0.05],
  [/essig/, 20, 0, 0, 0.6, 0.6, 0, 0, 0],
  // Ein Teelöffel Brühpulver ergibt etwa 250 ml fertige Brühe.
  [/brühe|fond/, 4, 0.1, 0, 0.4, 0.3, 0, 0.2, 0.9, { tl: 250, el: 750, stk: 500 }],
];

const UNIT_DEFAULT = { '': 100, Dose: 250, Packung: 250, Becher: 200, Glas: 350, Kugel: 125, Kopf: 300, Bund: 30, Würfel: 42, Scheibe: 25, Tube: 100, Zehe: 3, Stange: 150 };

function lookup(name) {
  const n = String(name).toLowerCase().replace(/\bbio[\s-]*/g, '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return T.find((row) => row[0].test(n)) || null;
}

// Gewicht einer Zutat in Gramm, oder null, wenn es sich nicht bestimmen lässt.
function grams(q, u, row) {
  const x = row[9] || {};
  if (u === 'g' || u === 'ml') return q;
  if (u === 'EL') return q * (x.el || 15);
  if (u === 'TL') return q * (x.tl || 5);
  if (u === 'Prise') return q * 0.5;
  if (x.stk) return q * x.stk;
  return UNIT_DEFAULT[u] != null ? q * UNIT_DEFAULT[u] : null;
}

const hasValues = (n) => !!n && typeof n === 'object' && Number(n.kcal) > 0;

// Liefert { per, source, values, missing, counted }.
// per: 'Portion' oder 'Stück'. source: 'eingetragen' oder 'berechnet'. values: null, wenn nichts berechenbar ist.
export function nutrition(dish) {
  const per = dish.pieces ? 'Stück' : 'Portion';
  if (hasValues(dish.nutrition)) {
    const values = {};
    for (const [k] of FIELDS) values[k] = Number(dish.nutrition[k]) || 0;
    return { per, source: 'eingetragen', values, missing: [], counted: 0 };
  }
  const sum = [0, 0, 0, 0, 0, 0, 0, 0];
  const missing = [];
  let counted = 0;
  for (const raw of dish.ingredients || []) {
    // Grundzutaten stehen als Text da („3 EL Öl“), die Menge steckt im Namen.
    const ing = raw.q == null ? parseIngredientLine(raw.n) : raw;
    if (!ing || ing.q == null) continue;
    const row = lookup(ing.n);
    let g = row ? grams(ing.q, ing.u, row) : null;
    if (g == null) { missing.push(ing.n); continue; }
    // Von reichlich Bratfett bleibt nur ein Teil im Essen.
    if (/zum (an)?braten|zum frittieren|zum ausbacken/i.test(ing.n) && g >= 50) g *= 0.35;
    for (let k = 0; k < 8; k++) sum[k] += (row[k + 1] * g) / 100;
    counted += 1;
  }
  if (!counted) return { per, source: 'berechnet', values: null, missing, counted };
  const div = dish.pieces || dish.servings || 4;
  const values = {};
  FIELDS.forEach(([k], n) => { values[k] = sum[n] / div; });
  return { per, source: 'berechnet', values, missing, counted };
}

// Geschätzte Kalorien werden auf 5 gerundet, eingetragene Werte bleiben genau.
export function fmtValue(key, v, exact = false) {
  if (v == null) return '';
  if (key === 'kcal') return String(exact ? Math.round(v) : Math.round(v / 5) * 5);
  if (key === 'salt' || v < 10) return (Math.round(v * 10) / 10).toLocaleString('de-DE');
  return String(Math.round(v));
}

// Durchschnitt über mehrere Gerichte, z. B. die Abendessen einer Woche.
export function average(dishes) {
  const rows = dishes.map((d) => nutrition(d).values).filter(Boolean);
  if (!rows.length) return null;
  const out = {};
  for (const [k] of FIELDS) out[k] = rows.reduce((s, r) => s + r[k], 0) / rows.length;
  return { values: out, n: rows.length };
}

/* ---------- Ampel ---------- */

// Einordnung pro Portion nach dem Vorbild der Lebensmittelampel. Maßstab ist die Referenzmenge für
// einen Erwachsenen pro Tag (70 g Fett, 20 g gesättigte Fettsäuren, 90 g Zucker, 6 g Salz).
// Die offizielle Ampel bewertet verpackte Lebensmittel und wäre für ein ganzes Abendessen zu streng,
// deshalb gelten hier eigene Grenzen für eine Hauptmahlzeit: bis 25 % der Tagesmenge grün,
// bis 40 % gelb, darüber rot.
export const AMPEL = [
  ['fat', 'Fett', 70],
  ['sat', 'gesättigtes Fett', 20],
  ['sugar', 'Zucker', 90],
  ['salt', 'Salz', 6],
];
// Pluspunkte: ab diesen Mengen pro Portion gilt ein Gericht als reich an Eiweiß oder Ballaststoffen.
export const PLUS = [['protein', 'viel Eiweiß', 40], ['fiber', 'viele Ballaststoffe', 10]];
const WORD = { gruen: 'niedrig', gelb: 'mittel', rot: 'hoch' };

// Liefert null für Rezepte ohne Werte und für Brotbox-Rezepte mit Stückzahl (dort passt der Maßstab nicht).
export function ampel(dish) {
  const r = nutrition(dish);
  if (!r.values || dish.pieces) return null;
  const items = AMPEL.map(([key, label, day]) => {
    const share = r.values[key] / day;
    const level = share <= 0.25 ? 'gruen' : share <= 0.4 ? 'gelb' : 'rot';
    return { key, label, level, word: WORD[level] };
  });
  const plus = PLUS.filter(([key, , min]) => r.values[key] >= min).map(([key, label]) => ({ key, label }));
  return { items, plus, estimated: r.source === 'berechnet' };
}
