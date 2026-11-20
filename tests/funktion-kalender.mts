// Kalender-Abos fürs Küchen-Display: iCloud-Kalender lesen, Serien, Ausnahmen, Zeitzonen, Nachtdienste.
import { parseCalendar, calendarDays, seriesDates, feedUrl, loadCalendars, addWays, ortOk } from '../supabase/functions/push/index.ts';
const ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Apple Inc.//iPhone OS 18//EN', 'X-WR-CALNAME:Papa',
  'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'DTSTART:19810329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'END:VTIMEZONE',
  // Wöchentlich Di und Do, eine Ausnahme, ein verschobener Termin
  'BEGIN:VEVENT', 'UID:training', 'DTSTART;TZID=Europe/Berlin:20250902T170000', 'DTEND;TZID=Europe/Berlin:20250902T183000', 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH', 'EXDATE;TZID=Europe/Berlin:20261124T170000', 'SUMMARY:Handball\\, Halle Süd', 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'SUMMARY:Alarm', 'END:VALARM', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:training', 'RECURRENCE-ID;TZID=Europe/Berlin:20261119T170000', 'DTSTART;TZID=Europe/Berlin:20261119T180000', 'DTEND;TZID=Europe/Berlin:20261119T193000', 'SUMMARY:Handball (später)', 'END:VEVENT',
  // Nachtdienst über Mitternacht, in UTC gespeichert
  'BEGIN:VEVENT', 'UID:nacht', 'DTSTART:20261119T183000Z', 'DTEND:20261120T070000Z', 'SUMMARY:Nachtdienst', 'END:VEVENT',
  // Mehrtägig ganztägig
  'BEGIN:VEVENT', 'UID:kongress', 'DTSTART;VALUE=DATE:20261118', 'DTEND;VALUE=DATE:20261121', 'SUMMARY:Kongress', 'END:VEVENT',
  // Monatlich am zweiten Donnerstag
  'BEGIN:VEVENT', 'UID:elternabend', 'DTSTART;TZID=Europe/Berlin:20260108T193000', 'DURATION:PT1H30M', 'RRULE:FREQ=MONTHLY;BYDAY=2TH', 'SUMMARY:Stammtisch', 'END:VEVENT',
  // Jährlich: Geburtstag
  'BEGIN:VEVENT', 'UID:geb', 'DTSTART;VALUE=DATE:19801120', 'DTEND;VALUE=DATE:19801121', 'RRULE:FREQ=YEARLY', 'SUMMARY:Geburtstag Oma', 'END:VEVENT',
  // Abgesagt und beendete Serie
  'BEGIN:VEVENT', 'UID:abgesagt', 'DTSTART;TZID=Europe/Berlin:20261119T100000', 'DTEND;TZID=Europe/Berlin:20261119T110000', 'STATUS:CANCELLED', 'SUMMARY:Zahnarzt', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:vorbei', 'DTSTART;TZID=Europe/Berlin:20260105T080000', 'DTEND;TZID=Europe/Berlin:20260105T090000', 'RRULE:FREQ=DAILY;COUNT=10', 'SUMMARY:Kurs', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:bis', 'DTSTART;TZID=Europe/Berlin:20261001T070000', 'DTEND;TZID=Europe/Berlin:20261001T153000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH,FR;UNTIL=20261231T225959Z', 'SUMMARY:Frühdienst', 'END:VEVENT',
  // Zeitzone aus Outlook und lange Zeile, umbrochen
  'BEGIN:VEVENT', 'UID:outlook', 'DTSTART;TZID=W. Europe Standard Time:20261120T120000', 'DTEND;TZID=W. Europe Standard Time:20261120T130000', 'SUMMARY:Mittagessen mit dem Team aus der An', ' ästhesie', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');
