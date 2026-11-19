// Stall-Ampel (Nachricht an die Kinder) und Minuten-Shop (Kauf an die Eltern, Einlösen ans Kind).
import { stallMessages, dueMessages } from '../supabase/functions/push/index.ts';
import * as A from '../js/aufgaben.js';
const persons = [{ id: 'p1', name: 'Papa', adult: true }, { id: 'p2', name: 'Mama', adult: true }, { id: 'p3', name: 'Jonas', adult: false }, { id: 'p4', name: 'Lena', adult: false }];
const tasks = [{ id: 'meerschwein-kaefig', name: 'Meerschweinchen-Käfig sauber machen', schedule: 'woechentlich', who: ['p3', 'p4'], rotate: true, rot_offset: 0, active: true, minutes: 30 }];
const at = (hm: string, day = '2026-11-19') => Date.parse(`${day}T${hm}:00+01:00`);
const show = (name: string, d: { key: string; to: string[]; msg: { title: string; body: string } }[]) => console.log(name.padEnd(30), d.length ? d.map((x) => `${x.msg.title} | ${x.msg.body} -> ${x.to.join(',')} [${x.key}]`).join(' / ') : '(nichts)');
const v = { on: true, tage: 5, last: '2026-11-14' };
show('fällig heute, 16:30', stallMessages(v, tasks, [], persons, at('16:30')));
show('fällig heute, 16:00', stallMessages(v, tasks, [], persons, at('16:00')));
show('fällig heute, 18:40', stallMessages(v, tasks, [], persons, at('18:40')));
show('überfällig 2 Tage', stallMessages({ ...v, last: '2026-11-12' }, tasks, [], persons, at('16:35')));
show('morgen fällig', stallMessages({ ...v, last: '2026-11-15' }, tasks, [], persons, at('16:35')));
show('gemeldet', stallMessages(v, tasks, [{ id: 'st-x', status: 'offen' }], persons, at('16:35')));
show('Ampel aus', stallMessages({ ...v, on: false }, tasks, [], persons, at('16:35')));
show('eigene Zeit 15:00', stallMessages(v, tasks, [], persons, at('15:05'), [], { kind1: '15:00', kind2: '19:00' }));
show('Urlaub', stallMessages(v, tasks, [], persons, at('16:35'), [{ von: '2026-11-18', bis: '2026-11-22', weg: true }]));

// Logik im Browser-Teil
console.log('Stand 19.11. (zuletzt 14.11., alle 5):', JSON.stringify(A.stState(v, '2026-11-19')));
console.log('Stand 17.11.:', A.stState(v, '2026-11-17').stufe, A.stState(v, '2026-11-18').stufe, A.stState(v, '2026-11-21').stufe, A.stState(v, '2026-11-21').left);
console.log('Ohne Einstellung:', A.stState(null, '2026-11-19').on, A.stView(null, [], '2026-11-19').canReport);

// Minuten-Shop: Konto hält gekaufte Minuten fest, Zurückbuchen gibt sie frei.
const now = at('17:00');
const t0 = new Date(at('15:00')).toISOString();
const log = [
  { id: 'a', person_id: 'p3', day: '2026-11-19', minutes: 30, status: 'bestaetigt', created_at: t0, decided_at: t0 },
  { id: 'b', person_id: 'p3', day: '2026-11-19', minutes: 30, status: 'bestaetigt', created_at: t0, decided_at: t0 },
];
const kauf = { id: 'shop-1', person_id: 'p3', day: '2026-11-19', label: 'Minuten-Shop: Abendessen aussuchen', minutes: -40, status: 'offen', created_at: new Date(at('16:50')).toISOString(), decided_by: null, decided_at: null };
console.log('Konto vor Kauf:', A.account(log, 'p3', 60, now, '2026-11-19').balance);
console.log('Konto mit offenem Kauf:', A.account([...log, kauf], 'p3', 60, now, '2026-11-19').balance);
console.log('Konto nach Zurückbuchen:', A.account([...log, { ...kauf, status: 'abgelehnt' }], 'p3', 60, now, '2026-11-19').balance);
console.log('Konto nach Einlösen:', A.account([...log, { ...kauf, status: 'bestaetigt' }], 'p3', 60, now, '2026-11-19').balance);
console.log('Tagessieg ohne Limit:', A.account([...log, { id: 'lpsieg-2026-11-19-p3', person_id: 'p3', day: '2026-11-19', minutes: 10, status: 'bestaetigt', created_at: t0 }], 'p3', 60, now, '2026-11-19').balance);
console.log('Shop Start:', A.shopState(null).on, A.shopState(null).items.length, '| gespeichert aus:', A.shopState({ aus: true, items: [] }).on);

const base = { persons, tasks: [], abfuhr: [], hearts: [], plan: [], shopping: [], dishes: [], ratings: [], urlaub: [], added: [] };
const shopKeys = (lg: object[], ms: number) => dueMessages({ ...base, log: lg } as never, ms).filter((x) => /^shop/.test(x.key));
show('Kauf 16:55', shopKeys([kauf], at('16:55')));
show('eingelöst 17:10', shopKeys([{ ...kauf, status: 'bestaetigt', decided_by: 'p1', decided_at: new Date(at('17:08')).toISOString() }], at('17:10')));
show('zurückgebucht 17:10', shopKeys([{ ...kauf, status: 'abgelehnt', decided_by: 'p1', decided_at: new Date(at('17:08')).toISOString() }], at('17:10')));
