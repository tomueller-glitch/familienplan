// Startdaten: Familie, 16 Gerichte und ein Brotbox-Rezept, Wochenplan 16. bis 22. November 2026, Einkaufsliste.
// Wird beim ersten Start einmal in die Datenbank geschrieben.

const i = (q, u, n, c) => ({ q, u, n, c });
const b = (n) => ({ q: null, u: '', n, c: 'basis' });

const ZWIEBEL = i(1, '', 'Zwiebel', 'obst');
const KNOBI = (q = 1) => i(q, '', 'Knoblauchzehe', 'obst');
const SALZ = b('Salz, Pfeffer');

const persons = [
  { id: 'p1', name: 'Papa', color: '#1F6F8B', sort: 1, adult: true },
  { id: 'p2', name: 'Mama', color: '#B8437A', sort: 2, adult: true },
  { id: 'p3', name: 'Kind 1', color: '#DE7C12', sort: 3, adult: false, screen_base: 45, earn_cap: 30 },
  { id: 'p4', name: 'Kind 2', color: '#3F8F5B', sort: 4, adult: false, screen_base: 30, earn_cap: 20 },
];

const dishes = [
  {
    id: 'hackbaellchen', name: 'Hackbällchen in Tomatensauce mit Reis', category: 'rind', duration_min: 45,
    tags: ['Thermomix', 'Airfryer'],
    note: 'Acht Bällchen für die Brotbox am nächsten Tag beiseitelegen.',
    ingredients: [
      i(800, 'g', 'Bio-Hackfleisch vom Rind', 'fleisch'), i(1, '', 'Bio-Ei', 'kuehl'), i(50, 'g', 'Semmelbrösel', 'vorrat'),
      ZWIEBEL, KNOBI(), i(2, '', 'Bio-Karotte', 'obst'), i(500, 'g', 'Bio passierte Tomaten', 'vorrat'),
      i(2, 'EL', 'Tomatenmark', 'vorrat'), i(100, 'g', 'Bio-Frischkäse natur', 'kuehl'), i(300, 'g', 'Bio-Reis', 'vorrat'),
      b('20 g Olivenöl'), b('1 EL Öl für den Airfryer'), b('150 g Wasser'), b('1 TL Gemüsebrühe'), b('1 TL Oregano'), b('1 TL Paprikapulver'), SALZ,
    ],
    steps: [
      'Zwiebel, Knoblauch und Karotten in den Thermomix geben, 5 Sek., Stufe 5. Zwei Esslöffel davon für die Hackmasse herausnehmen.',
      'Hack, Ei, Semmelbrösel, das entnommene Gemüse, Paprikapulver, 1 TL Salz und Pfeffer verkneten. Etwa 28 kleine Bällchen formen.',
      'Bällchen mit dem Öl bepinseln und im Airfryer bei 200 °C 10 bis 12 Minuten braun braten, nach der Hälfte der Zeit schütteln. Passen nicht alle in den Korb, in zwei Durchgängen. Ohne Airfryer in der Pfanne rundum anbraten.',
      'Währenddessen Olivenöl zum Gemüse im Mixtopf geben, 3 Min., 120 °C, Stufe 1. Reis im Topf nach Packungsangabe kochen.',
      'Passierte Tomaten, Wasser, Tomatenmark, Brühe und Oregano zugeben, 15 Min., 100 °C, Stufe 1.',
      'Frischkäse zugeben und 20 Sek. pürieren, dabei langsam von Stufe 4 auf Stufe 8 hochdrehen. Abschmecken.',
      'Sauce in einen Topf geben, die Bällchen darin 5 Minuten ziehen lassen und mit dem Reis servieren.',
    ],
  },

  {
    id: 'bohnen-wraps', name: 'Vegane Bohnen-Wraps mit Guacamole', category: 'vegan', duration_min: 30,
    tags: ['Thermomix', 'Selber bauen'],
    note: 'Jeder füllt seinen Wrap am Tisch selbst. Wer nicht vegan essen möchte, nimmt geriebenen Käse und Joghurt dazu.',
    ingredients: [
      i(8, '', 'Weizen-Tortilla', 'brot'), i(2, 'Dose', 'Bio-Kidneybohnen', 'vorrat'), i(1, 'Dose', 'Bio-Mais', 'vorrat'),
      ZWIEBEL, KNOBI(), i(1, '', 'Spitzpaprika', 'obst'), i(200, 'g', 'Bio passierte Tomaten', 'vorrat'),
      i(2, '', 'Avocado', 'obst'), i(0.5, '', 'Bio-Zitrone', 'obst'), i(0.5, 'Kopf', 'Eisbergsalat', 'obst'),
      i(200, 'g', 'Datteltomaten', 'obst'), b('20 g Öl'), b('1 TL Kreuzkümmel'), b('1 TL Paprikapulver'), b('Salz'),
    ],
    steps: [
      'Guacamole: Avocadofleisch mit Zitronensaft und Salz mit der Gabel zerdrücken.',
      'Zwiebel und Knoblauch in den Thermomix geben, 5 Sek., Stufe 5. Öl zugeben, 3 Min., 120 °C, Stufe 1.',
      'Paprika klein würfeln. Mit abgespülten Bohnen, Mais, passierten Tomaten, Kreuzkümmel, Paprikapulver und ½ TL Salz zugeben, 10 Min., 100 °C, Linkslauf, Stufe 1.',
      'Salat in Streifen schneiden, Tomaten halbieren.',
      'Tortillas kurz in einer trockenen Pfanne oder im Ofen erwärmen.',
      'Alles in Schüsseln auf den Tisch stellen.',
    ],
  },
  {
    id: 'fischstaebchen', name: 'Knusprige Fischstäbchen mit Kartoffelpüree und Erbsen', category: 'fisch', duration_min: 50,
    prep: 'Seelachsfilet aus dem Tiefkühler in den Kühlschrank legen.',
    tags: ['Thermomix', 'Kinder helfen mit'],
    note: 'Den Fisch am Vorabend im Kühlschrank auftauen. Panieren können die Kinder übernehmen.',
    ingredients: [
      i(700, 'g', 'Seelachsfilet tiefgekühlt', 'tk'), i(2, '', 'Bio-Ei', 'kuehl'), i(40, 'g', 'Bio-Weizenmehl', 'vorrat'),
      i(100, 'g', 'Semmelbrösel', 'vorrat'), i(1000, 'g', 'Bio-Kartoffeln', 'obst'), i(350, 'ml', 'Bio-Milch', 'kuehl'),
      i(60, 'g', 'Bio-Butter', 'kuehl'), i(300, 'g', 'Erbsen tiefgekühlt', 'tk'), i(1, '', 'Bio-Zitrone', 'obst'),
      b('100 ml Rapsöl zum Braten'), b('1 Prise Muskat'), b('Salz'), b('Ketchup'),
    ],
    steps: [
      'Kartoffeln schälen und in Stücke von etwa 2 cm schneiden. Rühraufsatz einsetzen. Kartoffeln, Milch und 1 TL Salz in den Thermomix geben, 25 Min., 95 °C, Stufe 1.',
      'Fisch trocken tupfen, in fingerdicke Streifen schneiden und salzen. Nacheinander in Mehl, verquirltem Ei und Semmelbröseln wenden.',
      'Rapsöl in einer großen Pfanne etwa 3 mm hoch erhitzen. Fischstäbchen bei mittlerer Hitze pro Seite 3 Minuten goldbraun braten, in der letzten Minute 20 g Butter zugeben. Auf Küchenpapier abtropfen lassen.',
      'Passen nicht alle in die Pfanne, in zwei Durchgängen braten und den ersten im Ofen bei 80 °C warm halten. Alternative: Fischstäbchen mit Öl beträufeln und im Airfryer bei 200 °C 8 bis 10 Minuten backen, nach der Hälfte wenden.',
      'Erbsen in wenig Salzwasser 4 Minuten kochen, abgießen und mit 10 g Butter schwenken.',
      'Restliche Butter und Muskat zu den Kartoffeln geben, 30 Sek., Stufe 3. Ist das Püree zu fest, einen Schuss Milch unterrühren.',
      'Mit Zitronenspalten und Ketchup servieren.',
    ],
  },

  {
    id: 'haehnchen-nudeln', name: 'Nudeln mit Hähnchen und Gemüse-Tomatensauce', category: 'gefluegel', duration_min: 35,
    tags: ['Thermomix'],
    note: 'Das Gemüse wird püriert und fällt in der Sauce nicht auf. Für den Nudelsalat in der Brotbox 100 g Nudeln mehr kochen.',
    ingredients: [
      i(400, 'g', 'Bio-Nudeln (kein Vollkorn)', 'vorrat'), i(700, 'g', 'Bio-Landhähnchen Ministeaks', 'fleisch'),
      ZWIEBEL, KNOBI(), i(2, '', 'Bio-Karotte', 'obst'), i(1, '', 'Spitzpaprika', 'obst'),
      i(500, 'g', 'Bio passierte Tomaten', 'vorrat'), i(100, 'g', 'Bio-Frischkäse natur', 'kuehl'), i(50, 'g', 'Parmesan', 'kuehl'),
      b('20 g Öl und 1 EL zum Braten'), b('100 g Wasser'), b('1 TL Gemüsebrühe'), b('1 TL Oregano'), SALZ,
    ],
    steps: [
      'Zwiebel, Knoblauch, Karotten und Paprika grob schneiden, in den Thermomix geben, 5 Sek., Stufe 5. Öl zugeben, 4 Min., 120 °C, Stufe 1.',
      'Passierte Tomaten, Wasser, Brühe und Oregano zugeben, 12 Min., 100 °C, Stufe 1.',
      'Nudeln nach Packungsangabe kochen.',
      'Hähnchen in Streifen schneiden, salzen, pfeffern und in einer Pfanne 6 bis 8 Minuten durchbraten.',
      'Frischkäse in die Sauce geben und 30 Sek. pürieren, dabei langsam von Stufe 5 auf Stufe 8 hochdrehen. Abschmecken.',
      'Nudeln mit Sauce und Hähnchen mischen, Parmesan darüber reiben.',
    ],
  },
  {
    id: 'knoedelgroestl', name: 'Knödelgröstl mit Ei und Schinken, Gurkensalat', category: 'schwein', duration_min: 25,
    tags: ['Schnell'],
    note: '',
    ingredients: [
      i(2, 'Packung', 'Bio Serviettenknödel (390 g)', 'kuehl'), i(240, 'g', 'Prosciutto Cotto', 'kuehl'), i(6, '', 'Bio-Ei', 'kuehl'),
      ZWIEBEL, i(20, 'g', 'Bio-Butter', 'kuehl'), i(1, 'Bund', 'Schnittlauch', 'obst'), i(1, '', 'Bio-Gurke', 'obst'),
      i(150, 'g', 'Bio-Naturjoghurt', 'kuehl'), i(0.5, '', 'Bio-Zitrone', 'obst'), SALZ,
    ],
    steps: [
      'Gurke in dünne Scheiben hobeln. Joghurt mit Zitronensaft, Salz und Pfeffer verrühren und mit der Gurke mischen.',
      'Knödel in Würfel von etwa 2 cm schneiden, Zwiebel fein würfeln, Schinken in Streifen schneiden.',
      'Butter in einer großen Pfanne erhitzen. Knödelwürfel bei mittlerer Hitze 8 Minuten rundum goldbraun braten.',
      'Zwiebel und Schinken zugeben und 3 Minuten mitbraten.',
      'Eier mit Salz und Pfeffer verquirlen, darübergießen und unter Rühren 2 Minuten stocken lassen.',
      'Mit Schnittlauchröllchen bestreuen und mit dem Gurkensalat servieren.',
    ],
  },
  {
    id: 'burger', name: 'Burger mit selbst gebackenen Brötchen und Kartoffelspalten', category: 'rind', duration_min: 105,
    prep: 'Falls eingefroren: Hackfleisch in den Kühlschrank legen.',
    tags: ['Thermomix', 'Airfryer', 'Selber bauen', 'Wochenende'],
    note: 'Davon 1 Stunde Wartezeit für den Teig. Wer es eilig hat, kauft fertige Burgerbrötchen.',
    ingredients: [
      i(800, 'g', 'Bio-Hackfleisch vom Rind', 'fleisch'), i(250, 'ml', 'Bio-Milch', 'kuehl'), i(0.5, 'Würfel', 'Hefe', 'kuehl'),
      i(500, 'g', 'Bio-Weizenmehl', 'vorrat'), i(40, 'g', 'Bio-Butter', 'kuehl'), i(1, '', 'Bio-Ei', 'kuehl'),
      i(8, 'Scheibe', 'Bio-Käse', 'kuehl'), i(0.5, 'Kopf', 'Eisbergsalat', 'obst'), i(2, '', 'Tomate', 'obst'),
      i(0.5, '', 'Bio-Gurke', 'obst'), i(800, 'g', 'Bio-Kartoffeln', 'obst'),
      b('20 g Zucker'), b('1 TL Salz für den Teig'), b('Sesam'), b('Ketchup'), b('3 EL Öl'), b('1 TL Paprikapulver'), SALZ,
    ],
    steps: [
      'Milch, Hefe und Zucker in den Thermomix geben, 2 Min., 37 °C, Stufe 2.',
      'Mehl, Butter, Ei und Salz zugeben, 3 Min., Teigstufe. Teig in einer Schüssel abgedeckt 45 Minuten gehen lassen.',
      'Acht Kugeln formen, auf ein Blech setzen, flach drücken und weitere 15 Minuten gehen lassen. Ofen auf 200 °C Ober- und Unterhitze vorheizen.',
      'Brötchen mit Milch bestreichen, mit Sesam bestreuen und 15 bis 18 Minuten backen.',
      'Kartoffeln mit Schale in Spalten schneiden, mit 2 EL Öl, Paprikapulver und Salz mischen und im Airfryer bei 200 °C 20 bis 25 Minuten knusprig backen, zwei- bis dreimal schütteln.',
      'Hack mit Salz und Pfeffer würzen und zu 8 flachen Patties formen. In heißem Öl pro Seite 3 bis 4 Minuten durchbraten, zum Schluss den Käse auflegen.',
      'Salat, Tomaten und Gurke schneiden. Jeder belegt seinen Burger selbst.',
    ],
  },

  {
    id: 'pfannkuchen', name: 'Pfannkuchen herzhaft und süß', category: 'gemischt', duration_min: 40,
    tags: ['Thermomix', 'Selber bauen'],
    note: '',
    ingredients: [
      i(300, 'g', 'Bio-Weizenmehl', 'vorrat'), i(600, 'ml', 'Bio-Milch', 'kuehl'), i(4, '', 'Bio-Ei', 'kuehl'),
      i(200, 'g', 'Bio-Räucherlachs', 'kuehl'), i(200, 'g', 'Kräuterfrischkäse', 'kuehl'), i(0.5, '', 'Bio-Gurke', 'obst'),
      i(100, 'g', 'Prosciutto Cotto', 'kuehl'), i(4, 'Scheibe', 'Bio-Käse', 'kuehl'), i(250, 'g', 'Bio-Magerquark', 'kuehl'),
      i(1, 'Glas', 'Apfelmus', 'vorrat'), b('Butter zum Braten'), b('Zimt'), b('1 Prise Salz'),
    ],
    steps: [
      'Mehl, Milch, Eier und Salz in den Thermomix geben, 20 Sek., Stufe 5. Teig 15 Minuten ruhen lassen.',
      'Gurke in Scheiben schneiden. Quark mit 3 EL Apfelmus und etwas Zimt glatt rühren.',
      'In einer Pfanne mit wenig Butter nacheinander etwa 10 dünne Pfannkuchen backen und im Ofen bei 80 °C warm halten.',
      'Für die Variante mit Schinken und Käse einen Pfannkuchen nach dem Wenden belegen, zuklappen und kurz weiterbraten, bis der Käse schmilzt.',
      'Am Tisch füllen: Räucherlachs mit Kräuterfrischkäse und Gurke, Schinken mit Käse, Apfelquark mit Apfelmus.',
    ],
  },
  {
    id: 'gyros', name: 'Hähnchen-Gyros mit Tzatziki, Pita und Tomatensalat', category: 'gefluegel', duration_min: 75,
    prep: 'Falls eingefroren: Hähnchenbrust in den Kühlschrank legen.',
    tags: ['Airfryer', 'Thermomix', 'Selber bauen', 'Wochenende'],
    note: 'Davon 30 Minuten zum Marinieren. Das Hähnchen am Vorabend aus dem Gefrierfach in den Kühlschrank legen. Jeder füllt seine Pita am Tisch selbst.',
    ingredients: [
      i(800, 'g', 'Bio-Hähnchenbrustfilet', 'fleisch'), KNOBI(3), i(0.5, '', 'Bio-Zitrone', 'obst'),
      i(1, '', 'Bio-Gurke', 'obst'), i(500, 'g', 'Skyr natur', 'kuehl'), i(8, '', 'Pita-Brot', 'brot'),
      i(4, '', 'Tomate', 'obst'), ZWIEBEL,
      b('6 EL Olivenöl'), b('2 TL Paprikapulver'), b('1 TL Oregano'), b('1 TL Kreuzkümmel'), b('1 EL Essig'), SALZ,
    ],
    steps: [
      'Hähnchen in dünne Streifen schneiden. Mit 3 EL Öl, 2 gepressten Knoblauchzehen, Paprikapulver, Oregano, Kreuzkümmel, dem Saft der halben Zitrone, 1 TL Salz und Pfeffer mischen und 30 Minuten marinieren.',
      'Für das Tzatziki die Gurke grob schneiden, in den Thermomix geben, 4 Sek., Stufe 5. In ein Sieb geben, leicht salzen, 10 Minuten abtropfen lassen und gut ausdrücken.',
      'Restlichen Knoblauch in den Mixtopf geben, 3 Sek., Stufe 8. Skyr, Gurke, 1 EL Öl und ½ TL Salz zugeben, 10 Sek., Linkslauf, Stufe 3. Kalt stellen.',
      'Tomaten in Spalten, Zwiebel in feine Ringe schneiden und mit 2 EL Öl, Essig, Salz und Pfeffer mischen.',
      'Hähnchen in zwei Durchgängen im Airfryer bei 200 °C 10 bis 12 Minuten braten, nach der Hälfte schütteln. Etwas dunkle Ränder geben den typischen Gyros-Geschmack. Ohne Airfryer portionsweise in der heißen Pfanne scharf anbraten.',
      'Pita im Airfryer bei 180 °C 2 Minuten aufbacken, aufschneiden und am Tisch mit Hähnchen, Tzatziki und Tomatensalat füllen.',
    ],
  },
  {
    id: 'haehnchenpfanne', name: 'Hähnchen-Gemüse-Pfanne mit Reis', category: 'gefluegel', duration_min: 35,
    tags: ['Schnell'],
    note: '',
    ingredients: [
      i(600, 'g', 'Hähnchenbrustfilet', 'fleisch'), i(2, '', 'rote Paprika', 'obst'), i(1, '', 'Zucchini', 'obst'),
      ZWIEBEL, KNOBI(2), i(250, 'g', 'Bio-Reis', 'vorrat'), i(3, 'EL', 'Sojasauce', 'vorrat'),
      b('1 TL Paprikapulver'), b('2 EL Rapsöl'), SALZ,
    ],
    steps: [
      'Reis nach Packungsangabe kochen. Im Thermomix: Reis im Garkörbchen mit 1.200 g Wasser und Salz, 20 Min., Varoma, Stufe 4.',
      'Hähnchen in Streifen schneiden, mit Paprikapulver, Salz und Pfeffer würzen.',
      'Paprika und Zucchini in Streifen, Zwiebel in Ringe schneiden, Knoblauch hacken.',
      'Hähnchen in heißem Öl 5 Minuten rundum anbraten, herausnehmen.',
      'Gemüse 5 bis 7 Minuten braten, Hähnchen zurückgeben, mit Sojasauce ablöschen und kurz durchschwenken.',
      'Mit dem Reis servieren.',
    ],
  },
  {
    id: 'linsenbolognese', name: 'Linsenbolognese mit Spaghetti', category: 'veggie', duration_min: 35,
    tags: ['Thermomix'],
    note: 'Ohne Parmesan ist das Gericht vegan.',
    ingredients: [
      i(200, 'g', 'rote Linsen', 'vorrat'), ZWIEBEL, KNOBI(2), i(2, '', 'Bio-Karotte', 'obst'),
      i(2, 'EL', 'Tomatenmark', 'vorrat'), i(2, 'Dose', 'gehackte Tomaten', 'vorrat'),
      i(500, 'g', 'Spaghetti (kein Vollkorn)', 'vorrat'), i(60, 'g', 'Parmesan', 'kuehl'),
      b('2 EL Olivenöl'), b('300 ml Gemüsebrühe'), b('1 TL Oregano'), SALZ,
    ],
    steps: [
      'Zwiebel, Knoblauch und Karotten in den Thermomix geben, 5 Sek., Stufe 5, nach unten schieben.',
      'Öl zugeben, 3 Min., 120 °C, Stufe 1.',
      'Tomatenmark zugeben, 1 Min., 120 °C, Stufe 1.',
      'Linsen abspülen. Mit Tomaten, Brühe und Oregano zugeben, 20 Min., 100 °C, Linkslauf, Stufe 1.',
      'Währenddessen Spaghetti kochen.',
      'Sauce abschmecken, mit Spaghetti und geriebenem Parmesan servieren.',
    ],
  },
  {
    id: 'seelachs-gebacken', name: 'Gebackener Seelachs mit Kartoffeln und Kräuterquark', category: 'fisch', duration_min: 40,
    prep: 'Seelachsfilet aus dem Tiefkühler in den Kühlschrank legen.',
    tags: [],
    note: 'Tiefgekühlten Fisch vorher auftauen lassen. Kabeljau passt genauso.',
    ingredients: [
      i(600, 'g', 'Seelachsfilet tiefgekühlt', 'tk'), i(2, '', 'Bio-Ei', 'kuehl'), i(40, 'g', 'Bio-Weizenmehl', 'vorrat'),
      i(100, 'g', 'Semmelbrösel', 'vorrat'), i(1000, 'g', 'Bio-Kartoffeln', 'obst'), i(500, 'g', 'Bio-Magerquark', 'kuehl'),
      i(1, 'Bund', 'Schnittlauch', 'obst'), KNOBI(), i(1, '', 'Bio-Zitrone', 'obst'),
      b('3 EL Milch'), b('Rapsöl zum Braten'), SALZ,
    ],
    steps: [
      'Kartoffeln schälen, halbieren und in Salzwasser etwa 20 Minuten kochen. Im Thermomix: im Varoma mit 1.000 g Wasser, 30 Min., Varoma, Stufe 1.',
      'Quark mit Milch, gehacktem Schnittlauch, gepresstem Knoblauch, Salz und Pfeffer glatt rühren.',
      'Fisch trocken tupfen, in Portionen schneiden, salzen und mit Zitronensaft beträufeln.',
      'Fisch nacheinander in Mehl, verquirltem Ei und Semmelbröseln wenden.',
      'In reichlich Öl bei mittlerer Hitze pro Seite 3 bis 4 Minuten goldbraun backen.',
      'Mit Kartoffeln, Kräuterquark und Zitronenspalten servieren.',
    ],
  },
  {
    id: 'chili', name: 'Chili con Carne mit Reis', category: 'rind', duration_min: 40,
    tags: ['Thermomix'],
    note: 'Für die Kinder mild würzen und Chili am Tisch nachgeben.',
    ingredients: [
      i(500, 'g', 'Bio-Hackfleisch vom Rind', 'fleisch'), ZWIEBEL, KNOBI(2), i(1, '', 'rote Paprika', 'obst'),
      i(2, 'EL', 'Tomatenmark', 'vorrat'), i(500, 'g', 'Bio passierte Tomaten', 'vorrat'),
      i(1, 'Dose', 'Bio-Kidneybohnen', 'vorrat'), i(1, 'Dose', 'Bio-Mais', 'vorrat'),
      i(200, 'g', 'saure Sahne', 'kuehl'), i(250, 'g', 'Bio-Reis', 'vorrat'),
      b('1 EL Rapsöl'), b('200 ml Gemüsebrühe'), b('1 TL Kreuzkümmel'), b('1 TL Paprikapulver'), b('Chilipulver nach Geschmack'), SALZ,
    ],
    steps: [
      'Zwiebel und Knoblauch im Thermomix 5 Sek., Stufe 5 zerkleinern, mit Öl 3 Min., 120 °C, Stufe 1 dünsten.',
      'Hackfleisch in einer Pfanne krümelig braun anbraten. Im Thermomix wird es nicht braun.',
      'Paprika würfeln. Tomatenmark, passierte Tomaten, Brühe, Paprika und Gewürze in den Thermomix geben, Hack dazu, 15 Min., 100 °C, Linkslauf, Stufe 1.',
      'Reis nach Packungsangabe kochen.',
      'Bohnen und Mais abspülen, zugeben, 5 Min., 100 °C, Linkslauf, Stufe 1.',
      'Abschmecken und mit einem Klecks saurer Sahne und Reis servieren.',
    ],
  },
  {
    id: 'pizza', name: 'Pizza mit Thunfisch oder Putenschinken', category: 'gemischt', duration_min: 70,
    tags: ['Thermomix', 'Selber bauen', 'Wochenende'],
    note: 'Davon 30 Minuten Wartezeit für den Teig.',
    ingredients: [
      i(500, 'g', 'Bio-Weizenmehl', 'vorrat'), i(0.5, 'Würfel', 'Hefe', 'kuehl'), i(250, 'g', 'Bio passierte Tomaten', 'vorrat'),
      i(2, 'Kugel', 'Mozzarella', 'kuehl'), i(1, 'Dose', 'Thunfisch im eigenen Saft', 'vorrat'),
      i(1, '', 'rote Paprika', 'obst'), ZWIEBEL, i(100, 'g', 'Champignons', 'obst'),
      b('300 g lauwarmes Wasser'), b('2 EL Olivenöl'), b('1 TL Oregano'), b('1 TL Salz'), b('1 Prise Zucker'),
    ],
    steps: [
      'Wasser, Hefe und Zucker im Thermomix 2 Min., 37 °C, Stufe 2.',
      'Mehl, Öl und Salz zugeben, 2 Min., Teigstufe.',
      'Teig abgedeckt 30 Minuten gehen lassen. Ofen auf 250 °C Ober- und Unterhitze vorheizen.',
      'Passierte Tomaten mit Oregano und Salz würzen. Gemüse in Ringe oder Scheiben schneiden.',
      'Teig auf zwei Bleche ausrollen, mit Sauce bestreichen, belegen, Mozzarella zerzupfen und darüber verteilen.',
      '12 bis 15 Minuten backen.',
    ],
  },
  {
    id: 'putengeschnetzeltes', name: 'Putengeschnetzeltes mit Champignons und Bulgur', category: 'gefluegel', duration_min: 35,
    tags: [],
    note: '',
    ingredients: [
      i(600, 'g', 'Putenfleisch', 'fleisch'), i(300, 'g', 'Champignons', 'obst'), ZWIEBEL,
      i(200, 'ml', 'Kochsahne', 'kuehl'), i(250, 'g', 'Bulgur', 'vorrat'), i(1, 'Bund', 'Schnittlauch', 'obst'),
      b('1 EL Rapsöl'), b('700 ml Gemüsebrühe'), b('1 TL Paprikapulver'), SALZ,
    ],
    steps: [
      'Bulgur mit 500 ml Gemüsebrühe aufkochen und zugedeckt 15 Minuten quellen lassen.',
      'Putenfleisch in Streifen schneiden, salzen, pfeffern und in heißem Öl portionsweise anbraten, herausnehmen.',
      'Zwiebel würfeln, Champignons in Scheiben schneiden und 5 Minuten braten.',
      'Mit 200 ml Brühe und Sahne ablöschen, Paprikapulver zugeben, 5 Minuten einkochen lassen.',
      'Fleisch zurückgeben, kurz erhitzen, abschmecken.',
      'Mit Bulgur und Schnittlauch servieren.',
    ],
  },
  {
    id: 'frittata', name: 'Gemüsefrittata mit Feta und Spinat, dazu Salat', category: 'veggie', duration_min: 45,
    tags: [],
    note: 'Gekochte Kartoffeln vom Vortag sparen Zeit.',
    ingredients: [
      i(8, '', 'Bio-Ei', 'kuehl'), i(200, 'g', 'Feta', 'kuehl'), i(200, 'g', 'Babyspinat', 'obst'), i(1, '', 'Zucchini', 'obst'),
      i(250, 'g', 'Datteltomaten', 'obst'), ZWIEBEL, i(500, 'g', 'Bio-Kartoffeln', 'obst'),
      i(1, 'Kopf', 'Kopfsalat', 'obst'), i(1, '', 'Bio-Gurke', 'obst'), i(0.5, '', 'Bio-Zitrone', 'obst'),
      b('3 EL Olivenöl'), SALZ,
    ],
    steps: [
      'Ofen auf 180 °C vorheizen. Kartoffeln kochen, falls keine vom Vortag da sind.',
      'Zwiebel und Zucchini würfeln, Kartoffeln in Scheiben schneiden, in einer ofenfesten Pfanne in Öl 8 Minuten braten.',
      'Spinat zugeben und zusammenfallen lassen.',
      'Eier mit Salz und Pfeffer verquirlen, darübergießen, Feta zerbröckeln und mit halbierten Tomaten darauf verteilen.',
      '3 Minuten auf dem Herd stocken lassen, dann 15 bis 20 Minuten im Ofen fertig backen.',
      'Salat und Gurke mit Zitronensaft und Öl anmachen und dazu servieren.',
    ],
  },
  {
    id: 'beef-udon', name: 'Beef Udon mit Pak Choi und Champignons', category: 'rind', duration_min: 25,
    // Werte von der Rezeptkarte, pro Portion.
    nutrition: { kcal: 784, fat: 35.3, sat: 17.8, carbs: 83.9, sugar: 14.9, fiber: 9.7, protein: 37.3, salt: 4.17 },
    tags: ['Schnell', 'HelloFresh'],
    pause_until: '2026-12-06',
    note: 'Rezept von einer HelloFresh-Karte. Etwa 37 g Eiweiß pro Portion. Udon-Nudeln gibt es vorgegart im Asia-Regal.',
    ingredients: [
      i(880, 'g', 'Udon-Nudeln, vorgegart', 'vorrat'), i(400, 'g', 'Hackfleisch vom Weiderind', 'fleisch'),
      i(400, 'g', 'Pak Choi', 'obst'), i(200, 'g', 'Champignons', 'obst'), i(2, '', 'Zwiebel', 'obst'), KNOBI(4),
      i(40, 'ml', 'Sojasoße', 'vorrat'), i(50, 'g', 'Sweet-Chili-Soße', 'vorrat'), i(40, 'g', 'Sesam', 'vorrat'),
      b('3 EL Öl'), b('2 TL Zucker'), b('2 TL Balsamicoessig'), b('Salz, Pfeffer'),
    ],
    steps: [
      'Vom Pak Choi den Strunk etwa 0,5 cm abschneiden, den Rest in 1 cm breite Streifen schneiden. Champignons in Scheiben, Zwiebeln in feine Streifen schneiden.',
      'In einer großen Pfanne das Öl erhitzen. Zwiebeln, Champignons und Pak Choi darin 4 bis 5 Minuten anbraten.',
      'Gleichzeitig eine zweite große Pfanne ohne Fett erhitzen und das Hackfleisch darin 4 bis 5 Minuten krümelig braten.',
      'Knoblauch zum Gemüse pressen. Hackfleisch mit dem ausgetretenen Fett dazugeben. Sojasoße, Sweet-Chili-Soße, Zucker und Balsamico untermischen.',
      'Udon-Nudeln in die Pfanne geben und 2 Minuten mit erhitzen. In tiefen Tellern anrichten und mit Sesam bestreuen.',
    ],
  },
  {
    id: 'energiebaellchen', name: 'Energiebällchen mit Datteln und Hafer', category: 'brotbox', duration_min: 15,
    pieces: 20,
    tags: ['Thermomix', 'Vegan', 'Ohne Nüsse'],
    note: 'Ergibt etwa 20 Stück, 2 pro Brotbox. Halten im Kühlschrank in einer Dose 7 Tage, eingefroren 2 Monate. Ohne Nüsse, weil viele Schulen Nüsse in der Brotbox nicht erlauben. Wer mehr Eiweiß möchte: 2 EL Erdnussmus dazu, dann nur für zu Hause.',
    ingredients: [
      i(200, 'g', 'Datteln, entsteint', 'vorrat'), i(120, 'g', 'Bio-Haferflocken, zart', 'vorrat'),
      i(2, 'EL', 'Kakaopulver, ungesüßt', 'vorrat'), i(30, 'g', 'Kokosraspel, zum Wälzen', 'vorrat'),
      b('2 bis 3 EL Wasser oder Orangensaft'), b('1 Prise Salz'),
    ],
    steps: [
      'Sind die Datteln sehr trocken, 10 Minuten in warmem Wasser einweichen und gut abtropfen lassen.',
      'Haferflocken in den Mixtopf geben und 5 Sek./Stufe 8 zu grobem Mehl zerkleinern.',
      'Datteln, Kakao und Salz dazugeben, 15 Sek./Stufe 7 zerkleinern. Mit dem Spatel nach unten schieben.',
      'Wasser oder Orangensaft zugeben und 10 Sek./Stufe 5 mischen. Die Masse soll zusammenkleben, wenn man sie zusammendrückt. Ist sie zu trocken, noch 1 EL Flüssigkeit dazu.',
      'Mit feuchten Händen etwa 20 Kugeln von je 15 g formen, in Kokosraspeln wälzen und 30 Minuten kalt stellen.',
    ],
  },
];

