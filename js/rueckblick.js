// Wochenrückblick für die Eltern: Essen, Aufgaben der Kinder, Müll-Ampel und Ausgaben einer Woche (Montag bis Sonntag).
// Das Lernen kommt aus dem Lernplaner dazu (siehe learnWeek). Reine Auswertung, ohne Zugriff auf die App.
import { addDays, todayISO } from './logic.js';
import * as A from './aufgaben.js';
import * as HB from './haushalt.js';

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function weekReview(data, week, opts = {}) {
  const today = opts.today || todayISO();
  const days = Array.from({ length: 7 }, (_, n) => addDays(week, n));
  const sun = days[6];
  const inWeek = (d) => d >= week && d <= sun;
  const dishName = (id) => ((data.dishes || []).find((d) => d.id === id) || {}).name || '';
  const name = (id) => ((data.persons || []).find((p) => p.id === id) || {}).name || '';

  // Essen: Abendessen der Woche mit dem Schnitt der Sterne.
  const meals = days.map((day) => {
    const p = (data.plan || []).find((x) => x.day === day);
    const stars = (data.ratings || []).filter((r) => r.day === day).map((r) => Number(r.stars) || 0).filter(Boolean);
    return { day, dish: p && p.dish_id ? dishName(p.dish_id) : '', avg: avg(stars), n: stars.length };
  });
  const rated = meals.filter((m) => m.dish && m.avg != null);
  const best = rated.slice().sort((a, b) => b.avg - a.avg)[0] || null;
  const worst = rated.length > 1 ? rated.slice().sort((a, b) => a.avg - b.avg)[0] : null;
  const hearts = (data.hearts || []).filter((h) => h.week_start === week).map((h) => ({ person: name(h.person_id), dish: dishName(h.dish_id) })).filter((h) => h.dish);

  // Aufgaben der Kinder.
  const kids = (data.persons || []).filter((p) => !p.adult);
  const log = data.taskLog || [];
  const kinder = kids.map((k) => {
    const mine = log.filter((e) => e.person_id === k.id && inWeek(e.day));
    const b = A.weekBonus(data.tasks || [], log, k.id, week, sun < today ? sun : today, opts.away || (() => false));
    const bonus = mine.find((e) => e.id === A.bonusId(week, k.id) && e.status === 'bestaetigt');
    return {
      id: k.id, name: k.name,
      basicsOk: b.ok, basicsDue: b.due, complete: b.complete,
      bonus: bonus ? bonus.minutes : 0,
      earned: mine.filter((e) => e.status === 'bestaetigt' && e.minutes > 0 && !A.isBonus(e)).reduce((a, e) => a + e.minutes, 0),
      redeemed: -mine.filter((e) => e.minutes < 0).reduce((a, e) => a + e.minutes, 0),
      extras: mine.filter((e) => e.status === 'bestaetigt' && e.minutes > 0 && !A.isBonus(e)).length,
      rejected: mine.filter((e) => e.status === 'abgelehnt').length,
      muell: mine.filter((e) => A.kmBinOf(e) && e.status === 'bestaetigt').length,
      spuel: mine.filter((e) => A.isSm(e) && e.status === 'bestaetigt').length,
    };
  });

  // Ausgaben: Kassenzettel der Woche, dazu der Stand des Monats, in dem der Sonntag liegt.
  const receipts = (data.receipts || []).filter((r) => inWeek(r.day));
  const total = receipts.reduce((a, r) => a + (Number(r.total) || 0), 0);
  const month = sun.slice(0, 7);
  const monthTotal = HB.summary(data.receipts || [], month).total;
  const budget = Number(opts.budget) || 0;
  const bs = budget ? HB.budgetState(monthTotal, budget, month, sun < today ? sun : today) : null;

  // Ausblick: Abendessen der nächsten Woche schon geplant?
  const next = Array.from({ length: 7 }, (_, n) => addDays(week, 7 + n));
  const planned = next.filter((d) => (data.plan || []).some((p) => p.day === d && p.dish_id)).length;

  return {
    week, sun,
    essen: { meals, best, worst, hearts, cooked: meals.filter((m) => m.dish).length, ratings: rated.reduce((a, m) => a + m.n, 0) },
    kinder,
    ausgaben: { total: HB.money(total), count: receipts.length, month, monthTotal: HB.money(monthTotal), budget, left: bs ? bs.left : null },
    ausblick: { planned },
  };
}

// Lernen aus den Datensätzen des Lernplaners (Tabelle lp_data): Tagessiege Montag bis Freitag, Lernzeit,
// verlegte Spiele, schwere Themen und die Prüfungen der nächsten zwei Wochen.
export function learnWeek(rows, tasks, week) {
  const sun = addDays(week, 6);
  const fri = addDays(week, 4);
  const until = addDays(week, 20);
  const of = (c) => (rows || []).filter((r) => r.coll === c).map((r) => r.data).filter(Boolean);
  const settings = of('settings')[0] || {};
  const wins = of('win').filter((w) => w.v && w.k >= week && w.k <= fri).length;
  const verlegt = of('day').filter((d) => d.k >= week && d.k <= sun && d.v && d.v.verlegt).length;
  const done = (tasks || []).filter((t) => t && t.done && t.doneAt >= week && t.doneAt <= sun);
  const minutes = done.reduce((a, t) => a + (Number(t.actual) || Number(t.planned) || 0), 0);
  const help = of('help').filter((h) => h.date >= week && h.date <= sun).map((h) => `${h.subject}: ${h.title}`);
  const exams = of('exam').filter((e) => e.date > sun && e.date <= until).sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((e) => ({ date: e.date, text: `${e.subject} ${e.type}${e.topic ? ` (${e.topic})` : ''}` }));
  return { wins, goal: Number(settings.winGoal) || 4, verlegt, done: done.length, minutes, help, exams };
}
