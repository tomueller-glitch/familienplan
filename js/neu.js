// Was ist neu? Nach jedem Update zeigt die App einmal die Einträge, die auf diesem Gerät noch nicht gesehen wurden.
// Neue Einträge kommen oben dazu. Die id muss größer sein als alle bisherigen (Datum plus Buchstabe).
// fuer: 'eltern' zeigt den Punkt nur Erwachsenen, 'kinder' nur den Kindern, ohne Angabe sehen ihn alle.
export const NEUES = [
  {
    id: '2026-11-21r', datum: '21. November', titel: 'Küchen-Display: Wetter neben der Uhr',
    punkte: [
      { text: 'Neben Datum und Uhr stehen jetzt die Temperatur, das Wetter und der Regen der nächsten zwölf Stunden, als Satz („Regen ab 14 Uhr“) und als kleine Balken. Das gilt den ganzen Tag.' },
      { text: 'Der Kleidungstipp am Morgen ist weg. Morgens steht oben das Abendessen, darunter Brotbox und wem man Glück wünscht.' },
    ],
  },
  {
    id: '2026-11-21w', datum: '21. November', titel: 'Waschmaschinen-Ampel über Home Connect',
    punkte: [
      { text: 'Die Waschmaschine hat jetzt eine eigene Ampel am Küchen-Display: grün bereit, gelb läuft (mit Uhrzeit, wann sie fertig ist), rot fertig. Rot bleibt, bis jemand die Tür geöffnet hat.' },
      { text: 'Ist die Wäsche fertig, bekommen die Eltern eine Nachricht (7 bis 21:30 Uhr). Verbinden unter Aufgaben bei „Waschmaschine“ mit „Mit Home Connect verbinden“.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-21p', datum: '21. November', titel: 'PV-Anlage am Küchen-Display',
    punkte: [
      { text: 'Über der Strompreis-Kurve steht jetzt, wie viel Sonne gerade kommt, wie voll der Speicher ist und was das Haus verbraucht. Lohnt sich ein großer Verbraucher, steht darunter grün „guter Moment für die Spülmaschine“.' },
      { text: 'Die Zugangsdaten von AlphaESS liegen nur bei Supabase (ALPHA_APP_ID, ALPHA_APP_SECRET, optional ALPHA_SN). Ohne sie bleibt die Zeile weg.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-21s', datum: '21. November', titel: 'Strompreis von Tibber am Küchen-Display',
    punkte: [
      { text: 'Unten in der Terminspalte stehen der Strompreis jetzt, die günstigsten zwei Stunden am Stück und Balken für die nächsten 24 Stunden: grün günstig, orange teuer, dunkel die laufende Stunde. Die Preise für morgen kommen ab etwa 13 Uhr dazu.' },
      { text: 'Der Tibber-Schlüssel liegt nur bei Supabase als Secret TIBBER_TOKEN, nicht in der App. Ohne Schlüssel bleibt die Kurve weg.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20n', datum: '20. November, nachts', titel: 'Nachtruhe am Küchen-Display',
    punkte: [
      { text: 'Von 0 bis 6 Uhr ist das Küchen-Display schwarz und hält den Bildschirm nicht mehr wach. Ist im geführten Zugriff eine Display-Sperre eingestellt, geht der Bildschirm dann ganz aus. Ein Tipp zeigt alles für zwei Minuten.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20k', datum: '20. November, spät', titel: 'Dienstplan als Kalender: nur fürs Essen',
    punkte: [
      { text: 'Kalender haben jetzt drei Arten: Display und Essen, nur Display, nur fürs Essen. „Nur fürs Essen“ passt für einen Dienstplan: Die Dienste stehen nicht am Küchen-Display, zählen aber fürs Abendessen. Umstellen unter Planen > Kalender mit dem Knopf neben dem Kalender.', fuer: 'eltern' },
      { text: 'Aus einem Dienstplan zeigt das Display nur Rufdienste. Titel gehen weder ans Display noch an Claude, nur die Uhrzeiten.', fuer: 'eltern' },
      { text: 'An Tagen mit Rufdienst plant Claude Gerichte, die warten können oder sich gut aufwärmen lassen. „Rufdienst ITS“ zählt dafür nicht.', fuer: 'eltern' },
      { text: 'Die Zeile zum Abendessen am Display nennt nur Abweichungen, etwa „Papa isst später, ab 20:00 Uhr“ oder „Papa muss um 20:00 los“.' },
    ],
  },
  {
    id: '2026-11-20d', datum: '20. November, nachts', titel: 'Wunschessen-Duell und Live beim Einkaufen',
    punkte: [
      { text: 'Wunschessen-Duell: Unter „Woche“ und als blauer Zettel am Küchen-Display stehen zwei Gerichte für die nächste Woche. Alle vier stimmen ab, jede Stimme zählt gleich. Wer wofür gestimmt hat, sieht man erst, wenn alle abgestimmt haben. Der Sieger kommt in Claudes Plan.' },
      { text: 'Gleichstand: Es gewinnt das Gericht, das länger nicht dran war. Sind beide gleich lange nicht dran, das besser bewertete. Ist auch das gleich, entscheidet das Los.' },
      { text: 'Live beim Einkaufen: Wer den Einkaufsmodus startet, sagt den anderen per Nachricht Bescheid. Was sie dann ergänzen, erscheint sofort in der Liste im Laden, gelb markiert mit „neu von …“. Das Küchen-Display zeigt unten, wer gerade einkauft.' },
      { text: 'Prüfung der App: Fehlendes wandert auch, wenn man den Einkaufsmodus über einen anderen Bereich verlässt. Im Laden fehlen die Zeilen „für …“. Seltenes steht unter „Einstellungen zur Liste“.' },
    ],
  },
  {
    id: '2026-11-20e', datum: '20. November, abends', titel: 'Einkaufsliste: eine Liste, kein Nachkauf mehr',
    punkte: [
      { text: 'Unter „Einkauf“ steht oben immer der nächste Einkauf, egal zu welcher Woche er gehört. Was ihr ergänzt, kommt dorthin, auch „Ist alle“ vom Küchen-Display und Siri.' },
      { text: 'Spätere Einkäufe stehen darunter bei „Danach“, die der letzten Tage bei „Erledigt“. Beide sind zugeklappt. Abgehaktes des aktuellen Einkaufs liegt ganz unten, ebenfalls zugeklappt.' },
      { text: 'Die Liste „Nachkauf“ gibt es nicht mehr. Was im Laden fehlt, im Einkaufsmodus auf „fehlt“ tippen. Mit „Fertig“ steht es auf dem nächsten Einkauf, mit dem Hinweis „nicht bekommen“. Wer „Fertig“ vergisst, findet es am nächsten Tag dort.' },
      { text: 'Was nach dem Einkaufstag noch offen ist, wandert von selbst weiter. Zutaten für Abendessen, die schon vorbei sind, bleiben liegen.', fuer: 'eltern' },
      { text: 'Eigene Einträge landen gleich in der passenden Abteilung, zum Beispiel Joghurt im Kühlregal.' },
    ],
  },
  {
    id: '2026-11-20m', datum: '20. November, abends', titel: 'Küchen-Display: Zettel, Kochen, Essen rufen',
    punkte: [
      { text: 'Zettel fürs Küchen-Display: Unter Planen eine kurze Nachricht aufhängen, etwa „Paket ist beim Nachbarn“. Sie hängt oben am Display, bis heute Abend oder ein paar Tage, und lässt sich dort abnehmen.' },
      { text: 'Vor dem Abendessen gibt es am Display „Kochen“ (Kochmodus groß, mit Timern), „Essen in 5 Min.“ und „Essen ist fertig“. Die beiden letzten schicken allen, die zu Hause mitessen, eine Nachricht aufs Handy.' },
      { text: 'Bei 2 oder 3 Sternen fragt die App, was nicht gepasst hat (zu scharf, mag eine Zutat nicht …). Das steht dann beim Rezept, Claude berücksichtigt es beim nächsten Plan.' },
      { text: 'Was für morgen vorzubereiten ist und die Brotbox für morgen stehen am Display jetzt bei „Morgen“ in der Terminspalte.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20l', datum: '20. November, abends', titel: 'Heute Abend für morgen: abhaken und löschen',
    punkte: [
      { text: 'Was heute Abend für morgen vorzubereiten ist, lässt sich jetzt abhaken. Ist alles erledigt, steht „alles erledigt“ da, und auf dem Küchen-Display verschwindet der Punkt.' },
      { text: 'Mit dem Kreuz löscht ihr einen Punkt nur für diesen Tag, mit „Rückgängig“ im Hinweis kommt er zurück. Beim Gericht bleibt der Hinweis für das nächste Mal stehen.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20k', datum: '20. November, nachmittags', titel: 'Statusleiste unauffälliger',
    punkte: [
      { text: 'Die App reicht jetzt bis unter die Statusleiste mit Uhrzeit und Akku. Auf dem Küchen-Display fällt die Leiste dadurch kaum noch auf. Ausblenden lässt sie sich auf dem iPad nicht.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20j', datum: '20. November, nachmittags', titel: 'Reste erst nach dem Kochen',
    punkte: [
      { text: 'Reste, die sich aus Packungsgrößen ergeben, stehen nicht mehr vorab auf „Was muss weg?“. Nach dem Kochen fragt die App im Wochenplan „Reste von …?“ mit den erwarteten Resten zum Abhaken und Ändern. „Übernehmen“ setzt sie auf „Was muss weg?“, „Nichts übrig“ verwirft sie.', fuer: 'eltern' },
      { text: 'Am Kochtag kommt eine Dreiviertelstunde nach dem Essen eine Nachricht. Wurde das Gericht nicht gekocht, fällt die Frage weg, nach drei Tagen auch.', fuer: 'eltern' },
      { text: 'Bisher vorab eingetragene Reste sind in diese Nachfrage gewandert.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20i', datum: '20. November, nachmittags', titel: 'Küchen-Display holt Updates selbst',
    punkte: [
      { text: 'Fehler behoben: Das Küchen-Display hat neue Fassungen der App nicht bemerkt, weil es nie in den Hintergrund geht. Jetzt schaut es alle zehn Minuten nach und lädt sie von allein, auch im geführten Zugriff, aber nie, während jemand seine PIN eingibt.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20h', datum: '20. November, nachmittags', titel: 'Küchen-Display räumt auf',
    punkte: [
      { text: 'Auf dem Küchen-Display verschwinden Termine von heute eine halbe Stunde nach ihrem Ende, „kommt heim“ eine halbe Stunde nach der Uhrzeit. Ganztägiges und Nachtdienste bleiben stehen.' },
    ],
  },
  {
    id: '2026-11-20g', datum: '20. November, nachmittags', titel: 'Preisgedächtnis mit Grundpreisen',
    punkte: [
      { text: 'Das Preisgedächtnis zeigt jetzt, wo die Größe bekannt ist, den Preis je kg, je Liter oder je Stück. So lassen sich 1 l Milch bei Aldi und 0,5 l bei Lidl vergleichen. „Günstiger“ steht nur noch dort, wo der Vergleich wirklich stimmt.', fuer: 'eltern' },
      { text: 'Claude liest beim Kassenzettel die Anzahl („2 x 1,29“) und bei gewogenen Sachen das Gewicht mit. Beim Prüfen stehen bei jedem Posten Anzahl, Größe und der Grundpreis, die Größe lässt sich nachtragen.', fuer: 'eltern' },
      { text: 'Die geschätzten Kosten über dem Einkauf rechnen jetzt mit dem Preis je Packung. Vorher zählte eine Zeile „2 x Milch“ wie eine Packung zum doppelten Preis.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20f', datum: '20. November, mittags', titel: 'Nicht bekommen: Nachkauf geht wieder',
    punkte: [
      { text: 'Fehler behoben: „Auf Nachkauf setzen“ und „Bei Lidl versuchen“ ließen Posten aus der Liste der anderen Woche liegen, wenn zwei Wochen am selben Tag eingekauft werden. Jetzt kommen alle nicht bekommenen Posten mit.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20e', datum: '20. November', titel: 'Wann die Kinder von der Schule kommen',
    punkte: [
      { text: 'Das Küchen-Display zeigt bei den Terminen, wann die Kinder etwa von der Schule heimkommen: Schulschluss, an OGTS-Tagen deren Ende, plus Heimweg.' },
      { text: 'Unter Planen, „Schule“ stellt ihr pro Kind Unterrichtsende und OGTS je Wochentag ein, dazu den Heimweg in Minuten (Standard 30). Für Philip gilt auf Wunsch der Stundenplan aus dem Lernplaner. Fällt Unterricht aus, tragt ihr dort „Früher aus“ mit Tag und Uhrzeit ein.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20d', datum: '20. November', titel: 'Große Fotos von Kassenzetteln',
    punkte: [
      { text: 'Fehler behoben: Fotos mit sehr vielen Megapixeln kamen beim Kassenzettel manchmal leer an und galten als „zu groß“. Die App verkleinert jetzt jedes Foto einzeln und speicherschonend, die Grenze ist höher.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20c', datum: '20. November, morgens', titel: 'Zwei Einkäufe an einem Tag sind eine Liste',
    punkte: [
      { text: 'Legst du zwei Einkäufe auf denselben Einkaufstag, werden sie eine Liste. Doppelte Posten wie zweimal Zwiebeln werden dabei zusammengezählt.', fuer: 'eltern' },
      { text: 'Das gilt jetzt auch über die Woche hinaus: Liegt der Einkauf dieser Woche am selben Tag wie der Großeinkauf für die nächste, stehen beide in einer Liste, gleiche Sachen in einer Zeile mit einem Haken.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20b', datum: '20. November, morgens', titel: 'Küchen-Display auch hell',
    punkte: [
      { text: 'Das Küchen-Display ist tagsüber jetzt hell und ab 18 Uhr dunkel.' },
      { text: 'Im Familie-Fenster beim Küchen-Display lässt sich die Farbe einstellen: Automatisch, Hell oder Dunkel.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-20a', datum: '20. November', titel: 'Küchen-Display: morgens anders als abends',
    punkte: [
      { text: 'Morgens zeigt das Küchen-Display, was ihr anziehen sollt, das Wetter, die Brotbox und wem man Glück wünscht. Nachmittags kommen Abendessen, Vorbereitung für morgen und die Brotbox für morgen.' },
      { text: 'Nach dem Essen fragt das Display „Wie war’s?“. Tipp auf dich, gib deine PIN ein und vergib Sterne, auch ohne Handy.' },
      { text: '„Ist alle?“: Unten am Display Milch, Butter und Co. antippen, auf dich tippen und deine PIN eingeben, dann stehen sie auf der Einkaufsliste, mit deinem Namen. Unter „Mehr“ gibt es alles aus „Immer wieder“ und ein Feld für anderes.' },
    ],
  },
  {
    id: '2026-11-19j', datum: '19. November, spätabends', titel: 'Abhaken am Küchen-Display',
    punkte: [
      { text: 'Am Küchen-Display auf deinen Namen tippen, deine PIN eingeben und die Aufgaben von heute abhaken, wenn dein Handy gerade nicht da ist. Die PIN legst du am Handy unter „Aufgaben“ ganz unten fest.', fuer: 'kinder' },
      { text: 'Die Kinder können am Küchen-Display mit ihrer eigenen PIN die Aufgaben von heute abhaken. Die PIN legen sie am Handy unter „Aufgaben“ fest, zurücksetzen geht im Familie-Fenster.', fuer: 'eltern' },
      { text: 'Am Küchen-Display gibt es keinen Knopf „Anzeige beenden“ mehr. Beenden: fünfmal schnell aufs Kalenderblatt tippen und die PIN von Mama oder Papa eingeben.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-19i', datum: '19. November, spätabends', titel: 'Heimweg aus dem Kalender, Termine nur noch im iPhone',
    punkte: [
      { text: 'Steht bei einem Termin im iPhone-Kalender ein Ort, rechnet die App die Fahrzeit nach Hause dazu. Danach richten sich Essenszeit und „kommt später“, auch in Claudes Wochenplan. Das Küchen-Display zeigt „zu Hause etwa …“.' },
      { text: 'Das Küchen-Display passt auf dem iPad mini quer und hoch auf einen Bildschirm, auch mit vier Ampeln. Die Ampeln stehen dafür zweispaltig.', fuer: 'eltern' },
      { text: 'Fehler behoben: Ein Termin ohne Ende, etwa ein Werkstatttermin, galt als „über Nacht weg“. Und ein Termin, der in mehreren Kalendern steht, erscheint auf dem Display nur noch einmal mit allen Personen.' },
      { text: 'Termine gibt es nur noch im iPhone-Kalender. Das Menü „Termine“ im Familienplan ist weg, unter „Planen“ steht jetzt „Kalender“.' },
      { text: 'Unter „Kalender“, „Heimweg“ einmal die Adresse und den Schlüssel von OpenRouteService eintragen. Pro Kalender lässt sich Auto, Rad, zu Fuß oder kein Heimweg wählen.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-19h', datum: '19. November, spätabends', titel: 'iPhone-Kalender zählen fürs Abendessen',
    punkte: [
      { text: 'Termine aus dem iPhone-Kalender einer Person zählen jetzt fürs Abendessen mit: Wer zur Essenszeit unterwegs ist, kommt später, wer über Nacht weg ist, etwa im Nachtdienst, isst nicht mit. Von Hand lässt sich das im Tag wie immer ändern.' },
      { text: 'Steht ein Termin im Familienplan und im iPhone-Kalender, zeigt das Küchen-Display ihn nur einmal.' },
      { text: 'Unter Familie, „iPhone-Kalender“ lässt sich pro Kalender umschalten, ob er fürs Essen zählt oder nur aufs Display kommt. Bei den Terminen im Familienplan steht, welche auch im iPhone-Kalender stehen und wegkönnen.', fuer: 'eltern' },
      { text: 'Claude sieht die Kalendertermine beim Wochenplan auch und plant an vollen Tagen schnelle Gerichte.', fuer: 'eltern' },
    ],
  },
  {
    id: '2026-11-19g', datum: '19. November, nachts', titel: 'Einkaufsliste ohne „Bio“, dafür mit Bio-Angeboten',
    punkte: [
      { text: 'Auf der Einkaufsliste steht kein „Bio“ mehr vor den Sachen. Gekauft wird Bio, wenn es das gibt.' },
      { text: 'Gibt es etwas am Einkaufstag gerade als Bio-Angebot, steht daneben „Bio im Angebot“, darunter Markt und Preis.' },
      { text: 'Claude schreibt die Liste ab jetzt ohne „Bio“ und sucht bevorzugt Bio-Angebote.', fuer: 'eltern' },
    ],
  },
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
