import { lernMessages, lpFromRows, berlin, lpSchoolEnd } from '../supabase/functions/push/index.ts';
const persons=[{id:'p1',name:'Papa',adult:true},{id:'p2',name:'Mama',adult:true},{id:'p3',name:'Jonas',adult:false},{id:'p4',name:'Lena',adult:false}];
const day='2026-11-17'; // Dienstag
const rows=[
 {id:'settings',coll:'settings',data:{kidId:'p3',afterSchool:60,latest:'19:30',winGoal:4,bedtimeMin:30}},
 {id:'schoolEnd',coll:'schoolEnd',data:{'1':'13:00','2':'15:30','3':'13:00','4':'13:00','5':'12:15'}},
 {id:'task:a',coll:'task',data:{id:'a',kind:'ha',subject:'Mathe',title:'S. 10',due:'2026-11-18',done:false}},
 {id:'task:b',coll:'task',data:{id:'b',kind:'daily',subject:'Latein',title:'Ludus Latinus',date:day,done:false}},
 {id:'task:c',coll:'task',data:{id:'c',kind:'lern',examId:'e1',subject:'Latein',title:'20 Vokabeln',date:'2026-11-16',done:false}},
 {id:'task:d',coll:'task',data:{id:'d',kind:'ha',subject:'Englisch',title:'WB 42',due:'2026-11-17',done:true,doneAt:day,actual:15}},
 {id:'exam:e1',coll:'exam',data:{id:'e1',subject:'Latein',type:'Ex / Test',date:'2026-11-18'}},
 {id:'help:h',coll:'help',data:{id:'h',date:day,subject:'Mathe',title:'Brüche'}},
 ...['2026-11-16','2026-11-17','2026-11-18','2026-11-19'].map(k=>({id:'win:'+k,coll:'win',data:{k,v:true}})),
];
const lp=lpFromRows(rows);
const at=(hm:string)=>Date.parse(`${day}T${hm}:00+01:00`);
for(const t of ['16:30','16:35','18:30','19:05','19:45','12:00']){const m=lernMessages(lp,persons,at(t));console.log(t,berlin(at(t)).min,m.map(x=>`${x.key} -> ${x.to.join(',')} | ${x.msg.title} | ${x.msg.body}`));}
const sun=Date.parse('2026-11-22T17:10:00+01:00');console.log('So',lernMessages(lp,persons,sun).map(x=>x.key));
console.log('Ferien',lernMessages(lp,persons,Date.parse('2026-12-28T16:40:00+01:00')).map(x=>x.key));
console.log('aus',lernMessages(lpFromRows([{id:'settings',coll:'settings',data:{pushOn:false}}]),persons,at('16:30')).length);

