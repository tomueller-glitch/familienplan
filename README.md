# Familienplan

Familien-App für den Essensplan, die Einkaufsliste, die Sternebewertung der Abendessen und die Haushaltsaufgaben der Kinder.
Statische Web-App für Netlify, gemeinsame Daten in Supabase. Ein Build ist nicht nötig.

## Einrichten in etwa 15 Minuten

### 1. Supabase

1. Im Supabase-Dashboard ein Projekt wählen oder ein neues anlegen. Die Tabellen heißen alle `ep_...` und stören andere Tabellen im selben Projekt nicht.
2. **SQL Editor** öffnen, den Inhalt von `supabase/schema.sql` einfügen und ausführen.
3. Unter **Authentication > Users** mit **Add user** einen Familienzugang anlegen, zum Beispiel `familie@...` mit einem Passwort. "Auto Confirm User" aktivieren. Diesen einen Zugang nutzen alle vier.
4. Danach unter **Authentication > Sign In / Providers** die Option **Allow new users to sign up** ausschalten und speichern. Sonst könnte sich jeder, der die Adresse der App kennt, über die Schnittstelle selbst ein Konto anlegen und eure Daten lesen.
5. Über **Connect** oder **Settings > API Keys** die Projekt-URL und den Publishable Key kopieren (bei älteren Projekten heißt er "anon public").

### 2. Zugangsdaten eintragen

`js/config.js` öffnen und beide Werte eintragen:

```js
window.ESSENSPLAN_CONFIG = {
  supabaseUrl: 'https://deinprojekt.supabase.co',
  supabaseKey: 'sb_publishable_...',
};
```

Der Publishable Key darf öffentlich sein. Die Daten sind durch die Anmeldung und die Regeln aus `schema.sql` geschützt. Den Secret Key niemals eintragen.

### 3. Netlify

1. Bei Netlify **Add new site > Deploy manually** wählen.
2. Den ganzen Ordner `essensplaner` in das Feld ziehen.
3. Die Adresse der Seite an die Familie schicken.

Für spätere Änderungen den Ordner unter **Deploys** erneut hineinziehen.

### 4. Erster Start

1. Seite öffnen und mit dem Familienzugang anmelden.
2. **Startdaten einspielen** antippen. Das schreibt die Gerichte, die Haushaltsaufgaben, den Wochenplan vom 16. bis 22. November 2026 und die Einkaufsliste in die Datenbank.
3. Auf jedem Gerät auswählen, wer es benutzt. Die Namen lassen sich oben rechts ändern.
4. Auf dem Handy über "Zum Home-Bildschirm" als App ablegen.

Ohne Eintrag in `js/config.js` läuft die App im Demo-Modus und speichert nur auf dem jeweiligen Gerät. So lässt sie sich vorab ausprobieren, auch lokal mit `python3 -m http.server` im Ordner.

## Was die App macht

**Woche.** Die Startseite zeigt das heutige Abendessen als Kalenderblatt und darunter die ganze Woche. Ein Tipp auf einen Tag öffnet Rezept, Brotbox und Bewertung. Gerichte lassen sich tauschen oder als ausgefallen markieren.

**Einkauf.** Die Liste gehört zur gewählten Woche. Häkchen erscheinen sofort auf allen Geräten, mit dem Namen der Person. Eigene Einträge sind möglich. Für neue Wochen rechnet die App die Zutaten aller geplanten Gerichte zusammen.

**Gerichte.** Zu jedem Gericht steht, wie oft es dran war, wann zuletzt und wie es bewertet ist. Gezählt wird jeder geplante Tag bis heute, der nicht als ausgefallen markiert ist.

**Rechte.** Nur Personen mit dem Haken "Erwachsen" können Gerichte tauschen, die Woche vorschlagen, einen Plan einfügen, Gerichte anlegen, bearbeiten oder von Hand aussortieren und die Einkaufsliste neu berechnen. Bewerten, Abhaken und eigene Einträge auf der Einkaufsliste können alle. Die Haken setzt ein Erwachsener oben rechts unter dem eigenen Namen.

**PIN.** Wer auf einem Gerät zu einem Erwachsenen wechselt, gibt dessen vierstellige PIN ein. Beim ersten Wechsel legt jeder Erwachsene seine PIN selbst fest, die Erwachsenen sollten das also vor den Kindern tun. Ändern lässt sie sich oben rechts unter dem eigenen Namen. Hat jemand seine PIN vergessen, setzt ein anderer Erwachsener sie dort zurück. Nach fünf falschen Versuchen ist eine Minute Pause. Die PIN liegt nur als Prüfsumme in der Datenbank. Sie hält Kinder fern, die herumprobieren, ist aber kein Schutz gegen jemanden, der sich mit Programmierwerkzeugen auskennt.

**Brotbox.** An Schultagen bewerten die Kinder ihre Brotbox mit 1 bis 5 Sternen, auf der Startseite und im Tagesbogen. Unter "Gerichte" steht eine Liste der beliebtesten Brotboxen. Wird der Text einer Brotbox geändert, zählen die alten Sterne nicht mehr für diesen Tag.

**Termine und Abendessen.** Unter „Termine der Familie“ (im Wochenplan unten) tragen die Eltern wiederkehrende Termine ein: wer, an welchen Tagen, von wann bis wann und wann die Person wieder zu Hause ist. Termine können in den bayerischen Schulferien und an Feiertagen pausieren. Gegessen wird um 18:30 Uhr. Kommt jemand später heim, verschiebt sich das Abendessen auf diese Uhrzeit, auf die Viertelstunde aufgerundet, damit alle zusammen essen. Termine, die erst zur Essenszeit beginnen, verschieben nichts, die App zeigt dann „muss um … los“. Im Tagesbogen lässt sich unter „Wer isst mit?“ für einzelne Tage festlegen, wer später kommt oder gar nicht mitisst. Kinder können das nur für sich selbst ändern. Ist an einem Tag ein Erwachsener zwischen 17 und 19 Uhr unterwegs oder wird nach 19 Uhr gegessen, schlägt die App nur Rezepte bis 40 Minuten vor. Isst jemand nicht mit, rechnet die Einkaufsliste mit weniger Portionen. Die Werte stehen am Anfang von `js/termine.js`.

**Vorrat.** Unter „Einkauf > Vorrat: Was haben wir noch?“ steht, was meistens im Haus ist. Neue Einkaufslisten setzen diese Zutaten abgehakt in den Abschnitt „Schon im Haus“, damit nichts doppelt gekauft wird. Ist etwas leer, kommt es mit „Ist leer“ auf die Einkaufsliste der Woche.

**Erinnerungen.** Mit eingerichteten Push-Nachrichten (siehe unten) meldet sich die App selbst. Ohne sie gibt es unter „Aufgaben“ eine Kalenderdatei mit allen Abholterminen. Auf dem Handy geöffnet, landen die Termine im Kalender, der jeweils am Vorabend um 18 Uhr erinnert.

**Einkaufen.** Bei jedem Posten steht, wofür er gedacht ist („für Hackbällchen (Mo), Brotbox (Do)“). War etwas nicht zu bekommen, markiert der Knopf **fehlt** den Posten. Oben erscheint dann, welche Gerichte betroffen sind, und ein Knopf setzt die fehlenden Posten auf den nächsten Einkauf. Die Liste funktioniert auch ohne Netz: Haken und Markierungen werden gespeichert und nachgetragen, sobald das Handy wieder Empfang hat. Dafür muss die App einmal mit Netz geöffnet worden sein.

**Immer wieder.** Unter „Einkauf“ führt „Immer wieder: Milch, Klopapier und Co.“ zu den Dingen, die ihr regelmäßig braucht, unabhängig vom Wochenplan. Ein Tipp setzt einen Eintrag auf die nächste offene Einkaufstour der angezeigten Woche, ein zweiter nimmt ihn wieder herunter. Neue Einträge lassen sich mit Abteilung ergänzen. Beim ersten Öffnen trägt „Typische Dinge eintragen“ eine Startliste ein (Milch, Brot, Heu, Einstreu, Klopapier und Ähnliches).

**Vorabend.** Rezepte können eine Vorbereitung für den Vorabend haben (Fisch auftauen), dazu gibt es pro Tag eine freie Notiz, etwa für die Brotbox. Am Abend vorher steht das im Wochenplan, und um 19 Uhr kommt eine Push-Nachricht an die Eltern.

**Nährwerte.** Jedes Rezept zeigt Brennwert, Fett, gesättigte Fettsäuren, Kohlenhydrate, Zucker, Ballaststoffe, Eiweiß und Salz pro Portion, der Wochenplan den Schnitt der Abendessen. Die App schätzt die Werte aus den Zutaten (Tabelle in `js/naehrwerte.js`), eine Portion ist ein Viertel des Rezepts. Salz zum Abschmecken ist nicht enthalten. Wer Werte von einer Rezeptkarte hat, trägt sie beim Gericht ein, dann gelten diese.

**Ampel.** Mama und Papa sehen bei jedem Abendessen vier Punkte für Fett, gesättigtes Fett, Zucker und Salz (niedrig, mittel, hoch), dazu Marken für viel Eiweiß und viele Ballaststoffe. Der Wochenplan fasst zusammen, wie viele Abendessen viel Eiweiß haben und wo etwas hoch ausfällt. Die Kinder sehen die Ampel nicht. Der Maßstab ist ein Abendessen als Hauptmahlzeit: bis ein Viertel der Tagesmenge eines Erwachsenen niedrig, bis 40 % mittel, darüber hoch. Das sind eigene Grenzen, die offizielle Ampel gilt für verpackte Lebensmittel. Ändern lassen sie sich in `js/naehrwerte.js`.

**Brotbox-Rezepte.** Rezepte der Art „Brotbox-Rezept“ (Energiebällchen, Muffins) stehen unter „Gerichte“ in einem eigenen Abschnitt und kommen nie in den Abendessen-Plan.

**Wochenbilanz.** Ab Freitag zeigt der Wochenplan einen Rückblick: bestes Abendessen, Herz der Kinder, beste Brotbox und die erledigten Aufgaben. Von dort kommen die Eltern direkt zur Auswertung für Claude.

