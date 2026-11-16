import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
(globalThis as any).Deno = { env: { get: (k: string) => (k === 'ANTHROPIC_API_KEY' ? 'x' : undefined) }, serve: () => {} };
const m = await import(ROOT + '/supabase/functions/push/index.ts');
for (const w of ['2026-11-23', '2026-12-21', '2026-12-28', '2027-01-04', '2027-01-11', '2027-03-29']) {
  const sd = m.shopDays(w);
  console.log(w, 'gross', sd.gross.day, sd.gross.why || '-', '| frisch', sd.frisch.day, sd.frisch.why || '-', sd.frisch.mittags ? '(mittags zu)' : '');
}
const imp = m.toImport({ tage: [], neue_gerichte: [], einkauf: [{ name: 'Milch', menge: '1 l', tour: 'gross', abteilung: 'kuehl' }, { name: 'Brot', menge: '1', tour: 'frisch', abteilung: 'brot' }] }, '2026-12-28');
console.log('Touren:', JSON.stringify(imp.shopping.map((x: any) => [x.trip, x.due])));
// Automatischer Entwurf: Für die Woche ab 28.12. schon am Montag, 21.12.
const store: any = { calls: [] as string[], get: async (p: string) => {
  if (p.startsWith('ep_settings')) return [];
  if (p.startsWith('ep_ai_runs?select=id&week_start')) { store.calls.push(p); return [{ id: 'x' }]; }
  return [];
}, upsert: async () => {} };
for (const t of ['2026-12-21T11:30:00Z', '2026-12-18T11:30:00Z', '2026-12-11T11:30:00Z']) {
  store.calls.length = 0;
  await m.stepPlanner(store, Date.parse(t), ['p1']);
  console.log(t, 'prüft Woche:', store.calls.map((c: string) => c.match(/eq\.(\d{4}-\d{2}-\d{2})/)?.[1]).join(',') || '-');
}
