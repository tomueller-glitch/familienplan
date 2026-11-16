import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const m = await import(ROOT + '/supabase/functions/push/index.ts');
const week = '2026-11-16';
console.log('Start:', m.offerStart('2 Packungen à 390 g, Angebot ab 20.11., nicht Bio', week), m.offerStart('1 kg, Angebot, Bio', week), m.offerStart('Angebot ab 2.1.', '2026-12-28'));
const d = { tage: [], neue_gerichte: [], einkauf: [
  { name: 'Bio Serviettenknödel', menge: '2 Packungen, Angebot ab 20.11., nicht Bio', tour: 'frisch' },
  { name: 'Hähnchen', menge: '1 kg, Angebot ab 13.11., nicht Bio', tour: 'gross' },
  { name: 'Lachs', menge: '200 g, Angebot ab 16.11., Bio', tour: 'gross' },
  { name: 'Quark', menge: '500 g, Angebot ab 16.11., Bio', tour: 'frisch' },
] };
const r = m.checkDraft(d, { rules: { ...m.DEFAULT_RULES }, ctx: null, week });
console.log('Fehler zu Angeboten:', JSON.stringify(r.errors.filter((e: string) => e.includes('Angebot'))));
const p = m.planPrompt({ rules: { ...m.DEFAULT_RULES }, ctx: null, offers: '', week, wish: '' }) as any;
console.log('Regel im Prompt:', JSON.stringify(p).includes('spätestens an diesem Tag beginnen'), 'Suche:', m.offersPrompt(week).slice(0, 160));