**Tage tauschen.** Im Fenster eines Tages tauscht „Mit anderem Tag tauschen“ das Abendessen mit einem anderen Tag dieser oder der nächsten Woche. Vorabend-Notizen wandern mit, Brotboxen und Essenszeit bleiben am Tag. Vorher weist die App darauf hin, wenn eine Brotbox Reste vom Vortag einplant, Zutaten erst später eingekauft werden, ein langes Rezept auf einem vollen Tag landet oder schon Bewertungen da sind.

**Aufgaben.** Im Bereich „Aufgaben“ sehen die Kinder, was heute ansteht, und haken es ab. Feste Aufgaben sind täglich oder einmal pro Woche fällig, die Tonnen-Aufgabe erscheint am Abend vor jeder Abholung laut `js/abfuhr.js`. Dazu kommen Extra-Aufgaben bei Bedarf. Aufgaben mit 0 Minuten sind Grundaufgaben ohne Bildschirmzeit. Was die Kinder abhaken, wartet auf eure Bestätigung, bei Grundaufgaben ist das abschaltbar. Gemeinsame Aufgaben wechseln auf Wunsch jede Woche zwischen den Kindern. Unter „Aufgaben verwalten“ legt ihr Aufgaben an, ändert Minuten und Zuständigkeit oder pausiert sie.

**Bildschirmzeit.** Bestätigte Minuten landen auf dem Minutenkonto des Kindes, zusätzlich zur Grundzeit. Pro Tag zählt höchstens das Tageslimit, das ihr oben rechts unter „Familie“ pro Kind einstellt. Verdiente Minuten verfallen 72 Stunden nach der Bestätigung (`EXPIRY_HOURS` in `js/aufgaben.js`). Mit „Bildschirmzeit einlösen“ bucht ihr Minuten ab, die ältesten zuerst. Freigeben müsst ihr die Zeit weiterhin am Gerät, etwa über Apple Bildschirmzeit oder Google Family Link.

**Erst die Grundaufgaben.** Minuten für Extra-Aufgaben lassen sich erst bestätigen, wenn die täglichen Grundaufgaben des Tages erledigt sind, also Aufgaben mit 0 Minuten wie Tisch decken (Wochenaufgaben zählen nicht). Abhaken können die Kinder Extra-Aufgaben trotzdem jederzeit. Eine gemeldete Grundaufgabe zählt dafür schon als erledigt.

**Grundaufgaben bestätigen.** Auch Grundaufgaben landen bei euch unter „Zu bestätigen“, mit dem Vermerk „Grundaufgabe“. Lehnt ihr ab, bekommt das Kind eine Nachricht, die Aufgabe gilt wieder als offen und trägt den Vermerk „nicht anerkannt, bitte noch einmal“. Eine bestätigte Grundaufgabe können die Kinder nicht mehr selbst zurücknehmen. Der Wochenbonus wird erst gutgeschrieben, wenn ihr alle Grundaufgaben der Woche bestätigt habt. Abschaltbar unter „Aufgaben verwalten“ mit „Grundaufgaben bestätigen“. Die Kinder sehen ihre offenen Aufgaben für heute ganz oben in der Woche als roten Hinweis, ein Tipp darauf öffnet die Aufgaben. Ist alles erledigt, wird der Hinweis grün.

**Uhrzeiten der Erinnerungen.** Unter „Aufgaben verwalten“ bei „Erinnerungen“ stellt ihr ein, wann die Kinder erinnert werden (erste Erinnerung und die mit Nachdruck) und wann ihr den Stand des Tages bekommt. Zur Wahl stehen halbe Stunden von 14 bis 22 Uhr oder „aus“. Gespeichert in `ep_settings` unter `aufgaben.erinnerung`. Unter „Aufgaben“ stehen die Tagesaufgaben in einem rot umrandeten Kasten „Heute auf jeden Fall“, die Wochenaufgaben getrennt darunter unter „Diese Woche“ mit den Tagen, die bis Sonntag noch bleiben. Am Sonntag rutscht eine offene Wochenaufgabe in den Kasten für heute. Bis dahin steht bei euch „Wartet auf die Grundaufgaben“, und die Push-Nachricht zum Bestätigen kommt erst danach. Mit „Trotzdem“ könnt ihr vorher bestätigen. Die Regel lässt sich unter „Aufgaben verwalten“ abschalten. Wenn ihr verreist seid, gilt sie nicht.

**Abfuhrtermine.** Die Termine der CEB Coburg stehen in `js/abfuhr.js`, im Moment bis Ende 2026. Sobald die Termine für 2027 veröffentlicht sind, dort neue Zeilen anhängen.

**Lieblingsgericht der Woche.** Ab Freitag vergibt jedes Kind ein Herz an das Abendessen der Woche, das ihm am besten geschmeckt hat. Zur Wahl stehen die Gerichte, die bis dahin gegessen wurden. Bis zum Sonntag der Folgewoche lässt sich das Herz noch setzen oder ändern, danach ist die Wahl abgeschlossen. Ein zweiter Tipp auf dasselbe Gericht nimmt das Herz zurück. Im Wochenplan, in der Gerichteliste und in der Auswertung für Claude steht, welches Gericht wie viele Herzen hat. Jedes Herz bringt ein Gericht im Wochenvorschlag um 10 Prozent nach vorn, höchstens um 50 Prozent.

**Schultage.** Die App kennt die bayerischen Schulferien, die gesetzlichen Feiertage in Bayern und den Buß- und Bettag, an dem in Bayern kein Unterricht ist. An diesen Tagen gibt es keine Brotbox und keine Brotbox-Sterne, im Wochenplan steht der Grund dabei. Beim Einfügen eines Plans fallen Brotboxen an schulfreien Tagen weg. Die Ferien stehen in `js/ferien.js` und reichen bis zu den Sommerferien 2028. Für spätere Schuljahre dort neue Zeilen nach den Terminen auf km.bayern.de ergänzen. Die Feiertage rechnet die App für jedes Jahr selbst aus.

**Sterne.** Jede Person bewertet das Abendessen mit 1 bis 5 Sternen, ab dem Tag, an dem es auf dem Plan steht. Ein zweiter Tipp auf denselben Stern nimmt die Bewertung zurück.

**Reihenfolge.** Der Wochenvorschlag rechnet für jedes Gericht Bewertung mal Abstand zum letzten Mal. 5 Sterne zählen doppelt, 3 Sterne einfach, 2 Sterne halb. Gerichte ohne Bewertung zählen einfach. Was in der Vorwoche dran war, pausiert. Rezepte über 60 Minuten landen am Wochenende, je Art gibt es höchstens zwei Gerichte pro Woche.

**Aussortieren.** Liegt der Schnitt unter 2 Sternen und haben mindestens 2 Personen bewertet, verschwindet das Gericht aus allen Vorschlägen. Es bleibt gespeichert und lässt sich unter "Gerichte" wieder aufnehmen. Danach zählt die Regel nur neue Bewertungen. Beide Werte stehen in `js/logic.js` unter `RULE`.

## Push-Nachrichten

Eine kleine Funktion bei Supabase schaut alle fünf Minuten nach, ob etwas ansteht, und schickt dann eine Nachricht aufs Handy:

| Wann | An wen | Nachricht |
| --- | --- | --- |
| Vorabend der Müllabfuhr, ab 18 Uhr | wer mit der Tonne dran ist (ohne Tonnen-Aufgabe: die Eltern) | „Schwarze Tonne rausstellen“. Entfällt, wenn die Aufgabe schon abgehakt ist. |
| Kind meldet eine Aufgabe als erledigt | Eltern | „Kind 1: Spülmaschine ausräumen (+10 Min.)“. Mit der Regel „Minuten erst nach den Grundaufgaben“ erst, wenn die erledigt sind. |
| Vorabend der Müllabfuhr, ab 21 Uhr | Eltern | „Restmüll steht noch nicht draußen“, wenn das zuständige Kind die Tonne noch nicht abgehakt hat. |
| Spülmaschine fertig (von Hand auf Rot oder zur eingestellten Endzeit) | die Kinder der Aufgabe „Spülmaschine ausräumen“ | „Die Spülmaschine ist fertig“. Zwischen 7 und 20:30 Uhr, sonst am nächsten Morgen. Entfällt, wenn sie schon jemand als ausgeräumt gemeldet hat. |
| Stall heute fällig oder überfällig (Stall-Ampel an) | die Kinder der Stall-Aufgabe in dieser Woche | „Heute ist der Stall dran“ oder „Der Stall ist seit 2 Tagen dran“. Einmal am Tag zur ersten Erinnerungszeit der Kinder (Standard 16:30), nicht im Urlaub. Entfällt, wenn schon gemeldet. |
| Kind kauft im Minuten-Shop | Eltern | „Gekauft im Minuten-Shop: Jonas: Abendessen aussuchen für 40 Min.“ |
| Eltern lösen einen Kauf ein oder buchen ihn zurück | das Kind | „Eingelöst: Abendessen aussuchen“ oder „Minuten zurückgebucht“. |
| Sonntag ab 18:30 Uhr | Eltern (im Rückblick abschaltbar) | „Wochenrückblick KW 47“. Öffnet den Rückblick mit Essen, Aufgaben, Lernen und Ausgaben. |
| Mama oder Papa stellen einen Mülleimer in der Küche auf Rot | die Kinder der Aufgabe „Müll aus der Küche rausbringen“ | „Plastikmüll ist voll“. Zwischen 7 und 20:30 Uhr, sonst am nächsten Morgen. Entfällt, wenn ihn schon jemand als rausgebracht gemeldet hat. |
| Jemand schreibt etwas auf die Einkaufsliste | die anderen Erwachsenen (abschaltbar) | „Kind 1: Brezeln, Spülmittel“. Zwischen 21:30 und 7 Uhr wartet die Nachricht bis zum Morgen. |
| Eltern bestätigen oder lehnen ab | das Kind | „+10 Minuten. Papa hat … bestätigt.“ Bei Grundaufgaben kommt nur die Ablehnung. |
| 16:30 Uhr (einstellbar), wenn Aufgaben für heute offen sind | das Kind | „Heute noch eine Aufgabe: Tisch decken.“ Gemeint ist alles aus dem Kasten „Heute auf jeden Fall“: Tagesaufgaben, die Tonne und sonntags die offenen Wochenaufgaben. |
| 19 Uhr (einstellbar), wenn davon noch etwas offen ist | das Kind | „Noch eine Aufgabe offen, bitte jetzt erledigen.“ Mit der Regel „Erst die Grundaufgaben“ steht dabei, dass es erst danach Minuten gibt. |
| 20 Uhr (einstellbar) | Eltern | Was bei welchem Kind noch offen ist und wie viele Aufgaben auf eure Bestätigung warten, auch von den Vortagen. Kommt nur, wenn etwas offen ist. |
| Freitag ab 17 Uhr | Kinder ohne Herz für die Woche | „Herz der Woche“ |
| Werktags 7 Uhr, am Wochenende 8:30 Uhr | alle, abschaltbar | Morgenüberblick. Kinder: ihre offenen Aufgaben und das Abendessen. Eltern: Abendessen mit Kochbeginn, Einkauf des Tages (mit Knopf „Ich gehe einkaufen“), wartende Bestätigungen und wie viele Aufgaben die Kinder noch offen haben. Termine stehen bewusst nicht drin. |
| Abends nach dem Essen | wer mitgegessen und noch nicht bewertet hat, abschaltbar | „Wie hat es geschmeckt? Heute gab es … Tippe hier und vergib deine Sterne.“ Kinder etwa eine Stunde nach dem Essen, spätestens 20:15 Uhr, Erwachsene nach 90 Minuten. Ein Tipp öffnet den Tag mit den Sternen. |
| Vorabend, ab 19 Uhr | Eltern | „Für morgen vorbereiten: Seelachsfilet aus dem Tiefkühler in den Kühlschrank legen.“ |
| Einkaufstag, ab 7 Uhr | Eltern, solange auf der Liste noch etwas offen ist | „Heute ist Einkauf … Wer übernimmt?“ Auf Android mit Knopf „Ich gehe einkaufen“. Trägt sich jemand ein, bekommt der andere Elternteil „Papa geht einkaufen“. |
| Essenszeit minus Kochdauer des Gerichts | Eltern, die mitessen (abschaltbar unter „Benachrichtigungen auf diesem Gerät“) | „Zeit zum Kochen: Pizza … Dauert etwa 70 Minuten, gegessen wird um 18:30 Uhr.“ |