const plan = [
  { day: '2026-11-16', dish_id: 'hackbaellchen', lunchbox: 'Sandwich mit Frischkäse, Käse und Gurkenscheiben. Dazu Snackmöhren und Apfelspalten mit etwas Zitronensaft.' },
  { day: '2026-11-17', prep: '4 Hackbällchen pro Kind für die Brotbox beiseitestellen.', dish_id: 'bohnen-wraps', lunchbox: 'Kalte Hackbällchen vom Montag (4 pro Kind) mit Ketchup im Döschen und 1 Scheibe Brot. Dazu Datteltomaten und Orangenspalten. Kühlakku einpacken.' },
  { day: '2026-11-18', dish_id: 'fischstaebchen', lunchbox: '' }, // Buß- und Bettag, schulfrei
  { day: '2026-11-19', prep: 'Aufbackbrötchen für die Brotbox backen.', dish_id: 'haehnchen-nudeln', lunchbox: 'Brötchen mit Prosciutto Cotto und Gurke. Dazu Snackmöhren, ein kleiner Becher Joghurt oder Skyr und Orangenspalten. Kühlakku einpacken.' },
  { day: '2026-11-20', prep: 'Energiebällchen für die Brotbox machen (Rezept unter „Brotbox-Rezepte“). Eine Portion Nudeln vom Abendessen für den Nudelsalat aufheben.', dish_id: 'knoedelgroestl', lunchbox: 'Nudelsalat: Nudeln vom Donnerstag mit Mais, Erbsen, Käsewürfeln und 100 g Joghurt. Dazu Apfel und 2 Energiebällchen. Kühlakku einpacken.' },
  { day: '2026-11-21', dish_id: 'burger', lunchbox: '' },
  { day: '2026-11-22', dish_id: 'gyros', lunchbox: '' },
].map((p) => ({ skipped: false, prep: '', ...p }));

