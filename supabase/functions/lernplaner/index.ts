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

  let body: { prompt?: unknown; images?: unknown; web?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Ungültige Anfrage' }, 400); }
  const prompt = body.prompt;
  const images = Array.isArray(body.images) ? body.images as { type?: string; data?: string }[] : [];
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 30000 || images.length > 4) return json({ error: 'Ungültige Anfrage' }, 400);

  const content = [
    ...images
      .filter((i) => i && typeof i.data === 'string' && i.data.length < 8_000_000)
      // PDF (zum Beispiel ein Inhaltsverzeichnis als Datei) geht als Dokument an Claude, alles andere als Bild.
      .map((i) => i.type === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: i.data } }
        : { type: 'image', source: { type: 'base64', media_type: /^image\/(png|jpeg|gif|webp)$/.test(i.type || '') ? i.type : 'image/jpeg', data: i.data } }),
    { type: 'text', text: prompt },
  ];
  // Mit web: true darf Claude im Lehrplan und bei den Schulbuchverlagen nachsehen (Websuche der Claude-API).
  const web = body.web === true;
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3,
    allowed_domains: ['lehrplanplus.bayern.de', 'isb.bayern.de', 'ccbuchner.de', 'klett.de', 'cornelsen.de', 'westermann.de'] }];
  type Block = { type: string; text?: string };
  const call = async (withWeb: boolean) => {
    const messages: { role: string; content: unknown }[] = [{ role: 'user', content }];
    let last: { ok: boolean; status: number; j: Record<string, any> } = { ok: false, status: 0, j: {} };
    // Die Websuche kann mit "pause_turn" unterbrechen; dann einfach weiterlaufen lassen.
    for (let i = 0; i < 3; i++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: Deno.env.get('LERNPLANER_MODEL') || 'claude-sonnet-5-5', max_tokens: 4000,
          messages, ...(withWeb ? { tools } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      last = { ok: r.ok, status: r.status, j };
      if (!r.ok || j.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: j.content });
    }
    return last;
  };
  let res = await call(web);
  // Klappt es mit Websuche nicht, ohne sie noch einmal versuchen.
  if (web && !res.ok && res.status !== 429) res = await call(false);
  if (!res.ok) {
    const msg = res.j?.error?.message || `Claude-API antwortet mit ${res.status}`;
    console.error('lernplaner', res.status, msg);
    return json({ error: msg }, res.status === 429 ? 429 : 502);
  }
  // Nur den Text nach dem letzten Suchergebnis zurückgeben: dort steht die eigentliche Antwort.
  const blocks: Block[] = res.j.content || [];
  let from = 0;
  blocks.forEach((b, i) => { if (b.type !== 'text') from = i + 1; });
  const text = blocks.slice(from).filter((b) => b.type === 'text').map((b) => b.text || '').join('')
    || blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
  return json({ text, stop: res.j.stop_reason || null });
});