Den Einkaufstag legen Mama oder Papa unter „Einkauf“ direkt unter der Überschrift der Liste fest. Dort steht auch der Haken „Ich gehe einkaufen“. Jede Nachricht geht nur einmal raus. Lehnt der Push-Dienst von Apple oder Google eine Nachricht nur vorübergehend ab (Überlastung, Netz), versucht die Funktion es beim nächsten Lauf fünf Minuten später noch einmal. Fällige Erinnerungen gehen vor Sicherung und Wochenplan raus, damit sie nicht warten müssen. Unter „Benachrichtigungen auf diesem Gerät“ steht, wann die letzte Nachricht an dieses Gerät gegangen ist oder warum nicht. Aufklappbar darunter stehen die letzten zehn Nachrichten mit Uhrzeit und Ergebnis (Spalten `last_ok_at`, `last_status`, `last_error` und `history` in `ep_push_subs`, schema.sql neu ausführen). „An den Push-Dienst übergeben“ heißt: Apple oder Google haben die Nachricht angenommen. Erscheint sie dann nicht auf dem Handy, liegt es am Handy. Wer sich in der App abmeldet, bekommt keine mehr.

**Wenn Nachrichten auf dem iPhone fehlen:** In den iOS-Einstellungen unter Mitteilungen > Familienplan prüfen, ob Mitteilungen erlaubt sind. Ein Fokus (Nicht stören, Schlafen, Arbeit) hält Nachrichten zurück, außer die App steht dort unter „Erlaubte Apps“. Steht in der App „Dieses Gerät ist beim Server nicht angemeldet“, Benachrichtigungen einmal aus- und wieder einschalten. Die Uhrzeiten stehen in `supabase/functions/push/index.ts` unter `dueMessages`.

### Einrichten, ohne Kommandozeile

1. **Tabellen.** `supabase/schema.sql` noch einmal komplett im SQL Editor ausführen. Das legt die drei neuen Tabellen an und lässt alles Bestehende stehen.
2. **Schlüssel erzeugen.** `push-einrichten.html` im Browser öffnen, am einfachsten nach dem nächsten Hochladen unter `https://deine-app.netlify.app/push-einrichten.html`. Die Seite erzeugt die Schlüssel im Browser, nichts davon wird verschickt. Seite offen lassen, bis alles übertragen ist.
3. **Öffentlicher Schlüssel in die App.** Die angezeigte Zeile `vapidPublicKey: '…',` in `js/config.js` einsetzen und den Ordner neu zu Netlify hochladen.
4. **Funktion anlegen.** Im Supabase-Dashboard unter **Edge Functions** eine neue Funktion über den Editor anlegen, Name `push`. Den Inhalt von `supabase/functions/push/index.ts` komplett hineinkopieren und veröffentlichen (Deploy).
5. **JWT-Prüfung aus.** In den Einstellungen der Funktion `push` die JWT-Prüfung („Verify JWT“) ausschalten. Die Funktion prüft selbst: Der Zeitplan weist sich mit dem `CRON_SECRET` aus, die Testnachricht mit der Anmeldung der Familie.
6. **Secrets.** Unter **Edge Functions > Secrets** vier Einträge anlegen: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `CRON_SECRET` aus der Hilfsseite, dazu `VAPID_SUBJECT` mit der Adresse eurer App bei Netlify.
7. **Zeitplan.** Auf der Hilfsseite die Supabase-Adresse eintragen, den erzeugten SQL-Befehl kopieren und im SQL Editor ausführen. Er schaltet die Erweiterungen `pg_cron` und `pg_net` ein und ruft die Funktion alle fünf Minuten auf. Eine Vorlage zum Nachlesen steht in `supabase/cron.sql`.
8. **Auf jedem Handy einschalten.** Familienplan öffnen, oben rechts auf den eigenen Namen tippen und unter „Benachrichtigungen auf diesem Gerät“ auf **Einschalten**. Danach **Testnachricht** antippen.

**iPhone und iPad.** Push gibt es dort ab iOS 16.4 und nur für Apps auf dem Home-Bildschirm: in Safari „Teilen“, dann „Zum Home-Bildschirm“, die App von dort öffnen und erst dann einschalten. Im normalen Safari-Tab fehlt der Knopf, die App erklärt das an der Stelle.

**Wenn nichts ankommt.** Im Dashboard unter **Edge Functions > push > Logs** stehen Fehler im Klartext, etwa ein fehlendes Secret. Die Antworten der letzten Aufrufe zeigt im SQL Editor `select status_code, content, created from net._http_response order by created desc limit 10;`. Steht dort `{"error":"Nicht angemeldet."}`, stimmt das `CRON_SECRET` im Zeitplan nicht mit dem in den Secrets überein. Meldet die Funktion einen Fehler beim Datenbankzugriff, im Projekt einen Secret Key anlegen und ihn zusätzlich als Secret `SERVICE_KEY` eintragen.

**Neue Abfuhrtermine.** Die Funktion liest die Termine aus der Tabelle `ep_abfuhr`. Die App trägt dort beim Start alles aus `js/abfuhr.js` ein. Neue Termine also wie bisher in `js/abfuhr.js` ergänzen und hochladen, einmal die App öffnen, fertig.

## Wochenplan mit Claude

Einmal pro Woche (Standard: freitags ab 12 Uhr) schreibt Claude einen Entwurf für die nächste Woche: Abendessen, Brotboxen, neue Rezepte und Einkaufsliste mit den Angeboten von Aldi Süd und Lidl. Ihr bekommt eine Push-Nachricht, seht euch den Entwurf an, tauscht bei Bedarf einzelne Tage und gebt ihn frei. Erst dann gilt er.

**So läuft es ab.** Die Push-Funktion bei Supabase stellt die Anfrage über die Claude-Schnittstelle (Message Batches API) in zwei Schritten: Zuerst sucht Claude auf aldi-sued.de und lidl.de die Angebote der Woche, dann schreibt Claude den Plan in einem festen Format. Die Funktion prüft den Entwurf (alle sieben Tage belegt, keine ausgeschlossenen Lebensmittel, keine aussortierten oder gesperrten Gerichte, Brotboxen nur an Schultagen). Hat der Entwurf Fehler, bekommt Claude einen zweiten Versuch mit den Fehlern. Meist liegt der Entwurf nach weniger als einer Stunde vor.

**Was mitgeschickt wird.** Eure Regeln (Gerichte › Unsere Regeln), der Wunsch für die nächste Woche, die Auswertung mit Sternen, Herzen und Brotbox-Bewertungen, Schulferien, Essenszeiten und wer an welchem Abend fehlt. Die App legt diese Angaben in der Tabelle `ep_settings` ab, sobald jemand sie öffnet. Namen der Familienmitglieder gehen so mit, wie sie in der App stehen.

**Ist die Woche schon geplant** (zum Beispiel von Hand oder per Import), entsteht kein automatischer Entwurf. Über „Entwurf für KW … erstellen“ unter „Gerichte“ geht es jederzeit auf Knopfdruck.

**Einrichten.**
1. Auf platform.claude.com ein Konto anlegen, unter Billing Guthaben aufladen und unter Spend Limits ein Monatslimit setzen (zum Beispiel 5 Dollar).
2. Unter API keys einen Schlüssel erzeugen.
3. Bei Supabase unter Edge Functions › Secrets einen Eintrag `ANTHROPIC_API_KEY` mit diesem Schlüssel anlegen. Der Schlüssel gehört nirgendwo sonst hin, vor allem nicht in `js/config.js`.
4. `supabase/schema.sql` ausführen, die Funktion `push` aktualisieren und die App hochladen.
5. Einmal die App als Papa oder Mama öffnen. Unter „Gerichte“ steht „Wochenplan mit Claude“. Mit „Entwurf für KW … erstellen“ lässt es sich sofort ausprobieren.

