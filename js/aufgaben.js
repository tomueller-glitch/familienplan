// Rechenlogik für Haushaltsaufgaben und das Minutenkonto der Kinder.
// Ohne Zugriff auf Seite oder Datenbank, damit sie sich testen lässt.

import { addDays, diffDays, isSchoolDay, mondayOf, parseISO, todayISO, wdIndex } from './logic.js';
import { ABFUHR, TONNEN } from './abfuhr.js';

export const RHYTHMEN = {
  taeglich: 'täglich',
  woechentlich: 'einmal pro Woche',
  bedarf: 'bei Bedarf',
  tonne: 'am Abend vor der Müllabfuhr',
};

export const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const counts = (e) => e.status !== 'abgelehnt';

// Wer ist an diesem Tag dran? Bei "abwechselnd" wechselt es jede Woche, auch über den Jahreswechsel.
export function assignees(task, day) {
  const who = task.who || [];
  if (!who.length) return [];
  if (!task.rotate) return who;
  const n = Math.floor(diffDays(mondayOf(day), '2024-01-01') / 7) + (task.rot_offset || 0);
  return [who[((n % who.length) + who.length) % who.length]];
}

export function inSeason(task, day) {
  const months = task.months || [];
  // „Nur an Schultagen“: nicht am Wochenende, in den Ferien und an Feiertagen.
  if (task.school_only && !isSchoolDay(day)) return false;
  return !months.length || months.includes(parseISO(day).getMonth() + 1);
}

// Tonne, die am Tag nach "day" abgeholt wird, sonst null.
export function trashTomorrow(day) {
  const next = addDays(day, 1);
  const hit = ABFUHR.filter(([d]) => d === next).map(([, t]) => TONNEN[t] || t);
  return hit.length ? hit.join(' und ') : null;
}

// Aufgaben eines Kindes an einem Tag. Liefert feste Aufgaben (heute fällig) und Extras (bei Bedarf).
export function tasksFor(tasks, log, personId, day) {
  const week = mondayOf(day);
  const mine = (t) => t.active !== false && inSeason(t, day) && assignees(t, day).includes(personId);
  const entries = (t, from, to) => log.filter((e) => e.task_id === t.id && e.person_id === personId && e.day >= from && e.day <= to && counts(e));
  // Heute abgelehnt und noch nicht neu gemeldet: Das Kind soll sehen, warum die Aufgabe wieder offen ist.
  const rejectedOn = (t, d) => log.filter((e) => e.task_id === t.id && e.person_id === personId && e.day === d && e.status === 'abgelehnt').pop() || null;
  const fixed = [];
  const extras = [];
  for (const t of tasks) {
    if (!mine(t)) continue;
    if (t.schedule === 'taeglich') {
      fixed.push({ task: t, label: t.name, done: entries(t, day, day)[0] || null, rejected: rejectedOn(t, day) });
    } else if (t.schedule === 'woechentlich') {
      const done = entries(t, week, addDays(week, 6))[0] || null;
      if (!done || done.day === day) fixed.push({ task: t, label: t.name, done, weekly: true, rejected: done ? null : rejectedOn(t, day) });
    } else if (t.schedule === 'tonne') {
      const bin = trashTomorrow(day);
      if (bin) fixed.push({ task: t, label: `${t.name}: ${bin}`, done: entries(t, day, day)[0] || null, bin, rejected: rejectedOn(t, day) });
    } else {
      const today = entries(t, day, day);
      const max = t.max_per_day || 1;
      extras.push({ task: t, label: t.name, doneToday: today.length, left: Math.max(0, max - today.length) });
    }
  }
  return { fixed, extras };
}

// Grundaufgaben des Tages (ohne Minuten, täglich oder Tonne), die noch nicht abgehakt sind.
// Wöchentliche Aufgaben zählen nicht, sie dürfen an einem beliebigen Tag erledigt werden.
export function basicsOpen(tasks, log, personId, day) {
  return tasksFor(tasks, log, personId, day).fixed.filter((f) => !f.task.minutes && !f.weekly && !f.done).map((f) => f.label);
}

