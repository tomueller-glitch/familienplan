import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
(globalThis as any).Deno = { env: { get: () => undefined }, serve: () => {} };
const m = await import(ROOT + '/supabase/functions/push/index.ts');
const persons = [
  { id: 'p1', name: 'Torsten', adult: true }, { id: 'p2', name: 'Mama', adult: true },
  { id: 'p3', name: 'Emma', adult: false }, { id: 'p4', name: 'Ben', adult: false },
];
const tasks = [
  { id: 't1', name: 'Zimmer aufräumen', schedule: 'taeglich', who: ['p3', 'p4'], minutes: 0, active: true, months: [] },
  { id: 't2', name: 'Spülmaschine ausräumen', schedule: 'taeglich', who: ['p3'], minutes: 0, active: true, months: [] },
];
const day = '2026-11-18';
// Emma hat aufgeräumt (wartet auf Bestätigung), Ben noch nichts.
const log = [{ id: 'l1', task_id: 't1', person_id: 'p3', day, minutes: 0, status: 'offen', created_at: `${day}T14:00:00Z` }];
const base = { persons, tasks, log, abfuhr: [], hearts: [], plan: [], shopping: [], dishes: [], ratings: [], urlaub: [], grundZuerst: true, added: [] };
const pick = (out: any[]) => out.filter((o) => /^grund/.test(o.key)).map((o) => [o.key, o.to.join('+'), o.msg.title, o.msg.body]);
for (const t of ['15:35', '16:40', '19:05', '20:10']) {
  // Winterzeit: UTC + 1
  const [h, mi] = t.split(':').map(Number);
  const at = Date.UTC(2026, 10, 18, h - 1, mi);
  console.log(t, JSON.stringify(pick(m.dueMessages(base, at))));
}
// Urlaub: keine Erinnerungen
console.log('Urlaub 19:05', JSON.stringify(pick(m.dueMessages({ ...base, urlaub: [{ id: 'u', von: day, bis: day, weg: true }] }, Date.UTC(2026, 10, 18, 18, 5)))));
// Abgelehnte Grundaufgabe meldet sich beim Kind
const rej = [{ id: 'l2', task_id: 't2', person_id: 'p3', day, minutes: 0, status: 'abgelehnt', decided_by: 'p1', decided_at: new Date(Date.UTC(2026, 10, 18, 17, 0)).toISOString(), created_at: `${day}T15:00:00Z`, label: 'Spülmaschine ausräumen' }];
const ok = [{ ...rej[0], id: 'l3', status: 'bestaetigt' }];
const ent = (lg: any[]) => m.dueMessages({ ...base, log: lg }, Date.UTC(2026, 10, 18, 17, 5)).filter((o: any) => /entschieden|bestaet|abgelehnt/.test(o.key + o.msg.tag)).map((o: any) => [o.to.join('+'), o.msg.title, o.msg.body]);
console.log('Abgelehnt:', JSON.stringify(ent(rej)), 'Bestätigt (still):', JSON.stringify(ent(ok)));
// Sonntag: offene Wochenaufgabe gehört mit in die Erinnerung, eine Tagesaufgabe mit Minuten ebenso.
const sun = '2026-11-22';
const wtasks = [...tasks, { id: 't3', name: 'Käfig sauber machen', schedule: 'woechentlich', who: ['p4'], minutes: 30, active: true, months: [] }, { id: 't4', name: 'Hund füttern', schedule: 'taeglich', who: ['p4'], minutes: 5, active: true, months: [] }];
console.log('Sonntag 19:05', JSON.stringify(pick(m.dueMessages({ ...base, tasks: wtasks, log: [] }, Date.UTC(2026, 10, 22, 18, 5))).filter((x: any) => x[1] === 'p4')));
console.log('Sonntag erledigt (Mittwoch)', JSON.stringify(pick(m.dueMessages({ ...base, tasks: wtasks, log: [{ id: 'w', task_id: 't3', person_id: 'p4', day: '2026-11-18', minutes: 30, status: 'bestaetigt' }] }, Date.UTC(2026, 10, 22, 18, 5))).filter((x: any) => x[1] === 'p4')));
console.log('Eltern 20:10, Vortag wartet', JSON.stringify(pick(m.dueMessages({ ...base, log: [...log, { id: 'v', task_id: 't2', person_id: 'p3', day: '2026-11-17', minutes: 0, status: 'offen' }] }, Date.UTC(2026, 10, 18, 19, 10))).filter((x: any) => /eltern/.test(x[0]))));
void sun;
// Eigene Uhrzeiten: Kinder 17:00 und 20:00, Eltern aus
console.log('Zeiten', JSON.stringify(m.reminderTimes({ kind1: '20:00', kind2: '17:00', eltern: '' })), JSON.stringify(m.reminderTimes(undefined)), JSON.stringify(m.reminderTimes({ kind1: '', kind2: '18:30' })));
const eig = { ...base, erinnerung: { kind1: '17:00', kind2: '20:00', eltern: '' } };
for (const [h, mi] of [[15, 40], [16, 5], [18, 5], [19, 5], [19, 15]]) console.log('eigene Zeiten', `${h + 1}:${String(mi).padStart(2, '0')}`, JSON.stringify(pick(m.dueMessages(eig, Date.UTC(2026, 10, 18, h, mi))).map((x: any) => x[0])));