const T1 = 'Großeinkauf am 13. oder 14.11.';
const T2 = 'Kleiner Einkauf vom 16. bis 18.11.';
const shoppingRaw = [
  [T1, 'fleisch', 'Bio-Hackfleisch vom Rind', '4 Packungen à 400 g, Angebot, 2 einfrieren'],
  [T1, 'fleisch', 'Bio-Landhähnchen Ministeaks', '2 Packungen à 350 g'],
  [T1, 'fleisch', 'Bio-Hähnchenbrustfilet', '800 g, für Sonntag gleich einfrieren'],
  [T1, 'tk', 'Seelachsfilet tiefgekühlt', '700 g'],
  [T1, 'tk', 'Erbsen tiefgekühlt', '450 g'],
  [T1, 'kuehl', 'Bio-Eier', '10 Stück'],
  [T1, 'kuehl', 'Bio-Milch', '1 l'],
  [T1, 'kuehl', 'Bio-Butter', '250 g'],
  [T1, 'kuehl', 'Bio-Frischkäse natur', '2 Packungen'],
  [T1, 'kuehl', 'Bio-Naturjoghurt', '500 g'],
  [T1, 'kuehl', 'Bio-Käse in Scheiben', '2 Packungen'],
  [T1, 'kuehl', 'Parmesan', '1 Stück'],
  [T1, 'kuehl', 'Joghurt oder Skyr, kleine Becher', '2 Stück, Brotbox'],
  [T1, 'kuehl', 'Skyr natur', '500 g, Tzatziki'],
  [T1, 'kuehl', 'Hefe', '1 Würfel'],
  [T1, 'obst', 'Bio-Kartoffeln, vorwiegend festkochend', '2 kg'],
  [T1, 'obst', 'Bio-Karotten', '1 kg'],
  [T1, 'obst', 'Bio Snackmöhren', '2 Packungen, Angebot'],
  [T1, 'obst', 'Zwiebeln', '1 Netz'],
  [T1, 'obst', 'Knoblauch', '1 Knolle'],
  [T1, 'obst', 'Spitzpaprika rot', '500 g, Angebot bis 14.11. (nicht Bio)'],
  [T1, 'obst', 'Datteltomaten', '500 g, Angebot'],
  [T1, 'obst', 'Bio-Gurke', '1 Stück'],
  [T1, 'obst', 'Eisbergsalat', '1 Kopf'],
  [T1, 'obst', 'Avocados', '2 Stück'],
  [T1, 'obst', 'Bio-Zitronen', '3 Stück'],
  [T1, 'obst', 'Äpfel „Krumme Dinger“', '2 kg, Angebot bis 14.11. (nicht Bio)'],
  [T1, 'obst', 'Orangen', '2 kg, Angebot'],
  [T1, 'brot', 'Bio-Brot', '1 Laib'],
  [T1, 'brot', 'Aufbackbrötchen', '1 Packung'],
  [T1, 'brot', 'Weizen-Tortillas', '8 Stück werden gebraucht'],
  [T1, 'brot', 'Pita-Brote', '8 Stück'],
  [T1, 'vorrat', 'Bio-Reis', '300 g'],
  [T1, 'vorrat', 'Bio-Nudeln, kein Vollkorn', '500 g, Penne oder Fusilli'],
  [T1, 'vorrat', 'Bio passierte Tomaten', '3 Packungen à 500 g'],
  [T1, 'vorrat', 'Tomatenmark', '1 Tube'],
  [T1, 'vorrat', 'Bio-Kidneybohnen', '2 Dosen'],
  [T1, 'vorrat', 'Bio-Mais', '2 kleine Dosen'],
  [T1, 'vorrat', 'Semmelbrösel', '1 Packung'],
  [T1, 'vorrat', 'Bio-Weizenmehl Type 405 oder 550', '1 kg'],
  [T1, 'vorrat', 'Bio-Haferflocken', '1 Packung, Energiebällchen'],
  [T1, 'vorrat', 'Datteln entsteint', '200 g, Energiebällchen'],
  [T1, 'vorrat', 'Kakaopulver ungesüßt', 'falls nicht im Haus, Energiebällchen'],
  [T1, 'vorrat', 'Kokosraspel', '1 Packung, Energiebällchen'],
  [T1, 'vorrat', 'Erdnussmus', '1 Glas, ohne Nüsse: Sonnenblumenkerne'],
  [T1, 'vorrat', 'Backkakao', ''],
  [T1, 'vorrat', 'Ketchup', ''],
  [T2, 'kuehl', 'Bio Serviettenknödel', '2 Packungen à 390 g, Angebot'],
  [T2, 'kuehl', 'Prosciutto Cotto', '2 Packungen à 240 g, Angebot'],
  [T2, 'obst', 'Bio-Gurken', '2 Stück'],
  [T2, 'obst', 'Tomaten', '6 Stück'],
  [T2, 'obst', 'Schnittlauch', '1 Bund'],
];
const shopping = shoppingRaw.map(([trip, category, label, qty], n) => ({
  id: `s-2026-11-16-${String(n + 1).padStart(2, '0')}`,
  week_start: '2026-11-16', trip, due: trip === T1 ? '2026-11-13' : '2026-11-16', category, label, qty, sort: n,
  purpose: '', missing: false, buyer: null,
  checked: false, checked_by: null, checked_at: null, manual: false,
}));

