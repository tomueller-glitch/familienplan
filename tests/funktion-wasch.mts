// Waschmaschine (Home Connect): Ampel aus Betriebszustand und Tür, Nachricht einmal je Waschgang.
import { washerState, washMessages } from '../supabase/functions/push/index.ts';
const t = Date.parse('2026-11-21T09:00:00Z');
const run = washerState(null, 'Run', 'Locked', 2700, null, t);
const fin = washerState(run, 'Finished', 'Closed', null, null, t + 3000000);
const fin2 = washerState(fin, 'Finished', 'Closed', null, null, t + 3300000);
const ready = washerState(fin2, 'Ready', 'Closed', null, null, t + 3600000);
const open = washerState(ready, 'Ready', 'Open', null, null, t + 3900000);
const again = washerState(open, 'Finished', 'Closed', null, null, t + 4200000);
const delayed = washerState(null, 'DelayedStart', 'Closed', null, 5400, t);
console.log('Ampel:', [run, fin, fin2, ready, open, again, delayed].map((x) => `${x.op}/${x.tuer}=${x.stufe}${x.bis ? ' bis ' + x.bis.slice(11, 16) : ''}${x.start ? ' start ' + x.start.slice(11, 16) : ''}`).join(' | '), '| gleiche Fertigzeit:', fin.fertig_seit === fin2.fertig_seit);
const persons = [{ id: 'p1', adult: true }, { id: 'p2', adult: true }, { id: 'p3', adult: false }];
const m = washMessages(fin, persons, t + 3000000);
console.log('Nachricht:', JSON.stringify(m.map((x) => ({ key: x.key, to: x.to, title: x.msg.title }))), '| nachts:', washMessages(fin, persons, Date.parse('2026-11-21T22:00:00Z')).length, '| grün:', washMessages(open, persons, t).length);