const ev = parseCalendar(ICS);
console.log('Termine gelesen:', ev.length, '| Titel:', ev.map((e) => e.summary).join(' / '));
const out = calendarDays(ev, ['2026-11-19', '2026-11-20'], 'papa');
for (const [d, list] of Object.entries(out)) console.log(d, JSON.stringify(list.map((x) => `${x.ganztags ? 'ganztags' : `${x.von || '…'}-${x.bis || '…'}`} ${x.titel}`)));
console.log('Serie alle 2 Wochen Do/Fr ab 1.10.:', seriesDates('2026-10-01', { FREQ: 'WEEKLY', INTERVAL: '2', BYDAY: 'TH,FR' }, '2026-11-30').join(' '));
console.log('Monatlich 2. Do:', seriesDates('2026-01-08', { FREQ: 'MONTHLY', BYDAY: '2TH' }, '2026-12-31').slice(-3).join(' '));
console.log('Letzter Freitag:', seriesDates('2026-01-30', { FREQ: 'MONTHLY', BYDAY: '-1FR' }, '2026-04-30').join(' '));
console.log('Sommerzeit (Mo 30.3. 7 Uhr):', JSON.stringify(calendarDays(parseCalendar(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x', 'DTSTART;TZID=Europe/Berlin:20260302T070000', 'DTEND;TZID=Europe/Berlin:20260302T080000', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Frühdienst', 'END:VEVENT', 'END:VCALENDAR'].join('\n')), ['2026-03-30'], 'x')));
console.log('Adressen:', feedUrl('webcal://p52-caldav.icloud.com/published/2/abc'), feedUrl('http://x.de/a.ics'), feedUrl('https://192.168.1.2/a.ics'), feedUrl('kein link'));
// Drei Wochen für die Essensplanung: ein Abruf, alle Tage ab heute.
{
  const real = globalThis.fetch;
  let hits = 0;
  globalThis.fetch = (async () => { hits += 1; return new Response(ICS, { status: 200 }); }) as typeof fetch;
  const store = { get: async () => [{ key: 'kalender', value: { feeds: [{ id: 'k1', url: 'webcal://p52-caldav.icloud.com/published/2/abc', person_id: 'p1' }] } }] } as never;
  const now = Date.parse('2026-11-19T10:00:00Z');
  const r22 = await loadCalendars(store, now, 22);
  const r2 = await loadCalendars(store, now);
  const r99 = await loadCalendars(store, now, 99);
  globalThis.fetch = real;
  const days = Object.keys(r22.tage);
  console.log('Tage:', days.length, days[0], days[days.length - 1], '| Standard:', Object.keys(r2.tage).length, '| höchstens:', Object.keys(r99.tage).length, '| Abrufe:', hits);
  console.log('Di 24.11. (Ausnahme):', JSON.stringify(r22.tage['2026-11-24'].map((x) => x.titel)), '| Do 26.11.:', JSON.stringify(r22.tage['2026-11-26'].map((x) => `${x.von}-${x.bis} ${x.titel}`)), '| Anzahl:', r22.feeds[0].anzahl);
}
// Heimweg: Orte suchen, Fahrzeiten rechnen, alles merken.
{
  const real = globalThis.fetch;
  const log: string[] = [];
  const GEO: Record<string, [number, number]> = { 'Am Hang 3, 96450 Coburg': [50.26, 10.96], 'HUK-Arena Coburg': [50.25, 10.98], 'Sporthalle Rödental': [50.29, 11.04] };
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    if (u.pathname.includes('pelias')) {
      const t = u.searchParams.get('text') || ''; log.push(`${u.host}${u.pathname} ${t}`);
      if (u.searchParams.get('api_key') === 'falsch') return new Response('{}', { status: 403 });
      const g = GEO[t]; return new Response(JSON.stringify({ features: g ? [{ geometry: { coordinates: [g[1], g[0]] } }] : [] }), { status: 200 });
    }
    const b = JSON.parse(String(init && init.body)); log.push(`${u.host}${u.pathname} key=${u.searchParams.get('api_key')} ${b.locations.length - 1} Ziele, Schlüssel ${(init && (init.headers as Record<string, string>).Authorization) || '-'}`);
    return new Response(JSON.stringify({ durations: b.sources.map((i: number) => [b.locations[i][0] > 11 ? 840 : 500]) }), { status: 200 });
  }) as typeof fetch;
  const saved: unknown[] = [];
  const store = { upsert: async (_t: string, rows: unknown[]) => { saved.push(...rows); } } as never;
  const feeds = [{ id: 'k1', person_id: 'p1' }, { id: 'k3', person_id: 'p3', weg: 'rad' }, { id: 'k2', person_id: null }, { id: 'k4', person_id: 'p2', weg: 'aus' }];
  const mk = () => ({ '2026-11-19': [
    { titel: 'Spiel', von: '16:00', bis: '18:00', ganztags: false, zeit: true, kalender: 'k1', ort: 'HUK-Arena Coburg' },
    { titel: 'Training', von: '17:00', bis: '18:30', ganztags: false, zeit: true, kalender: 'k3', ort: 'Sporthalle Rödental' },
    { titel: 'Apple-Ort', von: '15:00', bis: '18:40', ganztags: false, zeit: true, kalender: 'k1', ort: 'Klinikum', geo: [50.27, 10.95] as [number, number] },
    { titel: 'Videocall', von: '18:00', bis: '19:00', ganztags: false, zeit: true, kalender: 'k1', ort: 'https://zoom.us/j/1' },
    { titel: 'Gemeinsam', von: '17:00', bis: '18:00', ganztags: false, zeit: true, kalender: 'k2', ort: 'HUK-Arena Coburg' },
    { titel: 'Mama aus', von: '17:00', bis: '18:00', ganztags: false, zeit: true, kalender: 'k4', ort: 'HUK-Arena Coburg' },
    { titel: 'Unbekannt', von: '17:00', bis: '18:00', ganztags: false, zeit: true, kalender: 'k1', ort: 'Irgendwo 99' },
  ] });
  const t1 = mk();
  const f1 = await addWays(store, t1, feeds, { adresse: 'Am Hang 3, 96450 Coburg', schluessel: 'abc' }, {});
  console.log('Weg 1:', t1['2026-11-19'].map((x) => `${x.titel}=${x.weg ?? '-'}`).join(' '), '| Fehler:', f1 || '-');
  console.log('Abrufe 1:', log.join(' / '));
  const cache = (saved.pop() as { value: unknown }).value;
  log.length = 0;
  const t2 = mk();
  await addWays(store, t2, feeds, { adresse: 'Am Hang 3, 96450 Coburg', schluessel: 'abc' }, cache as never);
  console.log('Weg 2 aus dem Speicher:', t2['2026-11-19'].map((x) => x.weg ?? '-').join(' '), '| Abrufe:', log.length, '| gespeichert:', saved.length);
  // Abruf schlägt fehl: nicht merken, beim nächsten Mal neu. Alte Speicher mit gemerkten Fehlschlägen werden einmal geleert.
  const ok = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => (String(url).includes('matrix') ? new Response('', { status: 503 }) : ok(url, init))) as typeof fetch;
  const t3 = mk(); saved.length = 0;
  const f3 = await addWays(store, t3, feeds, { adresse: 'Am Hang 3, 96450 Coburg', schluessel: 'abc' }, { v: 2, heim: (cache as never as { heim: unknown }).heim, orte: (cache as never as { orte: unknown }).orte, zeiten: {} } as never);
  const c3 = (saved.pop() as { value: { zeiten: Record<string, unknown> } } | undefined);
  console.log('Ausfall:', t3['2026-11-19'].map((x) => x.weg ?? '-').join(' '), '| gemerkt:', c3 ? Object.keys(c3.value.zeiten).length : 0, '|', f3);
  globalThis.fetch = ok;
  const t4 = mk();
  const alt = { heim: (cache as never as { heim: unknown }).heim, orte: (cache as never as { orte: unknown }).orte, zeiten: Object.fromEntries(Object.keys((cache as never as { zeiten: Record<string, unknown> }).zeiten).map((k) => [k, null])) };
  const f4 = await addWays(store, t4, feeds, { adresse: 'Am Hang 3, 96450 Coburg', schluessel: 'abc' }, alt as never);
  console.log('Alter Speicher mit Lücken:', t4['2026-11-19'].map((x) => x.weg ?? '-').join(' '), '|', f4 || '-');
  console.log('Falscher Schlüssel:', await addWays(store, mk(), feeds, { adresse: 'Neu 1', schluessel: 'falsch' }, {}).catch((e) => e.message));
  console.log('Ohne Schlüssel:', JSON.stringify(await addWays(store, mk(), feeds, { adresse: 'Am Hang 3' }, {})), '| Orte:', ['Hallenbad Coburg', 'Microsoft Teams', 'zu Hause', ''].map((o) => ortOk(o)).join(' '));
  globalThis.fetch = real;
}
// Termin ohne Ende (Dauer null) ist kein Nachtdienst
{
  const z = calendarDays(parseCalendar(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:w', 'DTSTART;TZID=Europe/Berlin:20261119T103000', 'SUMMARY:Werkstatt', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:n', 'DTSTART;TZID=Europe/Berlin:20261119T153000', 'DTEND;TZID=Europe/Berlin:20261120T080000', 'SUMMARY:Nacht', 'END:VEVENT', 'END:VCALENDAR'].join('\n')), ['2026-11-19', '2026-11-20'], 'x');
  console.log('Ohne Ende und über Nacht:', JSON.stringify(z));
}