**Kosten.** Mit Claude Sonnet 5.5 grob 10 bis 20 Cent pro Entwurf (Batch-Preise sind halb so hoch wie normale Anfragen), dazu 1 Cent pro Websuche. Das Modell lässt sich unter „Unsere Regeln“ ändern.

**Wenn etwas schiefgeht.** Die App zeigt den Fehler im Wochenplan an, und es kommt eine Push-Nachricht. In der Tabelle `ep_ai_runs` stehen alle Entwürfe mit Status, Fehlertext und Verbrauch (`usage`). „Woche vorschlagen“ funktioniert immer auch ohne Claude.

## Schnelles Mittagessen

Unter „Woche“ steht unter dem heutigen Tag der Knopf „Schnelles Mittagessen“. Personenzahl, verfügbare Zeit (10 bis 30 Minuten) und auf Wunsch ein Stichwort eingeben. Claude schlägt zwei bis drei gesunde Gerichte vor, aus dem, was laut Vorrat und den Einkäufen der letzten Tage im Haus ist, bevorzugt mit dem, was weg muss. Zutaten fürs Abendessen heute und morgen bleiben unangetastet. Mit Kochmodus. Fragt ein Kind, sind die Vorschläge so einfach, dass es sie allein machen kann. Kosten: ein Bruchteil eines Cents.

## Kosten pro Gericht und Einkaufsmodus

- **Kosten pro Gericht:** Jeden Sonntag schätzt die Push-Funktion, was die Zutaten jedes Gerichts kosten, mit euren Preisen aus den Kassenzetteln (sonst übliche Discounter-Preise), nur für den verbrauchten Anteil einer Packung. Die Gerichte-Liste zeigt „etwa 2,40 € pro Portion“, die Sortierung „Günstig“ ordnet danach, und Claude nutzt die Werte, um teure Wochen auszugleichen. „Jetzt schätzen“ geht auch sofort. Kosten: etwa 1 bis 2 Cent pro Schätzung.
- **Einkaufsmodus:** Oben in der Einkaufsliste. Der Bildschirm bleibt an, die Häkchen und Schrift werden größer, Erledigtes verschwindet. Beim Wechsel in einen anderen Bereich endet der Modus.
- **Kosten der Woche:** Unter dem Wochenplan steht, was die geplanten Abendessen etwa kosten (nach Essern und Gästen), und was vom Monatsbudget im Haushaltsbuch noch übrig ist.
- **Saison und Region:** Claude bevorzugt Obst und Gemüse, das in Franken gerade Saison hat oder als Lagerware aus der Region kommt. In der Einkaufsliste steht dann „Saison“ dabei. Abschalten unter Gerichte > Unsere Regeln.
- **Alte Listen räumen sich auf:** Jeden Sonntag nach der Datensicherung löscht die Push-Funktion Einkaufslisten, die älter als acht Wochen sind. So bleibt die App beim Start schnell.
- **Offene Posten wandern mit:** Was auf der Liste der Vorwoche nicht abgehakt ist, steht ab Montag auf der Liste der neuen Woche, mit dem Vermerk „aus KW …“, auf der nächsten offenen Einkaufstour. Steht derselbe Artikel schon drauf, wird nichts doppelt angelegt. Übernommene Posten bleiben auch stehen, wenn die Liste aus dem Wochenplan neu erstellt wird, und lassen sich mit dem Kreuz löschen.

## Festtage, Auswertung und Wunschzettel

- **Festtage planen:** Unter „Woche“ bei den Kacheln „Planen“. Anlass, Datum, was es geben soll (zum Beispiel „Fondue wie jedes Jahr“), Zahl der Erwachsenen und Kinder und Besonderheiten eingeben. Claude liefert Menü, Mengen pro Erwachsenem, pro Kind und gesamt, vier bis sechs Dips mit Rezept, die übrigen Rezepte, einen Zeitplan, Ideen zum Mithelfen für die Kinder und eine Einkaufsliste. „Auf die Einkaufsliste“ verteilt sie auf einen Festeinkauf für Haltbares drei Tage vorher und einen für Frisches am Vortag. „In den Wochenplan“ trägt das Festessen am Tag ein, mit Kochmodus und Gästen. Der Wochenplan von Claude lässt diesen Tag dann frei. Dauer etwa eine Minute, Kosten wenige Cent.
- **Was mögen wir?:** Unter „Gerichte“ unten. Familienlieblinge, Herzen, meistgekochte Gerichte, für jeden die eigenen Lieblinge und Flops, wer am strengsten bewertet, pro Jahr.
- **Wunschzettel für die App:** In der Hilfe und im Familie-Fenster. Jeder notiert, was nervt oder fehlt. Die Eltern kopieren die offene Liste in den Chat mit Claude und haken Umgesetztes ab.

## Ersatz, Jahresüberblick und Hilfe

- **Ersatz?:** Ist ein Posten als „fehlt“ markiert, schlägt Claude mit „Ersatz?“ zwei bis drei Alternativen vor, passend zu den Gerichten, für die er gedacht war, und zu euren Ausschlüssen. „Nehmen“ ersetzt den Posten auf der Liste. Den Hinweis fürs Rezept (zum Beispiel „am Vorabend auftauen“) zeigt die App auf Wunsch am betreffenden Tag unter „Heute anders“ und im Kochmodus. Kosten: ein Bruchteil eines Cents.
- **Jahresüberblick:** Im Haushaltsbuch unten. Ausgaben pro Monat mit Budget-Strich, Kategorien mit Anteil am Jahr und der Bio-Anteil bei Lebensmitteln, im Vergleich zum Vorjahr.
- **Hilfe:** Das Fragezeichen oben rechts erklärt kurz, was die App kann, für Kinder und für Eltern getrennt.

## Kochmodus, Reihenfolge im Laden, Reste und Datensicherung

- **Kochmodus:** Im Tagesfenster und bei jedem Gericht. Erst die Zutaten zum Abhaken (mit Gästen hochgerechnet), dann ein Schritt pro Seite in großer Schrift. Steht im Schritt eine Zeit ab einer Minute („20 Min./100 °C“), startet ein Knopf den Timer. Er piept und vibriert, wenn er abgelaufen ist, auch wenn ihr weiterblättert. Der Bildschirm bleibt an, solange der Kochmodus offen ist.
- **Reihenfolge im Laden:** Unter „Einkauf“ unten. Für Aldi Süd und Lidl getrennt legt ihr fest, in welcher Reihenfolge ihr durch die Abteilungen lauft. Die Einkaufsliste folgt dieser Reihenfolge.
- **Was muss weg?:** Unter „Woche“ unten. Reste, Angebrochenes oder Gartenernte eintragen, das können auch die Kinder. Claude verplant es im nächsten Entwurf und kauft es nicht noch einmal. Beim Freigeben verschwinden die eingeplanten Einträge. Beim Planen von Hand zeigt „Gericht wählen“, welche Gerichte etwas davon verbrauchen.
- **Datensicherung:** Jeden Sonntag ab 3 Uhr sichert die Push-Funktion alle Daten als Datei im privaten Supabase-Speicher „sicherung“, die letzten 8 bleiben erhalten. Im Familie-Fenster lassen sie sich anzeigen, herunterladen und auf Knopfdruck neu anlegen. Zum Wiederherstellen die Datei an Claude schicken. Der Speicher entsteht mit schema.sql.

## Wunschessen, Gäste, Vorrat und Siri

- **Wunschessen:** Unter „Aufgaben“ wünscht sich jedes Kind ein Gericht für die nächste Woche, aus der Sammlung oder als eigene Idee. Die Eltern sehen die Wünsche im Wochenplan. Claude baut pro Woche einen Wunsch ein, abwechselnd zwischen den Kindern, und schreibt für neue Ideen ein Rezept. Beim Freigeben merkt sich die App, wessen Wunsch dran war.
- **Gäste:** Im Tagesfenster unter „Wer isst mit?“ tragen die Eltern Gäste ein. Rezept und neu erstellte Einkaufsliste rechnen die Mengen für den Tag hoch, Claude berücksichtigt sie beim Plan.
- **Vorrat automatisch:** Kassenzettel setzen gekaufte Vorräte auf „da“, mit Kaufdatum. Wurde etwas vor über vier Wochen gekauft und seitdem in geplanten Gerichten verwendet, fragt der Vorrat „Noch da?“. Unter „Einkauf“ steht dann „Vorrat: 2 Sachen prüfen“.
- **Preisgedächtnis:** Im Haushaltsbuch zeigt „Preisgedächtnis“, was ihr wo bezahlt habt, mit dem günstigeren Markt markiert. Claude bekommt diese Preise beim Wochenplan, prüft Angebote daran und schätzt die Kosten des Einkaufs. Die Schätzung steht im Entwurf.
- **Per Siri ergänzen:** Unter „Einkauf“ erzeugen die Eltern einen Familien-Schlüssel und richten auf jedem iPhone einen Kurzbefehl aus fünf Aktionen ein (Nach Eingabe fragen, URL codieren, Text, Inhalte von URL abrufen, Text sprechen). Die persönliche Adresse zum Kopieren steht im Bogen. „Hey Siri, Einkaufsliste“, dann zum Beispiel „Milch, Brot und Eier“. Der Schlüssel erlaubt nur das Ergänzen der Einkaufsliste und lässt sich jederzeit erneuern.

## Rezepte und Zutaten per Foto

- **Rezept aus Foto** (unter „Gerichte“): Foto oder Screenshot eines Rezepts, etwa aus Cookidoo, von einer Kochbox-Karte oder aus dem Kochbuch, bis zu vier Fotos. Claude rechnet auf 4 Portionen um, sortiert die Zutaten nach Abteilungen, übernimmt Thermomix-Angaben in die Schritte und trägt Nährwerte ein (vom Rezept oder geschätzt). Vor dem Speichern seht ihr das Rezept, danach ist es ein normales Gericht der Sammlung.
- **Zutaten aus Foto** (unter „Einkauf“): Screenshot einer Zutatenliste oder einer anderen Einkaufsliste. Vor dem Übernehmen wählt ihr aus, was auf die Liste soll. Abgewählt ist schon, was man meist im Haus hat, was laut Vorrat da ist und was schon auf der Liste steht. Dazu wählt ihr den Einkauf, „wofür“ und den Markt.
- **Mehrere Zeilen einfügen:** Werden mehrere Zeilen auf einmal ins Ergänzen-Feld eingefügt (etwa per Texterkennung aus einem Screenshot kopiert), öffnet sich dieselbe Auswahl. Das geht ohne Claude und kostet nichts.

