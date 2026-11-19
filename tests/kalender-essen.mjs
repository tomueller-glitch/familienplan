// Termine aus den iPhone-Kalendern zählen fürs Abendessen, doppelte Termine werden erkannt.
// Aufruf: node tests/kalender-essen.mjs
import * as T from '../js/termine.js';

const persons = [{ id: 'papa', name: 'Torsten', adult: true }, { id: 'mama', name: 'Mama', adult: true }, { id: 'ben', name: 'Ben' }, { id: 'mia', name: 'Mia' }];
const feeds = [{ id: 'k1', name: 'Dienst', person_id: 'papa' }, { id: 'k2', name: 'Familie', person_id: null }, { id: 'k3', name: 'Ben', person_id: 'ben' }, { id: 'k4', name: 'Mama', person_id: 'mama', essen: false }];
const tage = {
  '2026-11-23': [{ titel: 'Spätdienst', von: '12:00', bis: '20:30', ganztags: false, zeit: true, kalender: 'k1' }, { titel: 'Geburtstag Oma', von: null, bis: null, ganztags: true, kalender: 'k2' }],
  '2026-11-24': [{ titel: 'Handball', von: '17:00', bis: '19:00', ganztags: false, zeit: true, kalender: 'k3' }, { titel: 'Yoga', von: '17:30', bis: '20:00', ganztags: false, zeit: true, kalender: 'k4' }],
  '2026-11-25': [{ titel: 'Nachtdienst', von: '15:30', bis: null, ganztags: false, zeit: true, kalender: 'k1' }],
  '2026-11-26': [{ titel: 'Nachtdienst', von: null, bis: '08:00', ganztags: false, zeit: true, kalender: 'k1' }, { titel: 'Elternabend', von: '19:00', bis: '21:00', ganztags: false, zeit: true, kalender: 'k1' }],
  '2026-11-27': [{ titel: 'Kongress', von: null, bis: null, ganztags: true, zeit: true, kalender: 'k1' }, { titel: 'Urlaub', von: null, bis: null, ganztags: true, kalender: 'k3' }],
};
const kal = T.calendarEvents(tage, feeds);
console.log('Einzeltermine:', kal.map((e) => `${e.date.slice(8)} ${e.who[0]} ${e.title} ${e.start_time || '…'}-${e.end_time || '…'}${e.nacht ? ' Nacht' : ''}`).join(' | '));
const fixed = [{ id: 'e1', title: 'Handballtraining', who: ['ben'], weekdays: [1], start_time: '17:00', end_time: '18:30', home_time: '18:45', pause_ferien: true, active: true }];
const events = [...fixed, ...kal];
for (const d of Object.keys(tage)) {
  const i = T.dinnerInfo(persons, events, [], d);
  const st = i.people.map((x) => `${x.person.name}:${x.status}${x.home != null ? '@' + T.toHM(x.home) : ''}${x.reason ? ` (${x.reason})` : ''}`).join(', ');
  console.log(d, 'Essen', i.time, '| Esser', i.eaters, '| kurz', T.isBusy(persons, events, [], d), '|', st);
}
// Hand-Eintrag geht vor
const over = T.dinnerInfo(persons, events, [{ day: '2026-11-25', person_id: 'papa', status: 'da' }], '2026-11-25');
console.log('Von Hand dabei am 25.:', over.people[0].status, '| Esser', over.eaters);
// Wochentermine bleiben unberührt
console.log('Ohne Kalender am 24.:', T.dinnerInfo(persons, fixed, [], '2026-11-24').time, '| Montag 23. ohne Termin:', T.eventsOn(events, '2026-11-23').map((e) => e.title).join(', '));
// Doppelte erkennen
const S = (own, cal, p) => T.sameEvent(own, cal, p);
console.log('gleich:', [
  S(fixed[0], tage['2026-11-24'][0], 'ben'),
  S({ title: 'Dienst', who: ['papa'], start_time: '12:15' }, tage['2026-11-23'][0], 'papa'),
  S({ title: 'Handball Ben', who: ['ben'], start_time: '17:00' }, { titel: 'Handball', von: '17:00' }, null),
].join(' '), '| verschieden:', [
  S({ title: 'Klavier', who: ['mia'], start_time: '17:00' }, tage['2026-11-24'][0], 'ben'),
  S({ title: 'Ballett', who: ['mia'], start_time: '17:00' }, { titel: 'Handball', von: '17:00' }, null),
  S({ title: 'Handball', who: ['ben'], start_time: null }, tage['2026-11-24'][0], 'ben'),
].join(' '));
