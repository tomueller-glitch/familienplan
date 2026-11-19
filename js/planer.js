// Wochenplan mit Claude: Regeln, Kontext für die Anfrage und Hilfen für die Entwürfe.
// Die Anfrage selbst stellt die Push-Funktion bei Supabase (supabase/functions/push).

import * as L from './logic.js';
import * as T from './termine.js';

// Gleiche Grundwerte wie in der Funktion (DEFAULT_RULES). Gespeichert wird nur, was die Eltern ändern.
export const DEFAULT_RULES = {
  ausschluesse: ['Brokkoli', 'Rosenkohl', 'Vollkornnudeln', 'Ofenlachs'],
  vorlieben: 'Fisch gern gebacken oder paniert, zum Beispiel Seelachs oder Kabeljau. Lachs nur geräuchert. Fett muss nicht krampfhaft reduziert werden, Fischstäbchen lieber in der Pfanne.',
  ziele: 'Gesünder und proteinreicher essen. Bio wann immer möglich. Kinderfreundlich für 9 und 12 Jahre. Thermomix und Airfryer gern einbauen.',
  kochzeit: 60,
  neue_rezepte: 2,
  vegan: 1,
  auto: true,
  tag: 4,
  zeit: '12:00',
  modell: 'claude-sonnet-5-5',
  lidl: true,
  saison: true,
};

// Märkte. Leer oder unbekannt heißt Aldi Süd.
export const SHOPS = { '': 'Aldi Süd', lidl: 'Lidl' };
export const SHOP_PLACES = { '': 'Coburg-Creidlitz', lidl: 'Coburg-Ketschendorf' };
export const shopOf = (item) => (item && item.shop === 'lidl' ? 'lidl' : '');

