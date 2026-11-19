// Küchen-Display am Morgen: Wetter mit Kleidungstipp und was heute mitmuss.
// Reine Rechenlogik ohne Zugriff auf Seite oder Datenbank. Das Wetter kommt von Open-Meteo (kostenlos, ohne Schlüssel).

// Ohne Adresse für den Heimweg gilt Coburg.
export const HOME_DEFAULT = [50.258, 10.964];

export function weatherUrl([lat, lon]) {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3), longitude: lon.toFixed(3), timezone: 'Europe/Berlin', forecast_days: '2',
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code',
    daily: 'temperature_2m_min,temperature_2m_max,precipitation_probability_max,weather_code',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

// WMO-Wettercodes in Worten.
export function codeWord(c) {
  if (c == null) return '';
  if (c === 0) return 'klar';
  if (c <= 2) return 'heiter';
  if (c === 3) return 'bewölkt';
  if (c === 45 || c === 48) return 'Nebel';
  if (c >= 51 && c <= 57) return 'Niesel';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'Regen';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'Schnee';
  if (c >= 95) return 'Gewitter';
  return '';
}
const snowy = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;
const rainy = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;

// Der Tag zwischen from und to Uhr: tiefste und höchste Temperatur, Regen, Schnee, erste Regenstunde.
// data: Antwort von Open-Meteo. day: JJJJ-MM-TT.
export function daySummary(data, day, from = 7, to = 18) {
  const h = data && data.hourly;
  if (!h || !Array.isArray(h.time)) return null;
  const idx = h.time.map((t, i) => [t, i]).filter(([t]) => t.slice(0, 10) === day && Number(t.slice(11, 13)) >= from && Number(t.slice(11, 13)) <= to).map(([, i]) => i);
  if (!idx.length) return null;
  const temps = idx.map((i) => h.temperature_2m[i]).filter((x) => typeof x === 'number');
  const prob = idx.map((i) => (h.precipitation_probability || [])[i] ?? 0);
  const codes = idx.map((i) => (h.weather_code || [])[i]);
  const wet = idx.filter((i, n) => prob[n] >= 50 || rainy(codes[n]) || snowy(codes[n]));
  const main = codes.reduce((m, c) => (snowy(c) ? c : rainy(c) && !snowy(m) ? c : m == null ? c : m), null);
  return {
    min: Math.round(Math.min(...temps)), max: Math.round(Math.max(...temps)),
    regen: Math.max(...prob), ab: wet.length ? Number(h.time[wet[0]].slice(11, 13)) : null,
    schnee: codes.some(snowy), wort: codeWord(main),
  };
}

// Was die Kinder anziehen sollen, kurz und konkret.
export function clothesTip(s) {
  if (!s) return '';
  const out = [];
  if (s.min <= 0) out.push('Mütze, Schal und Handschuhe');
  else if (s.min <= 6) out.push('warme Jacke und Mütze');
  else if (s.min <= 12) out.push('Jacke');
  else if (s.min <= 17) out.push('leichte Jacke');
  else out.push('T-Shirt-Wetter');
  if (s.schnee) out.push('Winterstiefel');
  else if (s.regen >= 50) out.push('Regenjacke');
  const t = out.join(', ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function weatherLine(s) {
  if (!s) return '';
  const temp = s.min === s.max ? `${s.min} Grad` : `${s.min} bis ${s.max} Grad`;
  const wet = s.regen >= 50 && s.ab != null ? `${s.schnee ? 'Schnee' : 'Regen'} ab ${s.ab} Uhr` : s.regen >= 30 ? `Regen möglich (${s.regen} %)` : s.wort;
  return [temp, wet].filter(Boolean).join(', ');
}

// Aus den Terminen des Tages: was mitmuss und wem man Glück wünscht.
// items: Kalendertermine { titel, ... } mit people (Personen, gerne mehrere).
const BRING = [
  [/schwimm|hallenbad|freibad/i, 'Schwimmsachen'],
  [/sport|turnen|training|handball|fußball|fussball|leichtathletik|tanz|ballett|judo|karate|reiten/i, 'Sportsachen'],
  [/musikschule|klavier|gitarre|geige|flöte|chor|orchester|bandprobe/i, 'Noten oder Instrument'],
  [/ausflug|wandertag|exkursion|lehrgang/i, 'Proviant und Trinkflasche'],
  [/geld|eintritt|kino|museum/i, 'Geld'],
];
const EXAM = /schulaufgabe|probe|stegreif|\bex\b|extemporale|test|klassenarbeit|prüfung|referat|abfrage|lernzielkontrolle|lzk/i;
export function morningNotes(items) {
  const exams = [];
  const bring = new Map();
  for (const x of items || []) {
    const who = (x.people || []).map((p) => p.name);
    if (EXAM.test(x.titel) && !/leseprobe|generalprobe|\bgp\b/i.test(x.titel)) { exams.push({ who, titel: x.titel }); continue; }
    for (const [re, what] of BRING) {
      if (!re.test(x.titel)) continue;
      const list = bring.get(what) || [];
      for (const n of who) if (!list.includes(n)) list.push(n);
      bring.set(what, list);
      break;
    }
  }
  return {
    exams,
    bring: [...bring.entries()].map(([what, who]) => ({ what, who })),
  };
}
