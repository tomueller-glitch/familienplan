// Abfuhrtermine der CEB Coburg für die eigene Straße, aus der Kalenderdatei auf
// abfuhrkalender.ceb-coburg.de (Stand 12.11.2026). Die Termine für 2027 sind noch nicht veröffentlicht.
// Neue Termine einfach anhängen: [Abholtag, Tonne].

export const TONNEN = {
  schwarz: 'schwarze Tonne',
  gruen: 'grüne Tonne',
  gelb: 'gelbe Tonne',
};

const FEST = [
  ['2026-11-19', 'schwarz'],
  ['2026-11-26', 'gruen'],
  ['2026-12-03', 'schwarz'],
  ['2026-12-04', 'gelb'],
  ['2026-12-17', 'schwarz'],
  ['2026-12-24', 'gruen'],
  ['2026-12-31', 'schwarz'],
];

// Termine aus der App dazu (Kalenderdatei der CEB, in den Einstellungen unter „abfuhr“ gespeichert).
// ABFUHR ist eine lebende Bindung: wer es importiert, sieht nach useImported() den neuen Stand.
export let ABFUHR = FEST;
export function useImported(list) {
  const seen = new Set();
  ABFUHR = [...FEST, ...(Array.isArray(list) ? list : [])]
    .filter((x) => Array.isArray(x) && /^\d{4}-\d{2}-\d{2}$/.test(x[0]) && TONNEN[x[1]])
    .filter(([d, t]) => (seen.has(`${d}|${t}`) ? false : seen.add(`${d}|${t}`)))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return ABFUHR;
}

// Kalenderdatei (.ics) lesen. Erkennt Restmüll (schwarz), Bio (grün) und Gelbe Tonne oder Gelber Sack.
// Papier und andere Abfuhren werden übergangen, weil die App sie nicht kennt.
export function parseIcs(text) {
  const raw = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const out = [];
  const skipped = new Set();
  for (const block of raw.split(/BEGIN:VEVENT/i).slice(1)) {
    const date = (block.match(/DTSTART[^:\n]*:(\d{4})(\d{2})(\d{2})/i) || []).slice(1).join('-');
    const sum = ((block.match(/SUMMARY[^:\n]*:([^\r\n]*)/i) || [])[1] || '').replace(/\\([,;\\])/g, '$1').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const s = sum.toLowerCase();
    const bin = /rest|schwarz|grau/.test(s) ? 'schwarz' : /bio|grün|gruen/.test(s) ? 'gruen' : /gelb|wertstoff|verpackung/.test(s) ? 'gelb' : null;
    if (bin) out.push([date, bin]); else if (sum) skipped.add(sum);
  }
  const seen = new Set();
  const list = out.filter(([d, t]) => (seen.has(`${d}|${t}`) ? false : seen.add(`${d}|${t}`))).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { list, skipped: [...skipped] };
}
