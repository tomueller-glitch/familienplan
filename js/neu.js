// Was ist neu? Nach jedem Update zeigt die App einmal die Einträge, die auf diesem Gerät noch nicht gesehen wurden.
// Neue Einträge kommen oben dazu. Die id muss größer sein als alle bisherigen (Datum plus Buchstabe).
// fuer: 'eltern' zeigt den Punkt nur Erwachsenen, 'kinder' nur den Kindern, ohne Angabe sehen ihn alle.
export const NEUES = [
  {
    id: '2026-11-18c', datum: '18. November, mittags', titel: 'Ampel für die Spülmaschine',
    punkte: [
      { text: 'Neben den Mülleimern gibt es jetzt eine Ampel für die Spülmaschine. Grün: wird eingeräumt. Gelb: läuft. Rot: fertig, bitte ausräumen.' },
      { text: 'Ist sie fertig, kommt eine Nachricht. Nach dem Ausräumen auf „Ausgeräumt“ tippen, mit der Bestätigung springt die Ampel auf Grün.', fuer: 'kinder' },
      { text: 'Bei Gelb wählst du „Fertig in 1 bis 4 Std.“ oder eine Uhrzeit. Zu dieser Zeit springt die Ampel von selbst auf Rot und die Kinder bekommen eine Nachricht. „Spülmaschine ausräumen“ steht dafür nicht mehr bei den Extra-Aufgaben.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-18b', datum: '18. November', titel: 'Foto als Nachweis und Wochenrückblick',
    punkte: [
      { text: 'Bei manchen Aufgaben öffnet sich beim Abhaken die Kamera. Ein Foto zeigt Mama oder Papa, dass es erledigt ist.', fuer: 'kinder' },
      { text: 'Foto als Nachweis: Unter „Aufgaben verwalten“ lässt es sich bei jeder Aufgabe einschalten. Das Kind fotografiert beim Melden, ihr seht das Bild unter „Zu bestätigen“ und könnt es groß ansehen. Die Fotos werden nach 14 Tagen gelöscht.', fuer: 'eltern' },
      { text: 'Wochenrückblick: Essen mit Sternen, Aufgaben und Minuten der Kinder, Müll, Lernen, Ausgaben und der Stand der nächsten Woche auf einer Seite. Zu finden unter „Woche“ bei „Planen“, sonntags und montags auch oben in der Woche.', fuer: 'eltern' },
      { text: 'Sonntags um 18:30 Uhr kommt eine Nachricht zum Wochenrückblick. Abschalten lässt sie sich unten im Rückblick.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-18a', datum: '18. November', titel: 'Push-Nachrichten: Fehler „BadWebPushTopic“ behoben',
    punkte: [
      { text: 'Apple hat manche Nachrichten wegen einer ungültigen Kennung abgelehnt (abgelehnt, Status 400, BadWebPushTopic), etwa „Aufgabe erledigt“, die Tonne oder neue Einträge auf der Einkaufsliste. Die Kennung ist jetzt immer gültig.', fuer: 'eltern' },
    ],
  },
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
  return list.map((n) => ({ ...n, punkte: n.punkte.filter((p) => (adult ? p.fuer !== 'kinder' : p.fuer !== 'eltern')) })).filter((n) => n.punkte.length);
}
