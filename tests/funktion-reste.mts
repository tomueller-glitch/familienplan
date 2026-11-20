// Nachricht nach dem Kochen: „Reste von …?“ Aufruf: node --experimental-strip-types tests/funktion-reste.mts
import { restMessages } from '../supabase/functions/push/index.ts';
const persons = [{ id: 'p1', adult: true }, { id: 'p2', adult: true }, { id: 'p3' }];
const plan = [{ day: '2026-11-19', dish_id: 'd1', dinner_time: '18:30' }, { day: '2026-11-20', dish_id: 'd2', skipped: true }];
const dishes = [{ id: 'd1', name: 'Chili con Carne mit Reis' }];
const list = [{ id: 'a', text: 'etwa 2 Portionen Chili', day: '2026-11-19', dish_id: 'd1' }, { id: 'b', text: '200 g Hackfleisch', day: '2026-11-19', dish_id: 'd1' }, { id: 'c', text: '1 Portion', day: '2026-11-20', dish_id: 'd2' }, { id: 'd', text: 'Rest', day: '2026-11-19', dish_id: 'anderes' }];
const at = (hm: string, day = '2026-11-19') => Date.parse(`${day}T${hm}:00+01:00`);
for (const t of ['19:00', '19:15', '21:00', '21:45']) {
  const m = restMessages(list, plan, dishes, persons, at(t));
  console.log(t, m.length ? `${m[0].key} an ${m[0].to.join('+')}: ${m[0].msg.title} ${m[0].msg.body}` : '-');
}
console.log('ausgelassen:', restMessages(list, plan, dishes, persons, at('20:00', '2026-11-20')).length, '| Urlaub:', restMessages(list, plan, dishes, persons, at('20:00'), [{ von: '2026-11-18', bis: '2026-11-22', weg: true }]).length);
// Essen ist fertig: Text und Schlüssel (höchstens alle zwei Minuten je Art)
import { dinnerCall } from '../supabase/functions/push/index.ts';
const t0 = Date.parse('2026-11-19T18:31:10+01:00');
const a = dinnerCall('gleich', '', 'Chili con Carne', t0); const b = dinnerCall('jetzt', '', '', t0 + 30000); const c = dinnerCall('jetzt', '', '', t0 + 150000);
console.log('Ruf:', a.msg.title, '|', a.msg.body, '|', b.msg.title, b.msg.body, '| gleicher Schlüssel in 30 s:', dinnerCall('jetzt', '', '', t0).key === b.key, '| neuer nach 2,5 Min.:', b.key !== c.key);
