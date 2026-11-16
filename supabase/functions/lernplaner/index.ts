// Supabase-Funktion "lernplaner": leitet Anfragen aus lernen.html an Claude weiter.
// Nur für angemeldete Geräte des Familienplans. Nutzt den Claude-Schlüssel aus den Secrets der Edge Functions.
// Deployen: Supabase > Edge Functions > Deploy a new function > Via Editor, Name "lernplaner", diesen Code einfügen.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Nur POST erlaubt' }, 405);

  // Angemeldet?
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return json({ error: 'Bitte im Familienplan anmelden' }, 401);

  // Derselbe Schlüssel wie beim Familienplan. Falls das Secret dort anders heißt, wird es hier mit gefunden.
  const key = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY') || Deno.env.get('ANTHROPIC_KEY') || Deno.env.get('CLAUDE_KEY');
  if (!key) return json({ error: 'Kein Claude-Schlüssel in den Secrets gefunden' }, 500);

  let body: { prompt?: unknown; images?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Ungültige Anfrage' }, 400); }
  const prompt = body.prompt;
  const images = Array.isArray(body.images) ? body.images as { type?: string; data?: string }[] : [];
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 30000 || images.length > 4) return json({ error: 'Ungültige Anfrage' }, 400);

  const content = [
    ...images
      .filter((i) => i && typeof i.data === 'string' && i.data.length < 8_000_000)
      .map((i) => ({ type: 'image', source: { type: 'base64', media_type: /^image\/(png|jpeg|gif|webp)$/.test(i.type || '') ? i.type : 'image/jpeg', data: i.data } })),
    { type: 'text', text: prompt },
  ];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('LERNPLANER_MODEL') || 'claude-sonnet-5-5', max_tokens: 2000, messages: [{ role: 'user', content }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: j?.error?.message || 'Fehler bei der Claude-API' }, r.status === 429 ? 429 : 502);
  const text = (j.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
  return json({ text });
});
