// Schulschluss und Heimkommen der Kinder. Reine Rechenlogik ohne Seite und Datenbank.
// Einstellungen in ep_settings unter "schule":
//   kinder: { [Person]: { quelle: 'lernplaner' | 'eigen', weg: Minuten (Standard 30), tage: { 1..5: { bis: 'HH:MM', ogts: 'HH:MM' | '' } } } }
//   frueher: { [JJJJ-MM-TT]: { [Person]: 'HH:MM' } }   früherer Schulschluss an einem Tag, etwa wegen ausgefallener Stunden
// Der Stundenplan aus dem Lernplaner (lp_data "timetable" und "schoolEnd") gilt für das Kind des Lernplaners.
import { isSchoolDay } from './logic.js';

export const WEG_DEFAULT = 30;
export const SCHULTAGE = [1, 2, 3, 4, 5];
export const TAG_NAMEN = { 1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch', 4: 'Donnerstag', 5: 'Freitag' };

const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
export const toHM = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const dow = (day) => new Date(`${day}T12:00:00`).getDay();
const mondayMs = (day) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

// Wie im Lernplaner: A- und B-Woche, ist eine Woche leer, gilt die andere. Ende der letzten Stunde des Tages.
function filled(p) { return !!p && SCHULTAGE.some((w) => (p[w] || []).some(Boolean)); }
export function lernplanerEnd(day, lp) {
  if (!lp) return null;
  const w = dow(day);
  const tt = lp.timetable;
  if (tt && Array.isArray(tt.times)) {
    let type = 'A';
    if (tt.ab && tt.refWeek) {
      const diff = Math.round((mondayMs(day) - mondayMs(String(tt.refWeek).slice(0, 10))) / (7 * 864e5));
      type = Math.abs(diff) % 2 === 0 ? tt.refType : (tt.refType === 'A' ? 'B' : 'A');
    }
    const other = type === 'A' ? 'B' : 'A';
    let plan = tt[type];
    if (!filled(plan)) plan = tt[other];
    let lessons = (plan && plan[w]) || [];
    if (!lessons.some(Boolean) && tt.ab && tt[other] && tt[other][w]) lessons = tt[other][w];
    let last = -1;
    lessons.forEach((x, i) => { if (x) last = i; });
    if (last >= 0 && tt.times[last]) return String(tt.times[last][1]);
  }
  const se = lp.schoolEnd && lp.schoolEnd[w];
  return se ? String(se) : null;
}

export function childCfg(cfg, pid, lpKid) {
  const c = (cfg && cfg.kinder && cfg.kinder[pid]) || {};
  return { quelle: c.quelle || (pid === lpKid ? 'lernplaner' : 'eigen'), weg: Number.isFinite(Number(c.weg)) && c.weg !== '' ? Number(c.weg) : WEG_DEFAULT, tage: c.tage || {} };
}

// Schultag eines Kindes: wann die Schule aus ist, wann es etwa zu Hause ist, und warum.
// art: 'unterricht', 'ogts' oder 'frueher'. regel: das übliche Ende, wenn heute früher aus ist.
export function schoolDay(pid, day, cfg, lp, lpKid) {
  const w = dow(day);
  if (!SCHULTAGE.includes(w) || !isSchoolDay(day)) return null;
  const c = childCfg(cfg, pid, lpKid);
  const t = c.tage[w] || {};
  const lesson = c.quelle === 'lernplaner' && pid === lpKid ? lernplanerEnd(day, lp) : t.bis || null;
  const ogts = t.ogts || null;
  const usual = ogts && toMin(ogts) > (toMin(lesson) ?? 0) ? ogts : lesson;
  const early = cfg && cfg.frueher && cfg.frueher[day] && cfg.frueher[day][pid];
  const ende = early || usual;
  if (!ende || toMin(ende) == null) return null;
  const art = early ? 'frueher' : usual === ogts && ogts ? 'ogts' : 'unterricht';
  return { ende, heim: toHM(toMin(ende) + c.weg), art, regel: early ? usual : null, unterricht: lesson, ogts };
}

// Kurzer Text für Display und Übersicht.
export function dayText(s) {
  if (!s) return '';
  if (s.art === 'frueher') return `heute früher aus (${s.ende}${s.regel ? ` statt ${s.regel}` : ''})`;
  if (s.art === 'ogts') return `OGTS bis ${s.ende}`;
  return `Schule bis ${s.ende}`;
}

// Alte Einträge für "früher aus" (vor gestern) fallen weg.
export function pruneEarly(frueher, today) {
  const from = new Date(`${today}T12:00:00`);
  from.setDate(from.getDate() - 1);
  const min = from.toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(frueher || {}).filter(([d, v]) => d >= min && v && Object.keys(v).length));
}