export const MODELS = [
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5', 'empfohlen, etwa 15 Cent pro Plan'],
  ['claude-opus-5-5', 'Claude Opus 5.5', 'gründlicher, etwa 30 Cent pro Plan'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5', 'sehr günstig, einfachere Rezepte'],
];

export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export const settingOf = (settings, key) => (settings.find((s) => s.key === key) || {}).value;

// Urlaub und Tage auswärts: Zeiträume, in denen niemand zu Hause isst.
export function holidays(settings) {
  const list = settingOf(settings, 'urlaub');
  return Array.isArray(list) ? list.filter((u) => u && /^\d{4}-\d{2}-\d{2}$/.test(u.von) && /^\d{4}-\d{2}-\d{2}$/.test(u.bis)) : [];
}
export function holidayOn(settings, day) {
  return holidays(settings).find((u) => day >= u.von && day <= u.bis) || null;
}

export function rulesOf(settings) {
  const r = { ...DEFAULT_RULES, ...(settingOf(settings, 'regeln') || {}) };
  if (!Array.isArray(r.ausschluesse)) r.ausschluesse = String(r.ausschluesse || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  return r;
}

// Was die Funktion über die Familie wissen muss. Die Rechnungen (Ferien, Essenszeit, Bewertungen)
// stehen in der App, deshalb legt die App das Ergebnis in ep_settings ab.
export function buildContext(data, stats, nutritionOf, today = L.todayISO()) {
  const tage = [];
  for (let n = 1; n <= 21; n += 1) {
    const day = L.addDays(today, n);
    const info = T.dinnerInfo(data.persons, data.events, data.attendance, day);
    tage.push({
      tag: day,
      schulfrei: L.schoolFree(day) || null,
      essen: info.time,
      esser: info.eaters,
      weg: info.away.map((x) => x.person.name),
      kurz: T.isBusy(data.persons, data.events, data.attendance, day),
      // Festtage mit eigenem Plan bleiben im Wochenplan von Claude frei, wie Urlaub.
      urlaub: (holidayOn(data.settings || [], day) || {}).name || (feastOn(data.settings || [], day) && feastOn(data.settings || [], day).plan ? `Festessen ${feastOn(data.settings || [], day).anlass || ''}, schon geplant`.trim() : null),
      gaeste: Math.max(0, Number(((data.plan || []).find((p) => p.day === day) || {}).guests) || 0),
    });
  }
  return {
    stand: today,
    tage,
    vorrat: data.pantry.filter((x) => x.have).map((x) => x.label),
    auswertung: withCosts(L.buildExport(data, stats, today, nutritionOf), data),
  };
}

// Neuester Entwurf einer Woche, ersetzte zählen nicht.
export function runFor(runs, week) {
  return runs
    .filter((r) => String(r.week_start).slice(0, 10) === week && r.status !== 'ersetzt')
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] || null;
}

export const RUNNING = ['angebote', 'plan'];

export function runText(run) {
  if (!run) return '';
  const kw = `KW ${L.isoWeek(String(run.week_start).slice(0, 10))}`;
  const since = run.created_at ? new Date(run.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
  switch (run.status) {
    case 'angebote': return `${kw}: Claude sucht die Aldi-Angebote (gestartet ${since} Uhr).`;
    case 'plan': return `${kw}: Claude schreibt den Plan. Das dauert meist bis zu einer Stunde.`;
    case 'fertig': return `${kw}: Der Entwurf liegt bereit.`;
    case 'freigegeben': return `${kw}: Freigegeben.`;
    case 'verworfen': return `${kw}: Verworfen.`;
    case 'fehler': return `${kw}: Hat nicht geklappt. ${run.error || ''}`;
    default: return `${kw}: ${run.status}`;
  }
}

// Festtage: gespeichert in ep_settings unter "feste".
export function feasts(settings) {
  const v = settingOf(settings, 'feste');
  return Array.isArray(v) ? v.filter((f) => f && f.id && /^\d{4}-\d{2}-\d{2}$/.test(f.datum || '')) : [];
}
export const feastOn = (settings, day) => feasts(settings).find((f) => f.datum === day) || null;

// Antwort im Demo-Modus: so sieht ein Festtags-Plan aus.
export function demoFeast(f) {
  const n = (Number(f.erwachsene) || 0) + (Number(f.kinder) || 0);
  return {
    titel: `${f.anlass || 'Heiligabend'}: Fondue (Beispiel)`,
    menue: [
      { gang: 'Hauptgang', gericht: 'Fondue mit Gemüsebrühe', beschreibung: 'Rinderhüfte, Putenbrust und Garnelen, dazu Champignons, Paprika, Zucchini und Baguette.' },
      { gang: 'Nachtisch', gericht: 'Bratapfel mit Vanillesoße', beschreibung: 'Lässt sich am Nachmittag vorbereiten.' },
    ],
    mengen: [
      { was: 'Fleisch und Fisch', pro_erwachsener: '200 g', pro_kind: '120 g', gesamt: `${Math.round(((Number(f.erwachsene) || 0) * 200 + (Number(f.kinder) || 0) * 120) / 50) * 50} g` },
      { was: 'Gemüse zum Garen', pro_erwachsener: '150 g', pro_kind: '100 g', gesamt: 'etwa 1,3 kg' },
      { was: 'Baguette', pro_erwachsener: '1/3 Stange', pro_kind: '1/4 Stange', gesamt: `${Math.ceil(n / 3)} Stangen` },
    ],
    dips: [
      { name: 'Knoblauch-Quark', zutaten: [[500, 'g', 'Magerquark', 'kuehl'], [2, 'Stk.', 'Knoblauchzehen', 'obst'], [null, '', 'Salz, Pfeffer', 'basis']], zubereitung: 'Knoblauch fein reiben, mit Quark und etwas Milch glatt rühren, abschmecken.', kinder: true },
      { name: 'Curry-Mango-Dip', zutaten: [[200, 'g', 'Joghurt', 'kuehl'], [3, 'EL', 'Mango-Chutney', 'vorrat'], [null, '', '1 TL Currypulver', 'basis']], zubereitung: 'Alles verrühren und 30 Minuten ziehen lassen.', kinder: true },
      { name: 'Cocktailsoße', zutaten: [[150, 'g', 'Mayonnaise', 'vorrat'], [3, 'EL', 'Ketchup', 'vorrat']], zubereitung: 'Verrühren, mit einem Spritzer Zitrone abschmecken.', kinder: true },
      { name: 'Kräuter-Senf-Dip', zutaten: [[200, 'g', 'Schmand', 'kuehl'], [2, 'TL', 'Senf', 'vorrat'], [1, 'Bund', 'Schnittlauch', 'obst']], zubereitung: 'Schnittlauch fein schneiden, alles verrühren.', kinder: false },
    ],
    gerichte: [{ name: 'Fondue mit Brühe', zutaten: [[800, 'g', 'Rinderhüfte', 'fleisch'], [600, 'g', 'Putenbrust', 'fleisch'], [2, 'l', 'Gemüsebrühe', 'vorrat']], schritte: ['Fleisch in mundgerechte Stücke schneiden.', 'Brühe aufkochen und in den Fondue-Topf füllen.'] }],
    einkauf: [
      { name: 'Rinderhüfte', menge: '800 g', abteilung: 'fleisch', wann: 'frisch', wofuer: 'Fondue' },
      { name: 'Putenbrust', menge: '600 g', abteilung: 'fleisch', wann: 'frisch', wofuer: 'Fondue' },
      { name: 'Magerquark', menge: '500 g', abteilung: 'kuehl', wann: 'vorher', wofuer: 'Knoblauch-Quark' },
      { name: 'Mango-Chutney', menge: '1 Glas', abteilung: 'vorrat', wann: 'vorher', wofuer: 'Curry-Mango-Dip' },
    ],
    zeitplan: [{ wann: 'Am Vortag abends', was: 'Dips anrühren und kalt stellen.' }, { wann: 'Am Festtag 16 Uhr', was: 'Fleisch schneiden, Gemüse vorbereiten.' }],
    kinder: ['Dips anrühren', 'Tisch festlich decken'],
    tipps: 'Beispiel aus dem Demo-Modus. Übrige Brühe ergibt am nächsten Tag eine Suppe.',
  };
}

// Kosten pro Gericht aus ep_settings "kosten" (geschätzt von der Push-Funktion, für das ganze Rezept).
export function costOf(settings, dish) {
  const v = settingOf(settings, 'kosten');
  const euro = v && v.gerichte ? Number(v.gerichte[dish.id]) : NaN;
  if (!(euro > 0)) return null;
  const portions = dish.category === 'brotbox' ? Math.max(1, Number(dish.pieces) || 1) : Math.max(1, Number(dish.servings) || 4);
  return { euro, portion: Math.round((euro / portions) * 100) / 100, unit: dish.category === 'brotbox' ? (dish.pieces ? 'Stück' : 'Rezept') : 'Portion', stand: v.stand, kassenzettel: v.kassenzettel || 0 };
}
function withCosts(exp, data) {
  if (!exp || !Array.isArray(exp.gerichte)) return exp;
  const byName = Object.fromEntries((data.dishes || []).map((d) => [d.name, d]));
  exp.gerichte = exp.gerichte.map((g) => { const d = byName[g.name]; const c = d && costOf(data.settings || [], d); return c ? { ...g, kosten_pro_portion: c.portion } : g; });
  return exp;
}

/* ---------- Saison und Region ---------- */

// Was in Franken im jeweiligen Monat aus der Region kommt, frisch oder als Lagerware. [Gemüse, Obst]
export const SAISON = {"1": ["Grünkohl, Rosenkohl, Lauch, Wirsing, Rotkohl, Weißkohl, Feldsalat, Chicorée, Pastinaken, Schwarzwurzeln, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Zwiebeln, Topinambur", "Äpfel, Birnen"], "2": ["Grünkohl, Rosenkohl, Lauch, Wirsing, Rotkohl, Weißkohl, Feldsalat, Chicorée, Pastinaken, Schwarzwurzeln, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Zwiebeln", "Äpfel, Birnen"], "3": ["Lauch, Feldsalat, Chicorée, Bärlauch, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Zwiebeln, Pastinaken, Rotkohl, Weißkohl", "Äpfel"], "4": ["Bärlauch, Spinat, Rhabarber, Radieschen, Spargel, Feldsalat, Lauch, Frühlingszwiebeln, Karotten, Kartoffeln", "Äpfel, Rhabarber"], "5": ["Spargel, Rhabarber, Spinat, Radieschen, Kohlrabi, Kopfsalat, Frühlingszwiebeln, Mangold, Rucola, Lauch", "Erdbeeren, Rhabarber"], "6": ["Spargel, Kohlrabi, Zucchini, Erbsen, Brokkoli, Blumenkohl, Kopfsalat, Radieschen, Gurken, Mangold, Frühkartoffeln, Karotten, Spinat, Rhabarber", "Erdbeeren, Kirschen, Johannisbeeren"], "7": ["Zucchini, Gurken, Tomaten, Paprika, Bohnen, Erbsen, Brokkoli, Blumenkohl, Kohlrabi, Kopfsalat, Mangold, Karotten, Kartoffeln, Spitzkohl, Fenchel", "Kirschen, Himbeeren, Heidelbeeren, Johannisbeeren, Aprikosen, Erdbeeren"], "8": ["Tomaten, Paprika, Zucchini, Auberginen, Gurken, Bohnen, Mais, Brokkoli, Blumenkohl, Kohlrabi, Kopfsalat, Karotten, Kartoffeln, Fenchel, Spitzkohl, Mangold", "Zwetschgen, Pflaumen, Mirabellen, Birnen, Äpfel, Brombeeren, Heidelbeeren, Himbeeren"], "9": ["Tomaten, Paprika, Zucchini, Kürbis, Bohnen, Brokkoli, Blumenkohl, Lauch, Mais, Rote Bete, Karotten, Kartoffeln, Weißkohl, Rotkohl, Spinat, Fenchel, Zwiebeln", "Äpfel, Birnen, Zwetschgen, Weintrauben, Brombeeren"], "10": ["Kürbis, Lauch, Rote Bete, Weißkohl, Rotkohl, Wirsing, Rosenkohl, Karotten, Kartoffeln, Knollensellerie, Pastinaken, Feldsalat, Spinat, Mangold, Brokkoli, Blumenkohl, Fenchel, Zwiebeln", "Äpfel, Birnen, Quitten, Weintrauben, Walnüsse"], "11": ["Grünkohl, Rosenkohl, Kürbis, Lauch, Wirsing, Rotkohl, Weißkohl, Feldsalat, Chicorée, Pastinaken, Schwarzwurzeln, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Topinambur, Spinat, Zwiebeln", "Äpfel, Birnen, Quitten, Walnüsse"], "12": ["Grünkohl, Rosenkohl, Kürbis, Lauch, Wirsing, Rotkohl, Weißkohl, Feldsalat, Chicorée, Pastinaken, Schwarzwurzeln, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Zwiebeln", "Äpfel, Birnen, Walnüsse"]};

export function seasonOf(month) {
  const [g, o] = SAISON[String(month)] || ['', ''];
  return { gemuese: g.split(', ').filter(Boolean), obst: o.split(', ').filter(Boolean) };
}
// Steht eine Zutat (zum Beispiel „Bio-Karotten“) in der Saisonliste des Monats?
const SEASON_ALIAS = { äpfel: ['apfel'], kartoffeln: ['kartoffel'], 'rote bete': ['rote bete', 'rote beete'], knollensellerie: ['sellerie'], zwetschgen: ['zwetschge', 'zwetschg'], weintrauben: ['trauben'], mais: ['mais'] };
export function isSeasonal(label, month) {
  const text = String(label || '').toLowerCase();
  if (!text) return false;
  const s = seasonOf(month);
  // Frühlings- und Lauchzwiebeln sind weder Zwiebeln noch Lauch im Sinne der Liste.
  if (/frühlingszwiebel|lauchzwiebel/.test(text)) return s.gemuese.includes('Frühlingszwiebeln');
  return [...s.gemuese, ...s.obst].some((name) => {
    const n = name.toLowerCase();
    const stems = [n.replace(/(en|n|e|s)$/, ''), ...(SEASON_ALIAS[n] || [])];
    return stems.some((st) => st.length >= 4 && text.includes(st));
  });
}

/* ---------- Einkaufstage und Feiertage ---------- */

// Tage, an denen in Coburg die Märkte zu sind (gleiche Liste wie in der Push-Funktion).
// Buß- und Bettag ist nur schulfrei, Mariä Himmelfahrt ist in Coburg kein Feiertag.
export function shopHoliday(day) {
  const h = L.holidaysBY(Number(day.slice(0, 4)))[day] || null;
  return h === 'Buß- und Bettag' || h === 'Mariä Himmelfahrt' ? null : h;
}
export const shortDay = (day) => /-12-(24|31)$/.test(day);
export const shopClosed = (day) => L.wdIndex(day) === 6 || !!shopHoliday(day);
// Letzter offener Einkaufstag an oder vor "day". Mit avoidShort nie Heiligabend oder Silvester.
export function shopDayBack(day, avoidShort = false) {
  let d = day;
  for (let n = 0; n < 7 && (shopClosed(d) || (avoidShort && shortDay(d))); n += 1) d = L.addDays(d, -1);
  return d;
}
// Die zwei Touren einer Woche, mit denselben Namen wie in Claudes Plan (Funktion push, toImport): Großeinkauf am Samstag
// davor, Frischeeinkauf am Mittwoch. Ist der Markt zu, rückt die Tour auf den letzten offenen Tag davor.
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const dm = (iso) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
export function shopTrips(week) {
  const tour = (label, regular, avoidShort) => {
    const day = shopDayBack(regular, avoidShort);
    const why = day !== regular ? `${WD[L.wdIndex(regular)]} ${dm(regular)} ist ${shopHoliday(regular) || (shortDay(regular) ? 'nur bis mittags offen' : 'Sonntag')}` : '';
    return { trip: `${label} am ${WD[L.wdIndex(day)]} ${dm(day)}${why ? `, vorgezogen (${why})` : ''}${shortDay(day) ? ', Markt schließt mittags' : ''}`, due: day };
  };
  return [tour('Großeinkauf', L.addDays(week, -2), true), tour('Frischeeinkauf', L.addDays(week, 2), false)];
}