// Haushaltsaufgaben. Kind 1 ist der 12-Jährige, Kind 2 die 9-Jährige.
// minutes 0 heißt Grundaufgabe ohne Bildschirmzeit.
const task = (id, sort, name, minutes, schedule, who, extra = {}) => ({
  id, sort, name, minutes, schedule, who, rotate: false, rot_offset: 0, max_per_day: 1, months: [], note: '', active: true, ...extra,
});
const tasks = [
  task('meerschwein-kaefig', 1, 'Meerschweinchen-Käfig sauber machen', 30, 'woechentlich', ['p3', 'p4'],
    { rotate: true, note: 'Einstreu komplett wechseln, Häuschen, Näpfe und Trinkflasche auswaschen. Die Kleine anfangs mit Hilfe.' }),
  task('meerschwein-futter', 2, 'Meerschweinchen füttern und Wasser auffüllen', 0, 'taeglich', ['p3', 'p4'], { rotate: true, rot_offset: 1 }),
  task('tisch-decken', 3, 'Tisch decken', 0, 'taeglich', ['p3', 'p4'], { rotate: true }),
  task('tisch-abraeumen', 4, 'Tisch abräumen', 0, 'taeglich', ['p3', 'p4'], { rotate: true, rot_offset: 1 }),
  task('tonne', 5, 'Tonne an die Straße stellen', 10, 'tonne', ['p3'],
    { note: 'Am Abend rausstellen und nach der Abholung am nächsten Tag zurückholen.' }),
  task('staubsaugen-etage', 6, 'Staubsaugen, ein Stockwerk', 20, 'woechentlich', ['p3']),
  task('staubsaugen-zimmer', 7, 'Staubsaugen, eigenes Zimmer', 10, 'woechentlich', ['p4']),
  task('spuelmaschine', 8, 'Spülmaschine ausräumen', 10, 'bedarf', ['p3', 'p4'], { max_per_day: 2 }),
  task('muell', 9, 'Müll aus der Küche rausbringen', 5, 'bedarf', ['p3', 'p4'], { max_per_day: 2 }),
  task('kochen', 10, 'Beim Kochen helfen', 15, 'bedarf', ['p4'],
    { note: 'Zum Beispiel panieren, Teig kneten, Gemüse schneiden oder Tzatziki machen.' }),
  task('laub', 11, 'Laub aufsammeln', 20, 'bedarf', ['p3', 'p4'], { months: [10, 11] }),
];

