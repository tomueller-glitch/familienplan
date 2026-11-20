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
// Einzeltermine aus den iPhone-Kalendern haben ein Datum statt Wochentagen.
export function eventsOn(events, day) {
  const wd = wdIndex(day);
  return events.filter((e) => (e.date ? e.date === day : e.active !== false
    && (e.weekdays || []).includes(wd)
    && (!e.valid_from || day >= e.valid_from)
    && (!e.valid_to || day <= e.valid_to)
    && !(e.pause_ferien && isBreak(day))));
}

// Termine aus den abonnierten Kalendern (heute und die nächsten drei Wochen) als Einzeltermine.
// Sie sind die einzige Quelle für Termine. Die alten Wochentermine (ep_events) zählen nicht mehr.
// Es zählen nur Kalender, die zu einer Person gehören und nicht auf „nur Anzeige“ stehen,
// und nur Termine mit Uhrzeit. Ganztägige Einträge wie Geburtstage verschieben das Essen nicht.
// Ein Termin, der über Mitternacht hinaus läuft (weiter), heißt: an dem Abend weg. Termine ohne Dauer zählen nur mit ihrer Uhrzeit.
// Art eines Kalenders: 'beides' (Display und Essen), 'anzeige' (nur Display), 'essen' (nur fürs Essen, etwa ein
// Dienstplan). Aus „nur fürs Essen“ gehen keine Titel weiter, nur Uhrzeiten unter „Dienst“.
export const feedArt = (f) => (f && f.essen === false ? 'anzeige' : f && f.anzeige === false ? 'essen' : 'beides');
// Rufdienst (ganztägig, die Person ist zu Hause, kann aber weg müssen). „Rufdienst ITS“ zählt fürs Essen nicht.
export const isOnCall = (title) => /rufdienst|bereitschaft/i.test(String(title || ''));
export const onCallForDinner = (title) => isOnCall(title) && !/\bITS\b/i.test(String(title || ''));
// Tage mit Rufdienst je Person aus den Kalendern, die fürs Essen zählen: { tag: [person_id] }.
export function onCallDays(tage, feeds) {
  const out = {};
  for (const [day, items] of Object.entries(tage || {})) {
    for (const x of items || []) {
      const f = (feeds || []).find((y) => y.id === x.kalender);
      if (!f || !f.person_id || feedArt(f) === 'anzeige' || !onCallForDinner(x.titel)) continue;
      (out[day] = out[day] || []).includes(f.person_id) || out[day].push(f.person_id);
    }
  }
  return out;
}

export function calendarEvents(tage, feeds) {
  const out = [];
  for (const [day, items] of Object.entries(tage || {})) {
    (items || []).forEach((x, i) => {
      const f = (feeds || []).find((y) => y.id === x.kalender);
      if (!f || !f.person_id || f.essen === false || !x.titel) return;
      const timed = x.zeit === true || x.von || x.bis;
      if (!timed) return;
      // Rufdienst mit Uhrzeit zählt wie ganztägiger: nicht als Abwesenheit.
      if (isOnCall(x.titel)) return;
      // Mit Heimweg: zu Hause nach Ende plus Fahrzeit, auf fünf Minuten aufgerundet.
      const end = toMin(x.bis);
      const home = end != null && x.weg > 0 ? toHM(Math.min(23 * 60 + 55, Math.ceil((end + x.weg) / 5) * 5)) : null;
      out.push({ id: `kal-${f.id}-${day}-${i}`, kal: f.id, date: day, title: feedArt(f) === 'essen' ? 'Dienst' : x.titel, who: [f.person_id], start_time: x.von || null, end_time: x.bis || null, home_time: home, weg: x.weg || 0, nacht: x.weiter === true });
    });
  }
  return out;
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
    let gone = null;
    for (const e of own) {
      const st = toMin(e.start_time);
      // Termine, die erst zur Essenszeit oder danach beginnen, verschieben das Essen nicht.
      if (st != null && st >= base) {
        if (st < base + 120 && (leaves == null || st < leaves.at)) leaves = { at: st, title: e.title };
        continue;
      }
      // Kalendertermin, der vor dem Essen beginnt und über Mitternacht läuft: an dem Abend weg.
      if (e.nacht) { gone = e.title; continue; }
      const h = toMin(homeOf(e));
      if (h != null && h > base && (home == null || h > home)) { home = h; reason = e.title; }
    }
    if (home != null) status = 'spaet';
    if (gone) { status = 'weg'; home = null; reason = gone; }
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
    const s = toMin(e.start_time) ?? (e.date ? 0 : null);
    const h = e.nacht ? 24 * 60 : toMin(homeOf(e));
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
