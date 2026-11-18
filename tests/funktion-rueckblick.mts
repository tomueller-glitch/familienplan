// Wochenrückblick: Nachricht am Sonntag und Auswertung der Woche.
import { reviewMessages, isoWeekOf } from '../supabase/functions/push/index.ts';
import { weekReview, learnWeek } from '../js/rueckblick.js';
const persons = [{ id: 'p1', name: 'Papa', adult: true }, { id: 'p2', name: 'Mama', adult: true }, { id: 'p3', name: 'Jonas', adult: false }];
const at = (d: string, hm: string) => Date.parse(`${d}T${hm}:00+01:00`);
const show = (n: string, d: ReturnType<typeof reviewMessages>) => console.log(n.padEnd(22), d.map((x) => `${x.msg.title} -> ${x.to.join(',')} [${x.key}]`).join(' / ') || '(nichts)');
show('So 18:29', reviewMessages(null, persons, at('2026-11-22', '18:29')));
show('So 18:30', reviewMessages(null, persons, at('2026-11-22', '18:30')));
show('So 18:30 Mama aus', reviewMessages({ aus: ['p2'] }, persons, at('2026-11-22', '18:30')));
show('Sa 18:30', reviewMessages(null, persons, at('2026-11-21', '18:30')));
show('So 21:00', reviewMessages(null, persons, at('2026-11-22', '21:00')));
show('verreist', reviewMessages(null, persons, at('2026-11-22', '19:00'), [{ von: '2026-11-20', bis: '2026-11-23', weg: true }]));
console.log('KW', isoWeekOf('2026-11-22'), isoWeekOf('2027-01-03'), isoWeekOf('2026-12-31'));
const week = '2026-11-16';
const data = {
  persons: [...persons, { id: 'p4', name: 'Lena', adult: false }],
  dishes: [{ id: 'd1', name: 'Fischstäbchen' }, { id: 'd2', name: 'Linsen-Dal' }],
  plan: [{ day: '2026-11-16', dish_id: 'd1' }, { day: '2026-11-17', dish_id: 'd2' }, { day: '2026-11-23', dish_id: 'd1' }],
  ratings: [{ day: '2026-11-16', person_id: 'p1', stars: 5 }, { day: '2026-11-16', person_id: 'p3', stars: 4 }, { day: '2026-11-17', person_id: 'p3', stars: 2 }, { day: '2026-11-17', person_id: 'p1', stars: 3 }],
  hearts: [{ week_start: week, person_id: 'p3', dish_id: 'd1' }],
  tasks: [{ id: 't1', name: 'Tisch decken', minutes: 0, schedule: 'taeglich', who: ['p3'], active: true }, { id: 'muell', name: 'Müll', minutes: 5, schedule: 'bedarf', who: ['p3'], active: true }],
  taskLog: [
    ...['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map((d) => ({ id: 'g' + d, person_id: 'p3', task_id: 't1', day: d, minutes: 0, status: 'bestaetigt' })),
    { id: 'km-plastik-1', person_id: 'p3', task_id: 'muell', day: '2026-11-18', minutes: 5, status: 'bestaetigt' },
    { id: 'x2', person_id: 'p3', task_id: 'muell', day: '2026-11-19', minutes: 5, status: 'abgelehnt' },
    { id: 'r1', person_id: 'p3', task_id: null, day: '2026-11-20', minutes: -15, status: 'bestaetigt' },
    { id: 'bonus-2026-11-16-p3', person_id: 'p3', task_id: null, day: '2026-11-22', minutes: 30, status: 'bestaetigt' },
  ],
  receipts: [{ id: 'b1', day: '2026-11-18', total: 63.4 }, { id: 'b2', day: '2026-11-21', total: 80.1 }, { id: 'b3', day: '2026-11-05', total: 200 }],
};
const r = weekReview(data, week, { today: '2026-11-22', budget: 900 });
console.log('Essen:', JSON.stringify({ best: r.essen.best, worst: r.essen.worst, hearts: r.essen.hearts, cooked: r.essen.cooked }));
console.log('Kinder:', JSON.stringify(r.kinder));
console.log('Ausgaben:', JSON.stringify(r.ausgaben), 'Ausblick:', JSON.stringify(r.ausblick));
const lw = learnWeek([
  { coll: 'settings', data: { winGoal: 4 } },
  { coll: 'win', data: { k: '2026-11-16', v: true } }, { coll: 'win', data: { k: '2026-11-18', v: true } }, { coll: 'win', data: { k: '2026-11-21', v: true } },
  { coll: 'day', data: { k: '2026-11-19', v: { verlegt: true } } },
  { coll: 'help', data: { date: '2026-11-17', subject: 'Mathe', title: 'Brüche' } },
  { coll: 'exam', data: { date: '2026-11-25', subject: 'Musik', type: 'Schulaufgabe', topic: 'Beethoven' } }, { coll: 'exam', data: { date: '2026-11-19', subject: 'Physik', type: 'Ex / Test' } },
], [{ done: true, doneAt: '2026-11-17', actual: 25 }, { done: true, doneAt: '2026-11-18', planned: 20 }, { done: true, doneAt: '2026-11-24', actual: 99 }], week);
console.log('Lernen:', JSON.stringify(lw));