Foto-Auswertungen laufen über die Push-Funktion und kosten jeweils etwa 1 bis 3 Cent. Die Fotos werden nicht gespeichert.

## Haushaltsbuch

Der Bereich „Ausgaben“ zeigt pro Monat, was die Familie ausgegeben hat: Gesamtbetrag, Vergleich zum Vormonat, Summen nach Kategorie und nach Markt und die Liste der Kassenzettel. Alle sehen die Zahlen, eintragen und ändern können nur die Eltern.

- „Kassenzettel fotografieren“ öffnet Kamera oder Fotos. Lange Zettel gern in zwei bis vier Fotos von oben nach unten, alle auf einmal auswählen.
- Die Push-Funktion schickt die Fotos an Claude und bekommt Markt, Datum, Betrag und alle Posten mit Kategorie zurück. Das dauert meist 10 bis 30 Sekunden und kostet etwa 1 Cent. Die Fotos werden nicht gespeichert.
- Vor dem Speichern prüft ihr alles und könnt Namen, Preise und Kategorien ändern oder Posten ergänzen. Weicht die Summe der Posten vom Betrag ab, zeigt die App das an. Der Unterschied zählt dann als „Sonstiges“.
- Ändert ihr eine Kategorie, merkt sich die App das (bis zu 300 Artikel) und sagt es Claude beim nächsten Zettel.
- Offene Posten der Einkaufsliste, die auf dem Zettel stehen, schlägt die App zum Abhaken vor.
- Unter „Budget und Kategorien“ stellt ihr ein Monatsbudget ein (mit Ampel und ab dem 10. mit Hochrechnung) und passt die Kategorien an.
- „Ohne Foto eintragen“ geht auch, etwa für den Bäcker.

Die Kassenzettel liegen in der Tabelle ep_receipts. Sie entsteht, wenn ihr supabase/schema.sql noch einmal ausführt.

## Zwei Märkte: Aldi Süd und Lidl

Bevorzugt wird bei Aldi Süd in Coburg-Creidlitz eingekauft. Lidl in Coburg-Ketschendorf kommt dazu, wenn etwas dort im Angebot deutlich günstiger oder besser ist (zum Beispiel Bio) oder es nur dort zu haben ist. Für eine Kleinigkeit ohne echten Vorteil schickt Claude euch nicht extra zu Lidl. Angebote, die nur mit der App Lidl Plus gelten, stehen mit diesem Hinweis in der Menge.

- In der Einkaufsliste steht pro Einkauf zuerst der Block „Aldi Süd“ und darunter, gelb markiert, „Lidl“. Gibt es nichts bei Lidl, sieht die Liste aus wie bisher.
- Eigene Einträge lassen sich beim Ergänzen Aldi oder Lidl zuordnen.
- War etwas nicht zu bekommen („fehlt“), setzt „Bei Lidl versuchen“ den Posten auf die Lidl-Liste, umgekehrt „Bei Aldi versuchen“.
- Die Push-Nachricht zum Einkauf nennt, wie viele Posten bei Lidl liegen.
- In den Regeln für Claude lässt sich Lidl abschalten, dann plant Claude wieder nur mit Aldi.
- Die Websites zeigen fast nur bundesweite Angebote. Die Filialen sind angegeben, damit Claude regionale Angebote mitnimmt, wenn es welche gibt. Ob ein Angebot in der Filiale vorrätig ist, zeigt sich erst im Laden.

Für den Markt braucht die Tabelle ep_shopping die Spalte shop. Sie entsteht, wenn ihr supabase/schema.sql noch einmal im SQL Editor ausführt. Bis dahin funktioniert die App weiter, merkt sich den Markt aber nicht.

## Urlaub und Tage auswärts

Unter „Woche“ steht bei den Kacheln „Planen“ die Kachel „Urlaub und auswärts“. Dort tragen die Eltern einen Zeitraum mit Bezeichnung ein, zum Beispiel „Skiurlaub“ vom 25. bis 29.11. oder einen einzelnen Abend bei Freunden.

- An diesen Tagen plant die App kein Abendessen und keine Brotbox, weder „Woche vorschlagen“ noch Claude. Ist die ganze Woche Urlaub, startet Claude für sie keinen Entwurf.
- Sind dort schon Gerichte eingeplant, fragt die App, ob sie herausgenommen werden sollen. Die Einkaufsliste der Woche lässt sich danach unter „Einkauf“ neu berechnen.
- Es kommen keine Erinnerungen zum Kochen, zum Bewerten und am Vorabend.
- Mit dem Haken „Wir sind verreist“ pausieren außerdem die festen Aufgaben der Kinder, die Tonnen-Erinnerung und der Morgenüberblick. Ohne Haken (etwa beim Essen bei Oma) läuft alles andere normal weiter.
- Einkaufserinnerungen bleiben, falls vor der Abreise noch eingekauft wird.

Gespeichert wird das in der Tabelle ep_settings unter dem Schlüssel „urlaub“, eine neue Tabelle braucht es nicht.

## Eigene Rezepte

Unter **Gerichte > Eigenes Rezept eintragen** (nur Erwachsene). Zutaten so eintragen, wie sie im Rezept stehen, eine pro Zeile: `200g Mehl`, `1/2 TL Salz`, `1 1/2 Tassen Milch`, `3 Eier`, `1 Pck. Backpulver`. Ist das Rezept für mehr oder weniger Personen, die Zahl oben anpassen, die App rechnet auf 4 Personen um. Die Abteilung für die Einkaufsliste errät die App aus dem Namen. Gewürze, Öl und Zeilen ohne Menge kommen nicht auf die Liste. Bei der Zubereitung werden Nummern wie `1.` oder `2)` entfernt.

Der Haken **Lieblingsgericht der Familie** lässt das Gericht im Wochenvorschlag etwa ein Drittel öfter drankommen (`FAVORITE_BONUS` in `js/logic.js`). Die Sterne wirken zusätzlich, ein schlecht bewertetes Lieblingsgericht fliegt also trotzdem raus.

Mehrere Rezepte auf einmal: Rezepte formlos an Claude schicken, Claude macht daraus einen Block für **Plan einfügen**.

## Auswertung für Claude

Unter **Familie (oben rechts auf den eigenen Namen tippen) > Von Hand mit Claude im Chat > Auswertung erstellen** (nur Erwachsene) fasst die App alles zusammen: Gerichte mit Häufigkeit und Sternen pro Person, jedes bisherige Abendessen mit den Sternen, die Brotboxen mit den Sternen der Kinder, Lieblingsgerichte und was schon geplant ist. **Auswertung kopieren** legt den Text in die Zwischenablage, im Chat mit Claude einfügen. PINs und Zugangsdaten sind nicht enthalten.

## Neue Woche von Claude übernehmen

Unter **Familie > Von Hand mit Claude im Chat > Plan einfügen** nimmt die App einen Wochenplan als Textblock an. Bitte Claude darum mit dem Satz "Gib mir den Wochenplan als Import für die Essensplan-App". Das Format:

```json
{
  "week_start": "2026-11-23",
  "dishes": [
    {
      "name": "Kürbissuppe mit Brot",
      "category": "vegan",
      "duration_min": 30,
      "tags": ["Thermomix"],
      "note": "",
      "favorite": false,
      "ingredients": [[1, "", "Hokkaido-Kürbis", "obst"], [400, "ml", "Bio-Kokosmilch", "vorrat"], "Salz, Pfeffer"],
      "steps": ["Kürbis würfeln.", "20 Min., 100 °C, Stufe 1 kochen und pürieren."]
    }
  ],
  "plan": [
    { "day": "2026-11-23", "dish": "Kürbissuppe mit Brot", "lunchbox": "Käsebrot, Apfel", "prep": "Brot für die Brotbox auftauen." }
  ],
  "shopping": [
    { "label": "Hokkaido-Kürbis", "qty": "1 Stück", "category": "obst", "trip": "Einkauf", "due": "2026-11-21", "purpose": "Kürbissuppe (Mo)" }
  ]
}
```

