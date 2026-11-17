// Was ist neu? Nach jedem Update zeigt die App einmal die Einträge, die auf diesem Gerät noch nicht gesehen wurden.
// Neue Einträge kommen oben dazu. Die id muss größer sein als alle bisherigen (Datum plus Buchstabe).
// fuer: 'eltern' zeigt den Punkt nur Erwachsenen, ohne Angabe sehen ihn alle.
export const NEUES = [
  {
    id: '2026-11-17d', datum: '17. November, abends', titel: 'Müll-Ampel und „Was ist neu?“',
    punkte: [
      { text: 'Unter „Aufgaben“ gibt es eine Ampel für Plastikmüll und Restmüll in der Küche. Grün heißt noch Platz, Gelb fast voll, Rot voll.' },
      { text: 'Bei Gelb und Rot können die Kinder „Rausgebracht“ melden, bei Grün nicht. Mit der Bestätigung springt die Ampel auf Grün.' },
      { text: 'Bei Rot bekommen die Kinder eine Push-Nachricht, zwischen 7 und 20:30 Uhr, sonst am nächsten Morgen.' },
      { text: 'Die Ampel schaltet ihr unter „Aufgaben“ im Abschnitt „Mülleimer in der Küche“ durch Antippen der Farbe.', fuer: 'eltern' },
      { text: 'Nach einem Update zeigt dieses Fenster, was neu ist. Später findet ihr es in der Hilfe (Fragezeichen oben) unter „Was ist neu?“.' },
      { text: 'Die Hilfe „Was kann die App?“ ist auf dem neuesten Stand.' },
    ],
  },
  {
    id: '2026-11-17c', datum: '17. November, abends', titel: 'Kochmodus mit Mengen',
    punkte: [
      { text: 'Im Kochmodus steht unter jedem Schritt „Dafür brauchst du“ mit den Mengen für genau diesen Schritt, bei Gästen schon hochgerechnet.' },
      { text: 'Darunter lassen sich bei jedem Schritt alle Zutaten mit Mengen aufklappen. Den Kochmodus zu verlassen ist nicht mehr nötig.' },
    ],
  },
  {
    id: '2026-11-17b', datum: '17. November, 18 Uhr', titel: 'Zuverlässigere Push-Nachrichten',
    punkte: [
      { text: 'Die Anmeldung bei Apple wird nur noch einmal pro Stunde erneuert. Das war die Ursache für „Abgelehnt, Status 400“.', fuer: 'eltern' },
      { text: 'Lehnt Apple trotzdem eine Nachricht ab, steht der Grund jetzt im Verlauf im Familie-Fenster. Bei kurzen Störungen versucht die App es noch einmal.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-17a', datum: '17. November, nachts', titel: 'Gemeinsame Termine mit dem Lernplaner',
    punkte: [
      { text: 'Termine aus dem Lernplaner und die Termine der Familie sind jetzt dieselben. Was in einer App eingetragen oder gelöscht wird, gilt auch in der anderen.' },
      { text: 'Der Lernplaner erkennt am gewählten Namen im Familienplan, wer das Handy benutzt.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-16a', datum: '16. November, abends', titel: 'Lernplaner eingebunden',
    punkte: [
      { text: 'Unter „Aufgaben“ zeigt eine Karte den Lerntag: was erledigt ist, die Lernzeit und das Wochenspiel. Von dort geht es direkt in den Lernplaner.' },
      { text: 'Die Erinnerungen des Lernplaners kommen über dieselben Push-Nachrichten wie der Familienplan.', fuer: 'eltern' },
    ],
  },
];

const SEVEN_DAYS = 7 * 86400000;

// Ungesehene Einträge. Ohne gespeicherten Stand (erster Start mit dieser Funktion) zählen nur Einträge der letzten
// sieben Tage, damit ein neues Gerät nicht die ganze Geschichte zeigt.
export function unseen(list, seenId, nowMs) {
  if (seenId) return list.filter((n) => n.id > seenId);
  return list.filter((n) => Date.parse(`${n.id.slice(0, 10)}T00:00:00`) >= nowMs - SEVEN_DAYS);
}

export const newest = (list) => list.reduce((m, n) => (n.id > m ? n.id : m), '');

export function forAudience(list, adult) {
  return list.map((n) => ({ ...n, punkte: n.punkte.filter((p) => adult || p.fuer !== 'eltern') })).filter((n) => n.punkte.length);
}