// Was heute auf jeden Fall erledigt sein muss: Tagesaufgaben, die Tonne und am Sonntag die offenen Wochenaufgaben.
// Dieselbe Liste steht bei den Kindern im roten Kasten, im Hinweis der Woche und in den Erinnerungen.
export function mustToday(fixed, day) {
  const sunday = wdIndex(day) === 6;
  return fixed.filter((f) => !f.weekly || sunday);
}
export function mustOpen(tasks, log, personId, day) {
  return mustToday(tasksFor(tasks, log, personId, day).fixed, day).filter((f) => !f.done).map((f) => f.label);
}

// Eine gemeldete Aufgabe mit Minuten wartet, bis die Grundaufgaben ihres Tages erledigt sind.
// Liefert die offenen Grundaufgaben, sonst eine leere Liste.
export function lockedBy(tasks, log, entry) {
  if (!entry || entry.status !== 'offen' || !(entry.minutes > 0)) return [];
  return basicsOpen(tasks, log, entry.person_id, entry.day);
}

/* ---------- Wochenbonus ---------- */

// Ein Bonus pro Kind und Woche, erkennbar an der festen Kennung. So entsteht er auch bei mehreren Geräten nur einmal.
export const bonusId = (week, personId) => `bonus-${week}-${personId}`;
export const isBonus = (e) => String((e && e.id) || '').startsWith('bonus-');

// Stand einer Woche: Für jeden Tag "ok", "offen" (heute, noch nicht fertig), "verpasst", "frei" (keine Grundaufgaben
// oder Urlaub) oder "kommt" (Zukunft). Geschafft ist die Woche, wenn an mindestens drei Tagen Grundaufgaben anstanden
// und alle erledigt sind. "away" sagt, ob ein Tag als Urlaub zählt.
export function weekBonus(tasks, log, personId, week, today = todayISO(), away = () => false) {
  const days = Array.from({ length: 7 }, (_, n) => addDays(week, n)).map((day) => {
    if (day > today) return 'kommt';
    if (away(day)) return 'frei';
    const basics = tasksFor(tasks, log, personId, day).fixed.filter((f) => !f.task.minutes && !f.weekly);
    if (!basics.length) return 'frei';
    if (basics.every((f) => f.done)) return 'ok';
    return day < today ? 'verpasst' : 'offen';
  });
  const due = days.filter((d) => d !== 'frei').length;
  const ok = days.filter((d) => d === 'ok').length;
  return { days, ok, due, missed: days.includes('verpasst'), complete: due >= 3 && ok === due };
}

// Verdiente Minuten verfallen so viele Stunden nach der Bestätigung.
export const EXPIRY_HOURS = 72;
const HOUR = 3600000;
const stamp = (e) => Date.parse(e.decided_at || e.created_at || `${e.day}T12:00:00`);

// Minutenkonto: bestätigte Minuten, pro Tag gedeckelt, verfallen nach EXPIRY_HOURS.
// Eingelöste Minuten verbrauchen immer zuerst die ältesten Minuten.
export function account(log, personId, cap, nowMs = Date.now(), today = todayISO()) {
  const rows = log.filter((e) => e.person_id === personId);
  const limit = cap == null ? Infinity : cap;
  const usedPerDay = {};
  const lots = [];
  const earnedRows = rows.filter((e) => e.minutes > 0 && e.status === 'bestaetigt')
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : stamp(a) - stamp(b)));
  for (const e of earnedRows) {
    const used = usedPerDay[e.day] || 0;
    // Der Wochenbonus zählt nicht zum Tageslimit.
    const m = isBonus(e) ? e.minutes : Math.max(0, Math.min(limit - used, e.minutes));
    if (!isBonus(e)) usedPerDay[e.day] = used + m;
    if (m) lots.push({ m, at: stamp(e), exp: stamp(e) + EXPIRY_HOURS * HOUR });
  }
  lots.sort((a, b) => a.exp - b.exp);
  const redemptions = rows.filter((e) => e.minutes < 0 && e.status === 'bestaetigt').sort((a, b) => stamp(a) - stamp(b));
  let redeemedToday = 0;
  for (const r of redemptions) {
    const t = stamp(r);
    if (r.day === today) redeemedToday += -r.minutes;
    let need = -r.minutes;
    for (const lot of lots) {
      if (!need) break;
      if (lot.m <= 0 || lot.at > t || lot.exp <= t) continue;
      const take = Math.min(lot.m, need);
      lot.m -= take;
      need -= take;
    }
  }
  const live = lots.filter((l) => l.m > 0 && l.at <= nowMs && l.exp > nowMs);
  const balance = live.reduce((a, l) => a + l.m, 0);
  const next = live[0] ? { minutes: live.filter((l) => l.exp === live[0].exp).reduce((a, l) => a + l.m, 0), at: live[0].exp } : null;
  const todayRaw = rows.filter((e) => e.day === today && e.minutes > 0 && e.status === 'bestaetigt' && !isBonus(e)).reduce((a, e) => a + e.minutes, 0);
  return {
    balance,
    pending: rows.filter((e) => e.status === 'offen' && e.minutes > 0).reduce((a, e) => a + e.minutes, 0),
    redeemedToday,
    todayEarned: usedPerDay[today] || 0,
    todayCapped: todayRaw > limit,
    cap: limit === Infinity ? null : limit,
    nextExpiry: next,
  };
}

