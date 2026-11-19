// Kalender-Abos fürs Küchen-Display: iCloud-Kalender lesen, Serien, Ausnahmen, Zeitzonen, Nachtdienste.
import { parseCalendar, calendarDays, seriesDates, feedUrl } from '../supabase/functions/push/index.ts';
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
