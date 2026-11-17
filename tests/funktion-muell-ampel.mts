// Müll-Ampel in der Küche: Nachricht an die Kinder bei Rot.
import { muellMessages } from '../supabase/functions/push/index.ts';
const persons = [{ id: 'p1', name: 'Papa', adult: true }, { id: 'p3', name: 'Jonas', adult: false }, { id: 'p4', name: 'Lena', adult: false }];
const tasks = [{ id: 'muell', name: 'Müll aus der Küche rausbringen', schedule: 'bedarf', who: ['p3', 'p4'], active: true, minutes: 5 }];
const at = (hm: string, day = '2026-11-17') => Date.parse(`${day}T${hm}:00+01:00`);
const iso = (ms: number) => new Date(ms).toISOString();
const show = (name: string, d: ReturnType<typeof muellMessages>) => console.log(name.padEnd(28), d.length ? d.map((x) => `${x.msg.title} -> ${x.to.join(',')} [${x.key}]`).join(' / ') : '(nichts)');
const red = { plastik: { stufe: 'rot', at: iso(at('16:00')) }, rest: { stufe: 'gelb', at: iso(at('15:00')) } };
show('Plastik rot, 16:01', muellMessages(red, tasks, [], persons, at('16:01')));
show('beide rot', muellMessages({ ...red, rest: { stufe: 'rot', at: iso(at('16:05')) } }, tasks, [], persons, at('16:06')));
show('Plastik gemeldet', muellMessages(red, tasks, [{ id: 'km-plastik-x', status: 'offen' }], persons, at('16:10')));
show('Meldung abgelehnt', muellMessages(red, tasks, [{ id: 'km-plastik-x', status: 'abgelehnt' }], persons, at('16:10')));
show('alles grün', muellMessages({ plastik: { stufe: 'gruen', at: iso(at('16:00')) } }, tasks, [], persons, at('16:10')));
show('rot um 21 Uhr', muellMessages({ plastik: { stufe: 'rot', at: iso(at('21:00')) } }, tasks, [], persons, at('21:05')));
show('… am Morgen 7:00', muellMessages({ plastik: { stufe: 'rot', at: iso(at('21:00')) } }, tasks, [], persons, at('07:00', '2026-11-18')));
show('rot seit zwei Tagen', muellMessages(red, tasks, [], persons, at('16:01', '2026-11-19')));
show('verreist', muellMessages(red, tasks, [], persons, at('16:01'), [{ von: '2026-11-16', bis: '2026-11-20', weg: true }]));
show('ohne Müll-Aufgabe', muellMessages(red, [], [], persons, at('16:01')));
