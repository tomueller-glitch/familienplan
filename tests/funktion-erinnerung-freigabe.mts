import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
(globalThis as any).Deno = { env: { get: (k: string) => (k === 'ANTHROPIC_API_KEY' ? 'x' : undefined) }, serve: () => {} };
const m = await import(ROOT + '/supabase/functions/push/index.ts');
const store: any = { get: async (p: string) => {
  if (p.startsWith('ep_settings')) return [{ key: 'regeln', value: { auto: false } }];
  if (p.startsWith('ep_ai_runs?select=id,week_start')) return p.includes('week_start=eq.2026-11-23') ? [{ id: 'r1', week_start: '2026-11-23' }] : [];
  if (p.startsWith('ep_ai_runs?select=*')) return [];
  return [];
} };
for (const t of ['2026-11-20T18:30:00Z', '2026-11-20T10:00:00Z', '2026-11-21T07:00:00Z', '2026-11-21T14:00:00Z']) {
  const out = await m.stepPlanner(store, Date.parse(t), ['p1', 'p2']);
  console.log(t, JSON.stringify(out.map((o: any) => [o.key, o.msg.body])));
}