// Minuten, die ein neuer Eintrag heute noch bringen würde, unter Beachtung des Tageslimits.
export function minutesLeftToday(log, personId, cap, day) {
  if (cap == null) return Infinity;
  const sum = log.filter((e) => e.person_id === personId && e.day === day && e.minutes > 0 && e.status !== 'abgelehnt' && !isBonus(e))
    .reduce((a, e) => a + e.minutes, 0);
  return Math.max(0, cap - sum);
}

export const isSeasonless = (task) => !(task.months || []).length;

/* ---------- Mülleimer in der Küche ---------- */
// Ampel für Plastik- und Restmüll, gespeichert in ep_settings unter "kuechenmuell":
// { plastik: { stufe: 'gruen'|'gelb'|'rot', at, by }, rest: { ... } }. Die Stufen schalten die Eltern.
// Bei Gelb und Rot können die Kinder den Eimer als rausgebracht melden, bei Grün nicht.
// Die Meldung trägt den Eimer in der Kennung (km-plastik-…), damit die Bestätigung ihn wieder auf Grün stellt.
export const EIMER = [['plastik', 'Plastikmüll'], ['rest', 'Restmüll']];
export const STUFEN = ['rot', 'gelb', 'gruen'];
export const kmId = (bin, uid) => `km-${bin}-${uid}`;
export const kmBinOf = (e) => { const m = /^km-(plastik|rest)-/.exec(String((e && e.id) || '')); return m ? m[1] : null; };

// Die Aufgabe „Müll aus der Küche rausbringen“: Startaufgabe "muell", sonst eine Bei-Bedarf-Aufgabe mit Müll im Namen.
export function kmTask(tasks) {
  const live = (tasks || []).filter((t) => t.active !== false);
  return live.find((t) => t.id === 'muell')
    || live.find((t) => t.schedule === 'bedarf' && /müll|muell/i.test(t.name || '') && !/tonne/i.test(t.name || '')) || null;
}

export function kmState(value) {
  const v = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const [bin] of EIMER) {
    const x = v[bin] && typeof v[bin] === 'object' ? v[bin] : {};
    out[bin] = { stufe: STUFEN.includes(x.stufe) ? x.stufe : 'gruen', at: x.at || null, by: x.by || null };
  }
  return out;
}

// Offene Meldung für einen Eimer (wartet auf Bestätigung). Solange es sie gibt, fragt die App nicht noch einmal.
export function kmPending(log, bin) {
  return (log || []).filter((e) => kmBinOf(e) === bin && e.status === 'offen').pop() || null;
}

// Was ein Kind gerade tun kann: pro Eimer Stufe, offene Meldung und ob „Rausgebracht“ möglich ist.
export function kmView(value, log) {
  const st = kmState(value);
  return EIMER.map(([bin, name]) => {
    const pending = kmPending(log, bin);
    return { bin, name, ...st[bin], pending, canReport: st[bin].stufe !== 'gruen' && !pending };
  });
}