- `category` beim Gericht: `rind`, `gefluegel`, `fisch`, `schwein`, `vegan`, `veggie`, `gemischt`.
- Zutat: `[Menge, Einheit, Name, Abteilung]`. Abteilungen: `fleisch`, `kuehl`, `obst`, `tk`, `brot`, `vorrat`, `sonst`. Eine Zeile als reiner Text ohne Menge gilt als Gewürz und kommt nicht auf die Liste.
- `dish` im Plan ist der Name oder die Kennung eines Gerichts. Bekannte Gerichte müssen nicht noch einmal unter `dishes` stehen.
- Fehlt `shopping`, rechnet die App die Liste aus den Zutaten.
- Beim Gericht optional: `prep` (Vorbereitung am Vorabend), `nutrition` (eigene Nährwerte pro Portion mit `kcal`, `fat`, `sat`, `carbs`, `sugar`, `fiber`, `protein`, `salt`), `pieces` (Stückzahl bei Brotbox-Rezepten), `pause_until`.
- Beim Einkaufsposten optional: `due` (Einkaufstag) und `purpose` (wofür). Fehlt `purpose`, errät die App den Zweck aus dem Wochenplan.
- Ergänzungen: Ein Gericht ohne `ingredients` und `steps` ändert nur die genannten Felder eines vorhandenen Gerichts. Ein Tag nur mit `day` und `prep` ändert nur die Notiz für den Vorabend.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html`, `css/app.css` | Seite und Gestaltung |
| `js/config.js` | Supabase-Zugang |
| `js/app.js` | Oberfläche |
| `js/logic.js` | Datum, Statistik, Bewertungsregel, Wochenvorschlag, Einkaufsliste |
| `js/store.js` | Speicher: Supabase oder Demo-Modus |
| `js/seed.js` | Startdaten |
| `js/ferien.js` | Bayerische Schulferien |
| `js/aufgaben.js` | Aufgaben, Zuständigkeit, Minutenkonto |
| `js/abfuhr.js` | Abfuhrtermine der Mülltonnen |
| `js/termine.js` | Termine, Essenszeit, wer mitisst |
| `js/push.js`, `sw.js` | Push-Nachrichten auf dem Gerät und die Fassung der App für den Betrieb ohne Netz |
| `js/naehrwerte.js` | Nährwerttabelle und Berechnung pro Portion |
| `js/planer.js` | Wochenplan mit Claude: Regeln, Kontext, Entwürfe |
| `js/rueckblick.js` | Auswertung für den Wochenrückblick |
| `js/neu.js` | Einträge für „Was ist neu?“ nach einem Update |
| `push-einrichten.html` | Hilfsseite: erzeugt die Schlüssel und den Zeitplan |
| `supabase/schema.sql` | Tabellen und Zugriffsregeln |
| `supabase/functions/push/index.ts` | Supabase-Funktion, die die Nachrichten verschickt |
| `supabase/cron.sql` | Vorlage für den Zeitplan |

Die Schrift Barlow wird von Google Fonts geladen, die Supabase-Bibliothek von jsDelivr.

## Zurückholen, Vorschau und Abfuhrtermine

- **Erinnerung an die Freigabe:** Liegt der Entwurf für die nächste Woche am Freitag um 19 Uhr noch ungeprüft da, bekommen die Eltern eine Push-Nachricht, am Samstag ab 7:30 Uhr noch einmal. Ohne Freigabe gibt es keine Einkaufsliste für den Großeinkauf.
- **Vorschau:** Bevor ein Entwurf von Claude, ein eingefügter Plan oder eine Sicherung übernommen wird, zeigt die App, welche Tage, Rezepte und Einkaufslisten sich ändern. Rot markiert ist, was verloren gehen würde (ein Tag wird leer, ein Rezept verliert Zutaten oder Schritte, Bewertungen oder abgehakte Posten verschwinden).
- **Zurückholen:** Im Familie-Fenster unter „Datensicherung“ bei einer Sicherung auf „Zurückholen“ tippen. Dann einzelne Rezepte (vorausgewählt ist, was seitdem verloren ging) und auf Wunsch den Plan einer Woche wählen. Bewertungen und Einkaufslisten bleiben unberührt.
- **Abfuhrtermine:** Die festen Termine stehen in js/abfuhr.js. Neue Termine lassen sich in der App hochladen: auf abfuhrkalender.ceb-coburg.de die Kalenderdatei (.ics) laden und im Familie-Fenster oder unter „Aufgaben“ hochladen. Erkannt werden Restmüll, Bio und Gelb, Papier wird übergangen. Drei Wochen vor dem letzten bekannten Termin erscheint ein Hinweis.
- **Festtage wie letztes Jahr:** Unter „Festtage“ stehen vergangene Feste mit dem Knopf „Für … übernehmen“. Menü, Dips, Mengen und Einkaufsliste werden übernommen, das Datum rückt ein Jahr weiter.

## Wochenbonus, Kosten pro Einkauf und Claude-Kosten

- **Wochenbonus:** Hat ein Kind an jedem Tag der Woche alle Grundaufgaben erledigt (Aufgaben ohne Minuten, täglich), schreibt die App am Sonntag Extra-Minuten gut, voreingestellt 30. Einstellbar oder abschaltbar unter Aufgaben > Aufgaben verwalten. Tage im Urlaub und Tage ohne Grundaufgaben zählen nicht, es braucht aber mindestens drei Tage mit Grundaufgaben. Der Bonus zählt nicht zum Tageslimit und verfällt wie alle Minuten nach 72 Stunden. Die Kinder sehen unter „Aufgaben“ sieben Punkte für die Woche.
- **Kosten pro Einkauf:** Über jeder Tour der Einkaufsliste steht eine grobe Schätzung, wenn für mindestens drei Posten (und ein knappes Drittel der Liste) Preise aus den Kassenzetteln der letzten 120 Tage bekannt sind. Gerechnet wird eine Packung pro Posten, bei „2 Packungen“ oder „3 Stück“ entsprechend mehr.
- **Claude-Kosten:** Die Push-Funktion zählt bei jeder Anfrage an Claude die Tokens und rechnet sie mit der Preisliste von Anthropic in US-Dollar um (Batches zum halben Preis, Websuche 1 Cent pro Suche). Die Summe pro Monat und Art steht im Familie-Fenster. Ändern sich die Preise, stehen sie in `PRICES` in der Push-Funktion.
- **Prüfungen:** Im Ordner `tests` liegen die Prüfskripte, mit denen jedes Update vor der Auslieferung getestet wird (`sh tests/run.sh`).

## Optik

- **Dunkles Design:** Die App folgt der Einstellung des Handys (hell oder dunkel). Kopfzeile, Knöpfe und Kalenderblätter bleiben petrolfarben.
- **Ruhigere Einkaufsliste:** Der Knopf „fehlt“ erscheint nur im Einkaufsmodus. Zu Hause bleibt die Liste übersichtlich.
- **Erklärungen hinter dem „i“:** Längere Hinweise (Gerichte, Nährwerte, Minutenkonten) stehen hinter einem kleinen „i“ neben der Überschrift.

- **Angebote mit Datum:** Claude sucht die Angebote, die an den beiden Einkaufstagen (Samstag vor der Woche, Mittwoch) im Laden gelten, und notiert, ab wann sie gelten. Ein Angebot kommt nur auf eine Tour, wenn es am Einkaufstag schon gilt. Auf der Liste steht dann zum Beispiel „Angebot ab 13.11.“. Die Push-Funktion prüft das nach und lässt Claude nachbessern, wenn ein Angebot erst später beginnt.
- **Feiertage beim Einkauf:** Fällt der Großeinkauf (Samstag) oder der Frischeinkauf (Mittwoch) auf einen Tag, an dem in Coburg die Märkte zu sind, rückt er auf den letzten offenen Tag davor. Den Großeinkauf legt die App nie auf Heiligabend oder Silvester, weil dort mittags Schluss ist. Beispiel: Für die Woche ab 28.12.2026 ist der Großeinkauf am Mi 23.12., der Entwurf von Claude kommt dann schon am Mo 21.12. Festeinkäufe rücken genauso. Wer einen Einkaufstag von Hand auf einen Feiertag legt, bekommt einen Hinweis.
- **Notizen fürs nächste Mal:** Unter jedem Rezept und am Ende des Kochmodus lässt sich notieren, was beim nächsten Mal besser wäre. Die Notizen stehen dann im Rezept und am Anfang des Kochmodus, gespeichert in `ep_settings` unter `rezept_notizen`. Claude bekommt sie mit der Auswertung und setzt zum Beispiel die Zutaten für eine zusätzliche Soße mit auf die Einkaufsliste. Löschen kann sie, wer sie geschrieben hat, und jeder Erwachsene.
- **Sofortstart:** Die App zeigt beim Öffnen sofort den Stand vom letzten Mal und lädt im Hintergrund nach. Geschrieben wird erst mit frischen Daten (übernommene Einkaufsposten, Wochenbonus, Essenszeiten, Kontext für Claude), und Links aus Push-Nachrichten (zum Beispiel ein neuer Entwurf) öffnen sich, sobald die frischen Daten da sind.
- **Neue Version:** Die App startet aus dem Speicher des Handys, auch ohne Netz. Der Service Worker sucht beim Öffnen im Hintergrund nach einer neuen Fassung, lädt dann alle Dateien zusammen und zeigt „Neue Version der App. Tippen zum Laden.“ Nach einem Update auf Netlify reicht es, die App zu öffnen und auf den Hinweis zu tippen.
- **Abhaken:** Der Haken springt kurz auf, die Zeile blendet aus. Auf Android vibriert das Handy kurz, auf dem iPhone (ab iOS 18) gibt es einen kleinen fühlbaren Ruck.
- **Aufgaben nur an Schultagen:** Unter „Aufgaben verwalten“ lässt sich bei jeder Aufgabe „Nur an Schultagen“ anhaken. Dann erscheint sie nicht am Wochenende, in den bayerischen Ferien und an Feiertagen (auch nicht am Buß- und Bettag), und es gibt dafür keine Erinnerung. Gespeichert in der Spalte `school_only` von `ep_tasks` (schema.sql neu ausführen).
- **Kinder wechseln nur mit PIN:** Im Familie-Fenster unter den PINs der Erwachsenen, voreingestellt an. Wechselt ein Kind auf seinem Gerät zum anderen Kind, braucht es die PIN von Mama oder Papa. Ohne gesetzte PIN der Erwachsenen greift die Sperre nicht.

## Packungsgrößen

- **Eingeben:** Im Einkaufsmodus bei einem Posten auf „fehlt“, dann „Andere Größe“. Zu Hause unten bei „Liste“ auf „Packungsgrößen“, dort einen Posten aus der Liste wählen oder ein Produkt mit Größe eintragen.
- **Rückfrage:** Braucht ein Rezept zum Beispiel 700 g und die Packung hat 400 g, fragt die App: a) auf 1 Packung umrechnen, b) auf 2 Packungen umrechnen (alle Zutaten im gleichen Verhältnis, ab 5 Portionen kommt der Rest für den Tag danach auf „Was muss weg?“), c) Rezept lassen und den Rest auf „Was muss weg?“ (Tiefkühl und Vorrat bleiben einfach im Vorrat). a) und b) ändern das Rezept dauerhaft, die Portionen stehen in der Spalte `servings` von `ep_dishes` (schema.sql neu ausführen). Wird das Rezept deutlich größer, kommen die übrigen Zutaten als Zusatzmenge auf dieselbe Einkaufstour.
- **Lernen:** Steht auf dem Kassenzettel eine Größe im Artikeltext (zum Beispiel „PUTENBR.FIL. 400G“), übernimmt die App sie. Von Hand Eingetragenes hat Vorrang.
- **Planen:** Claude bekommt die Liste und plant mit ganzen Packungen. Auch „Liste aus dem Wochenplan neu erstellen“ rechnet bekannte Produkte in Packungen.
- **Wer spät kommt, verschiebt das Essen nicht:** Kommt jemand erst nach 19:30 nach Hause (Termin oder „kommt später“), bleibt das Abendessen bei 18:30. Beim Tag steht dann „kommt um 22:00, isst später“ und „eine Portion zur Seite stellen“. Wer bis 19:30 kommt, verschiebt das Essen wie bisher bis dahin.

## Lernplaner (lernen.html)

Eigene Seite für den Lernalltag des großen Sohns, auf derselben Adresse wie der Familienplan und mit derselben Anmeldung.
Tagesplan mit Hausaufgaben, Prüfungslernen, Ludus Latinus und Vokabelkasten-Check, Handball-Spiel (jede Aufgabe ein Tor, Tagessieg, Wochenspiel mit Siegprämie, Aufstieg mit neuen Trikots),
lernendes Modell für Tempo, Tageskapazität und Vorbereitungszeit. Daten in der Tabelle `lp_data`, die Karte „Schule“ im Bereich Aufgaben liest die Ansichten `lp_stand` und `lp_erledigt_heute`.

- Einrichten: `supabase/lernplaner.sql` im SQL Editor ausführen, Funktion `lernplaner` anlegen (Code in `supabase/functions/lernplaner/index.ts`).
- Claude-Aufrufe aus dem Lernplaner laufen über die Funktion `lernplaner`, Push-Erinnerungen über die Funktion `push` (Abschnitt „Lernplaner“ dort).
- Prüfung der Erinnerungen: `node --experimental-strip-types tests/funktion-lernplaner.mts`.
- Termine: Ist unter Optionen „Lernplaner gehört zu“ gewählt, nutzt der Lernplaner die Termine des Familienplans (`ep_events`, gleiche Regeln). Neue Termine aus dem Lernplaner landen dort ebenfalls.
- Lernmodus: startet mit dem Anpfiff, zeigt nur die aktuelle Aufgabe, Beenden mit Eltern-PIN. Verlässt er die App, zählt die Zeit nicht; nach der eingestellten Zeit kommt eine Push-Nachricht. Eine echte Sperre gibt es nur mit dem Geführten Zugriff am iPhone.
- „Pause vorbei“ und Lernmodus-Meldungen kommen pünktlich mit einem zweiten Zeitplan im Minutentakt (`lernplaner-minute` in `supabase/cron.sql` bzw. `push-einrichten.html`). Ohne ihn kommen sie mit bis zu fünf Minuten Verspätung.

- Hefteinträge: Fotos oder ein PDF pro Prüfung, Claude schreibt sie ab (`ex.heft`). Sie sind danach die wichtigste Quelle für Lernschritte, Abfrage und Karteikarten.
- Lernzeit: Lern-Aufgaben zählen nur mit der Uhr und ab zwei Dritteln der geplanten Zeit (`NEED_SHARE`). Kürzer oder „ohne Handy gelernt“ setzt `t.check`, die Eltern entscheiden mit „Zählt“ oder „Nochmal“ (Push `lp-pruefen`). Bis dahin wartet der Tagessieg.
- Karteikarten: eigene Sammlung `card` in `lp_data`, Lernkartei mit fünf Fächern (Fach 1 täglich, dann nach 1, 2, 4 und 7 Tagen). Karten von Prüfungen, die länger als 60 Tage vorbei sind, räumt die App weg.

- Tagessieg: schreibt `lpsieg-<Tag>-<Kind>` mit `winMin` Minuten (Standard 10) als bestätigten Eintrag in `ep_task_log`. Zählt nicht zum Tageslimit (`capFree` in `js/aufgaben.js`), im Wochenrückblick als „Tagessieg im Lernplaner“.
- Anpfiff selbst wählen: Zeit in 15-Minuten-Schritten rund um den geplanten Beginn, dazu ein Hindernis und ein Wenn-dann-Plan (`S.days[Tag].kplan`). Pünktlich heißt dann bis 5 Minuten nach seiner Zeit, früher zählt ab Schulschluss auch. Die Funktion `push` fragt nach Schulschluss „Wann pfeifst du heute an?“ und erinnert zu seiner Zeit an den Plan.
- Applaus: Bei Tagessieg und echten Lerneinheiten (Uhr, nicht nur bestätigt) bekommen die Eltern eine Nachricht mit Link `lernen.html?applaus=…`. Der Tipp speichert einen Applaus (Sammlung `clap`), das Kind sieht ihn oben und bekommt eine Nachricht. Abschaltbar (`applausOn`).
- Spielerkarte unter Pokale: Tempo, Ausdauer, Wurfquote, Gedächtnis, Fokus, Teamgeist aus den letzten 14 Tagen (45 bis 99), Teamgeist aus bestätigten Aufgaben im Familienplan.
- Restzeit-Scheibe bei der laufenden Aufgabe (60-Minuten-Zifferblatt) und ein „Erster Schritt“ vor dem Start (einfache Regeln nach Titel und Fach).
- Fokus am iPhone: Anleitung unter Eltern, Einstellungen, Lernmodus. Mit „Anpfiff schaltet den Lernfokus ein“ öffnet der Anpfiff `shortcuts://run-shortcut?name=Lernfokus an`, nach dem letzten Tor gibt es einen Knopf für „Lernfokus aus“. Bis zu zwei Minuten in den Kurzbefehlen zählen nicht als Ablenkung.