export const SEED_TASKS = tasks;

// „Immer wieder“: Dinge, die regelmäßig gebraucht werden, unabhängig vom Wochenplan.
export const STAPLES = [
  ['Bio-Milch', 'kuehl', '2 l'], ['Bio-Naturjoghurt', 'kuehl', ''], ['Bio-Butter', 'kuehl', ''], ['Bio-Eier', 'kuehl', '10 Stück'],
  ['Käse in Scheiben', 'kuehl', ''], ['Brot', 'brot', ''], ['Äpfel', 'obst', ''], ['Bananen', 'obst', ''],
  ['Gemüse fürs Meerschweinchen', 'obst', 'Gurke, Paprika, Salat'], ['Heu', 'haushalt', ''], ['Einstreu', 'haushalt', ''],
  ['Meerschweinchenfutter', 'haushalt', ''], ['Klopapier', 'haushalt', ''], ['Küchenrolle', 'haushalt', ''],
  ['Spülmaschinentabs', 'haushalt', ''], ['Müllbeutel', 'haushalt', ''], ['Kaffee', 'vorrat', ''], ['Bio-Haferflocken', 'vorrat', ''],
];
const staples = STAPLES.map(([label, category, qty], n) => ({ id: `st-${String(n + 1).padStart(2, '0')}`, label, category, qty, sort: n, last_added: null }));

// Typischer Vorrat. Was als "da" markiert ist, steht auf neuen Einkaufslisten schon abgehakt.
const pantry = ['Bio-Weizenmehl', 'Bio-Reis', 'Spaghetti', 'Nudeln', 'Semmelbrösel', 'Bio passierte Tomaten', 'Tomatenmark',
  'Bio-Kidneybohnen', 'Bio-Mais', 'rote Linsen', 'Bulgur', 'Bio-Haferflocken', 'Erbsen tiefgekühlt', 'Sojasauce', 'Ketchup']
  .map((label, n) => ({ id: `v${String(n + 1).padStart(2, '0')}`, label, have: true, sort: n + 1 }));

export const SEED = {
  tasks,
  pantry,
  staples,
  persons,
  dishes: dishes.map((d) => ({ favorite: false, manual_archived: false, rule_from: '1970-01-01T00:00:00Z', ...d })),
  plan,
  shopping,
};
