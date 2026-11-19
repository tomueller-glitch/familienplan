// Was ist neu? Nach jedem Update zeigt die App einmal die Einträge, die auf diesem Gerät noch nicht gesehen wurden.
// Neue Einträge kommen oben dazu. Die id muss größer sein als alle bisherigen (Datum plus Buchstabe).
// fuer: 'eltern' zeigt den Punkt nur Erwachsenen, 'kinder' nur den Kindern, ohne Angabe sehen ihn alle.
export const NEUES = [
  {
    id: '2026-11-19f', datum: '19. November, nachts', titel: 'iPhone-Kalender auf dem Küchen-Display',
    punkte: [
      { text: 'Im Familie-Fenster unter Küchen-Display, „Kalender fürs Display“: öffentliche iPhone-Kalender eintragen, etwa einen pro Person, den gemeinsamen und den Dienstplan. Das Display zeigt ihre Termine von heute und morgen mit Farbpunkt der Person, neben den Terminen aus dem Familienplan. Auf den Handys erscheinen sie nicht.', fuer: 'eltern' },
      { text: 'Das Küchen-Display ordnet sich auf kleinen Tablets wie dem iPad mini neu, damit alles auf einen Bildschirm passt.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-19e', datum: '19. November, spätabends', titel: 'Einkaufsliste: keine Doppelten mehr, Posten entfernen',
    punkte: [
      { text: 'Neu berechnete Listen hatten Posten aus Claudes Plan doppelt, wenn Claude ein Gericht abgekürzt hatte, etwa „Chili (Di)“. Jetzt erkennt die App das Abendessen am Wochentag. Einmal „Aus dem Plan neu erstellen“ räumt eine betroffene Liste auf.', fuer: 'eltern' },
      { text: '„Bio-Hähnchenbrustfilet“ und „Hähnchenbrustfilet“ sind jetzt ein Posten, gekauft wird dann Bio.' },
      { text: 'Jeder offene Posten hat rechts ein Kreuz: Damit kommt er von der Liste, ohne abgehakt zu werden. „Rückgängig“ im Hinweis holt ihn zurück. Beim Neuberechnen bleibt er weg.' },
    ],
  },
  {
    id: '2026-11-19d', datum: '19. November, abends', titel: 'Neues Gericht von Claude für einen Tag',
    punkte: [
      { text: 'Passt ein Abendessen im Wochenplan nicht, gibt es im Tag den Knopf „Neues Gericht von Claude“. Claude schlägt ein Rezept vor, das noch nicht in der Sammlung steht, auf Wunsch schneller, mit Fisch oder vegetarisch. Mit „Anderer Vorschlag“ kommt ein neuer, mit „Übernehmen“ steht es im Plan und in der Sammlung.', fuer: 'eltern' },
      { text: 'Beim Tauschen eines Gerichts passt sich jetzt auch die Einkaufsliste an: Zutaten nur für das alte Gericht fallen weg, die des neuen kommen auf die nächste Tour. Schon Gekauftes nimmt das neue Gericht, wenn es passt.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-19c', datum: '19. November, abends', titel: 'Groß- und Frischeeinkauf, Brotbox-Sachen bleiben',
    punkte: [
      { text: 'Wer im Entwurf von Claude ein Gericht getauscht hat, bekam bisher eine Liste nur aus den Rezepten: Brotbox-Sachen wie Vollkornbrot, Angebote und die Aufteilung in Groß- und Frischeeinkauf fehlten. Jetzt bleibt Claudes Liste, nur die Zutaten des getauschten Gerichts werden ersetzt.', fuer: 'eltern' },
      { text: '„Aus dem Plan neu erstellen“ behält Posten für die Brotboxen und die Touren der Liste.', fuer: 'eltern' },
      { text: 'Auch eine Liste aus den Rezepten hat jetzt einen Großeinkauf am Samstag und einen Frischeeinkauf am Mittwoch. Salat, Pilze, frisches Fleisch und Brot für die zweite Wochenhälfte kommen auf den Frischeeinkauf.', fuer: 'eltern' },
      { text: 'Steht eine Liste noch auf einem einzigen Einkauf oder fehlen Brotbox-Sachen aus Claudes Plan, schlägt die Einkaufsliste oben die Reparatur vor: „Aufteilen und ergänzen“.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-19b', datum: '19. November, nachmittags', titel: 'Einkaufsliste ohne doppelte Posten, Vorrat prüfen',
    punkte: [
      { text: 'Gleiche Zutaten stehen auf der Einkaufsliste nur noch einmal, mit der Gesamtmenge und allen Gerichten. Das gilt auch für „Zwiebel“ und „Zwiebeln“ oder „Stk.“ und „Stück“.' },
      { text: 'Bestehende Listen ab dieser Woche werden beim Öffnen aufgeräumt. Abgehakte und selbst eingetragene Posten bleiben, wie sie sind.', fuer: 'eltern' },
      { text: 'Aus dem Vorrat: Oben auf der Einkaufsliste steht, was der Wochenplan aus dem Vorrat nimmt. Mit „Ist da“ oder „Fehlt“ kurz bestätigen. Was fehlt, kommt mit Menge und Gerichten auf die nächste Tour und steht im Vorrat auf leer.' },
    ],
  },
  {
    id: '2026-11-19a', datum: '19. November', titel: 'Stall-Ampel, Minuten-Shop und Küchen-Display',
    punkte: [
      { text: 'Stall-Ampel: Bist du mit dem Stall dran, zeigt eine Ampel unter „Aufgaben“, wann er wieder sauber gemacht werden muss. Gelb heißt morgen, Rot heißt heute. Danach auf „Sauber gemacht“ tippen.', fuer: 'kinder' },
      { text: 'Stall-Ampel: Unter „Aufgaben“ stellt ihr den Rhythmus ein, zum Beispiel alle 5 Tage, und wann der Stall zuletzt sauber war. Ab Gelb können die Kinder melden, bei Rot kommt nachmittags eine Nachricht. Die Wochenaufgabe ersetzt die Ampel, solange sie an ist.', fuer: 'eltern' },
      { text: 'Minuten-Shop: Minuten lassen sich gegen Belohnungen tauschen, zum Beispiel das Abendessen aussuchen. Mama oder Papa lösen den Kauf ein.', fuer: 'kinder' },
      { text: 'Minuten-Shop: Unter „Aufgaben“ legt ihr Belohnungen und Preise fest. Erst nach dem Speichern sehen die Kinder den Shop. Käufe stehen bei „Zu bestätigen“ mit „Erledigt“ und „Zurückbuchen“.', fuer: 'eltern' },
      { text: 'Küchen-Display: Ein Tablet in der Küche zeigt groß Uhr, Abendessen, Ampeln, Termine, Aufgaben der Kinder und die Einkaufsliste. Einschalten im Familie-Fenster.', fuer: 'eltern' },
      { text: 'Tagessieg im Lernplaner bringt Minuten auf das Konto. Sie zählen nicht zum Tageslimit.' },
    ],
  },
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
