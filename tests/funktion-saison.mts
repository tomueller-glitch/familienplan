import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const { planPrompt, DEFAULT_RULES } = await import(ROOT + '/supabase/functions/push/index.ts');
const a = planPrompt({ rules: { ...DEFAULT_RULES }, ctx: null, offers: '', week: '2026-11-23', wish: '' }) as any;
const txt = JSON.stringify(a);
console.log('mit:', txt.includes('Saison und Region (November in Franken)'), 'ohne:', JSON.stringify(planPrompt({ rules: { ...DEFAULT_RULES, saison: false }, ctx: null, offers: '', week: '2026-11-23', wish: '' })).includes('Saison und Region'));