## Doppelte Posten auf der Einkaufsliste

Gleiche Posten derselben Tour stehen nur einmal auf der Liste (`itemKey`, `mergeDuplicates` in `js/logic.js`): klein geschrieben, ohne Umlaute, letztes Wort in einer Grundform, Mengen in Grundeinheit (kg in g, Stk. wie Stück). Das gilt beim Bauen aus den Rezepten, beim Übernehmen von Claudes Plan und beim Öffnen für bestehende Listen ab der Vorwoche (nur erzeugte, offene Posten). Prüfung: `node tests/einkauf-zusammenfassen.mjs`, `node tests/einkauf-doppelt.mjs`.

Aus dem Vorrat: `fromPantry` in `js/logic.js` sammelt die Zutaten der Gerichte ab heute, die laut Vorrat da sind. Die Liste fragt sie oben ab. „Ist da“ steht in `ep_settings` unter `vorrat_check` (pro Woche), „Fehlt“ setzt den Vorrat auf leer und stellt die Zutat auf die nächste Tour (sonst „Nachkauf“). Prüfung: `node tests/vorrat-frage.mjs`.

Brotbox und Touren: Posten, deren Zweck kein Abendessen ist (`isDinnerUse`), etwa „Brotbox (Di)“, lassen sich nicht aus Rezepten berechnen. „Aus dem Plan neu erstellen“ behält sie samt Touren (`keepNonDinner`, `tripFor`). Werden im Entwurf Tage getauscht, passt `draftShopping` Claudes Liste an, statt sie zu ersetzen. Fehlen Brotbox-Posten aus dem freigegebenen Entwurf, bietet die Liste sie oben zum Nachtragen an. Prüfung: `node tests/brotbox-liste.mjs`.

Abendessen oder Brotbox: Ein Zweck mit Wochentag gilt als Abendessen, außer er nennt Brotbox, Frühstück, Snack oder Mittag (`isDinnerUse`). Claude kürzt Gerichtsnamen oft, deshalb zählt der Tag. „Bio-X“ und „X“ sind ein Posten. Entfernte Posten (Kreuz, mit „Rückgängig“) stehen in `ep_settings` unter `liste_weg` (pro Woche) und kommen beim Neuberechnen nicht wieder.

- Touren am selben Tag: Wird ein Einkaufstag auf den Tag einer anderen Tour gelegt, bekommen alle Posten den Namen der Tour, die den Tag schon im Namen trägt (`sameDayTrips`), und doppelte Posten werden in einem Schritt zusammengefasst. `dedupeShopping` macht das auch für ältere Listen. Touren verschiedener Wochen am selben Tag (etwa Frischeeinkauf dieser Woche und Großeinkauf für die nächste) bleiben in ihren Wochen gespeichert, damit Neuberechnen stimmt. Die Liste zeigt sie aber als eine (`guests` in `viewEinkauf`), gleiche offene Posten als eine Zeile (`joinGuests`), Haken, „fehlt“ und Kreuz gelten für alle (`twinsOf`). Prüfung: `node tests/einkauf-doppelt.mjs` (Y, Z).

- Schule und Heimkommen: `ep_settings` unter `schule` (`kinder`: je Kind `quelle` lernplaner oder eigen, `weg` in Minuten, `tage` 1 bis 5 mit `bis` und `ogts`; `frueher`: Tag, Kind, Uhrzeit). `js/schule.js` rechnet das Ende (früher aus, sonst OGTS, sonst Unterricht, beim Kind des Lernplaners aus `lp_data` timetable und schoolEnd mit A- und B-Woche) plus Heimweg. Ferien und Feiertage zählen nicht. Das Display zeigt „kommt heim“ bei den Terminen von heute und morgen. Prüfung: `node tests/kalender-display.mjs` (I).
- Reste aus Packungsgrößen: Wer bei einer Packung „Rezept lassen“ oder „auf Packungen umrechnen“ wählt, erzeugt erwartete Reste in `ep_settings` unter `reste_erwartet` (`text`, `day`, `dish_id`). Sie stehen nicht auf „Was muss weg?“. Ab einer halben Stunde nach dem Essen am Kochtag (bis drei Tage danach) fragt der Wochenplan (`restQuestionCard`), die Funktion push schickt den Eltern eine Dreiviertelstunde nach dem Essen eine Nachricht (`restMessages`). Nicht gekochte Gerichte fallen still weg (`pruneExpected`). Alte Einträge mit `ab` wandern einmal in die Nachfrage (`migrateExpected`). Prüfung: `node tests/packungen.mjs`, `node --experimental-strip-types tests/funktion-reste.mts`.
- Preisgedächtnis: Kassenzettelposten haben `anzahl` (aus „2 x 1,29“), `packung` (Größe einer Packung oder bei Waagenartikeln das Gewicht) und `gewogen`. `priceBook` in `js/haushalt.js` gruppiert nach `priceKey` (Name ohne Mengen), rechnet den Preis je Packung und, wo eine Größe bekannt ist (`sizeOf` aus Größe, Zetteltext oder Name), den Grundpreis je kg, l oder Stück. „Günstiger“ nur bei gleicher Einheit oder gleicher Packungsgröße. `priceTable` in der Push-Funktion gibt Claude dieselben Werte. Gewogenes lernt keine Packungsgröße. Prüfung: `node tests/siri-preise.mjs`.
- Fotos an Claude (Kassenzettel, Rezepte, Zutaten): `shrinkImage` verkleinert auf höchstens 1568 Pixel, beim Dekodieren per `createImageBitmap`, wo möglich, ein Foto nach dem anderen (`shrinkAll`). Kommt ein leeres Bild heraus (Safari bei Speichermangel), noch einmal kleiner. Die Funktion nimmt je Foto bis 5 MB und zusammen bis 20 MB (Base64). Prüfung: `node tests/kalender-display.mjs` (H, braucht `/tmp/gross48mp.jpg`).

