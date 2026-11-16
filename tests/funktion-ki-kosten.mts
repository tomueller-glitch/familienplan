import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const m = await import(ROOT + '/supabase/functions/push/index.ts');
console.log(m.usageCost('claude-sonnet-5-5', { input_tokens: 20000, output_tokens: 15000 }, true).toFixed(4), m.usageCost('claude-haiku-5-5', { input_tokens: 3000, output_tokens: 800 }).toFixed(5), m.usageCost('claude-sonnet-5-5', { input_tokens: 30000, output_tokens: 3000, server_tool_use: { web_search_requests: 6 } }, true).toFixed(4));
