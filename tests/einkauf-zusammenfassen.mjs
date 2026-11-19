// Gleiche Posten zusammenfassen: Schlüssel, Mengen, Listen aus Claudes Plan und aus den Rezepten.
import * as L from '../js/logic.js';
const keys = ['Zwiebel','Zwiebeln','Knoblauchzehe','Knoblauchzehen','Pilze','Pilz','Champignons','Champignon','Tomate','Tomaten','Eier','Ei','Äpfel','Apfel','Nüsse','Nuss','Kartoffeln','Kartoffel','Paprika','Paprikas','rote Paprika','Rote Paprika','Bio-Zwiebeln','Linsen','rote Linsen','Sahne','Käse','Hähnchen','Brötchen','Reis','Mais','Zucchini','Möhren','Möhre','Frühlingszwiebeln','Lauchzwiebel'];
console.log(keys.map((k) => `${k}=${L.itemKey(k)}`).join('  '));
// Kollisionen verschiedener Dinge?
const all = ['Rind','Rinde','Sahne','Salami','Salat','Reis','Mais','Milch','Mehl','Möhre','Mohn','Kohl','Kohlrabi','Lauch','Linsen','Linse','Erbsen','Bohnen','Butter','Brot','Brote','Feta','Feige','Hefe','Honig','Kapern','Kaper','Kresse','Oliven','Senf','Speck','Tofu','Wraps','Gurken','Gurke','Birnen','Beeren','Spinat','Rotkohl','Kopfsalat','Quark','Joghurt','Schmand','Nudeln','Spaghetti','Penne','Lasagneplatten','Lachs','Lachsfilet','Hackfleisch'];
const m = {}; for (const a of all) (m[L.itemKey(a)] ||= []).push(a); console.log(Object.values(m).filter((x) => x.length > 1));
for (const t of ['2 Stück','2 Stk.','1 kg','1,5 l','2 Dosen','1 Dose','ca. 300 g','2 Packungen à 400 g','½ Bund','3','1 Kopf','2 EL']) console.log(t, '->', JSON.stringify(L.parseQtyText(t)));
const it = (id, label, qty, purpose, sort, extra = {}) => ({ id, week_start: '2026-11-23', trip: 'Großeinkauf', due: '2026-11-21', label, qty, purpose, sort, category: 'obst', ...extra });
const list = [it('a','Knoblauchzehen','2 Stück','Chili con Carne (Di)',1), it('b','Knoblauchzehe','2 Stk.','Spinat-Lasagne (Sa), Fränkisches Rindergulasch (So)',2), it('c','Zwiebel','2 Stk.','Seelachs-Frikadellen (Mo), Spinat-Lasagne (Sa)',7), it('d','Zwiebeln','2 Stück','Chili con Carne (Di), Gemüsefrittata (Mi)',8), it('e','Rotkohl','700 g','Gulasch (So)',5), it('f','Rotkohl','1 kg','Wraps (Fr)',6), it('g','Petersilie','1 Bund','x (Mo)',9), it('h','Petersilie','2 EL','y (Di)',10), it('i','Zwiebeln','1 Stück','z (Fr)',11, { trip: 'Frischeeinkauf', due: '2026-11-25' })];
for (const x of L.mergeList(list)) console.log(x.id, x.label, '|', x.qty, '|', x.purpose, '|', x.trip);
// Aus Rezepten
const dishes = [{ id: 'd1', name: 'Chili con Carne', ingredients: [{ n: 'Knoblauchzehen', q: 2, u: 'Stück', c: 'obst' }, { n: 'Zwiebeln', q: 2, u: '', c: 'obst' }, { n: 'Hackfleisch', q: 0.5, u: 'kg', c: 'fleisch' }] },
  { id: 'd2', name: 'Spinat-Lasagne', ingredients: [{ n: 'Knoblauchzehe', q: 2, u: 'Stk.', c: 'obst' }, { n: 'Zwiebel', q: 1, u: 'Stk.', c: 'obst' }, { n: 'Hackfleisch', q: 300, u: 'g', c: 'fleisch' }, { n: 'Knoblauch', q: 1, u: 'Zehe', c: 'obst' }] }];
const plan = [{ day: '2026-11-24', dish_id: 'd1' }, { day: '2026-11-28', dish_id: 'd2' }];
for (const x of L.buildShopping('2026-11-23', plan, dishes)) console.log('Rezept:', x.label, '|', x.qty, '|', x.purpose);
