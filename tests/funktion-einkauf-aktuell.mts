// Siri-Kurzbefehl: Neues kommt auf den aktuellen Einkauf, wie in der App.
import { currentTripOf } from '../supabase/functions/push/index.ts';
const it = (week_start: string, trip: string, due: string | null, checked = false, manual = false) => ({ week_start, trip, due, checked, manual, buyer: 'p1' });
const items = [
  it('2026-11-16', 'Großeinkauf am Sa 14.11.', '2026-11-14', true), it('2026-11-16', 'Frischeeinkauf am Mi 18.11.', '2026-11-18'),
  it('2026-11-16', 'Nachkauf', null), it('2026-11-23', 'Großeinkauf am Sa 21.11.', '2026-11-21'), it('2026-11-23', 'Frischeeinkauf am Mi 25.11.', '2026-11-25'),
];
const f = (x: { due: string; week: string; trip: string }) => `${x.due} ${x.week} ${x.trip}`;
console.log('Freitag:', f(currentTripOf(items, '2026-11-20')));
console.log('Mittwoch:', f(currentTripOf(items, '2026-11-18')));
console.log('Samstag alles gekauft:', f(currentTripOf(items.map((i) => (i.due === '2026-11-21' ? { ...i, checked: true } : i)), '2026-11-21')));
console.log('Keine Liste:', f(currentTripOf([], '2026-11-26')));