// Schulschluss aus dem Stundenplan: Di bis zur 9. Stunde (15:15), Anpfiff also 16:15.
const tt={times:[['08:00','08:45'],['08:45','09:30'],['09:45','10:30'],['10:30','11:15'],['11:30','12:15'],['12:15','13:00'],['13:00','13:45'],['13:45','14:30'],['14:30','15:15']],ab:true,refWeek:'2026-11-16',refType:'B',A:{},B:{2:['L','M','Ins','E','Sp','Sp','','Blas','Blas']}};
console.log('Schulschluss Di', lpSchoolEnd(tt,'2026-11-17'), 'Di A-Woche (Rückfall auf B)', lpSchoolEnd(tt,'2026-11-24'), 'Mo leer', lpSchoolEnd(tt,'2026-11-16'));
const lp2=lpFromRows([...rows,{id:'timetable',coll:'timetable',data:tt}]);
console.log('16:15', lernMessages(lp2,persons,at('16:15')).filter(x=>x.key.startsWith('lp-anpfiff')).length, '16:30 schon vorbei?', lernMessages(lp2,persons,at('17:05')).filter(x=>x.key.startsWith('lp-anpfiff')).length);
// Buß- und Bettag (18.11.2026): schulfrei, aber Lerntag. Anpfiff zur Wochenend-Startzeit 10:00.
const bt=lpFromRows(rows.map(r=>r.id==='task:b'?{...r,data:{...r.data,date:'2026-11-18'}}:r));
console.log('Bettag',lernMessages(bt,persons,Date.parse('2026-11-18T10:10:00+01:00')).map(x=>x.key));
// Pause vorbei und Lernmodus (Dienstag 17.11.2026, 16:40)
{
  const now=Date.parse('2026-11-17T16:40:00+01:00');
  const extra=[
    {id:'brk',coll:'brk',data:{date:'2026-11-17',at:now-8*60000,until:now-2*60000,len:5,long:false}},
    {id:'lm',coll:'lm',data:{date:'2026-11-17',on:true,since:now-60*60000,away:0,leaves:0,awayAt:now-14*60000}},
  ];
  const m=lernMessages(lpFromRows([...rows,...extra]),persons,now).filter(x=>/lp-(pause|weg)/.test(x.key));
  console.log('Pause/Weg',m.map(x=>`${x.key.split(':')[0]} -> ${x.to.join(',')} | ${x.msg.body}`));
  // Weg seit 7 Min., davon 6 Min. Pause: zählt nur 1 Min., keine Meldung
  const extra2=[{id:'brk',coll:'brk',data:{date:'2026-11-17',at:now-7*60000,until:now-1*60000,len:6,long:true}},{id:'lm',coll:'lm',data:{date:'2026-11-17',on:true,since:now-3600000,away:0,leaves:0,awayAt:now-7*60000}}];
  console.log('In der Pause raus',lernMessages(lpFromRows([...rows,...extra2]),persons,now).filter(x=>/lp-weg/.test(x.key)).length);
}
// Spiel verlegt: nur Elternnachricht
{
  const now=Date.parse('2026-11-17T15:30:00+01:00');
  const m=lernMessages(lpFromRows([...rows,{id:'day:2026-11-17',coll:'day',data:{k:'2026-11-17',v:{verlegt:true,grund:'muede'}}}]),persons,now);
  console.log('Verlegt',m.map(x=>`${x.key} -> ${x.to.join(',')} | ${x.msg.title}: ${x.msg.body}`));
}
// Lerneinheit zu kurz: Eltern entscheiden.
{
  const now=Date.parse('2026-11-18T16:40:00+01:00');
  const rows2=[...rows,{id:'task:k1',coll:'task',data:{id:'k1',kind:'lern',subject:'Mathe',title:'Terme üben',done:false,date:'2026-11-18',check:{date:'2026-11-18',at:now-60000,actual:9,planned:30,why:'kurz'}}},
    {id:'task:k2',coll:'task',data:{id:'k2',kind:'lern',subject:'Musik',title:'Beethoven Karten',done:false,date:'2026-11-18',check:{date:'2026-11-18',at:now-120000,actual:25,planned:25,why:'ohne'}}}];
  const lp2=lpFromRows(rows2);
  console.log('Prüfen offen:',lp2.open.some((t:any)=>t.id==='k1'),'wartend:',(lp2.checks||[]).length);
  console.log('Prüfen:',lernMessages(lp2,persons,now).filter(x=>x.key.startsWith('lp-pruefen')).map(x=>`${x.to.join(',')} | ${x.msg.title} | ${x.msg.body}`).join('\n  '));
  console.log('nachts:',lernMessages(lp2,persons,Date.parse('2026-11-18T22:00:00+01:00')).filter(x=>x.key.startsWith('lp-pruefen')).length);
}
// Anpfiff mit eigenem Plan, Planungsfrage, Applaus.
{
  const day = '2026-11-19';
  const at = (hm: string) => Date.parse(`${day}T${hm}:00+01:00`);
  const base = rows.filter((r: any) => !['win', 'kick'].includes(r.coll)).map((r: any) => r.coll === 'task' && !r.data.done && r.data.kind === 'ha' ? { ...r, data: { ...r.data, due: '2026-11-20' } } : r);
  const plan = { id: 'day:' + day, coll: 'day', data: { k: day, v: { kplan: { at: '17:15', hind: 'Ich bin müde', wenn: 'du müde bist', dann: 'Erst 5 Minuten Bewegung, dann Anpfiff' } } } };
  const keys = (r: any[], hm: string) => lernMessages(lpFromRows(r), persons, at(hm)).filter((x) => /lp-(plan|anpfiff|applaus|clap)/.test(x.key)).map((x) => `${x.key} -> ${x.to.join(',')} | ${x.msg.title} | ${x.msg.body}${x.msg.url && x.msg.url.includes('applaus') ? ' | ' + x.msg.url : ''}`);
  for (const hm of ['13:00', '13:30', '14:00', '15:30']) console.log('ohne Plan', hm, JSON.stringify(keys(base, hm)));
  for (const hm of ['16:20', '17:15']) console.log('mit Plan', hm, JSON.stringify(keys([...base, plan], hm)));
  const won = [...base, { id: 'win:' + day, coll: 'win', data: { k: day, v: true } },
    { id: 'task:z1', coll: 'task', data: { id: 'z1', kind: 'lern', subject: 'Mathe', title: 'Terme üben', done: true, doneAt: day, actual: 24, planned: 30, fin: at('17:40') } },
    { id: 'clap:c1', coll: 'clap', data: { id: 'c1', ref: 't-z1', what: 'Mathe: Terme üben', name: 'Papa', from: 'p1', at: at('17:50'), date: day } }];
  console.log('Applaus 17:55', JSON.stringify(keys(won, '17:55'), null, 1));
}