Bio und Angebote: Die Liste zeigt Namen ohne „Bio“ (`plainName`) und Mengen ohne Angebotszusatz (`cleanQty`). Die Familie kauft Bio, wenn es das gibt. Markiert wird nur ein Bio-Angebot: `parseOffers` liest die Angebotsliste aus Claudes Wochenlauf (`ep_ai_runs.offers`), `bioOfferFor` sucht ein Bio-Angebot, das am Einkaufstag gilt und alle Wörter des Postens enthält. Steht in Claudes Menge „Angebot ab …, Bio“, zählt das auch. Prüfung: `node tests/einkauf-zusammenfassen.mjs`, `node tests/brotbox-liste.mjs` (Fall H).

## Neues Gericht von Claude für einen Tag

Im Tagesbogen und oben bei „Gericht wählen“: „Neues Gericht von Claude“ schickt den Tag, das alte Gericht, den Rest der Woche, die Namen der Sammlung, Esser, Kochzeit, Vorrat und schon Gekauftes an die Funktion `push` (Aktion `neues-gericht`, `suggestNewDish`, Modell aus den Regeln). Sie prüft, dass der Name neu ist und keine Ausschlüsse vorkommen, und fragt sonst einmal nach. „Übernehmen“ speichert das Rezept, setzt es an den Tag, pausiert auf Wunsch das alte Gericht acht Wochen und passt die Einkaufsliste mit `swapShopping` an. Dasselbe passiert jetzt beim Tauschen aus der Sammlung. Prüfung: `node tests/neues-gericht.mjs`, `node --experimental-strip-types tests/funktion-neues-gericht.mts`.

## Stall-Ampel, Minuten-Shop und Küchen-Display

- Stall-Ampel: `ep_settings` unter `stall` (`on`, `tage`, `last`). Fällig ist `last + tage`, Gelb einen Tag vorher. Meldungen tragen die Kennung `st-…`, die Bestätigung setzt `last`. Aufgabe: `meerschwein-kaefig` oder eine Aufgabe mit Käfig oder Stall im Namen. Prüfung: `node --experimental-strip-types tests/funktion-stall-shop.mts` und `node tests/stall-shop.mjs`.
- Minuten-Shop: `ep_settings` unter `shop` (`aus`, `items`). Ein Kauf ist ein Eintrag `shop-…` mit negativen Minuten und Status „offen“, er hält die Minuten im Konto fest. „Erledigt“ setzt „bestaetigt“, „Zurückbuchen“ „abgelehnt“.
- Küchen-Display: `?anzeige=kueche` (oder im Familie-Fenster) merkt sich das Gerät in `localStorage` unter `essensplan.anzeige`, `?anzeige=aus` oder „Anzeige beenden“ beendet es. Das Gerät muss einmal mit dem Familienzugang angemeldet sein.
- iPhone-Kalender: `ep_settings` unter `kalender` (`feeds`: `id`, `name`, `url`, `person_id`, `essen`). Die Funktion `push` (Aktion `kalender`, `loadCalendars`) holt die .ics-Dateien nur von diesen Adressen, liest Serien, Ausnahmen, verschobene und abgesagte Termine, Zeitzonen und Termine über Mitternacht und gibt die Tage ab heute zurück (`tage`, höchstens 22). Die App fragt drei Wochen ab, alle 15 Minuten, und merkt sich den Stand im Gerät (`essensplan.kalender`).
- Heimweg: `ep_settings` unter `heimweg` (`adresse`, `schluessel` von OpenRouteService aus account.heigit.org, sonst Secret `ORS_KEY`). Adressen: `api.heigit.org/pelias/v1/search` und `api.heigit.org/openrouteservice/v2/matrix` (api.openrouteservice.org ist seit November 2026 abgeschaltet). `addWays` in der Funktion `push` sucht die Orte der Termine (`LOCATION`, bei Apple direkt die Koordinaten aus `X-APPLE-STRUCTURED-LOCATION`) und die Fahrzeit nach Hause (Matrix, pro Kalender `weg`: `auto`, `rad`, `fuss`, `aus`). Orte und Fahrzeiten stehen in `ep_settings` unter `wege`, jede Strecke wird nur einmal gefragt, höchstens 20 neue Orte pro Abruf. Online-Termine und „zu Hause“ zählen nicht, über drei Stunden auch nicht. Die App rechnet zu Hause = Ende plus Fahrzeit, auf fünf Minuten aufgerundet.
- Termine: Die Wochentermine (`ep_events`) zählen im Familienplan nicht mehr und lassen sich dort nicht mehr bearbeiten. Fürs Abendessen kommen Termine allein aus den iPhone-Kalendern. Der Lernplaner liest und schreibt `ep_events` weiter.
- Abhaken am Display: Kinder legen am Handy eine PIN fest (`pin_hash` in `ep_persons`, wie bei den Erwachsenen). Am Display öffnet das Antippen des Namens ein Ziffernfeld, danach 90 Sekunden (bei jedem Tippen neu) die festen Aufgaben von heute (`logTask` mit `person`). Aufgaben mit Foto gehen nur am Handy. Kein Knopf zum Beenden: fünfmal aufs Kalenderblatt tippen, dann die PIN eines Erwachsenen. Prüfung: `node tests/kalender-display.mjs` (F).
- Farbe des Displays: `ep_settings` unter `anzeige` (`farbe`: `auto`, `hell`, `dunkel`). Automatisch ist es von 6 bis 18 Uhr hell (Klasse `hell` am Display, `anzeige-hell` an `html`), sonst dunkel. Prüfung: `node tests/kalender-display.mjs` (F, G).
- Display morgens und abends: bis 12 Uhr Wetter (Open-Meteo, ohne Schlüssel, für die Heimweg-Adresse aus `wege.heim`, sonst Coburg, alle 30 Minuten, gemerkt unter `essensplan.wetter`), Kleidungstipp, Brotbox, Proben aus den Kalendern der Kinder (`js/wetter.js`, `morningNotes` kennt auch „Mitnehmen“, das ist ausgeblendet). Danach Abendessen, Vorbereitung und Brotbox für morgen. Eine halbe Stunde nach der Essenszeit bis 22 Uhr „Wie war's?“ (`rate` mit Person, PIN der Person). Unten „Ist alle?“ aus `ep_staples`: wer meldet, tippt auf sich und gibt die PIN ein (`dispAs`), der Posten bekommt `added_by` und `purpose: 'ist alle'`, mit Rückgängig. Testuhr: `ESSENSPLAN_STUNDE`, `ESSENSPLAN_MINUTE`. Prüfung: `node tests/kalender-display.mjs` (G).
- Kalender fürs Essen: `calendarEvents` in `js/termine.js` macht aus den Terminen mit Uhrzeit eines Personen-Kalenders Einzeltermine (`date`), die `dinnerInfo`, `isBusy` und `portionFactors` wie die Wochentermine verwenden. Ohne Ende am Tag (über Mitternacht) heißt: an dem Abend weg. Ganztägige Einträge zählen nicht, `essen: false` schaltet einen Kalender aufs Display zurück. Essenszeiten im Plan und der Kontext für Claude werden erst geschrieben, wenn die Kalender geladen sind (`kalReady`). Prüfung: `node tests/kalender-essen.mjs`, `node tests/kalender-display.mjs` (C, D).

## Foto als Nachweis und Wochenrückblick

- Foto als Nachweis: pro Aufgabe unter „Aufgaben verwalten“ (gespeichert in `ep_settings` unter `aufgaben.foto`). Das Foto geht verkleinert an die Funktion `push`, die es privat im Speicher `nachweise` ablegt. Den Speicher legt die Funktion beim ersten Foto selbst an, SQL ist nicht nötig. Die Eltern bekommen Links, die eine Stunde gelten. Fotos älter als 14 Tage löscht der Sonntagslauf.
- Wochenrückblick: Auswertung in `js/rueckblick.js`, Lernen direkt aus `lp_data`. Prüfung: `node --experimental-strip-types tests/funktion-rueckblick.mts`.

## Arbeiten mit GitHub

Der Code liegt im privaten GitHub-Repository. Netlify ist damit verbunden und veröffentlicht jede Änderung auf `main` automatisch.
Die Supabase-Funktionen veröffentlicht die GitHub Action `.github/workflows/supabase-funktionen.yml`, sobald die beiden Secrets dort eingetragen sind.

Regeln für jede Änderung, egal aus welchem Chat:
1. Immer zuerst den aktuellen Stand aus GitHub holen. Nie mit Code aus einem älteren Chatverlauf oder dem claude.ai-Artefakt weiterarbeiten.
2. Kleine, beschriebene Commits auf Deutsch, damit der Verlauf lesbar bleibt.
3. Vor dem Speichern die Prüfungen laufen lassen (`tests/`), mindestens die `.mts`-Dateien und die Syntaxprüfung der `js/`-Dateien.
4. Ändert sich eine Datei, die der Service Worker vorhält (Liste `SHELL` in `sw.js`), lädt die App sie selbst neu. Neue Seiten in diese Liste aufnehmen.
5. Zurück: In Netlify unter Deploys eine frühere Version veröffentlichen, oder in GitHub den Commit rückgängig machen (Revert).
