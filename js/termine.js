// Wiederkehrende Termine, wer zum Abendessen da ist und wann gegessen wird.
// Reine Rechenlogik ohne Zugriff auf Seite oder Datenbank.

import { schoolFree, wdIndex } from './logic.js';

// Abendessen zwischen 18:30 und 19:00. Kommt jemand später, wird später gegessen, damit alle dabei sind.
export const DINNER = { from: '18:30', to: '19:00' };
// Ab dieser Uhrzeit gilt ein Abend als spät.
export const LATE_AFTER = '19:30';
// An Tagen, an denen ein Erwachsener zwischen 17 und 19 Uhr unterwegs ist, nur kurze Rezepte.
export const BUSY_WINDOW = { from: '17:00', to: '19:00' };
export const BUSY_MAX_MIN = 40;

export const toMin = (hm) => {
  if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
export const toHM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const roundUp15 = (min) => Math.ceil(min / 15) * 15;

// Schulferien oder Feiertag, nicht aber ein gewöhnliches Wochenende.
export const isBreak = (day) => {
  const r = schoolFree(day);
  return !!r && r !== 'Wochenende';
};

// Termine, die an diesem Tag stattfinden.
export function eventsOn(events, day) {
  const wd = wdIndex(day);
  return events.filter((e) => e.active !== false
    && (e.weekdays || []).includes(wd)
    && (!e.valid_from || day >= e.valid_from)
    && (!e.valid_to || day <= e.valid_to)
    && !(e.pause_ferien && isBreak(day)));
}

export const homeOf = (e) => e.home_time || e.end_time || null;

// Wer isst mit, und wann wird gegessen?
// attendance: Einträge { day, person_id, status: 'da' | 'spaet' | 'weg', time }.
export function dinnerInfo(persons, events, attendance, day) {
  const todays = eventsOn(events, day);
  const base = toMin(DINNER.from);
  const people = persons.map((p) => {
    const own = todays.filter((e) => (e.who || []).includes(p.id));
    const override = attendance.find((a) => a.day === day && a.person_id === p.id);
    let status = 'da';
    let home = null;
    let reason = null;
    let leaves = null;
    for (const e of own) {
      const st = toMin(e.start_time);
      // Termine, die erst zur Essenszeit oder danach beginnen, verschieben das Essen nicht.
      if (st != null && st >= base) {
        if (st < base + 120 && (leaves == null || st < leaves.at)) leaves = { at: st, title: e.title };
        continue;
      }
      const h = toMin(homeOf(e));
      if (h != null && h > base && (home == null || h > home)) { home = h; reason = e.title; }
    }
    if (home != null) status = 'spaet';
    let manual = false;
    if (override) {
      manual = true;
      status = override.status;
      if (status === 'spaet') { home = toMin(override.time) ?? home ?? toMin(LATE_AFTER); reason = override.note || reason; }
      if (status !== 'spaet') home = null;
    }
    return { person: p, status, home, reason, leaves, manual, events: own };
  });
  const eaters = people.filter((x) => x.status !== 'weg');
  // Wer erst nach 19:30 heimkommt, verschiebt das Essen nicht: Die anderen essen wie gewohnt, er isst später.
  const lateLimit = toMin(LATE_AFTER);
  const latest = eaters.reduce((m, x) => (x.home != null && x.home <= lateLimit && x.home > m ? x.home : m), base);
  const time = latest > base ? roundUp15(latest) : base;
  return {
    time: toHM(time),
    shifted: time > base,
    late: time > toMin(LATE_AFTER),
    people,
    eaters: eaters.length,
    away: people.filter((x) => x.status === 'weg'),
    later: people.filter((x) => x.status === 'spaet' && x.home != null && x.home > base),
    // Kommen nach 19:30 und essen später für sich (zählen bei den Portionen trotzdem mit).
    afterDinner: people.filter((x) => x.status === 'spaet' && x.home != null && x.home > lateLimit),
    leaving: people.filter((x) => x.status !== 'weg' && x.leaves),
    events: todays,
  };
}

// Ein voller Tag: Ein Erwachsener ist zwischen 17 und 19 Uhr unterwegs, oder gegessen wird nach 19 Uhr.
export function isBusy(persons, events, attendance, day) {
  const info = dinnerInfo(persons, events, attendance, day);
  if (toMin(info.time) > toMin(DINNER.to)) return true;
  const from = toMin(BUSY_WINDOW.from);
  const to = toMin(BUSY_WINDOW.to);
  return info.events.some((e) => (e.who || []).some((id) => {
    const p = persons.find((x) => x.id === id);
    if (!p || !p.adult) return false;
    const s = toMin(e.start_time);
    const h = toMin(homeOf(e));
    return s != null && h != null && s < to && h > from;
  }));
}

// Höchstdauer der Rezepte pro Tag für den Wochenvorschlag.
export function durationLimits(persons, events, attendance, days) {
  const out = {};
  for (const d of days) {
    const wd = wdIndex(d);
    let lim = wd >= 5 || isBreak(d) ? Infinity : 60;
    if (isBusy(persons, events, attendance, d)) lim = Math.min(lim, BUSY_MAX_MIN);
    out[d] = lim;
  }
  return out;
}

// Anteil der Portionen pro Tag, für die Einkaufsliste.
// Gäste aus dem Wochenplan (plan.guests) kommen dazu.
export function portionFactors(persons, events, attendance, days, plan = []) {
  const out = {};
  for (const d of days) {
    const row = plan.find((p) => p.day === d);
    const n = dinnerInfo(persons, events, attendance, d).eaters + Math.max(0, Number(row && row.guests) || 0);
    out[d] = persons.length ? n / persons.length : 1;
  }
  return out;
}
