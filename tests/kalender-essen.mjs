// Termine aus den iPhone-Kalendern zählen fürs Abendessen, mit Heimweg.
// Aufruf: node tests/kalender-essen.mjs
import * as T from '../js/termine.js';

const persons = [{ id: 'papa', name: 'Torsten', adult: true }, { id: 'mama', name: 'Mama', adult: true }, { id: 'ben', name: 'Ben' }, { id: 'mia', name: 'Mia' }];
const feeds = [{ id: 'k1', name: 'Dienst', person_id: 'papa' }, { id: 'k2', name: 'Familie', person_id: null }, { id: 'k3', name: 'Ben', person_id: 'ben' }, { id: 'k4', name: 'Mama', person_id: 'mama', essen: false }];
const tage = {
  '2026-11-23': [{ titel: 'Spätdienst', von: '12:00', bis: '20:30', ganztags: false, zeit: true, kalender: 'k1' }, { titel: 'Geburtstag Oma', von: null, bis: null, ganztags: true, kalender: 'k2' }],
  '2026-11-24': [{ titel: 'Handball', von: '17:00', bis: '19:00', ganztags: false, zeit: true, kalender: 'k3' }, { titel: 'Yoga', von: '17:30', bis: '20:00', ganztags: false, zeit: true, kalender: 'k4' }],
  '2026-11-25': [{ titel: 'Nachtdienst', von: '15:30', bis: null, ganztags: false, zeit: true, weiter: true, kalender: 'k1' }],
  '2026-11-26': [{ titel: 'Nachtdienst', von: null, bis: '08:00', ganztags: false, zeit: true, kalender: 'k1' }, { titel: 'Elternabend', von: '19:00', bis: '21:00', ganztags: false, zeit: true, kalender: 'k1' }],
  '2026-11-27': [{ titel: 'Kongress', von: null, bis: null, ganztags: true, zeit: true, weiter: true, kalender: 'k1' }, { titel: 'Urlaub', von: null, bis: null, ganztags: true, kalender: 'k3' }],
};
const kal = T.calendarEvents(tage, feeds);
console.log('Einzeltermine:', kal.map((e) => `${e.date.slice(8)} ${e.who[0]} ${e.title} ${e.start_time || '…'}-${e.end_time || '…'}${e.nacht ? ' Nacht' : ''}`).join(' | '));
const events = kal;
for (const d of Object.keys(tage)) {
  const i = T.dinnerInfo(persons, events, [], d);
  const st = i.people.map((x) => `${x.person.name}:${x.status}${x.home != null ? '@' + T.toHM(x.home) : ''}${x.reason ? ` (${x.reason})` : ''}`).join(', ');
  console.log(d, 'Essen', i.time, '| Esser', i.eaters, '| kurz', T.isBusy(persons, events, [], d), '|', st);
}
// Hand-Eintrag geht vor
const over = T.dinnerInfo(persons, events, [{ day: '2026-11-25', person_id: 'papa', status: 'da' }], '2026-11-25');
console.log('Von Hand dabei am 25.:', over.people[0].status, '| Esser', over.eaters);
// Heimweg: Ende plus Fahrzeit, auf fünf Minuten aufgerundet
const mitWeg = T.calendarEvents({ '2026-11-24': [{ titel: 'Handball', von: '17:00', bis: '18:30', zeit: true, kalender: 'k3', weg: 17 }, { titel: 'Spät', von: '20:00', bis: '23:50', zeit: true, kalender: 'k1', weg: 30 }] }, feeds);
console.log('Heimweg:', mitWeg.map((e) => `${e.title} zu Hause ${e.home_time}`).join(' | '), '| Essen:', T.dinnerInfo(persons, mitWeg, [], '2026-11-24').time);
// Termin ohne Dauer am Vormittag: kein Grund, beim Essen zu fehlen
const ohne = T.calendarEvents({ '2026-11-19': [{ titel: 'Werkstatt', von: '10:30', bis: '10:30', zeit: true, kalender: 'k1' }, { titel: 'Training D1', von: '17:00', bis: '18:30', zeit: true, kalender: 'k1' }] }, feeds);
console.log('Ohne Dauer:', T.dinnerInfo(persons, ohne, [], '2026-11-19').people[0].status, T.dinnerInfo(persons, ohne, [], '2026-11-19').time);
// Morgens am Display: Kleidungstipp und was mitmuss
const W = await import('../js/wetter.js');
for (const s of [{ min: -2, max: 3, regen: 10, schnee: true }, { min: 4, max: 9, regen: 70, ab: 14 }, { min: 14, max: 22, regen: 0 }, { min: 19, max: 27, regen: 40 }]) console.log('Tipp:', JSON.stringify(s), '->', W.clothesTip(s), '|', W.weatherLine({ wort: '', ...s }));
const mn = W.morningNotes([{ titel: 'Musik Schulaufgabe', people: [{ name: 'Philip' }] }, { titel: 'Leseprobe', people: [{ name: 'Julia' }] }, { titel: 'Training D1', people: [{ name: 'Philip' }] }, { titel: 'Schwimmen', people: [{ name: 'Julia' }] }, { titel: 'Turnen', people: [{ name: 'Julia' }] }]);
console.log('Morgens:', JSON.stringify(mn));
