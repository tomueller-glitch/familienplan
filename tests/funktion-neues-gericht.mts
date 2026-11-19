// Neues Gericht von Claude: Auftrag und Prüfung des Vorschlags.
import { newDishPrompt, newDishProblem, mergeRules } from '../supabase/functions/push/index.ts';
const rules = mergeRules({ ausschluesse: ['Rosenkohl', 'Rosinen'] });
const p = newDishPrompt({
  tag: '2026-11-24', wochentag: 'Dienstag', alt: 'Nudeln mit Hähnchen', wunsch: 'lieber mit Fisch', abgelehnt: ['Hähnchen-Lauch-Pfanne'],
  woche: [{ tag: '2026-11-23', wochentag: 'Montag', gericht: 'Chili con Carne', zutaten: ['Hackfleisch', 'Bohnen'] }],
  sammlung: ['Chili con Carne', 'Nudeln mit Hähnchen'], esser: 3, gaeste: 1, weg: ['Papa'], kochzeit: 40, gekauft: ['Lauch'], vorrat: ['Reis'], reste: [],
}, rules);
for (const want of ['Dienstag, 24.11.', 'statt „Nudeln mit Hähnchen“', 'lieber mit Fisch', 'Hähnchen-Lauch-Pfanne', 'höchstens 40 Minuten', 'Es essen 3 Personen mit, dazu 1 Gast, Papa fehlt', 'Montag: Chili con Carne (Hackfleisch, Bohnen)', 'bitte möglichst davon verwenden: Lauch', 'Im Vorrat: Reis', 'Rosenkohl, Rosinen', '(davon keines): Chili con Carne; Nudeln mit Hähnchen'])
  console.log(p.includes(want) ? 'ok  ' : 'FEHLT', want);
console.log('Gedankenstrich im Auftrag:', /[–—]/.test(p));
const g = { name: 'Lachs-Lauch-Gratin', zutaten: [{ name: 'Lachs' }], schritte: ['x'] };
console.log('passt:', JSON.stringify(newDishProblem(g, ['Chili con Carne'], rules)));
console.log('schon da:', newDishProblem({ ...g, name: 'chili con carne' }, ['Chili con Carne'], rules));
console.log('Ausschluss:', newDishProblem({ ...g, zutaten: [{ name: 'Rosenkohl' }] }, [], rules));
console.log('leer:', newDishProblem({ ...g, schritte: [] }, [], rules));
