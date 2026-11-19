// Familienplan: Push-Nachrichten.
// Supabase Edge Function "push". Läuft alle 5 Minuten über Supabase Cron und schickt:
//  - am Vorabend der Müllabfuhr ab 18 Uhr eine Erinnerung an das Kind, das mit der Tonne dran ist,
//  - den Eltern eine Nachricht, sobald ein Kind eine Aufgabe als erledigt meldet,
//  - dem Kind eine Nachricht, sobald Mama oder Papa die Aufgabe bestätigt oder abgelehnt hat,
//  - freitags um 17 Uhr den Kindern eine Erinnerung an das Herz der Woche,
//  - am Einkaufstag ab 7 Uhr den Eltern eine Erinnerung, solange auf der Liste noch etwas offen ist,
//  - den Eltern eine Erinnerung, wenn es Zeit zum Kochen ist (Essenszeit minus Kochdauer). Abschaltbar.
//  - den Eltern um 19 Uhr, was für den nächsten Tag vorzubereiten ist (Fisch auftauen, Brötchen aufbacken),
//  - allen morgens einen Überblick über den Tag (werktags 7 Uhr, am Wochenende 8:30 Uhr). Abschaltbar.
//  - freitags einen Wochenplan-Entwurf von Claude (wenn ANTHROPIC_API_KEY gesetzt ist), siehe „Wochenplan mit Claude“.
//  - abends eine Erinnerung an alle, die mitgegessen, aber das Abendessen noch nicht bewertet haben.
//    Kinder etwa eine Stunde nach dem Essen, spätestens 20:15 Uhr, Erwachsene nach 90 Minuten. Abschaltbar.
//  - den Kindern eine Nachricht, sobald Mama oder Papa einen Mülleimer in der Küche auf Rot stellen (Müll-Ampel),
//  - den Kindern eine Nachricht, wenn die Spülmaschine fertig ist (von Hand auf Rot oder zur eingestellten Endzeit),
//  - sonntags ab 18:30 Uhr den Eltern den Hinweis auf den Wochenrückblick,
//  - Lernplaner (lernen.html): Anpfiff und Endspurt an das Kind, Erinnerung am Abend vor einer Prüfung,
//    den Eltern den Stand am Abend, sofort Bescheid bei „schwer“, das gewonnene Wochenspiel und sonntags
//    die Mannschaftsbesprechung. Abschaltbar im Lernplaner unter Einstellungen.
// Außerdem kann die App eine Testnachricht an das eigene Gerät anfordern.
//
// Die Datei kommt ohne fremde Bibliotheken aus. Verschlüsselung (RFC 8291) und
// VAPID-Anmeldung (RFC 8292) laufen über die eingebaute WebCrypto-Schnittstelle.
//
// Secrets der Funktion (Dashboard > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY   öffentlicher Schlüssel, derselbe wie in js/config.js
//   VAPID_PRIVATE_KEY  privater Schlüssel, nur hier eintragen
//   VAPID_SUBJECT      Kontakt für die Push-Dienste, z. B. https://familienplan.netlify.app
//   CRON_SECRET        langes Zufallswort, das auch im Cron-Job steht
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase selbst bereit. Sind die alten
// Schlüssel im Projekt abgeschaltet, zusätzlich SERVICE_KEY mit dem Secret Key (sb_secret_...) anlegen.

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
type Sub = { endpoint: string; p256dh: string; auth: string };
type Vapid = { publicKey: string; privateKey: string; subject: string };
type Message = {
  title: string; body: string; tag?: string; url?: string;
  // Knöpfe in der Nachricht (Android, Windows, Chrome). iPhone zeigt keine Knöpfe, dort öffnet ein Tippen die App.
  actions?: { action: string; title: string }[]; actionUrls?: Record<string, string>;
};

const enc = new TextEncoder();

/* ---------- Base64url ---------- */

export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(text: string): Uint8Array {
  const t = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

// Eigener ArrayBuffer für WebCrypto und fetch. Neuere TypeScript-Versionen verlangen das ausdrücklich.
const ab = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', ab(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, ab(data)));
}

/* ---------- Verschlüsselung nach RFC 8291 (aes128gcm) ---------- */

// Für Tests lassen sich Absenderschlüssel und Salz vorgeben, sonst werden sie zufällig erzeugt.
export async function encryptPayload(
  sub: Sub,
  payload: Uint8Array,
  fixed?: { asPrivate: string; asPublic: string; salt: string },
): Promise<Uint8Array> {
  const uaPublic = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  let asKeys: CryptoKeyPair | { privateKey: CryptoKey };
  let asPublic: Uint8Array;
  if (fixed) {
    asPublic = unb64u(fixed.asPublic);
    const jwk = {
      kty: 'EC', crv: 'P-256', d: fixed.asPrivate,
      x: b64u(asPublic.slice(1, 33)), y: b64u(asPublic.slice(33, 65)),
    };
    asKeys = { privateKey: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']) };
  } else {
    asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', (asKeys as CryptoKeyPair).publicKey));
  }
  const uaKey = await crypto.subtle.importKey('raw', ab(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const salt = fixed ? unb64u(fixed.salt) : crypto.getRandomValues(new Uint8Array(16));

  const prkKey = await hmac(authSecret, ecdh);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const aes = await crypto.subtle.importKey('raw', ab(cek), 'AES-GCM', false, ['encrypt']);
  const plain = concat(payload, new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ab(nonce) }, aes, ab(plain)));

  const rs = new Uint8Array([0, 0, 16, 0]); // Datensatzgröße 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/* ---------- VAPID-Anmeldung nach RFC 8292 ---------- */

// Apple: die Anmeldung (JWT) nicht öfter als einmal pro Stunde erneuern. Deshalb je Push-Dienst
// eine Stunde lang dieselbe Anmeldung wiederverwenden, solange die Funktion läuft.
const jwtCache = new Map<string, { at: number; header: string }>();
export async function vapidHeader(endpoint: string, vapid: Vapid, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const origin = new URL(endpoint).origin;
  const hit = jwtCache.get(origin + vapid.publicKey);
  if (hit && nowSec - hit.at < 55 * 60 && nowSec >= hit.at) return hit.header;
  const header = await makeVapidHeader(origin, vapid, nowSec);
  jwtCache.set(origin + vapid.publicKey, { at: nowSec, header });
  return header;
}
async function makeVapidHeader(origin: string, vapid: Vapid, nowSec: number): Promise<string> {
  const pub = unb64u(vapid.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', d: vapid.privateKey, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)) };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: origin, exp: nowSec + 12 * 3600, sub: vapid.subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`)));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`;
}

// Topic-Kopfzeile: Apple prüft sie als gültiges Base64url (Länge darf nicht 4n+1 sein) mit höchstens 32 Zeichen.
// Kennzeichen wie "offen", "tonne" oder "liste-neu" wurden deshalb mit BadWebPushTopic abgelehnt.
// Darum aus dem Kennzeichen einen festen Wert mit genau 32 Zeichen bilden: gleiches Kennzeichen, gleiches Topic,
// eine neuere Nachricht ersetzt also weiterhin die ältere.
export async function pushTopic(tag: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(tag)));
  return b64u(h.slice(0, 24));
}

// Schickt eine Nachricht an ein Gerät. Liefert den HTTP-Status des Push-Dienstes.
export async function sendPush(sub: Sub, msg: Message, vapid: Vapid, ttl = 86400): Promise<number> {
  return (await sendPushDetailed(sub, msg, vapid, ttl)).status;
}
// Wie sendPush, liefert zusätzlich den Grund, den der Push-Dienst bei einer Ablehnung nennt (Apple: {"reason": "..."}).
export async function sendPushDetailed(sub: Sub, msg: Message, vapid: Vapid, ttl = 86400): Promise<{ status: number; reason: string }> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(msg)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      // „high“: Apple stellt sonst im Stromsparmodus verzögert oder gar nicht zu.
      Urgency: 'high',
      ...(msg.tag ? { Topic: await pushTopic(msg.tag) } : {}),
    },
    body: ab(body),
  });
  let reason = '';
  if (res.status >= 300) {
    const txt = await res.text().catch(() => '');
    try { reason = String(JSON.parse(txt).reason || ''); } catch { reason = txt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); }
  } else await res.body?.cancel();
  return { status: res.status, reason };
}

/* ---------- Datum und Uhrzeit in Deutschland ---------- */

export function berlin(ms: number): { day: string; min: number; wd: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday);
  return { day: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute), wd };
}

const DAY = 86400000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const wdOf = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
export const mondayOf = (iso: string) => addDays(iso, -wdOf(iso));

// Wer ist dran? Gleiche Regel wie in js/aufgaben.js: wöchentlicher Wechsel ab dem 1.1.2024.
export function assignees(task: Row, day: string): string[] {
  const who: string[] = task.who || [];
  if (!who.length) return [];
  if (!task.rotate) return who;
  const n = Math.floor((Date.parse(`${mondayOf(day)}T00:00:00Z`) - Date.parse('2024-01-01T00:00:00Z')) / DAY / 7) + (task.rot_offset || 0);
  return [who[((n % who.length) + who.length) % who.length]];
}

// Bayerische Schulferien, gleiche Liste wie in js/ferien.js (die Prüfung tests/funktion-schultage.mts vergleicht beide).
export const FERIEN: [string, string][] = [
  ['2026-08-03', '2026-09-14'],
  ['2026-11-02', '2026-11-06'],
  ['2026-12-24', '2027-01-08'],
  ['2027-02-08', '2027-02-12'],
  ['2027-03-22', '2027-04-02'],
  ['2027-05-18', '2027-05-28'],
  ['2027-08-02', '2027-09-13'],
  ['2027-11-02', '2027-11-05'],
  ['2027-12-24', '2028-01-07'],
  ['2028-02-28', '2028-03-03'],
  ['2028-04-10', '2028-04-21'],
  ['2028-06-06', '2028-06-16'],
  ['2028-07-31', '2028-09-11'],
];
// Schultag: Montag bis Freitag, keine Ferien, kein Feiertag und nicht Buß- und Bettag.
export function schoolDay(day: string): boolean {
  if (wdOf(day) >= 5) return false;
  if (FERIEN.some(([a, b]) => day >= a && day <= b)) return false;
  if (shopHoliday(day)) return false;
  const y = Number(day.slice(0, 4));
  const n22 = `${y}-11-22`;
  const buss = addDays(n22, -((wdOf(n22) - 2 + 7) % 7));
  return day !== buss && day.slice(5) !== '08-15';
}
// Lerntag: Montag bis Freitag ohne Ferien und Feiertage. Buß- und Bettag ist schulfrei, aber ein Lerntag.
export function lernTag(day: string): boolean {
  if (wdOf(day) >= 5) return false;
  if (FERIEN.some(([a, b]) => day >= a && day <= b)) return false;
  return !shopHoliday(day);
}
const inSeason = (task: Row, day: string) => (!task.school_only || schoolDay(day)) && (!(task.months || []).length || task.months.includes(Number(day.slice(5, 7))));

const TONNEN: Record<string, string> = { schwarz: 'schwarze Tonne', gruen: 'grüne Tonne', gelb: 'gelbe Tonne' };

/* ---------- Was ist fällig? ---------- */

// extraKeys: weitere Schlüssel, die mit dem Versand als erledigt gelten (z. B. die Einkaufserinnerung,
// wenn der Morgenüberblick sie schon enthält).
export type Due = { key: string; to: string[]; msg: Message; ttl: number; extraKeys?: string[] };

// Feste Aufgaben eines Kindes an einem Tag, die noch offen sind. Gleiche Regeln wie in js/aufgaben.js.
export function openTasks(tasks: Row[], log: Row[], pid: string, day: string, binTomorrow: string | null): string[] {
  const week = mondayOf(day);
  const d10 = (x: unknown) => String(x || '').slice(0, 10);
  const done = (t: Row, from: string, to: string) => log.some((e) => e.task_id === t.id && e.person_id === pid && d10(e.day) >= from && d10(e.day) <= to && e.status !== 'abgelehnt');
  const out: string[] = [];
  for (const t of tasks) {
    if (t.active === false || !inSeason(t, day) || !assignees(t, day).includes(pid)) continue;
    if (t.schedule === 'taeglich' && !done(t, day, day)) out.push(t.name);
    else if (t.schedule === 'woechentlich' && !done(t, week, addDays(week, 6))) out.push(`${t.name} (diese Woche)`);
    else if (t.schedule === 'tonne' && binTomorrow && !done(t, day, day)) out.push(`heute Abend ${binTomorrow} an die Straße`);
  }
  return out;
}

// Offene Grundaufgaben des Tages: täglich oder Tonne, ohne Minuten. Wochenaufgaben zählen nicht.
export function basicsOpen(tasks: Row[], log: Row[], pid: string, day: string, binTomorrow: string | null): string[] {
  const d10 = (x: unknown) => String(x || '').slice(0, 10);
  const done = (t: Row) => log.some((e) => e.task_id === t.id && e.person_id === pid && d10(e.day) === day && e.status !== 'abgelehnt');
  return tasks.filter((t) => !t.minutes && t.active !== false && inSeason(t, day) && assignees(t, day).includes(pid)
    && (t.schedule === 'taeglich' || (t.schedule === 'tonne' && binTomorrow)) && !done(t)).map((t) => t.name);
}

// Was heute auf jeden Fall erledigt sein muss, wie im roten Kasten der App: Tagesaufgaben (auch mit Minuten),
// die Tonne am Vorabend und am Sonntag die Wochenaufgaben, die in dieser Woche noch fehlen.
export function mustOpen(tasks: Row[], log: Row[], pid: string, day: string, binTomorrow: string | null): string[] {
  const d10 = (x: unknown) => String(x || '').slice(0, 10);
  const sunday = wdOf(day) === 6;
  const monday = new Date(Date.parse(`${day}T00:00:00Z`) - 6 * DAY).toISOString().slice(0, 10);
  const doneFrom = (t: Row, from: string) => log.some((e) => e.task_id === t.id && e.person_id === pid && d10(e.day) >= from && d10(e.day) <= day && e.status !== 'abgelehnt');
  return tasks.filter((t) => t.active !== false && inSeason(t, day) && assignees(t, day).includes(pid)
    && ((t.schedule === 'taeglich' && !doneFrom(t, day))
      || (t.schedule === 'tonne' && binTomorrow && !doneFrom(t, day))
      || (t.schedule === 'woechentlich' && sunday && !doneFrom(t, monday)))).map((t) => t.name);
}

// Uhrzeiten der Aufgaben-Erinnerungen in Minuten nach Mitternacht, null heißt aus.
// Die frühere Kinder-Erinnerung ist die sanfte, die spätere die mit Nachdruck.
export function reminderTimes(raw?: Row): { kind1: number | null; kind2: number | null; eltern: number | null } {
  const v = { kind1: '16:30', kind2: '19:00', eltern: '20:00', ...(raw || {}) } as Row;
  const mins = (t: unknown) => { const m = String(t ?? '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  let k1 = mins(v.kind1);
  let k2 = mins(v.kind2);
  if (k1 != null && k2 != null && k1 > k2) [k1, k2] = [k2, k1];
  if (k1 != null && k2 == null) [k1, k2] = [null, k1];
  return { kind1: k1, kind2: k2, eltern: mins(v.eltern) };
}

// Rein rechnerisch: aus dem Datenstand und der Uhrzeit die fälligen Nachrichten bestimmen.
// Urlaub und Tage auswärts aus ep_settings (Schlüssel "urlaub"): [{ id, von, bis, name, weg }].
export function holidayOn(list: Row[], day: string): Row | null {
  return (Array.isArray(list) ? list : []).find((u) => u && u.von && u.bis && day >= String(u.von) && day <= String(u.bis)) || null;
}

export function dueMessages(data: {
  persons: Row[]; tasks: Row[]; log: Row[]; abfuhr: Row[]; hearts: Row[]; plan: Row[]; shopping?: Row[]; dishes?: Row[]; ratings?: Row[]; urlaub?: Row[];
  grundZuerst?: boolean; added?: Row[]; erinnerung?: Row;
}, nowMs: number): Due[] {
  const out: Due[] = [];
  const { day, min, wd } = berlin(nowMs);
  // Urlaub: kein Essen zu Hause. Mit "weg" ist die Familie verreist, dann pausieren auch Tonne, Aufgaben und Morgenüberblick.
  const holiday = holidayOn(data.urlaub || [], day);
  const awayHome = !!holiday && holiday.weg !== false;
  const name = (id: string) => (data.persons.find((p) => p.id === id) || {}).name || 'Jemand';
  const adults = data.persons.filter((p) => p.adult).map((p) => p.id);
  const kids = data.persons.filter((p) => !p.adult).map((p) => p.id);

  // Mülltonne am Vorabend, ab 18 Uhr bis 22 Uhr.
  const tomorrow = addDays(day, 1);
  const bins = data.abfuhr.filter((a) => String(a.day).slice(0, 10) === tomorrow).map((a) => TONNEN[a.bin] || a.bin);
  if (bins.length && !awayHome && min >= 18 * 60 && min < 22 * 60) {
    const tasks = data.tasks.filter((t) => t.schedule === 'tonne' && t.active !== false && inSeason(t, day));
    const who = new Set<string>();
    for (const t of tasks) {
      for (const id of assignees(t, day)) {
        const done = data.log.some((e) => e.task_id === t.id && e.person_id === id && String(e.day).slice(0, 10) === day && e.status !== 'abgelehnt');
        if (!done) who.add(id);
      }
    }
    if (!tasks.length) adults.forEach((id) => who.add(id));
    const label = bins.join(' und ');
    for (const id of who) {
      out.push({
        key: `tonne:${tomorrow}:${id}`, to: [id], ttl: 4 * 3600,
        msg: { title: `${label.charAt(0).toUpperCase()}${label.slice(1)} rausstellen`, body: `Morgen wird abgeholt. Bitte heute Abend an die Straße stellen.`, tag: 'tonne', url: './#aufgaben' },
      });
    }
  }

  // Kontrolle um 21 Uhr: Hat das zuständige Kind die Tonne noch nicht abgehakt, erfahren es die Eltern.
  if (bins.length && !awayHome && min >= 21 * 60 && min < 23 * 60) {
    const tasks = data.tasks.filter((t) => t.schedule === 'tonne' && t.active !== false && inSeason(t, day));
    const missing: string[] = [];
    for (const t of tasks) {
      for (const id of assignees(t, day)) {
        const done = data.log.some((e) => e.task_id === t.id && e.person_id === id && String(e.day).slice(0, 10) === day && e.status !== 'abgelehnt');
        if (!done && !missing.includes(id)) missing.push(id);
      }
    }
    const label = bins.join(' und ');
    if (missing.length && adults.length) {
      out.push({
        key: `tonne-kontrolle:${tomorrow}`, to: adults, ttl: 3 * 3600,
        msg: {
          title: `${label.charAt(0).toUpperCase()}${label.slice(1)} steht noch nicht draußen`,
          body: `${missing.map(name).join(' und ')} hat die Tonne noch nicht abgehakt. Morgen wird abgeholt.`,
          tag: 'tonne-kontrolle', url: './#aufgaben',
        },
      });
    }
  }

  // Neu gemeldete Aufgaben an die Eltern. Nur Meldungen der letzten 24 Stunden.
  const recent = (iso: string | null) => !!iso && Date.parse(iso) > nowMs - DAY;
  // Mit der Regel „Minuten erst nach den Grundaufgaben“ melden sich heutige Extras erst, wenn die Grundaufgaben erledigt sind.
  const binToday = bins.length ? bins.join(' und ') : null;
  const locked = (e: Row) => data.grundZuerst !== false && !awayHome && String(e.day).slice(0, 10) === day
    && basicsOpen(data.tasks, data.log, e.person_id, day, binToday).length > 0;
  const open = data.log.filter((e) => e.status === 'offen' && e.minutes > 0 && !locked(e));
  for (const e of open.filter((x) => recent(x.created_at))) {
    const all = open.filter((x) => recent(x.created_at));
    const body = all.length === 1
      ? `${name(e.person_id)}: ${e.label} (+${e.minutes} Min.)`
      : `${all.length} Aufgaben warten: ${[...new Set(all.map((x) => x.person_id))].map((id) => `${name(id)} (${all.filter((x) => x.person_id === id).length})`).join(', ')}`;
    out.push({ key: `offen:${e.id}`, to: adults, ttl: DAY / 1000, msg: { title: 'Aufgabe erledigt, bitte bestätigen', body, tag: 'offen', url: './#aufgaben' } });
  }

  // Minuten-Shop: Ein Kauf geht an die Eltern, das Einlösen oder Zurückbuchen an das Kind.
  const shopName = (e: Row) => String(e.label || '').replace(/^Minuten-Shop: /, '');
  for (const e of data.log.filter((x) => String(x.id || '').startsWith('shop-'))) {
    if (e.status === 'offen' && recent(e.created_at) && adults.length) {
      out.push({ key: `shop:${e.id}`, to: adults, ttl: DAY / 1000, msg: { title: 'Gekauft im Minuten-Shop', body: `${name(e.person_id)}: ${shopName(e)} für ${-Number(e.minutes)} Min. Bitte einlösen.`, tag: 'shop', url: './#aufgaben' } });
    } else if (e.status !== 'offen' && e.decided_by && recent(e.decided_at)) {
      const ok = e.status === 'bestaetigt';
      out.push({ key: `shop-fertig:${e.id}`, to: [e.person_id], ttl: 6 * 3600, msg: { title: ok ? `Eingelöst: ${shopName(e)}` : 'Minuten zurückgebucht', body: ok ? 'Viel Spaß damit!' : `${shopName(e)} klappt gerade nicht. Die ${-Number(e.minutes)} Minuten sind wieder auf deinem Konto.`, tag: 'shop', url: './#aufgaben' } });
    }
  }

  // Aufgaben der Kinder: eine Erinnerung am Nachmittag, eine mit Nachdruck am Abend, danach der Stand für die Eltern.
  // Die Uhrzeiten stellen die Eltern unter „Aufgaben verwalten“ ein (Standard 16:30, 19:00 und 20:00, leer heißt aus).
  const times = reminderTimes(data.erinnerung);
  if (!awayHome) {
    const left = (k: string) => mustOpen(data.tasks, data.log, k, day, binToday);
    const plural = (n: number) => (n === 1 ? 'eine Aufgabe' : `${n} Aufgaben`);
    for (const [at, slot] of [[times.kind1, 'nachmittag'], [times.kind2, 'abend']] as [number | null, string][]) {
      if (at == null || min < at || min >= at + 45) continue;
      for (const k of kids) {
        const l = left(k);
        if (!l.length) continue;
        out.push({
          key: `grund:${slot}:${day}:${k}`, to: [k], ttl: 2 * 3600,
          msg: slot === 'abend'
            ? { title: `Noch ${plural(l.length)} offen, bitte jetzt erledigen`, body: `${l.join(', ')}.${data.grundZuerst !== false && basicsOpen(data.tasks, data.log, k, day, binToday).length ? ' Erst danach gibt es Minuten für Extras.' : ''}`, tag: 'grundaufgaben', url: './#aufgaben' }
            : { title: `Heute noch ${plural(l.length)}`, body: `${l.join(', ')}.`, tag: 'grundaufgaben', url: './#aufgaben' },
        });
      }
    }
    if (times.eltern != null && min >= times.eltern && min < times.eltern + 60 && adults.length) {
      const lines = kids.map((k) => (left(k).length ? `${name(k)}: ${left(k).join(', ')}` : '')).filter(Boolean);
      // Alles, was noch auf Bestätigung wartet, auch von den Vortagen.
      const waiting = data.log.filter((e) => e.status === 'offen' && e.task_id && String(e.day).slice(0, 10) <= day).length;
      if (lines.length || waiting) {
        out.push({
          key: `grund-eltern:${day}`, to: adults, ttl: 3 * 3600,
          msg: {
            title: lines.length ? 'Bei den Kindern ist noch etwas offen' : 'Aufgaben zu bestätigen',
            body: [lines.length ? `${lines.join('. ')}.` : '', waiting ? `${waiting === 1 ? 'Eine Aufgabe wartet' : `${waiting} Aufgaben warten`} auf eure Bestätigung.` : ''].filter(Boolean).join(' '),
            tag: 'grund-eltern', url: './#aufgaben',
          },
        });
      }
    }
  }

  // Neu auf der Einkaufsliste: an die Erwachsenen außer dem, der es eingetragen hat. Nachts wartet es bis 7 Uhr.
  if (min >= 7 * 60 && min < 21 * 60 + 30) {
    const fresh = (data.added || []).filter((i) => i.added_by && !i.checked && Date.parse(i.created_at) > nowMs - 12 * 3600000);
    for (const i of fresh) {
      const to = data.persons.filter((p) => p.adult && p.id !== i.added_by && p.notify_list !== false).map((p) => p.id);
      if (!to.length) continue;
      const t = Date.parse(i.created_at);
      const same = fresh.filter((x) => x.added_by === i.added_by && Math.abs(Date.parse(x.created_at) - t) < 15 * 60000);
      const labels = same.map((x) => x.label);
      out.push({
        key: `liste:${i.id}`, to, ttl: 6 * 3600,
        msg: {
          title: 'Neu auf der Einkaufsliste',
          body: `${name(i.added_by)}: ${labels.slice(0, 6).join(', ')}${labels.length > 6 ? ` und ${labels.length - 6} weitere` : ''}`,
          tag: 'liste-neu', url: './#einkauf',
        },
      });
    }
  }

  // Wochenbonus: Die App schreibt ihn gut, das Kind bekommt die gute Nachricht.
  for (const e of data.log.filter((x) => String(x.id || '').startsWith('bonus-') && x.minutes > 0 && x.status === 'bestaetigt' && recent(x.decided_at))) {
    out.push({
      key: `bonus:${e.id}`, to: [e.person_id], ttl: DAY / 1000,
      msg: { title: `+${e.minutes} Minuten Wochenbonus`, body: 'Du hast die ganze Woche alle Grundaufgaben geschafft. Stark!', tag: 'wochenbonus', url: './#aufgaben' },
    });
  }

  // Entscheidung der Eltern an das Kind.
  // Bei Grundaufgaben (ohne Minuten) nur die Ablehnung melden, sonst kämen zu viele Nachrichten.
  for (const e of data.log.filter((x) => x.task_id && x.decided_by && recent(x.decided_at) && ((x.minutes > 0 && (x.status === 'bestaetigt' || x.status === 'abgelehnt')) || (!(x.minutes > 0) && x.status === 'abgelehnt')))) {
    const ok = e.status === 'bestaetigt';
    out.push({
      key: `entschieden:${e.id}`, to: [e.person_id], ttl: DAY / 1000,
      msg: {
        title: ok ? `+${e.minutes} Minuten` : 'Nicht bestätigt',
        body: ok ? `${name(e.decided_by)} hat „${e.label}“ bestätigt.` : `${name(e.decided_by)} hat „${e.label}“ nicht bestätigt. Frag nach, was noch fehlt, und melde es danach noch einmal.`,
        tag: `entschieden-${e.id}`.slice(0, 32), url: './#aufgaben',
      },
    });
  }

  // Kochen: Essenszeit (von der App aus den Terminen berechnet, sonst 18:30) minus Kochdauer.
  // Die Nachricht kommt zur Startzeit, höchstens 30 Minuten verspätet, an Eltern, die mitessen
  // und die Erinnerung nicht abgeschaltet haben.
  const tonight = data.plan.find((p) => String(p.day).slice(0, 10) === day && p.dish_id && !p.skipped);
  const dish = tonight && (data.dishes || []).find((d) => d.id === tonight.dish_id);
  if (dish && !holiday) {
    const hm = /^\d{1,2}:\d{2}$/.test(String(tonight.dinner_time || '')) ? String(tonight.dinner_time) : '18:30';
    const eat = Number(hm.split(':')[0]) * 60 + Number(hm.split(':')[1]);
    const dur = Math.max(5, Number(dish.duration_min) || 30);
    const start = eat - dur;
    const away: string[] = Array.isArray(tonight.dinner_away) ? tonight.dinner_away : [];
    const cooks = data.persons.filter((p) => p.adult && p.notify_cook !== false && !away.includes(p.id)).map((p) => p.id);
    if (cooks.length && min >= start && min < start + 30) {
      out.push({
        key: `kochen:${day}`, to: cooks, ttl: 3600,
        msg: { title: `Zeit zum Kochen: ${dish.name}`, body: `Dauert etwa ${dur} Minuten, gegessen wird um ${hm} Uhr.`, tag: 'kochen', url: './#woche' },
      });
    }
  }

  // Vorabend: ab 19 Uhr, was für morgen vorzubereiten ist. Aus dem Gericht und der Notiz zum Tag.
  if (min >= 19 * 60 && min < 21 * 60 + 30 && !holidayOn(data.urlaub || [], tomorrow)) {
    const next = data.plan.find((p) => String(p.day).slice(0, 10) === tomorrow);
    if (next) {
      const nd = !next.skipped && (data.dishes || []).find((d) => d.id === next.dish_id);
      const todo = [nd && nd.prep, next.prep].map((t) => String(t || '').trim()).filter(Boolean);
      if (todo.length && adults.length) {
        out.push({ key: `vorabend:${tomorrow}`, to: adults, ttl: 4 * 3600, msg: { title: 'Für morgen vorbereiten', body: todo.join(' '), tag: 'vorabend', url: './#woche' } });
      }
    }
  }

  // Einkaufstag: ab 7 Uhr bis 20 Uhr, solange noch etwas offen ist. Mehrere Touren am selben Tag
  // landen in einer gemeinsamen Nachricht (gleiches Kennzeichen). Ist schon jemand eingetragen,
  // steht der Name drin statt der Frage.
  // Morgenüberblick: werktags 7 Uhr, Samstag und Sonntag 8:30 Uhr, jeweils eine halbe Stunde lang.
  const mStart = wd >= 5 ? 8 * 60 + 30 : 7 * 60;
  const inMorning = min >= mStart && min < mStart + 30;
  const wantsMorning = (id: string) => (data.persons.find((p) => p.id === id) || {}).notify_morning !== false;

  if (min >= 7 * 60 && min < 20 * 60) {
    const open = (data.shopping || []).filter((i) => String(i.due || '').slice(0, 10) === day && !i.checked);
    const tripOf = (i: Row) => `${String(i.week_start || '').slice(0, 10)}|${i.trip || 'Einkauf'}`;
    const trips = [...new Set(open.map(tripOf))];
    if (trips.length) {
      const buyerOf = (t: string) => (open.find((i) => tripOf(i) === t && i.buyer) || {}).buyer as string | undefined;
      const label = (t: string) => `${t.split('|')[1]} (${open.filter((i) => tripOf(i) === t).length} Posten)`;
      const buyers = [...new Set(trips.map(buyerOf).filter(Boolean))] as string[];
      const allTaken = trips.every((t) => buyerOf(t));
      const nLidl = open.filter((i) => i.shop === 'lidl').length;
      const list = (trips.length === 1 ? `${trips[0].split('|')[1]}: ${open.length} Posten auf der Liste.` : `${trips.map(label).join(', ')}.`)
        + (nLidl ? ` Davon ${nLidl} bei Lidl.` : '');
      const week = trips[0].split('|')[0];
      const base = week ? `./?woche=${week}#einkauf` : './#einkauf';
      // Wer den Morgenüberblick bekommt, findet den Einkauf dort. Die eigene Erinnerung kommt dann nur,
      // wenn der Einkaufstag erst nach dem Morgenüberblick festgelegt wurde.
      for (const t of trips) for (const a of adults) {
        if (wantsMorning(a) && min < mStart + 30) continue;
        out.push({
          key: `einkauf:${day}:${t}:${a}`, to: [a], ttl: 12 * 3600,
          msg: {
            title: 'Heute ist Einkauf',
            body: allTaken ? `${list} ${buyers.map(name).join(' und ')} geht einkaufen.` : `${list} Wer übernimmt?`,
            tag: 'einkauf', url: base,
            ...(allTaken ? {} : {
              actions: [{ action: 'uebernehmen', title: 'Ich gehe einkaufen' }],
              actionUrls: { uebernehmen: `${base.replace('#einkauf', '')}${week ? '&' : '?'}uebernehmen=1#einkauf` },
            }),
          },
        });
      }
      // Sobald sich jemand einträgt, erfahren es die anderen Eltern.
      for (const t of trips) {
        const b = buyerOf(t);
        if (!b) continue;
        const others = adults.filter((id) => id !== b);
        if (!others.length) continue;
        out.push({
          key: `einkauf-wer:${day}:${t}:${b}`, to: others, ttl: 12 * 3600,
          msg: { title: `${name(b)} geht einkaufen`, body: `${name(b)} übernimmt „${t.split('|')[1]}“. Du musst heute nicht los.`, tag: 'einkauf', url: base },
        });
      }
    }
  }

  if (inMorning && !awayHome) {
    const tonight = data.plan.find((p) => String(p.day).slice(0, 10) === day && p.dish_id);
    const dish = tonight && !tonight.skipped && (data.dishes || []).find((d) => d.id === tonight.dish_id);
    const eatAt = tonight && /^\d{1,2}:\d{2}$/.test(String(tonight.dinner_time || '')) ? String(tonight.dinner_time) : '18:30';
    const shortName = (n: string) => String(n).split(/ mit | in | und | auf | aus /)[0].trim();
    const binTomorrow = bins.length ? bins.join(' und ') : null;
    const open = (data.shopping || []).filter((i) => String(i.due || '').slice(0, 10) === day && !i.checked);
    const tripOf = (i: Row) => `${String(i.week_start || '').slice(0, 10)}|${i.trip || 'Einkauf'}`;
    const trips = [...new Set(open.map(tripOf))];
    const title = wd >= 5 ? 'Guten Morgen' : 'Heute';
    for (const p of data.persons) {
      if (p.notify_morning === false) continue;
      const lines: string[] = [];
      let actions: Message['actions'];
      let actionUrls: Message['actionUrls'];
      let url = './';
      if (!p.adult) {
        const todo = openTasks(data.tasks, data.log, p.id, day, binTomorrow);
        lines.push(todo.length ? `Deine Aufgaben: ${todo.join(', ')}.` : 'Heute stehen keine festen Aufgaben an.');
        if (dish) lines.push(`Abendessen: ${shortName(dish.name)}.`);
        url = './#aufgaben';
      } else {
        if (dish) {
          const dur = Math.max(5, Number(dish.duration_min) || 30);
          const startMin = Number(eatAt.split(':')[0]) * 60 + Number(eatAt.split(':')[1]) - dur;
          lines.push(`Abendessen um ${eatAt}: ${shortName(dish.name)}, kochen ab ${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}.`);
        } else if (tonight && tonight.skipped) {
          lines.push('Das Abendessen fällt heute aus.');
        }
        if (trips.length) {
          const buyers = [...new Set(trips.map((t) => (open.find((i) => tripOf(i) === t && i.buyer) || {}).buyer).filter(Boolean))] as string[];
          const names = trips.map((t) => t.split('|')[1]).join(', ');
          const nLidl = open.filter((i) => i.shop === 'lidl').length;
          lines.push(`Einkauf: ${names}, ${open.length} Posten${nLidl ? `, davon ${nLidl} bei Lidl` : ''}. ${buyers.length ? `${buyers.map((b) => (b === p.id ? 'Du' : name(b))).join(' und ')} ${buyers.length === 1 && buyers[0] === p.id ? 'gehst' : 'geht'} einkaufen.` : 'Wer übernimmt?'}`);
          const week = trips[0].split('|')[0];
          url = `./?woche=${week}#einkauf`;
          if (!buyers.length) {
            actions = [{ action: 'uebernehmen', title: 'Ich gehe einkaufen' }];
            actionUrls = { uebernehmen: `./?woche=${week}&uebernehmen=1#einkauf` };
          }
        }
        const waiting = data.log.filter((e) => e.status === 'offen' && e.minutes > 0).length;
        if (waiting) lines.push(`${waiting} ${waiting === 1 ? 'Aufgabe wartet' : 'Aufgaben warten'} auf eure Bestätigung.`);
        const kidsTodo = kids.map((k) => [k, openTasks(data.tasks, data.log, k, day, binTomorrow)] as [string, string[]]).filter(([, t]) => t.length);
        if (kidsTodo.length) lines.push(`Offene Aufgaben der Kinder: ${kidsTodo.map(([k, t]) => `${name(k)}: ${t.length}`).join(', ')}.`);
        if (!lines.length) continue;
      }
      out.push({
        key: `morgen:${day}:${p.id}`, to: [p.id], ttl: 4 * 3600,
        msg: { title: p.adult ? title : `${title}, ${name(p.id)}`, body: lines.join('\n'), tag: 'morgen', url, ...(actions ? { actions, actionUrls } : {}) },
        extraKeys: p.adult ? trips.map((t) => `einkauf:${day}:${t}:${p.id}`) : [],
      });
    }
  }

  // Bewertung des Abendessens. Nur wer mitgegessen und noch keine Sterne vergeben hat.
  {
    const tonight = data.plan.find((p) => String(p.day).slice(0, 10) === day && p.dish_id && !p.skipped);
    const dish = tonight && (data.dishes || []).find((d) => d.id === tonight.dish_id);
    if (dish && !holiday) {
      const hm = /^\d{1,2}:\d{2}$/.test(String(tonight.dinner_time || '')) ? String(tonight.dinner_time) : '18:30';
      const eat = Number(hm.split(':')[0]) * 60 + Number(hm.split(':')[1]);
      const away: string[] = Array.isArray(tonight.dinner_away) ? tonight.dinner_away : [];
      const rated = new Set((data.ratings || []).filter((x) => String(x.day).slice(0, 10) === day).map((x) => x.person_id));
      const KID_LAST = 20 * 60 + 15;
      const kidAt = Math.min(eat + 60, KID_LAST - 5);
      const shortName = String(dish.name).split(/ mit | in | und | auf | aus /)[0].trim();
      for (const p of data.persons) {
        if (p.notify_rating === false || away.includes(p.id) || rated.has(p.id)) continue;
        let from: number; let to: number;
        if (p.adult) { from = eat + 90; to = Math.min(from + 60, 22 * 60); }
        else {
          // Bei sehr spätem Essen bleibt für die Kinder keine sinnvolle Zeit vor 20:15, dann entfällt die Erinnerung.
          if (kidAt < eat + 20) continue;
          from = kidAt; to = KID_LAST + 1;
        }
        if (min < from || min >= to) continue;
        out.push({
          key: `bewerten:${day}:${p.id}`, to: [p.id], ttl: 3 * 3600,
          msg: { title: 'Wie hat es geschmeckt?', body: `Heute gab es ${shortName}. Tippe hier und vergib deine Sterne.`, tag: 'bewerten', url: `./?tag=${day}#woche` },
        });
      }
    }
  }

  // Freitag ab 17 Uhr: Herz der Woche, falls noch keins vergeben und die Woche geplant ist.
  if (wd === 4 && min >= 17 * 60 && min < 21 * 60) {
    const week = mondayOf(day);
    const planned = data.plan.some((p) => p.dish_id && String(p.day).slice(0, 10) >= week && String(p.day).slice(0, 10) <= addDays(week, 6));
    if (planned) {
      for (const id of kids) {
        if (data.hearts.some((h) => String(h.week_start).slice(0, 10) === week && h.person_id === id)) continue;
        out.push({ key: `herz:${week}:${id}`, to: [id], ttl: 3 * DAY / 1000, msg: { title: 'Herz der Woche', body: 'Welches Essen war diese Woche dein Lieblingsgericht? Vergib dein Herz.', tag: 'herz', url: './' } });
      }
    }
  }
  return out;
}


/* ======================================================================
   Wochenplan mit Claude
   Ablauf in zwei Schritten über die Message Batches API, damit die Funktion
   nie lange warten muss: 1. Claude sucht die Angebote von Aldi Süd und Lidl,
   2. Claude schreibt den Plan als festes JSON. Jeder Lauf der Funktion
   (alle fünf Minuten) schaut nach, ob ein Schritt fertig ist.
   ====================================================================== */

const API = 'https://api.anthropic.com/v1';
const API_VERSION = '2026-10-21';

export const DEFAULT_RULES = {
  ausschluesse: ['Brokkoli', 'Rosenkohl', 'Vollkornnudeln', 'Ofenlachs'],
  vorlieben: 'Fisch gern gebacken oder paniert, zum Beispiel Seelachs oder Kabeljau. Lachs nur geräuchert. Fett muss nicht krampfhaft reduziert werden, Fischstäbchen lieber in der Pfanne.',
  ziele: 'Gesünder und proteinreicher essen. Bio wann immer möglich. Kinderfreundlich für 9 und 12 Jahre. Thermomix und Airfryer gern einbauen.',
  kochzeit: 60,
  neue_rezepte: 2,
  vegan: 1,
  auto: true,
  tag: 4,
  zeit: '12:00',
  modell: 'claude-sonnet-5-5',
  lidl: true,
  saison: true,
};
export type Rules = typeof DEFAULT_RULES;

// Saison in Franken: [Gemüse, Obst] pro Monat. Gleiche Liste wie in js/planer.js.
export const SAISON: Record<string, [string, string]> = {"1": ["Grünkohl, Rosenkohl, Lauch, Wirsing, Rotkohl, Weißkohl, Feldsalat, Chicorée, Pastinaken, Schwarzwurzeln, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Zwiebeln, Topinambur", "Äpfel, Birnen"], "2": ["Grünkohl, Rosenkohl, Lauch, Wirsing, Rotkohl, Weißkohl, Feldsalat, Chicorée, Pastinaken, Schwarzwurzeln, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Zwiebeln", "Äpfel, Birnen"], "3": ["Lauch, Feldsalat, Chicorée, Bärlauch, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Zwiebeln, Pastinaken, Rotkohl, Weißkohl", "Äpfel"], "4": ["Bärlauch, Spinat, Rhabarber, Radieschen, Spargel, Feldsalat, Lauch, Frühlingszwiebeln, Karotten, Kartoffeln", "Äpfel, Rhabarber"], "5": ["Spargel, Rhabarber, Spinat, Radieschen, Kohlrabi, Kopfsalat, Frühlingszwiebeln, Mangold, Rucola, Lauch", "Erdbeeren, Rhabarber"], "6": ["Spargel, Kohlrabi, Zucchini, Erbsen, Brokkoli, Blumenkohl, Kopfsalat, Radieschen, Gurken, Mangold, Frühkartoffeln, Karotten, Spinat, Rhabarber", "Erdbeeren, Kirschen, Johannisbeeren"], "7": ["Zucchini, Gurken, Tomaten, Paprika, Bohnen, Erbsen, Brokkoli, Blumenkohl, Kohlrabi, Kopfsalat, Mangold, Karotten, Kartoffeln, Spitzkohl, Fenchel", "Kirschen, Himbeeren, Heidelbeeren, Johannisbeeren, Aprikosen, Erdbeeren"], "8": ["Tomaten, Paprika, Zucchini, Auberginen, Gurken, Bohnen, Mais, Brokkoli, Blumenkohl, Kohlrabi, Kopfsalat, Karotten, Kartoffeln, Fenchel, Spitzkohl, Mangold", "Zwetschgen, Pflaumen, Mirabellen, Birnen, Äpfel, Brombeeren, Heidelbeeren, Himbeeren"], "9": ["Tomaten, Paprika, Zucchini, Kürbis, Bohnen, Brokkoli, Blumenkohl, Lauch, Mais, Rote Bete, Karotten, Kartoffeln, Weißkohl, Rotkohl, Spinat, Fenchel, Zwiebeln", "Äpfel, Birnen, Zwetschgen, Weintrauben, Brombeeren"], "10": ["Kürbis, Lauch, Rote Bete, Weißkohl, Rotkohl, Wirsing, Rosenkohl, Karotten, Kartoffeln, Knollensellerie, Pastinaken, Feldsalat, Spinat, Mangold, Brokkoli, Blumenkohl, Fenchel, Zwiebeln", "Äpfel, Birnen, Quitten, Weintrauben, Walnüsse"], "11": ["Grünkohl, Rosenkohl, Kürbis, Lauch, Wirsing, Rotkohl, Weißkohl, Feldsalat, Chicorée, Pastinaken, Schwarzwurzeln, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Topinambur, Spinat, Zwiebeln", "Äpfel, Birnen, Quitten, Walnüsse"], "12": ["Grünkohl, Rosenkohl, Kürbis, Lauch, Wirsing, Rotkohl, Weißkohl, Feldsalat, Chicorée, Pastinaken, Schwarzwurzeln, Rote Bete, Karotten, Kartoffeln, Knollensellerie, Zwiebeln", "Äpfel, Birnen, Walnüsse"]};
const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export function seasonLines(week: string) {
  const mid = addDays(week, 3);
  const m = Number(mid.slice(5, 7));
  const [g, o] = SAISON[String(m)] || ['', ''];
  return [
    `Saison und Region (${MONTH_NAMES[m - 1]} in Franken):`,
    `- Gemüse aus der Region: ${g}.`,
    `- Obst aus der Region: ${o}.`,
    '- Bevorzuge diese Sorten bei Gemüse, Salat, Beilagen und in der Brotbox. Gemüse und Obst außerhalb der Saison (zum Beispiel Tomaten, Zucchini, Paprika oder Beeren im Winter) nur sparsam und wenn ein Gericht es wirklich braucht. Tiefkühlgemüse ist in Ordnung.',
    '- Die Ausschlüsse oben gelten trotzdem.',
    '',
  ];
}

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const SHOP = ['obst', 'brot', 'fleisch', 'kuehl', 'tk', 'vorrat', 'haushalt', 'sonst'];
const DISH_KINDS = ['rind', 'gefluegel', 'fisch', 'schwein', 'vegan', 'veggie', 'gemischt'];
const fmtDay = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
export const isoWeekNo = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)));
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - first.getTime()) / DAY - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
};

export function mergeRules(stored: Row | null | undefined): Rules {
  const r = { ...DEFAULT_RULES, ...(stored || {}) } as Rules;
  r.ausschluesse = (Array.isArray(r.ausschluesse) ? r.ausschluesse : String(r.ausschluesse || '').split(/[,\n]/)).map((x) => String(x).trim()).filter(Boolean);
  return r;
}

// Das Antwortformat. Alle Felder sind Pflicht, leere Werte sind erlaubt. So bleibt das Schema einfach.
export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['hinweise', 'angebote_genutzt', 'neue_gerichte', 'tage', 'einkauf', 'wunsch_erfuellt', 'kosten'],
  properties: {
    hinweise: { type: 'string', description: 'Zwei bis drei Sätze an die Eltern: Was ist diese Woche besonders?' },
    wunsch_erfuellt: { type: 'string' },
    kosten: { type: 'number' },
    angebote_genutzt: { type: 'array', items: { type: 'string' } },
    neue_gerichte: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'kategorie', 'dauer_min', 'tags', 'hinweis', 'vorabend', 'zutaten', 'schritte'],
        properties: {
          name: { type: 'string' },
          kategorie: { type: 'string', enum: DISH_KINDS },
          dauer_min: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
          hinweis: { type: 'string' },
          vorabend: { type: 'string' },
          zutaten: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              required: ['menge', 'einheit', 'name', 'abteilung'],
              properties: {
                menge: { type: 'number' },
                einheit: { type: 'string' },
                name: { type: 'string' },
                abteilung: { type: 'string', enum: [...SHOP, 'basis'] },
              },
            },
          },
          schritte: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    tage: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['datum', 'gericht', 'brotbox', 'vorabend'],
        properties: { datum: { type: 'string' }, gericht: { type: 'string' }, brotbox: { type: 'string' }, vorabend: { type: 'string' } },
      },
    },
    einkauf: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'menge', 'abteilung', 'tour', 'wofuer', 'markt'],
        properties: {
          name: { type: 'string' },
          menge: { type: 'string' },
          abteilung: { type: 'string', enum: SHOP },
          tour: { type: 'string', enum: ['gross', 'frisch'] },
          wofuer: { type: 'string' },
          markt: { type: 'string', enum: ['aldi', 'lidl'] },
        },
      },
    },
  },
};

// Tage der Woche aus dem Kontext der App (schulfrei, Essenszeit, wer fehlt). Fehlt etwas, gelten Werktage als Schultage.
export function weekDays(ctx: Row | null, week: string, urlaub: Row[] = []) {
  const known: Row[] = (ctx && Array.isArray(ctx.tage)) ? ctx.tage : [];
  return Array.from({ length: 7 }, (_, n) => {
    const day = addDays(week, n);
    const k = known.find((t) => t.tag === day);
    const u = holidayOn(urlaub, day);
    return {
      urlaub: u ? String(u.name || 'Urlaub') : (k && k.urlaub) || null,
      tag: day, wochentag: DAY_NAMES[n],
      schultag: k ? !k.schulfrei : n < 5,
      schulfrei: k ? k.schulfrei || null : (n < 5 ? null : 'Wochenende'),
      essen: k ? k.essen : '18:30',
      esser: k ? k.esser : 4,
      weg: k ? k.weg || [] : [],
      kurz: k ? !!k.kurz : false,
      gaeste: k ? Math.max(0, Number(k.gaeste) || 0) : 0,
      bekannt: !!k,
    };
  });
}

// Märkte, in denen die Familie einkauft. Die Websites zeigen meist bundesweite Angebote, die Filiale hilft bei regionalen.
export const MARKETS = { aldi: 'Aldi Süd, Coburg-Creidlitz', lidl: 'Lidl, Coburg-Ketschendorf' };


/* ---------- Einkaufstage und Feiertage ---------- */

// Tage, an denen in Coburg die Märkte zu sind. Mariä Himmelfahrt gilt nur in katholisch geprägten Gemeinden,
// in Coburg nicht. Buß- und Bettag ist nur schulfrei.
function easterOf(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function shopHoliday(day: string): string | null {
  const y = Number(day.slice(0, 4));
  const e = easterOf(y);
  const p = (m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const list: Record<string, string> = {
    [p(1, 1)]: 'Neujahr', [p(1, 6)]: 'Heilige Drei Könige', [addDays(e, -2)]: 'Karfreitag', [addDays(e, 1)]: 'Ostermontag',
    [p(5, 1)]: 'Tag der Arbeit', [addDays(e, 39)]: 'Christi Himmelfahrt', [addDays(e, 50)]: 'Pfingstmontag', [addDays(e, 60)]: 'Fronleichnam',
    [p(10, 3)]: 'Tag der Deutschen Einheit', [p(11, 1)]: 'Allerheiligen', [p(12, 25)]: '1. Weihnachtstag', [p(12, 26)]: '2. Weihnachtstag',
  };
  return list[day] || null;
}
// Heiligabend und Silvester: Die Märkte schließen mittags.
export const shortDay = (day: string) => /-12-(24|31)$/.test(day);
const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
// Einkaufstage einer Woche: Großeinkauf am Samstag davor, Frischeinkauf am Mittwoch. Ist der Markt zu,
// rückt der Einkauf auf den letzten offenen Tag davor. Den Großeinkauf nie auf einen Tag, an dem mittags Schluss ist.
export function shopDays(week: string) {
  const back = (day: string, avoidShort: boolean) => {
    let d = day;
    for (let n = 0; n < 7 && (wdOf(d) === 6 || shopHoliday(d) || (avoidShort && shortDay(d))); n += 1) d = addDays(d, -1);
    return d;
  };
  const plan = (kind: 'gross' | 'frisch', regular: string) => {
    const day = back(regular, kind === 'gross');
    const why = day !== regular ? `${WD_SHORT[wdOf(regular)]} ${fmtDay(regular)} ist ${shopHoliday(regular) || (shortDay(regular) ? 'nur bis mittags offen' : 'Sonntag')}` : '';
    return { day, wd: DAY_NAMES[wdOf(day)], short: WD_SHORT[wdOf(day)], why, mittags: shortDay(day) };
  };
  return { gross: plan('gross', addDays(week, -2)), frisch: plan('frisch', addDays(week, 2)) };
}

export function offersPrompt(week: string, lidl = true) {
  const sd = shopDays(week);
  const sites = lidl ? 'aldi-sued.de und lidl.de' : 'aldi-sued.de';
  return `Suche auf ${sites} die Lebensmittel-Angebote, die an einem der beiden Einkaufstage im Laden zu haben sind: am ${sd.gross.wd}, ${fmtDay(sd.gross.day)} (Großeinkauf) oder am ${sd.frisch.wd}, ${fmtDay(sd.frisch.day)} (Frischeinkauf). `
    + 'Achte genau auf das Datum, ab dem ein Angebot gilt. Aktionsartikel gibt es erst ab diesem Tag im Laden, nicht vorher. Angebote, die erst nach dem Frischeinkauf beginnen, lässt du weg.\n'
    + '„Aktionsartikel“ heißt: gibt es nur im Aktionszeitraum, sonst gar nicht im Markt (zum Beispiel Wochenaktionen wie Knödel, Spezialitätenwochen). „Sortiment“ heißt: gibt es immer, nur gerade günstiger.\n'
    + `Eingekauft wird bei ${MARKETS.aldi}${lidl ? ` und bei ${MARKETS.lidl}` : ''}. Gibt es regionale Angebote für Coburg oder Oberfranken, nimm sie mit dazu.\n`
    + 'Wichtig sind Fleisch, Fisch, Obst, Gemüse, Milchprodukte, Eier, Brot und Vorrat. Getränke, Süßigkeiten und Non-Food weglassen.\n'
    + `Antworte nur mit einer Liste, eine Zeile pro Angebot, im Format: Markt (${lidl ? 'Aldi oder Lidl' : 'Aldi'}) | Produkt | Packungsgröße | Preis | Bio oder nicht Bio | gültig ab (Datum, zum Beispiel 20.11.) | gültig bis (Datum oder leer) | Aktionsartikel oder Sortiment.\n`
    + (lidl ? 'Gilt ein Lidl-Preis nur mit der App Lidl Plus, schreibe hinter den Preis „nur mit Lidl Plus“.\n' : '')
    + `Schreibe nur Angebote auf, die du auf ${sites} wirklich gefunden hast, und rate nichts. Steht nicht ausdrücklich Bio dabei, schreibe „nicht Bio“. `
    + 'Findest du für diese Woche noch nichts, antworte genau mit: keine Angebote gefunden';
}

export type PlanExtra = { wishes?: { kind: string; wunsch: string }[]; lastWish?: string; prices?: string; reste?: string[]; packungen?: string[] };

export function planPrompt(o: { rules: Rules; ctx: Row | null; offers: string; week: string; wish: string; problems?: string[]; urlaub?: Row[]; extra?: PlanExtra }) {
  const { rules, ctx, offers, week, wish, problems } = o;
  const extra = o.extra || {};
  const wishes = extra.wishes || [];
  const days = weekDays(ctx, week, o.urlaub);
  const sd = shopDays(week);
  const sat = sd.gross.day;
  const wed = sd.frisch.day;
  const system = [
    `Du erstellst den Abendessen-Wochenplan einer Familie mit zwei Erwachsenen und zwei Kindern (12 und 9 Jahre), dazu die Brotboxen der Kinder und die Einkaufsliste. Eingekauft wird bei ${MARKETS.aldi}${rules.lidl ? `, als zweiter Markt bei ${MARKETS.lidl}` : ''}.`,
    '',
    `Ziele der Familie: ${rules.ziele}`,
    `Vorlieben: ${rules.vorlieben}`,
    `Diese Lebensmittel kommen nie vor, auch nicht als Beilage oder in der Brotbox: ${rules.ausschluesse.join(', ') || 'keine'}.`,
    '',
    'Regeln für den Plan:',
    '- Tage mit "gaeste" größer 0: So viele Gäste essen zusätzlich mit. Die Rezepte bleiben für 4 Personen, aber die Einkaufsmengen für diesen Tag entsprechend erhöhen. Lieber ein Gericht, das sich gut für mehr Personen eignet.',
    '- Tage mit "urlaub" (nicht leer): Dort isst niemand zu Hause. Den Tag trotzdem aufführen, aber "gericht", "brotbox" und "vorabend" leer lassen und dafür nichts einkaufen.',
    `- Für jeden anderen Tag genau ein Abendessen. Kein Gericht doppelt in der Woche, keine gleiche Hauptzutat an zwei Tagen hintereinander, höchstens zweimal rotes Fleisch.`,
    `- Kochzeit werktags höchstens ${rules.kochzeit} Minuten. An Tagen mit "kurz": true höchstens 40 Minuten. Am Wochenende darf es länger dauern.`,
    '- Jedes Abendessen soll reichlich Eiweiß liefern, als Richtwert mindestens 30 g pro Erwachsenenportion.',
    '- "esser" sagt, wie viele mitessen, "weg" wer an dem Abend fehlt. Bei weniger Essern darf es etwas Einfaches sein.',
    `- Vegane Abendessen pro Woche: ${rules.vegan}.`,
    `- Genau ${rules.neue_rezepte} neue Gerichte, die noch nicht in der Sammlung stehen. Alle anderen Tage mit Gerichten aus der Sammlung, und zwar mit genau dem Namen, der dort steht.`,
    '- Aus der Sammlung bevorzugt Gerichte mit guten Sternen, Herzen oder als Lieblingsgericht markiert. Nie Gerichte mit Status "aussortiert", nie solche mit "nicht_einplanen_bis" an oder nach dem jeweiligen Tag, nie Gerichte der Art "Brotbox-Rezept" als Abendessen. Was in den letzten 14 Tagen gegessen wurde, möglichst nicht wiederholen.',
    '- Brotbox nur an Tagen mit "schultag": true, sonst ein leerer Text. Kindgerecht, abwechslungsreich, ohne Nüsse, ein bis zwei Sätze. Wo nötig an den Kühlakku erinnern.',
    '- Gerichte aus der Sammlung mit "notizen_der_familie": Das sind Erfahrungen vom letzten Kochen. Berücksichtige sie, zum Beispiel zusätzliche Möhren oder die Zutaten für eine Soße mit auf die Einkaufsliste setzen und den Hinweis in "vorabend" oder im Tag erwähnen, wenn etwas vorzubereiten ist.',
    '- "vorabend" beim Tag: was am Abend vorher zu tun ist (Fisch auftauen, Brötchen für die Brotbox backen). Sonst leer.',
    '',
    'Angebote:',
    '- Nutze passende Angebote, aber nur die aus der mitgeschickten Liste. Erfinde keine Angebote.',
    `- Ein Angebot darf nur auf eine Tour, wenn es am Einkaufstag dieser Tour schon gilt: Tour "gross" am ${fmtDay(sat)} nur mit Angeboten, die spätestens an diesem Tag beginnen, Tour "frisch" am ${fmtDay(wed)} nur mit Angeboten, die spätestens an diesem Tag beginnen und dann noch gelten. Angebote, die erst später beginnen, gar nicht einplanen. Steht kein Datum dabei, nicht als Angebot einplanen.`,
    '- Ein Aktionsartikel gibt es nur im Aktionszeitraum, sonst gar nicht im Markt. Plane ihn nie als normales Produkt ein. Passt der Zeitraum nicht zum Einkaufstag, nimm ein anderes Produkt, das es immer gibt.',
    '- Die Familie kauft grundsätzlich Bio, wenn es das gibt. Bevorzuge deshalb Bio-Angebote. Angebote, die nicht Bio sind, nur für Produkte, die es meist nicht in Bio gibt.',
    '- Steht dort "nicht Bio", ist es nicht Bio. Schreibe bei Angeboten in der Einkaufsliste in "menge" das Startdatum und die Bio-Angabe dazu, zum Beispiel: "2 Packungen, Angebot ab 13.11., Bio".',
    '- Liste die genutzten Angebote in "angebote_genutzt" auf, mit Markt und Bio-Angabe, zum Beispiel "Lidl: Hähnchenbrustfilet 1 kg, 7,99 €, nicht Bio".',
    '',
    'Markt:',
    ...(rules.lidl ? [
      '- Bevorzugt wird Aldi Süd. Jeder Posten der Einkaufsliste bekommt "markt": "aldi" oder "lidl".',
      '- "lidl" nur, wenn das Produkt dort im Angebot ist und deutlich günstiger oder besser (zum Beispiel Bio) als bei Aldi, oder wenn es Aldi nicht führt und du dir dabei sicher bist.',
      '- Lohnt sich der Weg zu Lidl nur für ein oder zwei Kleinigkeiten ohne echten Vorteil, bleib bei Aldi.',
      '- Angebote, die nur mit Lidl Plus gelten, gehen nur in den Plan, wenn du in "menge" "nur mit Lidl Plus" dazuschreibst.',
    ] : ['- Alles kommt von Aldi Süd, "markt" ist immer "aldi". Nutze keine Lidl-Angebote.']),
    '',
    ...(rules.saison !== false ? seasonLines(week) : []),
    'Neue Gerichte:',
    '- Zutaten für 4 Personen mit Menge, Einheit (g, ml, EL, TL, Stk., Pck., Dose oder leer) und Abteilung. Grundzutaten wie Öl, Salz, Pfeffer, Gewürze bekommen Abteilung "basis", Menge 0 und den Text mit Menge im Namen, zum Beispiel "2 EL Öl".',
    '- Schritte kurz und klar, mit Thermomix-Angaben (Zeit, Temperatur, Stufe), wo es passt. "tags" zum Beispiel Thermomix, Airfryer, Schnell, Vegan.',
    '- "vorabend" beim Gericht nur, wenn jedes Mal etwas vorzubereiten ist.',
    '',
    'Einkaufsliste:',
    `- Alle Zutaten der Woche zusammengefasst, in üblichen Packungsgrößen. Ohne Grundzutaten und ohne das, was laut Vorrat da ist.`,
    '- Namen in der Einkaufsliste ohne „Bio“ (also "Hähnchenbrustfilet", nicht "Bio-Hähnchenbrustfilet"). Die Familie kauft ohnehin Bio, wenn es das gibt.',
    '- Jede Zutat steht pro Tour nur einmal: Gleiche Zutaten aus mehreren Gerichten werden ein Posten mit der Gesamtmenge, in "wofuer" stehen alle Gerichte. Keine doppelten Posten durch Einzahl und Mehrzahl (Zwiebel und Zwiebeln) oder andere Einheiten (Stk. und Stück).',
    `- Tour "gross": Großeinkauf am ${sd.gross.wd}, ${fmtDay(sat)}${sd.gross.why ? ` (vorgezogen, weil ${sd.gross.why})` : ''}`,
    `- Tour "frisch": kleiner Einkauf am ${sd.frisch.wd}, ${fmtDay(wed)}${sd.frisch.why ? ` (vorgezogen, weil ${sd.frisch.why})` : ''}, für Frisches, das sonst nicht bis zum Ende der Woche hält`,
    ...(sd.gross.day > addDays(week, -7) && wdOf(sd.gross.day) < 5 ? ['- Der Großeinkauf liegt früher als sonst. Plane Frisches für die ersten Tage der Woche so, dass es bis dahin hält, oder lege es auf die Tour "frisch".'] : []),
    '- "wofuer" immer ausfüllen: Kurzname des Gerichts mit Wochentag, zum Beispiel "Hackbällchen (Mo), Brotbox (Do)".',
    '',
    'Wunschessen der Kinder:',
    ...(wishes.length ? [
      '- Baue genau einen der Wünsche ein, wenn er zu den Regeln passt. Die Ausschlüsse gelten auch hier.',
      `- Gibt es mehrere Wünsche, nimm den eines Kindes, dessen Wunsch zuletzt nicht dran war.${extra.lastWish ? ` Zuletzt erfüllt wurde der Wunsch von ${extra.lastWish}.` : ''}`,
      '- Steht der Wunsch nicht in der Sammlung, schreib ein neues Rezept dafür, gesund und kindgerecht umgesetzt.',
      '- In "wunsch_erfuellt" den Namen des Kindes, dessen Wunsch drin ist. Passt kein Wunsch, leer lassen und in "hinweise" kurz sagen, warum.',
    ] : ['- Diese Woche gibt es keine Wünsche, "wunsch_erfuellt" bleibt leer.']),
    '',
    'Was muss weg:',
    ...((extra.reste || []).length ? [
      '- Die Familie hat Reste, Angebrochenes oder Gartenernte, die bald verbraucht werden müssen. Verplane sie in den ersten Tagen der Woche, im Abendessen oder in der Brotbox.',
      '- Kauf dafür nichts davon ein. Sag in "hinweise" kurz, wo es verwendet wird. Passt etwas gar nicht, sag das auch.',
    ] : ['- Diese Woche ist nichts angegeben.']),
    '',
    'Packungsgrößen:',
    ...((extra.packungen || []).length ? [
      '- Unten steht, in welchen Packungsgrößen es manche Produkte im Markt wirklich gibt. Plane mit ganzen Packungen: Mengen in neuen Rezepten so wählen, dass eine oder zwei Packungen aufgehen.',
      '- Bleibt doch ein Rest (zum Beispiel 300 g von 800 g Pute), verwende ihn in einem zweiten Gericht derselben Woche oder in der Brotbox und sag das in "hinweise".',
      '- In der Einkaufsliste schreibst du für diese Produkte die Menge als Packungen, zum Beispiel "2 Packungen à 400 g".',
    ] : ['- Nimm übliche Packungsgrößen bei Aldi Süd.']),
    '',
    'Kosten:',
    '- "kosten": geschätzte Summe der Einkaufsliste in Euro. Nimm dafür die Preise, die die Familie zuletzt bezahlt hat (Preisgedächtnis), sonst übliche Discounter-Preise.',
    '- Vergleiche Angebote mit diesen Preisen. Ist ein Angebot nicht günstiger als das, was die Familie sonst zahlt, ist es kein Grund für ein Gericht. Das gilt auch für die Wahl zwischen Aldi und Lidl.',
    '- In der Auswertung steht bei vielen Gerichten "kosten_pro_portion". Wird die Woche teuer (etwa durch Gäste oder teure neue Rezepte), gleiche mit gut bewerteten, günstigen Gerichten aus.',
    '',
    'Sprache: Deutsch, schlicht und freundlich, ohne Gedankenstriche und ohne Werbesprache.',
  ].join('\n');

  const pantry = ctx && Array.isArray(ctx.vorrat) ? ctx.vorrat : [];
  const user = [
    `Plane die Woche von Montag, ${fmtDay(week)} bis Sonntag, ${fmtDay(addDays(week, 6))} (KW ${isoWeekNo(week)}).`,
    '',
    'Die Tage:',
    JSON.stringify(days.map(({ bekannt, ...d }) => d)),
    '',
    `Vorrat, der im Haus ist: ${pantry.length ? pantry.join(', ') : 'keine Angabe'}.`,
    '',
    `Angebote rund um die Einkaufstage (${shopDays(week).gross.wd} ${fmtDay(shopDays(week).gross.day)} und ${shopDays(week).frisch.wd} ${fmtDay(shopDays(week).frisch.day)}):`,
    offers && offers.trim() ? offers.trim() : 'Keine Angebote bekannt. Dann plane ohne Angebote.',
    '',
    'Auswertung aus der App (Sammlung, Bewertungen, Herzen, letzte Wochen):',
    ctx && ctx.auswertung ? JSON.stringify(ctx.auswertung) : 'Keine Auswertung vorhanden.',
    ...(wish ? ['', `Wunsch der Eltern für diese Woche: ${wish}`] : []),
    ...(wishes.length ? ['', 'Wunschessen der Kinder für diese Woche:', ...wishes.map((w) => `- ${w.kind}: ${w.wunsch}`)] : []),
    ...((extra.reste || []).length ? ['', 'Was muss weg (bald verbrauchen):', ...(extra.reste || []).map((x) => `- ${x}`)] : []),
    ...((extra.packungen || []).length ? ['', 'Packungsgrößen, wie es sie im Markt wirklich gibt (von der Familie gemeldet oder vom Kassenzettel):', ...(extra.packungen || []).map((x) => `- ${x}`)] : []),
    '',
    'Preisgedächtnis (was die Familie zuletzt bezahlt hat, aus den Kassenzetteln):',
    extra.prices && extra.prices.trim() ? extra.prices.trim() : 'Noch keine Kassenzettel erfasst.',
    ...(problems && problems.length ? ['', 'Dein letzter Entwurf hatte diese Fehler. Bitte behebe sie:', ...problems.map((x) => `- ${x}`)] : []),
  ].join('\n');
  return { system, user };
}

// Prüft den Entwurf. errors führen zu einem neuen Versuch, warnings stehen nur dabei.
// Startdatum aus „Angebot ab 20.11.“ als JJJJ-MM-TT, passend zum Jahr der geplanten Woche.
export function offerStart(menge: string, week: string): string | null {
  const m = menge.match(/angebot[^0-9]{0,12}ab\s+(\d{1,2})\.(\d{1,2})\./i);
  if (!m) return null;
  const mon = Number(m[2]); const day = Number(m[1]);
  if (!(mon >= 1 && mon <= 12 && day >= 1 && day <= 31)) return null;
  let y = Number(week.slice(0, 4));
  const wm = Number(week.slice(5, 7));
  if (wm === 12 && mon === 1) y += 1;
  if (wm === 1 && mon === 12) y -= 1;
  return `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function checkDraft(d: Row, o: { rules: Rules; ctx: Row | null; week: string; urlaub?: Row[] }) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const days = weekDays(o.ctx, o.week, o.urlaub);
  const norm = (x: unknown) => String(x || '').trim().toLowerCase();
  const collection: Row[] = o.ctx && o.ctx.auswertung && Array.isArray(o.ctx.auswertung.gerichte) ? o.ctx.auswertung.gerichte : [];
  const fresh: Row[] = Array.isArray(d.neue_gerichte) ? d.neue_gerichte : [];
  const tage: Row[] = Array.isArray(d.tage) ? d.tage : [];
  const banned = o.rules.ausschluesse.map(norm).filter(Boolean);
  const hit = (text: string) => banned.find((b) => norm(text).includes(b));

  for (const day of days) {
    const n = tage.filter((t) => t.datum === day.tag).length;
    if (n === 0 && day.urlaub) continue;
    if (n === 0) errors.push(`Für ${day.wochentag}, ${day.tag} fehlt ein Abendessen.`);
    if (n > 1) errors.push(`${day.wochentag}, ${day.tag} steht mehrfach im Plan.`);
  }
  for (const t of tage) if (!days.some((x) => x.tag === t.datum)) errors.push(`Der Tag ${t.datum} gehört nicht zur geplanten Woche.`);

  const seen = new Set<string>();
  for (const t of tage) {
    const day = days.find((x) => x.tag === t.datum);
    const name = norm(t.gericht);
    if (day && day.urlaub) {
      if (name) warnings.push(`${day.wochentag} ist ${day.urlaub}, „${t.gericht}“ wurde weggelassen.`);
      t.gericht = ''; t.brotbox = ''; t.vorabend = '';
      continue;
    }
    if (!name) { errors.push(`Am ${t.datum} steht kein Gericht.`); continue; }
    if (seen.has(name)) errors.push(`„${t.gericht}“ steht zweimal in der Woche.`);
    seen.add(name);
    const isNew = fresh.find((g) => norm(g.name) === name);
    const old = collection.find((g) => norm(g.name) === name);
    if (!isNew && !old) errors.push(`„${t.gericht}“ (${t.datum}) ist weder ein neues Gericht noch steht es so in der Sammlung.`);
    if (old) {
      if (String(old.status || '').startsWith('aussortiert') || String(old.status || '').includes('von Hand aussortiert')) errors.push(`„${t.gericht}“ ist aussortiert und darf nicht in den Plan.`);
      if (old.nicht_einplanen_bis && t.datum <= old.nicht_einplanen_bis) errors.push(`„${t.gericht}“ ist bis ${old.nicht_einplanen_bis} gesperrt.`);
      if (old.art === 'Brotbox-Rezept') errors.push(`„${t.gericht}“ ist ein Brotbox-Rezept und kein Abendessen.`);
    }
    const dur = isNew ? Number(isNew.dauer_min) : old ? Number(old.dauer_min) : 0;
    if (day && day.kurz && dur > 40) warnings.push(`${day.wochentag}: „${t.gericht}“ dauert ${dur} Minuten, an dem Tag ist es knapp.`);
    else if (day && day.schultag && dur > o.rules.kochzeit) warnings.push(`${day.wochentag}: „${t.gericht}“ dauert ${dur} Minuten.`);
    const b = hit(t.gericht) || hit(t.brotbox);
    if (b) errors.push(`Am ${t.datum} kommt „${b}“ vor, das ist ausgeschlossen.`);
    if (day && !day.schultag && norm(t.brotbox)) { warnings.push(`${day.wochentag} ist schulfrei, die Brotbox wurde weggelassen.`); t.brotbox = ''; }
    if (day && day.schultag && !norm(t.brotbox)) warnings.push(`${day.wochentag} ist ein Schultag ohne Brotbox.`);
  }
  for (const g of fresh) {
    if (!tage.some((t) => norm(t.gericht) === norm(g.name))) warnings.push(`Das neue Gericht „${g.name}“ steht an keinem Tag und wird nur gespeichert.`);
    if (collection.some((c) => norm(c.name) === norm(g.name))) warnings.push(`„${g.name}“ gab es schon, das gespeicherte Rezept wird ersetzt.`);
    const b = hit(g.name) || (g.zutaten || []).map((z: Row) => hit(z.name)).find(Boolean);
    if (b) errors.push(`Im neuen Gericht „${g.name}“ kommt „${b}“ vor, das ist ausgeschlossen.`);
    if (!(g.zutaten || []).length || !(g.schritte || []).length) errors.push(`Beim neuen Gericht „${g.name}“ fehlen Zutaten oder Schritte.`);
  }
  for (const e of Array.isArray(d.einkauf) ? d.einkauf : []) {
    const b = hit(e.name);
    if (b) errors.push(`Auf der Einkaufsliste steht „${e.name}“, das ist ausgeschlossen.`);
    // Angebote erst ab ihrem Starttag: Liegt der nach dem Einkaufstag der Tour, gibt es den Artikel dort noch nicht.
    const start = offerStart(String(e.menge || ''), o.week);
    const shop = e.tour === 'frisch' ? shopDays(o.week).frisch.day : shopDays(o.week).gross.day;
    if (start && start > shop) errors.push(`„${e.name}“ ist erst ab ${fmtDay(start)} im Angebot, die Tour "${e.tour === 'frisch' ? 'frisch' : 'gross'}" ist aber schon am ${fmtDay(shop)}, also dort noch nicht zu haben. Ist es ein Aktionsartikel, gibt es ihn vorher gar nicht: Nimm ein anderes Produkt, das es immer gibt. Gibt es den Artikel sonst auch im Sortiment, nimm ihn ohne Angebot.`);
  }
  return { errors, warnings };
}

// Wandelt den geprüften Entwurf in das Importformat der App um.
export function toImport(d: Row, week: string, lidl = true) {
  const sd = shopDays(week);
  const sat = sd.gross.day;
  const wed = sd.frisch.day;
  const name = (t: Row, label: string) => `${label} am ${t.short} ${fmtDay(t.day)}${t.why ? `, vorgezogen (${t.why})` : ''}${t.mittags ? ', Markt schließt mittags' : ''}`;
  const trips = { gross: name(sd.gross, 'Großeinkauf'), frisch: name(sd.frisch, 'Frischeeinkauf') } as Record<string, string>;
  return {
    week_start: week,
    dishes: (d.neue_gerichte || []).map((g: Row) => ({
      name: String(g.name).trim(),
      category: DISH_KINDS.includes(g.kategorie) ? g.kategorie : 'gemischt',
      duration_min: Math.max(5, Math.round(Number(g.dauer_min) || 30)),
      tags: Array.isArray(g.tags) ? g.tags.map(String) : [],
      note: String(g.hinweis || ''),
      prep: String(g.vorabend || ''),
      ingredients: (g.zutaten || []).map((z: Row) => (z.abteilung === 'basis' || !(Number(z.menge) > 0)
        ? [null, '', String(z.name), 'basis']
        : [Number(z.menge), String(z.einheit || ''), String(z.name), String(z.abteilung)])),
      steps: (g.schritte || []).map(String),
    })),
    plan: (d.tage || []).filter((t: Row) => String(t.gericht || '').trim()).slice().sort((a: Row, b: Row) => (a.datum < b.datum ? -1 : 1)).map((t: Row) => ({
      day: t.datum, dish: String(t.gericht).trim(), lunchbox: String(t.brotbox || ''), prep: String(t.vorabend || ''),
    })),
    shopping: (d.einkauf || []).map((e: Row) => ({
      label: String(e.name), qty: String(e.menge || ''), category: SHOP.includes(e.abteilung) ? e.abteilung : 'sonst',
      trip: trips[e.tour] || trips.gross, due: e.tour === 'frisch' ? wed : sat, purpose: String(e.wofuer || ''),
      shop: lidl && e.markt === 'lidl' ? 'lidl' : '',
    })),
  };
}

const textOf = (msg: Row) => (msg && Array.isArray(msg.content) ? msg.content : []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join('');

function apiHeaders() {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Der Schlüssel ANTHROPIC_API_KEY fehlt in den Secrets der Funktion.');
  return { 'x-api-key': key, 'anthropic-version': API_VERSION, 'content-type': 'application/json' };
}
/* ---------- Was Claude kostet ---------- */

// US-Dollar pro Million Tokens [Eingabe, Ausgabe], Stand der Preisliste von Anthropic im November 2026.
export const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5],
};
const SEARCH_USD = 0.01;
// Kosten einer Antwort in US-Dollar. Batches kosten die Hälfte, Cache-Lesen ein Bruchteil.
export function usageCost(model: string, u: Row | null | undefined, batch = false): number {
  if (!u) return 0;
  const key = Object.keys(PRICES).find((k) => String(model || '').startsWith(k)) || 'claude-sonnet-5-5';
  const [inp, out] = PRICES[key];
  const readFactor = key === 'claude-haiku-5-5' ? 0.1 : 0.05;
  const tokens = (Number(u.input_tokens) || 0) * inp + (Number(u.cache_creation_input_tokens) || 0) * inp * 1.25
    + (Number(u.cache_read_input_tokens) || 0) * inp * readFactor + (Number(u.output_tokens) || 0) * out;
  const searches = Number((u.server_tool_use || {}).web_search_requests) || 0;
  return (tokens / 1e6) * (batch ? 0.5 : 1) + searches * SEARCH_USD;
}
let usageKind = 'sonstiges';
const usageQueue: { kind: string; usd: number }[] = [];
function noteUsage(model: string, u: Row | null | undefined, batch = false, kind = usageKind) {
  const usd = usageCost(model, u, batch);
  if (usd > 0) usageQueue.push({ kind, usd });
}
// Gesammelte Kosten in ep_settings "ki_verbrauch" ablegen, pro Monat und Art. Die letzten 13 Monate bleiben.
export async function flushUsage(store: Store, nowMs = Date.now()) {
  if (!usageQueue.length) return;
  const items = usageQueue.splice(0);
  const month = berlin(nowMs).day.slice(0, 7);
  const rows = await store.get('ep_settings?select=value&key=eq.ki_verbrauch').catch(() => []);
  const all: Row = (rows[0] && rows[0].value && typeof rows[0].value === 'object') ? rows[0].value : {};
  const m: Row = all[month] || { usd: 0, n: 0, arten: {} };
  for (const x of items) {
    m.usd = Math.round((Number(m.usd || 0) + x.usd) * 10000) / 10000;
    m.n = Number(m.n || 0) + 1;
    m.arten = m.arten || {};
    m.arten[x.kind] = Math.round((Number(m.arten[x.kind] || 0) + x.usd) * 10000) / 10000;
  }
  all[month] = m;
  const keep = Object.keys(all).sort().slice(-13);
  const value = Object.fromEntries(keep.map((k) => [k, all[k]]));
  await store.upsert('ep_settings', [{ key: 'ki_verbrauch', value, updated_at: nowIso(nowMs) }]);
}

async function apiCall(url: string, init: RequestInit = {}) {
  const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, { ...init, headers: { ...apiHeaders(), ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try { msg = JSON.parse(text).error.message || msg; } catch (e) { /* Text bleibt */ }
    throw new Error(`Claude-Schnittstelle ${res.status}: ${msg}`);
  }
  // Direkte Anfragen gleich mitzählen. Batches zählt fetchResult, wenn das Ergebnis da ist.
  if (url === '/messages') {
    try { const r = JSON.parse(text); noteUsage(String(r.model || ''), r.usage); } catch (e) { /* keine Zählung */ }
  }
  return text;
}
async function submit(customId: string, params: Row): Promise<string> {
  const t = await apiCall('/messages/batches', { method: 'POST', body: JSON.stringify({ requests: [{ custom_id: customId, params }] }) });
  return JSON.parse(t).id;
}
// Liefert null, solange der Batch läuft, sonst das Ergebnis des einen Requests.
async function fetchResult(batchId: string): Promise<Row | null> {
  const b = JSON.parse(await apiCall(`/messages/batches/${batchId}`));
  if (b.processing_status !== 'ended') return null;
  if (!b.results_url) return { type: 'errored', error: { message: 'Kein Ergebnis geliefert.' } };
  const lines = (await apiCall(b.results_url)).split('\n').filter((l) => l.trim());
  const result = lines.length ? JSON.parse(lines[0]).result : { type: 'errored', error: { message: 'Leeres Ergebnis.' } };
  if (result && result.message) noteUsage(String(result.message.model || ''), result.message.usage, true, 'wochenplan');
  return result;
}

// Die neuen Modelle denken vor der Antwort nach (adaptives Thinking). Das zählt zu max_tokens,
// deshalb sind die Grenzen großzügig. Bezahlt wird nur, was tatsächlich erzeugt wird.
const PLAN_TOKENS = 64000;
const PLAN_TOKENS_RETRY = 120000;

function offersParams(rules: Rules, messages: Row[]) {
  return {
    model: rules.modell, max_tokens: 16000, messages,
    tools: [{
      type: 'web_search_20250305', name: 'web_search', max_uses: rules.lidl ? 8 : 5,
      allowed_domains: rules.lidl ? ['aldi-sued.de', 'lidl.de'] : ['aldi-sued.de'],
      user_location: { type: 'approximate', city: 'Coburg', region: 'Bayern', country: 'DE', timezone: 'Europe/Berlin' },
    }],
  };
}
function planParams(rules: Rules, prompt: { system: string; user: string }, maxTokens = PLAN_TOKENS) {
  return {
    model: rules.modell, max_tokens: maxTokens, system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    output_config: { format: { type: 'json_schema', schema: PLAN_SCHEMA } },
  };
}

/* ---------- Haushaltsbuch: Kassenzettel lesen ---------- */

// Gleiche Grundwerte wie in js/haushalt.js. Die Eltern können sie in der App ändern.
export const KATEGORIEN = [
  'Fleisch und Fisch', 'Obst und Gemüse', 'Milch, Käse und Eier', 'Brot und Backwaren', 'Vorrat und Tiefkühl',
  'Süßes und Snacks', 'Getränke', 'Drogerie und Hygiene', 'Haushalt und Putzen', 'Tierbedarf', 'Sonstiges', 'Pfand und Rabatt',
];

export function receiptSchema(cats: string[]) {
  return {
    type: 'object', additionalProperties: false,
    required: ['markt', 'datum', 'summe', 'posten', 'hinweis'],
    properties: {
      markt: { type: 'string' },
      datum: { type: 'string' },
      summe: { type: 'number' },
      hinweis: { type: 'string' },
      posten: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['text', 'name', 'preis', 'kategorie', 'packung'],
          properties: {
            text: { type: 'string' },
            name: { type: 'string' },
            preis: { type: 'number' },
            kategorie: { type: 'string', enum: cats },
            packung: { type: 'string' },
          },
        },
      },
    },
  };
}

export function receiptPrompt(cats: string[], learned: Record<string, string>) {
  const known = Object.entries(learned || {}).filter(([k, v]) => k && cats.includes(v)).slice(-80);
  return [
    'Auf dem Foto ist ein deutscher Kassenzettel, meist von Aldi Süd oder Lidl. Lies ihn vollständig aus.',
    '- "markt": Name des Geschäfts, bei Aldi Süd genau "Aldi Süd", bei Lidl genau "Lidl", sonst der Name wie auf dem Zettel.',
    '- "datum": Kaufdatum als JJJJ-MM-TT. Ist keins lesbar, leer lassen.',
    '- "summe": der bezahlte Gesamtbetrag in Euro (Zeile SUMME, Zu zahlen oder Gesamt).',
    '- "posten": jede Artikelzeile einzeln. "text" so wie auf dem Zettel, "name" gut lesbar ausgeschrieben (aus "BIO HAEHN.BR.FIL" wird "Bio-Hähnchenbrustfilet"), "preis" der Zeilenbetrag in Euro.',
    '- Mengenzeilen wie "2 x 1,29" gehören zum Artikel darüber, "preis" ist dann der Gesamtbetrag der Zeile.',
    '- Rabatte, Preisnachlässe und Pfandrückgabe als eigener Posten mit negativem Preis, Pfand und Rabatte in die Kategorie "Pfand und Rabatt".',
    '- Zwischensummen, Zahlungsart, Steuerzeilen, Rückgeld und Kartenbeleg sind keine Posten.',
    `- "kategorie": genau eine aus: ${cats.join(', ')}.`,
    '- "packung": die Packungsgröße, wenn sie auf dem Zettel im Artikeltext steht (aus "PUTENBR.FIL. 400G" wird "400 g", aus "MILCH 1L" wird "1 l", aus "EIER 10ER" wird "10 Stück"). Steht keine Größe da, leer lassen und nichts raten.',
    ...(known.length ? ['- So hat die Familie Artikel bisher eingeordnet, daran halten: ' + known.map(([k, v]) => `${k} = ${v}`).join('; ')] : []),
    '- "hinweis": kurz, wenn etwas unsicher oder unleserlich war, sonst leer. Weicht die Summe der Posten vom Gesamtbetrag ab, sag es dort.',
    'Rate keine Artikel dazu, die nicht auf dem Zettel stehen.',
  ].join('\n');
}

const MEDIA = ['image/jpeg', 'image/png', 'image/webp'];

export type Photo = { data: string; media: string };

export function receiptParams(model: string, photos: Photo[], cats: string[], learned: Record<string, string>) {
  const many = photos.length > 1 ? `\nDer Kassenzettel ist auf ${photos.length} Fotos verteilt, von oben nach unten. Überschneidungen nur einmal zählen.` : '';
  return {
    model, max_tokens: 16000,
    messages: [{ role: 'user', content: [
      ...photos.map((p) => ({ type: 'image', source: { type: 'base64', media_type: p.media, data: p.data } })),
      { type: 'text', text: receiptPrompt(cats, learned) + many },
    ] }],
    output_config: { format: { type: 'json_schema', schema: receiptSchema(cats) } },
  };
}

// Antwort von Claude auf ein lesbares Ergebnis bringen.
export function parseReceipt(res: Row, cats: string[]) {
  if (res.stop_reason === 'max_tokens') throw new Error('Der Kassenzettel war zu lang für eine Antwort.');
  const text = (res.content || []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join('');
  const d = JSON.parse(text);
  const money = (x: unknown) => Math.round((Number(x) || 0) * 100) / 100;
  const posten = (Array.isArray(d.posten) ? d.posten : []).map((p: Row) => ({
    text: String(p.text || '').slice(0, 120), name: String(p.name || p.text || '').slice(0, 120),
    preis: money(p.preis), kategorie: cats.includes(p.kategorie) ? p.kategorie : 'Sonstiges', packung: String(p.packung || '').slice(0, 20),
  })).filter((p: Row) => p.name);
  return {
    markt: String(d.markt || '').slice(0, 60),
    datum: /^\d{4}-\d{2}-\d{2}$/.test(String(d.datum || '')) ? String(d.datum) : '',
    summe: money(d.summe),
    hinweis: String(d.hinweis || '').slice(0, 400),
    posten,
    usage: res.usage || null,
  };
}

function checkPhotos(photos: Photo[]) {
  if (!photos.length || photos.length > 4) throw new Error('Bitte ein bis vier Fotos schicken.');
  if (photos.some((p) => !MEDIA.includes(p.media))) throw new Error('Bitte Fotos als JPEG, PNG oder WebP schicken.');
  if (photos.some((p) => !p.data) || photos.reduce((a, p) => a + p.data.length, 0) > 12_000_000) throw new Error('Die Fotos sind zu groß.');
}

export async function readReceipt(store: Store, photos: Photo[]) {
  checkPhotos(photos);
  const settings = await store.get('ep_settings?select=key,value&key=in.(haushalt,regeln)');
  const get = (k: string) => (settings.find((x) => x.key === k) || {}).value;
  const h = get('haushalt') || {};
  const cats: string[] = Array.isArray(h.kategorien) && h.kategorien.length ? h.kategorien.map(String) : KATEGORIEN;
  if (!cats.includes('Sonstiges')) cats.push('Sonstiges');
  const rules = mergeRules(get('regeln'));
  const text = await apiCall('/messages', { method: 'POST', body: JSON.stringify(receiptParams(rules.modell, photos, cats, h.merken || {})) });
  return parseReceipt(JSON.parse(text), cats);
}

/* ---------- Rezept aus Foto ---------- */

const NUTRI = ['kcal', 'fat', 'sat', 'carbs', 'sugar', 'fiber', 'protein', 'salt'];

export const RECIPE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['erkannt', 'name', 'kategorie', 'dauer_min', 'portionen_original', 'tags', 'hinweis', 'vorabend', 'zutaten', 'schritte', 'naehrwerte'],
  properties: {
    erkannt: { type: 'boolean' },
    name: { type: 'string' },
    kategorie: { type: 'string', enum: [...DISH_KINDS, 'brotbox'] },
    dauer_min: { type: 'integer' },
    portionen_original: { type: 'integer' },
    tags: { type: 'array', items: { type: 'string' } },
    hinweis: { type: 'string' },
    vorabend: { type: 'string' },
    zutaten: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['menge', 'einheit', 'name', 'abteilung'],
        properties: { menge: { type: 'number' }, einheit: { type: 'string' }, name: { type: 'string' }, abteilung: { type: 'string', enum: [...SHOP, 'basis'] } },
      },
    },
    schritte: { type: 'array', items: { type: 'string' } },
    naehrwerte: {
      type: 'object', additionalProperties: false,
      required: ['vom_rezept', ...NUTRI],
      properties: { vom_rezept: { type: 'boolean' }, ...Object.fromEntries(NUTRI.map((k) => [k, { type: 'number' }])) },
    },
  },
};

export function recipePrompt(names: string[]) {
  return [
    'Auf den Fotos ist ein Rezept, zum Beispiel aus Cookidoo, von einer Kochbox-Karte, aus einem Kochbuch oder handschriftlich. Mehrere Fotos gehören zum selben Rezept.',
    'Erfasse es für eine Familie mit zwei Erwachsenen und zwei Kindern (12 und 9 Jahre), also für 4 Portionen.',
    '- "erkannt": false, wenn auf den Fotos kein Rezept zu erkennen ist. Dann den Rest leer lassen.',
    '- "portionen_original": für wie viele Portionen das Rezept auf dem Foto gedacht ist. Rechne alle Mengen auf 4 Portionen um und runde sinnvoll (ganze Eier, übliche Packungsgrößen).',
    '- "zutaten": Menge als Zahl, Einheit kurz (g, ml, EL, TL, Stück, Bund, Dose, Packung), Name ohne Menge. "abteilung" ist die Abteilung im Supermarkt: obst (Obst, Gemüse, Kräuter), brot, fleisch (Fleisch und Fisch), kuehl (Milchprodukte, Eier, Kühlregal), tk (Tiefkühl), vorrat (Nudeln, Reis, Konserven, Mehl, Gewürzpasten). "basis" für Dinge, die man im Haus hat: Salz, Pfeffer, Öl, Zucker, Wasser, Gewürze. Bei "basis" ist die Menge 0.',
    '- "schritte": die Arbeitsschritte in eigenen, klaren Sätzen. Thermomix-Angaben (Zeit, Temperatur, Stufe, Linkslauf) beibehalten.',
    '- "dauer_min": Gesamtzeit in Minuten. "kategorie": nach der Hauptzutat, "brotbox" nur für Snacks für die Brotbox.',
    '- "vorabend": was am Vorabend vorbereitet werden muss (auftauen, einweichen, marinieren), sonst leer.',
    '- "tags": zwei bis vier kurze Stichworte, etwa Thermomix, Airfryer, schnell, Ofen.',
    '- "naehrwerte" pro Portion. Stehen sie auf dem Foto, übernimm sie und setze "vom_rezept" auf true. Sonst schätze sie aus den Zutaten und setze false.',
    '- "hinweis": kurz, was unsicher oder unleserlich war oder was du umgerechnet hast, sonst leer.',
    ...(names.length ? [`Diese Gerichte gibt es schon. Heißt das Rezept fast genauso, wähle einen eindeutigen Namen: ${names.slice(0, 200).join('; ')}`] : []),
    'Erfinde nichts dazu, was nicht auf den Fotos steht, außer den umgerechneten Mengen und geschätzten Nährwerten.',
  ].join('\n');
}

export function toDish(d: Row) {
  if (!d.erkannt || !String(d.name || '').trim()) throw new Error('Auf den Fotos war kein Rezept zu erkennen.');
  const n = d.naehrwerte || {};
  const nutrition = NUTRI.every((k) => Number.isFinite(Number(n[k]))) && Number(n.kcal) > 0
    ? Object.fromEntries(NUTRI.map((k) => [k, Math.round(Number(n[k]) * 10) / 10])) : null;
  return {
    name: String(d.name).trim().slice(0, 120),
    category: [...DISH_KINDS, 'brotbox'].includes(d.kategorie) ? d.kategorie : 'gemischt',
    duration_min: Math.max(5, Math.round(Number(d.dauer_min) || 30)),
    tags: Array.isArray(d.tags) ? d.tags.map(String).slice(0, 6) : [],
    note: String(d.hinweis || ''),
    prep: String(d.vorabend || ''),
    ingredients: (d.zutaten || []).filter((z: Row) => String(z.name || '').trim()).map((z: Row) => (z.abteilung === 'basis' || !(Number(z.menge) > 0)
      ? [null, '', String(z.name).trim(), 'basis']
      : [Number(z.menge), String(z.einheit || ''), String(z.name).trim(), String(z.abteilung)])),
    steps: (d.schritte || []).map(String).filter(Boolean),
    ...(nutrition ? { nutrition } : {}),
    meta: { portionen_original: Number(d.portionen_original) || null, naehrwerte_vom_rezept: !!n.vom_rezept },
  };
}

export async function readRecipe(store: Store, photos: Photo[]) {
  checkPhotos(photos);
  const [settings, dishes] = await Promise.all([store.get('ep_settings?select=key,value&key=eq.regeln'), store.get('ep_dishes?select=name')]);
  const rules = mergeRules((settings[0] || {}).value);
  const params = {
    model: rules.modell, max_tokens: 32000,
    messages: [{ role: 'user', content: [
      ...photos.map((p) => ({ type: 'image', source: { type: 'base64', media_type: p.media, data: p.data } })),
      { type: 'text', text: recipePrompt(dishes.map((x: Row) => String(x.name))) },
    ] }],
    output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
  };
  const res = JSON.parse(await apiCall('/messages', { method: 'POST', body: JSON.stringify(params) }));
  if (res.stop_reason === 'max_tokens') throw new Error('Das Rezept war zu lang für eine Antwort.');
  const text = (res.content || []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join('');
  return toDish(JSON.parse(text));
}

/* ---------- Schnelles Mittagessen ---------- */

export const LUNCH_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['vorschlaege'],
  properties: {
    vorschlaege: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'minuten', 'warum', 'zutaten', 'schritte', 'reste'],
        properties: {
          name: { type: 'string' }, minuten: { type: 'integer' }, warum: { type: 'string' },
          zutaten: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['menge', 'name', 'da'], properties: { menge: { type: 'string' }, name: { type: 'string' }, da: { type: 'boolean' } } } },
          schritte: { type: 'array', items: { type: 'string' } },
          reste: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export function lunchPrompt(b: Row, rules: Rules) {
  const list = (x: unknown) => (Array.isArray(x) ? x.map(String).filter(Boolean).slice(0, 80) : []);
  const n = Math.min(10, Math.max(1, Math.round(Number(b.personen) || 1)));
  const min = Math.min(45, Math.max(5, Math.round(Number(b.minuten) || 15)));
  const vorrat = list(b.vorrat); const gekauft = list(b.eingekauft); const reste = list(b.reste); const tabu = list(b.nicht_verbrauchen);
  return [
    `Schlag zwei bis drei schnelle, gesunde Mittagessen für ${n} ${n === 1 ? 'Person' : 'Personen'} vor, fertig in höchstens ${min} Minuten.`,
    b.kind ? 'Ein Kind (9 oder 12 Jahre) macht das allein. Nur einfache, sichere Zubereitung: Toaster, Wasserkocher, Mikrowelle, Herd nur für Einfaches wie Nudeln oder Rührei, kein Frittieren, keine scharfen Spezialmesser.' : '',
    b.wunsch ? `Wunsch: ${String(b.wunsch).slice(0, 200)}` : '',
    `Ziele der Familie: ${rules.ziele} Nie verwenden: ${rules.ausschluesse.join(', ') || 'nichts'}. Vorlieben: ${rules.vorlieben}`,
    '',
    'Was im Haus ist:',
    `- Vorrat: ${vorrat.join(', ') || 'keine Angabe'}`,
    `- In den letzten Tagen eingekauft, vermutlich noch da: ${gekauft.join(', ') || 'keine Angabe'}`,
    reste.length ? `- Muss bald weg, bitte bevorzugt verwenden: ${reste.join(', ')}` : '',
    'Übliche Grundzutaten (Salz, Pfeffer, Öl, Gewürze, Eier, Butter, Milch) darfst du als vorhanden annehmen, aber vorsichtig.',
    tabu.length ? `Diese Zutaten werden heute oder morgen fürs Abendessen gebraucht, nicht oder nur in kleinen Mengen verwenden: ${tabu.join(', ')}` : '',
    b.heute_abend ? `Heute Abend gibt es: ${b.heute_abend}. Mittags bitte etwas anderes.` : '',
    '',
    '- Möglichst nur mit dem, was da ist. Höchstens eine Kleinigkeit, die fehlt, dann bei der Zutat "da": false.',
    '- Eiweißreich und mit Gemüse oder Obst, wenn möglich. "warum": ein kurzer Satz, was daran gut ist.',
    '- Mengen für genau diese Personenzahl. Schritte kurz und klar, Thermomix oder Airfryer nur, wenn es schneller geht.',
    '- "reste": welche der Einträge aus „Muss bald weg“ verbraucht werden, genau so geschrieben wie oben, sonst leer.',
    'Deutsch, schlicht, ohne Gedankenstriche.',
  ].filter((x) => x !== '').join('\n');
}

export async function suggestLunch(store: Store, b: Row) {
  const settings = await store.get('ep_settings?select=key,value&key=eq.regeln');
  const rules = mergeRules((settings[0] || {}).value);
  const params = { model: 'claude-haiku-5-5', max_tokens: 6000, messages: [{ role: 'user', content: lunchPrompt(b, rules) }], output_config: { format: { type: 'json_schema', schema: LUNCH_SCHEMA } } };
  const res = JSON.parse(await apiCall('/messages', { method: 'POST', body: JSON.stringify(params) }));
  if (res.stop_reason === 'max_tokens') throw new Error('Die Antwort war zu lang.');
  const d = JSON.parse((res.content || []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join(''));
  const reste = Array.isArray(b.reste) ? b.reste.map(String) : [];
  const out = (d.vorschlaege || []).filter((v: Row) => String(v.name || '').trim()).slice(0, 3).map((v: Row) => ({
    name: String(v.name).trim().slice(0, 100), minuten: Math.max(1, Math.round(Number(v.minuten) || 15)), warum: String(v.warum || '').slice(0, 200),
    zutaten: (v.zutaten || []).filter((z: Row) => String(z.name || '').trim()).slice(0, 20).map((z: Row) => ({ menge: String(z.menge || ''), name: String(z.name).trim(), da: z.da !== false })),
    schritte: (v.schritte || []).map(String).filter(Boolean).slice(0, 10),
    reste: (v.reste || []).map(String).filter((x: string) => reste.includes(x)),
  }));
  if (!out.length) throw new Error('Claude hatte keinen Vorschlag.');
  return out;
}

/* ---------- Kosten pro Gericht ---------- */

const COST_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['gerichte'],
  properties: { gerichte: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nr', 'euro'], properties: { nr: { type: 'integer' }, euro: { type: 'number' } } } } },
};

export function costPrompt(dishes: Row[], prices: string) {
  const fmt = (g: Row) => (g.q == null || g.c === 'basis' ? `${g.n} (Grundzutat)` : `${g.q} ${g.u || ''} ${g.n}`.replace(/\s+/g, ' '));
  return [
    'Schätze, was die Zutaten für jedes dieser Rezepte bei Aldi Süd oder Lidl kosten.',
    '- Gerechnet wird nur der Anteil, der wirklich verbraucht wird: 250 g von einer 500-g-Packung Quark kostet die Hälfte der Packung.',
    '- Grundzutaten wie Salz, Pfeffer, Öl, Gewürze zusammen pauschal 0,30 € pro Rezept.',
    '- Nimm, wo vorhanden, die Preise, die die Familie zuletzt bezahlt hat. Sonst übliche Discounter-Preise in Deutschland, Bio, wenn "Bio" im Namen steht.',
    '- "euro": Kosten für das ganze Rezept, so wie es dasteht, auf zwei Stellen gerundet.',
    '',
    'Preise der Familie (aus ihren Kassenzetteln):',
    prices.trim() || 'Noch keine Kassenzettel.',
    '',
    'Rezepte:',
    ...dishes.map((d, i) => `${i + 1}. ${d.name}: ${(d.ingredients || []).map(fmt).join('; ')}`),
  ].join('\n');
}

// Schätzt die Kosten aller Gerichte und legt sie unter ep_settings "kosten" ab: { stand, kassenzettel, gerichte: { id: euro } }.
export async function estimateCosts(store: Store, nowMs = Date.now()) {
  const since = addDays(berlin(nowMs).day, -180);
  const [dishes, receipts] = await Promise.all([
    store.get('ep_dishes?select=id,name,ingredients'),
    store.get(`ep_receipts?select=shop,items,day&day=gte.${since}`).catch(() => []),
  ]);
  const list = dishes.filter((d) => (d.ingredients || []).length).slice(0, 150);
  const out: Record<string, number> = {};
  // In Paketen zu 40 Gerichten, damit die Antwort nicht zu lang wird.
  for (let i = 0; i < list.length; i += 40) {
    const part = list.slice(i, i + 40);
    const params = { model: 'claude-haiku-5-5', max_tokens: 8000, messages: [{ role: 'user', content: costPrompt(part, priceTable(receipts, 150)) }], output_config: { format: { type: 'json_schema', schema: COST_SCHEMA } } };
    const res = JSON.parse(await apiCall('/messages', { method: 'POST', body: JSON.stringify(params) }));
    const d = JSON.parse((res.content || []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join(''));
    for (const g of d.gerichte || []) {
      const dish = part[Number(g.nr) - 1];
      const euro = Math.round(Number(g.euro) * 100) / 100;
      if (dish && euro > 0 && euro < 500) out[dish.id] = euro;
    }
  }
  const value = { stand: berlin(nowMs).day, kassenzettel: receipts.length, gerichte: out };
  await store.upsert('ep_settings', [{ key: 'kosten', value, updated_at: new Date(nowMs).toISOString() }]);
  return value;
}

/* ---------- Festtage planen ---------- */

const ZUTAT = {
  type: 'object', additionalProperties: false, required: ['menge', 'einheit', 'name', 'abteilung'],
  properties: { menge: { type: 'number' }, einheit: { type: 'string' }, name: { type: 'string' }, abteilung: { type: 'string', enum: [...SHOP, 'basis'] } },
};
export const FEAST_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['titel', 'menue', 'mengen', 'dips', 'gerichte', 'einkauf', 'zeitplan', 'kinder', 'tipps'],
  properties: {
    titel: { type: 'string' },
    menue: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['gang', 'gericht', 'beschreibung'], properties: { gang: { type: 'string' }, gericht: { type: 'string' }, beschreibung: { type: 'string' } } } },
    mengen: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['was', 'pro_erwachsener', 'pro_kind', 'gesamt'], properties: { was: { type: 'string' }, pro_erwachsener: { type: 'string' }, pro_kind: { type: 'string' }, gesamt: { type: 'string' } } } },
    dips: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'zutaten', 'zubereitung', 'kinder'], properties: { name: { type: 'string' }, zutaten: { type: 'array', items: ZUTAT }, zubereitung: { type: 'string' }, kinder: { type: 'boolean' } } } },
    gerichte: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'zutaten', 'schritte'], properties: { name: { type: 'string' }, zutaten: { type: 'array', items: ZUTAT }, schritte: { type: 'array', items: { type: 'string' } } } } },
    einkauf: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'menge', 'abteilung', 'wann', 'wofuer'], properties: { name: { type: 'string' }, menge: { type: 'string' }, abteilung: { type: 'string', enum: SHOP }, wann: { type: 'string', enum: ['vorher', 'frisch'] }, wofuer: { type: 'string' } } } },
    zeitplan: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['wann', 'was'], properties: { wann: { type: 'string' }, was: { type: 'string' } } } },
    kinder: { type: 'array', items: { type: 'string' } },
    tipps: { type: 'string' },
  },
};

export function feastPrompt(f: Row, rules: Rules) {
  const ad = Math.max(0, Math.round(Number(f.erwachsene) || 0));
  const ki = Math.max(0, Math.round(Number(f.kinder) || 0));
  return [
    `Plane ein Festessen: ${f.anlass || 'Festtag'} am ${f.datum ? fmtDay(String(f.datum)) : 'Festtag'}, für ${ad} Erwachsene und ${ki} Kinder (insgesamt ${ad + ki} Personen).`,
    `Was es geben soll: ${String(f.wunsch || 'frei wählbar, festlich, aber machbar').slice(0, 500)}`,
    f.besonderheiten ? `Zu beachten: ${String(f.besonderheiten).slice(0, 500)}` : '',
    `Regeln der Familie: nie verwenden: ${rules.ausschluesse.join(', ') || 'nichts'}. Vorlieben: ${rules.vorlieben}. Ziele: ${rules.ziele}`,
    'Eingekauft wird bei Aldi Süd und Lidl in Coburg, an Festtagen sind die Läden voll.',
    '',
    '- "menue": die Gänge mit kurzer Beschreibung. Bei Fondue zum Beispiel: Fondue (Fleisch, Fisch, Gemüse), Beilagen, Dips, Nachtisch, falls gewünscht.',
    '- "mengen": die wichtigsten Mengen pro Person und gesamt, zum Beispiel Fleisch, Fisch, Brühe oder Öl, Beilagen. Kinder essen weniger als Erwachsene. Lieber etwas großzügig, ohne Berge übrig zu lassen.',
    '- "dips": vier bis sechs Dips oder Soßen mit Zutaten für alle zusammen und kurzer Zubereitung, abwechslungsreich (klassisch, kräftig, frisch, süß-scharf). "kinder": true, wenn der Dip kindertauglich ist. Gibt es keine Dips beim Essen, Soßen oder Beilagen hier eintragen.',
    '- "gerichte": die übrigen Rezepte (Hauptgericht, Beilagen, Nachtisch) mit Zutaten für alle Personen zusammen und klaren Schritten. Thermomix-Angaben, wo es passt.',
    '- Zutaten: Menge als Zahl, Einheit kurz, Abteilung im Supermarkt. Grundzutaten wie Salz, Pfeffer, Öl in kleinen Mengen: Abteilung "basis", Menge 0.',
    '- "einkauf": alles zusammengefasst in üblichen Packungsgrößen, ohne Grundzutaten. "wann": "vorher" für Haltbares, das man einige Tage vorher kaufen kann, "frisch" für Fleisch, Fisch, Salat und Kräuter (ein bis zwei Tage vorher). "wofuer" kurz, zum Beispiel "Fondue", "Knoblauch-Dip".',
    '- "zeitplan": was wann zu tun ist, ab einigen Tagen vorher bis zum Essen, mit Tag und Uhrzeit, zum Beispiel "23.12. abends: Dips vorbereiten".',
    '- "kinder": zwei bis vier Dinge, bei denen die Kinder (12 und 9 Jahre) mithelfen können.',
    '- "tipps": kurze praktische Hinweise, zum Beispiel was sich vorbereiten lässt oder was mit Resten passiert.',
    'Deutsch, schlicht und freundlich, ohne Gedankenstriche.',
  ].filter(Boolean).join('\n');
}

export async function planFeast(store: Store, f: Row) {
  const settings = await store.get('ep_settings?select=key,value&key=eq.regeln');
  const rules = mergeRules((settings[0] || {}).value);
  const params = { model: rules.modell, max_tokens: 32000, messages: [{ role: 'user', content: feastPrompt(f, rules) }], output_config: { format: { type: 'json_schema', schema: FEAST_SCHEMA } } };
  const res = JSON.parse(await apiCall('/messages', { method: 'POST', body: JSON.stringify(params) }));
  if (res.stop_reason === 'max_tokens') throw new Error('Die Antwort war zu lang.');
  const d = JSON.parse((res.content || []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join(''));
  const z = (list: Row[]) => (list || []).filter((x: Row) => String(x.name || '').trim()).map((x: Row) => (x.abteilung === 'basis' || !(Number(x.menge) > 0)
    ? [null, '', String(x.name).trim(), 'basis'] : [Number(x.menge), String(x.einheit || ''), String(x.name).trim(), String(x.abteilung)]));
  return {
    titel: String(d.titel || f.anlass || 'Festessen').slice(0, 120),
    menue: (d.menue || []).slice(0, 8), mengen: (d.mengen || []).slice(0, 15),
    dips: (d.dips || []).slice(0, 8).map((x: Row) => ({ name: String(x.name), zutaten: z(x.zutaten), zubereitung: String(x.zubereitung || ''), kinder: !!x.kinder })),
    gerichte: (d.gerichte || []).slice(0, 8).map((x: Row) => ({ name: String(x.name), zutaten: z(x.zutaten), schritte: (x.schritte || []).map(String) })),
    einkauf: (d.einkauf || []).slice(0, 80).map((x: Row) => ({ name: String(x.name), menge: String(x.menge || ''), abteilung: SHOP.includes(x.abteilung) ? x.abteilung : 'sonst', wann: x.wann === 'frisch' ? 'frisch' : 'vorher', wofuer: String(x.wofuer || '') })),
    zeitplan: (d.zeitplan || []).slice(0, 20), kinder: (d.kinder || []).slice(0, 6).map(String), tipps: String(d.tipps || ''),
    usage: res.usage || null,
  };
}

/* ---------- Kalender-Abos fürs Küchen-Display ---------- */
// Öffentliche iCloud-Kalender (oder andere Kalender-Abos) als .ics. Die Adressen stehen in ep_settings unter "kalender"
// ({ feeds: [{ id, name, url, person_id }] }) und werden nur von hier abgerufen, nie von einer Adresse aus der Anfrage.
// Ausgewertet werden heute und morgen nach deutscher Zeit: einmalige Termine, Serien (täglich, wöchentlich, monatlich,
// jährlich mit Abständen, Wochentagen, Anzahl und Ende), Ausnahmen, verschobene und abgesagte Einzeltermine.
type IcsProp = { name: string; params: Record<string, string>; value: string };
type IcsWhen = { date: string; time: string | null; tz: string | null; utc: boolean };
type IcsEvent = { uid: string; summary: string; ort?: string; geo?: [number, number] | null; start: IcsWhen; end: IcsWhen | null; dur: number | null; rrule: Record<string, string> | null; exdates: Set<string>; recurId: string | null; cancelled: boolean };
export type CalItem = { titel: string; von: string | null; bis: string | null; ganztags: boolean; zeit?: boolean; weiter?: boolean; kalender: string; ort?: string; geo?: [number, number] | null; weg?: number };

function icsProp(line: string): IcsProp | null {
  let i = 0;
  let quoted = false;
  for (; i < line.length; i += 1) { const c = line[i]; if (c === '"') quoted = !quoted; else if (c === ':' && !quoted) break; }
  if (i >= line.length) return null;
  const head = line.slice(0, i).split(';');
  const params: Record<string, string> = {};
  for (const p of head.slice(1)) { const k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); }
  return { name: head[0].toUpperCase(), params, value: line.slice(i + 1) };
}
const icsText = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/\s+/g, ' ').trim();
function icsWhen(value: string, params: Record<string, string>): IcsWhen | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4] || params.VALUE === 'DATE') return { date, time: null, tz: null, utc: false };
  return { date, time: `${m[4]}:${m[5]}`, tz: m[7] ? null : params.TZID || null, utc: !!m[7] };
}
function icsDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const min = (Number(m[2] || 0) * 7 + Number(m[3] || 0)) * 1440 + Number(m[4] || 0) * 60 + Number(m[5] || 0);
  return m[1] === '-' ? -min : min;
}
export function parseCalendar(text: string): IcsEvent[] {
  const lines = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: IcsEvent[] = [];
  let cur: IcsEvent | null = null;
  let depth = 0;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = { uid: '', summary: '', start: null as unknown as IcsWhen, end: null, dur: null, rrule: null, exdates: new Set(), recurId: null, cancelled: false }; depth = 0; continue; }
    if (!cur) continue;
    if (/^BEGIN:/i.test(line)) { depth += 1; continue; }
    if (/^END:VEVENT/i.test(line)) { if (cur.start) out.push(cur); cur = null; continue; }
    if (/^END:/i.test(line)) { depth -= 1; continue; }
    if (depth > 0) continue; // VALARM und Ähnliches
    const p = icsProp(line);
    if (!p) continue;
    if (p.name === 'UID') cur.uid = p.value.trim();
    else if (p.name === 'SUMMARY') cur.summary = icsText(p.value);
    else if (p.name === 'LOCATION') cur.ort = icsText(p.value);
    else if (p.name === 'X-APPLE-STRUCTURED-LOCATION') {
      const g = /geo:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i.exec(p.value);
      if (g) cur.geo = [Number(g[1]), Number(g[2])];
    }
    else if (p.name === 'DTSTART') cur.start = icsWhen(p.value, p.params) as IcsWhen;
    else if (p.name === 'DTEND') cur.end = icsWhen(p.value, p.params);
    else if (p.name === 'DURATION') cur.dur = icsDuration(p.value);
    else if (p.name === 'STATUS') cur.cancelled = /CANCELLED/i.test(p.value);
    else if (p.name === 'RRULE') cur.rrule = Object.fromEntries(p.value.split(';').map((x) => x.split('=')).filter((x) => x.length === 2).map(([k, v]) => [k.toUpperCase(), v]));
    else if (p.name === 'EXDATE') for (const v of p.value.split(',')) { const w = icsWhen(v, p.params); if (w) cur.exdates.add(w.date); }
    else if (p.name === 'RECURRENCE-ID') { const w = icsWhen(p.value, p.params); if (w) cur.recurId = w.date; }
  }
  return out;
}
// Wanduhrzeit einer Zeitzone in Minuten seit 1970 (UTC). Unbekannte Zonen (etwa aus Outlook) gelten als deutsche Zeit.
const zoneOk = new Map<string, boolean>();
function wallToUtcMin(date: string, time: string, tz: string): number {
  const naive = Date.parse(`${date}T${time}:00Z`);
  let zone = tz;
  if (!zoneOk.has(zone)) { try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); zoneOk.set(zone, true); } catch { zoneOk.set(zone, false); } }
  if (!zoneOk.get(zone)) zone = 'Europe/Berlin';
  const offset = (ms: number) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`) - ms;
  };
  let ms = naive - offset(naive);
  ms = naive - offset(ms);
  return Math.round(ms / 60000);
}
const DAYKEYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const wdOfIso = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const monthAdd = (iso: string, n: number) => { const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const lastDay = (ym: string) => { const d = new Date(`${ym}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.getUTCDate(); };
// Tage eines Monats nach BYDAY (MO, 2MO, -1FR) und BYMONTHDAY (1, 15, -1).
function monthDays(ym: string, byday: string[], bymonthday: number[], fallback: number): string[] {
  const n = lastDay(ym);
  const out = new Set<number>();
  for (const m of bymonthday) { const d = m > 0 ? m : n + 1 + m; if (d >= 1 && d <= n) out.add(d); }
  for (const b of byday) {
    const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(b);
    if (!m) continue;
    const wd = DAYKEYS.indexOf(m[2]);
    const all: number[] = [];
    for (let d = 1; d <= n; d += 1) if (wdOfIso(`${ym}-${String(d).padStart(2, '0')}`) === wd) all.push(d);
    const k = m[1] ? Number(m[1]) : 0;
    if (!k) all.forEach((d) => out.add(d));
    else { const d = k > 0 ? all[k - 1] : all[all.length + k]; if (d) out.add(d); }
  }
  if (!bymonthday.length && !byday.length && fallback <= n) out.add(fallback);
  return [...out].sort((a, b) => a - b).map((d) => `${ym}-${String(d).padStart(2, '0')}`);
}
// Alle Starttage einer Serie bis limit (im Kalender des Termins).
export function seriesDates(start: string, r: Record<string, string>, limit: string): string[] {
  const freq = String(r.FREQ || '').toUpperCase();
  const iv = Math.max(1, parseInt(r.INTERVAL, 10) || 1);
  const count = parseInt(r.COUNT, 10) || 0;
  const until = r.UNTIL ? (icsWhen(r.UNTIL, {}) || { date: '9999-12-31' }).date : '9999-12-31';
  const byday = r.BYDAY ? r.BYDAY.split(',').map((x) => x.trim().toUpperCase()) : [];
  const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number).filter(Boolean) : [];
  const bymonth = r.BYMONTH ? r.BYMONTH.split(',').map(Number).filter(Boolean) : [];
  const end = until < limit ? until : limit;
  const out: string[] = [];
  let seen = 0;
  const take = (d: string) => {
    if (d < start) return true;
    if (bymonth.length && !bymonth.includes(Number(d.slice(5, 7)))) return true;
    if (count && seen >= count) return false;
    if (d > end) return false;
    seen += 1;
    out.push(d);
    return true;
  };
  let guard = 0;
  if (freq === 'DAILY') {
    for (let d = start; d <= end && guard < 20000; d = addDays(d, iv), guard += 1) {
      if (byday.length && !byday.some((b) => b.endsWith(DAYKEYS[wdOfIso(d)]))) continue;
      if (!take(d)) break;
    }
  } else if (freq === 'WEEKLY') {
    const days = (byday.length ? byday.map((b) => DAYKEYS.indexOf(b.slice(-2))).filter((x) => x >= 0) : [wdOfIso(start)]).sort((a, b) => a - b);
    for (let w = addDays(start, -wdOfIso(start)); w <= end && guard < 5000; w = addDays(w, 7 * iv), guard += 1) {
      let stop = false;
      for (const wd of days) { if (!take(addDays(w, wd))) { stop = true; break; } }
      if (stop) break;
    }
  } else if (freq === 'MONTHLY') {
    for (let m = start.slice(0, 7); `${m}-01` <= end && guard < 2000; m = monthAdd(`${m}-01`, iv).slice(0, 7), guard += 1) {
      let stop = false;
      for (const d of monthDays(m, byday, bymd, Number(start.slice(8, 10)))) { if (!take(d)) { stop = true; break; } }
      if (stop) break;
    }
  } else if (freq === 'YEARLY') {
    const months = bymonth.length ? bymonth : [Number(start.slice(5, 7))];
    for (let y = Number(start.slice(0, 4)); `${y}-01-01` <= end && guard < 300; y += iv, guard += 1) {
      let stop = false;
      for (const mo of [...months].sort((a, b) => a - b)) {
        const ym = `${y}-${String(mo).padStart(2, '0')}`;
        for (const d of monthDays(ym, byday, bymd, Number(start.slice(8, 10)))) { if (!take(d)) { stop = true; break; } }
        if (stop) break;
      }
      if (stop) break;
    }
  } else take(start);
  return out;
}
// Termine eines Kalenders an den Tagen days (deutsche Zeit).
export function calendarDays(events: IcsEvent[], days: string[], feed: string): Record<string, CalItem[]> {
  const res: Record<string, CalItem[]> = Object.fromEntries(days.map((d) => [d, []]));
  const first = days[0];
  const last = days[days.length - 1];
  const overrides = new Map<string, IcsEvent>();
  for (const e of events) if (e.recurId && e.uid) overrides.set(`${e.uid}|${e.recurId}`, e);
  // Berliner Tagesgrenzen in UTC-Minuten, einmal gerechnet.
  const bounds = days.map((d) => [d, wallToUtcMin(d, '00:00', 'Europe/Berlin'), wallToUtcMin(addDays(d, 1), '00:00', 'Europe/Berlin')] as [string, number, number]);
  const hm = (utcMin: number) => { const b = berlin(utcMin * 60000); return `${String(Math.floor(b.min / 60)).padStart(2, '0')}:${String(b.min % 60).padStart(2, '0')}`; };
  const place = (e: IcsEvent, date: string) => {
    if (e.cancelled || !e.summary) return;
    if (!e.start.time) {
      // Ganztägig: Ende ausschließlich, ohne Ende ein Tag.
      const span = e.end && !e.end.time ? Math.max(1, daysBetween(e.start.date, e.end.date)) : e.dur ? Math.max(1, Math.round(e.dur / 1440)) : 1;
      const stop = addDays(date, span);
      for (const d of days) if (d >= date && d < stop) res[d].push({ titel: e.summary, von: null, bis: null, ganztags: true, kalender: feed });
      return;
    }
    const tz = e.start.utc ? 'UTC' : e.start.tz || 'Europe/Berlin';
    const s = wallToUtcMin(date, e.start.time, tz);
    let f = s + Math.max(0, e.dur || 0);
    if (e.end && e.end.time) f = Math.max(s, wallToUtcMin(addDays(date, daysBetween(e.start.date, e.end.date)), e.end.time, e.end.utc ? 'UTC' : e.end.tz || tz));
    for (const [d, a, z] of bounds) {
      if (!(s < z && (f > a || (f === s && s >= a)))) continue;
      // Ohne Ende (Dauer null) endet der Termin, wo er beginnt. "weiter": läuft über das Tagesende hinaus.
      res[d].push({ titel: e.summary, von: s >= a ? hm(s) : null, bis: f < z && f >= a ? hm(f) : null, ganztags: s <= a && f >= z, zeit: true, ...(f > z ? { weiter: true } : {}), kalender: feed, ...(e.ort ? { ort: e.ort } : {}), ...(e.geo ? { geo: e.geo } : {}) });
    }
  };
  const old = addDays(first, -31);
  for (const e of events) {
    if (e.recurId) continue;
    if (!e.rrule) { if (e.start.date <= last && e.start.date >= old) place(e, e.start.date); continue; }
    for (const date of seriesDates(e.start.date, e.rrule, last)) {
      if (date < old || e.exdates.has(date)) continue;
      const o = overrides.get(`${e.uid}|${date}`);
      if (o) { if (!o.cancelled) place(o, o.start.date); continue; }
      place(e, date);
    }
  }
  // Verschobene Einzeltermine, deren Serie hier fehlt.
  for (const o of overrides.values()) if (!o.cancelled && o.start.date >= old && !events.some((e) => !e.recurId && e.uid === o.uid)) place(o, o.start.date);
  for (const d of days) {
    const seen = new Set<string>();
    res[d] = res[d].filter((x) => { const k = `${x.titel}|${x.von}|${x.bis}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((x, y) => (x.ganztags === y.ganztags ? String(x.von || '00:00').localeCompare(String(y.von || '00:00')) : x.ganztags ? -1 : 1));
  }
  return res;
}
export function feedUrl(raw: string): string | null {
  const u = String(raw || '').trim().replace(/^webcals?:\/\//i, 'https://');
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|\[)/i.test(x.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(x.hostname)) return null;
    return x.toString();
  } catch { return null; }
}
/* ---------- Heimweg mit OpenRouteService ---------- */
// Aus dem Ort eines Termins und der Adresse der Familie die Fahrzeit nach Hause. Orte und Fahrzeiten
// werden in ep_settings unter "wege" gemerkt, damit jede Strecke nur einmal gefragt wird.
// Schlüssel und Adresse stehen unter "heimweg" ({ adresse, schluessel }). Pro Kalender "weg": auto, rad, fuss oder aus.
// Seit November 2026 nur noch unter api.heigit.org (api.openrouteservice.org ist abgeschaltet).
const ORS_ROUTE = 'https://api.heigit.org/openrouteservice/v2';
const ORS_GEO = 'https://api.heigit.org/pelias/v1';
export const WEG_PROFIL: Record<string, string> = { auto: 'driving-car', rad: 'cycling-regular', fuss: 'foot-walking' };
type Geo = [number, number];
type WegeCache = { heim?: { adresse: string; geo: Geo | null }; orte: Record<string, Geo | null>; zeiten: Record<string, number | null> };
const ortKey = (o: string) => o.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 160);
// Online-Termine und Termine zu Hause haben keinen Weg.
export const ortOk = (o?: string) => !!o && o.length >= 4 && !/https?:\/\/|www\.|zoom|teams|webex|meet\.google|online|telefon|zuhause|zu hause|daheim/i.test(o);
const geoKey = (g: Geo) => `${g[0].toFixed(4)},${g[1].toFixed(4)}`;
const nearby = (a: Geo, b: Geo) => Math.abs(a[0] - b[0]) < 0.002 && Math.abs(a[1] - b[1]) < 0.003;
class WegFehler extends Error {}
async function orsCall(url: string, init: RequestInit = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (res.status === 401 || res.status === 403) throw new WegFehler('Der Schlüssel für OpenRouteService stimmt nicht.');
    if (res.status === 429) throw new WegFehler('Das Tageskontingent bei OpenRouteService ist aufgebraucht. Morgen geht es weiter.');
    if (!res.ok) return null;
    return await res.json() as Row;
  } catch (e) {
    if (e instanceof WegFehler) throw e;
    return null;
  } finally { clearTimeout(timer); }
}
async function orsGeocode(key: string, text: string, focus: Geo | null): Promise<Geo | null> {
  const q = new URLSearchParams({ api_key: key, text, size: '1', 'boundary.country': 'DE' });
  if (focus) { q.set('focus.point.lat', String(focus[0])); q.set('focus.point.lon', String(focus[1])); }
  const r = await orsCall(`${ORS_GEO}/search?${q}`);
  const c = r && r.features && r.features[0] && r.features[0].geometry && r.features[0].geometry.coordinates;
  return Array.isArray(c) && c.length >= 2 ? [Number(c[1]), Number(c[0])] : null;
}
async function orsMatrix(key: string, profil: string, heim: Geo, ziele: Geo[]): Promise<(number | null)[]> {
  const r = await orsCall(`${ORS_ROUTE}/matrix/${profil}?${new URLSearchParams({ api_key: key })}`, {
    method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: [[heim[1], heim[0]], ...ziele.map((g) => [g[1], g[0]])], sources: ziele.map((_, i) => i + 1), destinations: [0], metrics: ['duration'] }),
  });
  const d = r && Array.isArray(r.durations) ? r.durations : null;
  return ziele.map((_, i) => (d && d[i] && typeof d[i][0] === 'number' ? Math.round(d[i][0] / 60) : null));
}
// Trägt bei den Terminen "weg" (Minuten nach Hause) ein. Gibt einen Fehlertext zurück oder ''.
export async function addWays(store: Store | null, tage: Record<string, CalItem[]>, feeds: Row[], heimweg: Row, cacheIn: Row): Promise<string> {
  const key = String((heimweg && heimweg.schluessel) || env('ORS_KEY') || '').trim();
  const adresse = String((heimweg && heimweg.adresse) || '').trim();
  if (!key || !adresse) return '';
  const cache: WegeCache = { heim: cacheIn && cacheIn.heim, orte: { ...((cacheIn && cacheIn.orte) || {}) }, zeiten: { ...((cacheIn && cacheIn.zeiten) || {}) } };
  let changed = false;
  if (!cache.heim || cache.heim.adresse !== adresse) {
    cache.heim = { adresse, geo: await orsGeocode(key, adresse, null) };
    cache.zeiten = {};
    changed = true;
  }
  const heim = cache.heim.geo;
  if (!heim) { if (changed && store) await store.upsert('ep_settings', [{ key: 'wege', value: cache, updated_at: nowIso() }]); return 'Die Adresse von zu Hause hat OpenRouteService nicht gefunden.'; }
  const items: { x: CalItem; profil: string }[] = [];
  for (const list of Object.values(tage)) for (const x of list) {
    const f = feeds.find((y) => String(y.id) === x.kalender);
    if (!f || !f.person_id || f.essen === false || f.weg === 'aus' || !x.zeit || !x.bis) continue;
    if (!x.geo && !ortOk(x.ort)) continue;
    items.push({ x, profil: WEG_PROFIL[String(f.weg || 'auto')] || WEG_PROFIL.auto });
  }
  // Orte suchen, höchstens 20 neue pro Abruf.
  let neu = 0;
  for (const it of items) {
    if (it.x.geo || !it.x.ort) continue;
    const k = ortKey(it.x.ort);
    if (!(k in cache.orte)) {
      if (neu >= 20) continue;
      neu += 1;
      cache.orte[k] = await orsGeocode(key, it.x.ort, heim);
      changed = true;
    }
    if (cache.orte[k]) it.x.geo = cache.orte[k];
  }
  // Fahrzeiten, die noch fehlen, pro Verkehrsmittel in einem Abruf.
  const offen = new Map<string, Geo[]>();
  for (const it of items) {
    if (!it.x.geo || nearby(it.x.geo, heim)) continue;
    const k = `${geoKey(it.x.geo)}|${it.profil}`;
    if (k in cache.zeiten) continue;
    const list = offen.get(it.profil) || [];
    if (!list.some((g) => geoKey(g) === geoKey(it.x.geo as Geo))) list.push(it.x.geo);
    offen.set(it.profil, list);
  }
  for (const [profil, ziele] of offen) {
    for (let i = 0; i < ziele.length; i += 25) {
      const part = ziele.slice(i, i + 25);
      const min = await orsMatrix(key, profil, heim, part);
      part.forEach((g, n) => { cache.zeiten[`${geoKey(g)}|${profil}`] = min[n]; });
      changed = true;
    }
  }
  for (const it of items) {
    if (!it.x.geo) continue;
    if (nearby(it.x.geo, heim)) { it.x.weg = 0; continue; }
    const m = cache.zeiten[`${geoKey(it.x.geo)}|${it.profil}`];
    // Über drei Stunden ist eher eine Reise oder ein falsch gefundener Ort.
    if (typeof m === 'number' && m <= 180) it.x.weg = m;
  }
  if (changed && store) {
    const orte = Object.entries(cache.orte);
    if (orte.length > 400) cache.orte = Object.fromEntries(orte.slice(-400));
    const zeiten = Object.entries(cache.zeiten);
    if (zeiten.length > 600) cache.zeiten = Object.fromEntries(zeiten.slice(-600));
    await store.upsert('ep_settings', [{ key: 'wege', value: cache, updated_at: nowIso() }]);
  }
  return '';
}

// tage: wie viele Tage ab heute (das Display braucht zwei, die Essensplanung drei Wochen).
export async function loadCalendars(store: Store, nowMs = Date.now(), tageAnzahl = 2) {
  const rows = await store.get('ep_settings?select=key,value&key=in.(kalender,heimweg,wege)');
  const val = (k: string): Row => (rows.find((r) => r.key === k) || {}).value || {};
  const feeds: Row[] = Array.isArray(val('kalender').feeds) ? val('kalender').feeds.slice(0, 12) : [];
  const today = berlin(nowMs).day;
  const n = Math.max(1, Math.min(22, Math.round(Number(tageAnzahl) || 2)));
  const days = Array.from({ length: n }, (_, i) => addDays(today, i));
  const tage: Record<string, CalItem[]> = Object.fromEntries(days.map((d) => [d, []]));
  const status = await Promise.all(feeds.map(async (f) => {
    const url = feedUrl(f.url);
    if (!url) return { id: f.id, ok: false, fehler: 'Die Adresse ist kein Kalender-Link (webcal:// oder https://).' };
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'text/calendar, */*' } }).finally(() => clearTimeout(timer));
      if (!res.ok) return { id: f.id, ok: false, fehler: res.status === 404 ? 'Den Kalender gibt es unter dieser Adresse nicht (mehr). Ist er noch öffentlich?' : `Der Kalender antwortet mit Fehler ${res.status}.` };
      const text = await res.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) return { id: f.id, ok: false, fehler: 'Unter der Adresse steht kein Kalender.' };
      const got = calendarDays(parseCalendar(text), days, String(f.id));
      let n = 0;
      for (const d of days) { tage[d].push(...got[d]); n += got[d].length; }
      return { id: f.id, ok: true, anzahl: n };
    } catch (e) {
      return { id: f.id, ok: false, fehler: (e as Error).name === 'AbortError' ? 'Der Kalender hat nicht rechtzeitig geantwortet.' : 'Der Kalender war nicht erreichbar.' };
    }
  }));
  for (const d of days) tage[d].sort((x, y) => (x.ganztags === y.ganztags ? String(x.von || '00:00').localeCompare(String(y.von || '00:00')) : x.ganztags ? -1 : 1));
  let wegFehler = '';
  try { wegFehler = await addWays(store, tage, feeds, val('heimweg'), val('wege')); } catch (e) { wegFehler = e instanceof WegFehler ? e.message : 'Die Fahrzeiten ließen sich gerade nicht berechnen.'; }
  // Koordinaten braucht die App nicht.
  for (const d of days) for (const x of tage[d]) delete x.geo;
  const wege = !!(val('heimweg').adresse && (val('heimweg').schluessel || env('ORS_KEY')));
  return { stand: new Date(nowMs).toISOString(), tage, feeds: status, wege: { an: wege, fehler: wegFehler } };
}

/* ---------- Ein Gericht im Wochenplan neu von Claude ---------- */
// Die Familie schickt ein Abendessen zurück und bekommt ein neues Rezept, das noch nicht in der Sammlung steht.
// Die App schickt den Tag, den Rest der Woche, die Namen der Sammlung, Esser und was schon gekauft ist.
export const NEWDISH_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['warum', 'gericht'],
  properties: { warum: { type: 'string' }, gericht: (PLAN_SCHEMA.properties.neue_gerichte as Row).items },
};
const list80 = (x: unknown, n = 80) => (Array.isArray(x) ? x.map((v) => String(v).slice(0, 120)).filter(Boolean).slice(0, n) : []);
export function newDishPrompt(b: Row, rules: Rules) {
  const tag = String(b.tag || '');
  const woche = (Array.isArray(b.woche) ? b.woche : []).slice(0, 7)
    .map((x: Row) => `- ${String(x.wochentag || x.tag)}: ${String(x.gericht || '').slice(0, 100)}${Array.isArray(x.zutaten) && x.zutaten.length ? ` (${list80(x.zutaten, 8).join(', ')})` : ''}`);
  const max = Number(b.kochzeit) > 0 ? Math.round(Number(b.kochzeit)) : 0;
  const esser = Math.max(1, Math.round(Number(b.esser) || 4));
  const gaeste = Math.max(0, Math.round(Number(b.gaeste) || 0));
  return [
    `Eine Familie mit zwei Erwachsenen und zwei Kindern (12 und 9 Jahre) möchte am ${String(b.wochentag || '')}, ${fmtDay(tag)} ${b.alt ? `statt „${String(b.alt).slice(0, 120)}“ ` : ''}ein anderes Abendessen.`,
    'Schlag genau ein neues Gericht vor, das noch nicht in ihrer Sammlung steht, auch nicht unter einem anderen Namen oder als kleine Abwandlung.',
    b.wunsch ? `Wunsch der Familie dazu: ${String(b.wunsch).slice(0, 300)}` : '',
    list80(b.abgelehnt, 10).length ? `Diese Vorschläge wollte die Familie gerade nicht, also etwas deutlich anderes: ${list80(b.abgelehnt, 10).join(', ')}` : '',
    '',
    `Ziele der Familie: ${rules.ziele}`,
    `Vorlieben: ${rules.vorlieben}`,
    `Diese Lebensmittel kommen nie vor: ${rules.ausschluesse.join(', ') || 'keine'}.`,
    `- Kochzeit höchstens ${max || rules.kochzeit} Minuten${max ? '' : ' (werktags)'}.`,
    `- Es essen ${esser} ${esser === 1 ? 'Person' : 'Personen'} mit${gaeste ? `, dazu ${gaeste} ${gaeste === 1 ? 'Gast' : 'Gäste'}` : ''}${list80(b.weg, 4).length ? `, ${list80(b.weg, 4).join(' und ')} ${list80(b.weg, 4).length === 1 ? 'fehlt' : 'fehlen'}` : ''}. Das Rezept trotzdem für 4 Personen.`,
    '- Reichlich Eiweiß, als Richtwert mindestens 30 g pro Erwachsenenportion. Kindgerecht, aber nicht langweilig.',
    '',
    'Der Rest der Woche, bitte nichts Ähnliches und nicht dieselbe Hauptzutat wie am Tag davor oder danach:',
    ...(woche.length ? woche : ['- nichts geplant']),
    '',
    list80(b.gekauft, 30).length ? `Für das alte Gericht schon eingekauft, bitte möglichst davon verwenden: ${list80(b.gekauft, 30).join(', ')}` : '',
    list80(b.vorrat, 60).length ? `Im Vorrat: ${list80(b.vorrat, 60).join(', ')}` : '',
    list80(b.reste, 20).length ? `Muss bald weg: ${list80(b.reste, 20).join(', ')}` : '',
    '',
    `Namen in der Sammlung (davon keines): ${list80(b.sammlung, 400).join('; ')}`,
    '',
    ...(rules.saison !== false ? seasonLines(mondayOf(tag)) : []),
    'Rezept:',
    '- Zutaten für 4 Personen mit Menge, Einheit (g, ml, EL, TL, Stk., Pck., Dose oder leer) und Abteilung. Grundzutaten wie Öl, Salz, Pfeffer, Gewürze bekommen Abteilung "basis", Menge 0 und den Text mit Menge im Namen, zum Beispiel "2 EL Öl".',
    '- Zutaten so, wie es sie bei Aldi Süd gibt, in üblichen Packungsgrößen.',
    '- Schritte kurz und klar, mit Thermomix-Angaben (Zeit, Temperatur, Stufe), wo es passt. "tags" zum Beispiel Thermomix, Airfryer, Schnell, Vegan.',
    '- "vorabend" nur, wenn etwas am Abend vorher zu tun ist, sonst leer. "hinweis" kurz oder leer.',
    '- "warum": ein bis zwei Sätze an die Eltern, warum das Gericht an diesem Tag passt.',
    'Deutsch, schlicht und freundlich, ohne Gedankenstriche und ohne Werbesprache.',
  ].filter((x) => x !== '').join('\n');
}
// Prüft den Vorschlag: neuer Name, keine Ausschlüsse. Gibt den Grund zurück, wenn etwas nicht passt.
export function newDishProblem(g: Row, sammlung: string[], rules: Rules): string {
  const name = String(g.name || '').trim();
  if (!name) return 'Das Gericht hatte keinen Namen.';
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim();
  if (sammlung.some((n) => norm(n) === norm(name))) return `„${name}“ steht schon in der Sammlung.`;
  const words = [name, ...(g.zutaten || []).map((z: Row) => String(z.name || ''))].join(' | ').toLowerCase();
  const hit = rules.ausschluesse.find((x) => x && words.includes(x.toLowerCase()));
  if (hit) return `Es enthält „${hit}“, das die Familie nie isst.`;
  if (!(g.zutaten || []).length || !(g.schritte || []).length) return 'Zutaten oder Schritte fehlten.';
  return '';
}
export async function suggestNewDish(store: Store, b: Row) {
  const settings = await store.get('ep_settings?select=key,value&key=eq.regeln');
  const rules = mergeRules((settings[0] || {}).value);
  const sammlung = list80(b.sammlung, 400);
  let prompt = newDishPrompt(b, rules);
  for (let n = 0; n < 2; n += 1) {
    const params = { model: rules.modell, max_tokens: 8000, messages: [{ role: 'user', content: prompt }], output_config: { format: { type: 'json_schema', schema: NEWDISH_SCHEMA } } };
    const res = JSON.parse(await apiCall('/messages', { method: 'POST', body: JSON.stringify(params) }));
    if (res.stop_reason === 'max_tokens') throw new Error('Die Antwort war zu lang.');
    const d = JSON.parse((res.content || []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join(''));
    const g = d.gericht || {};
    const why = newDishProblem(g, sammlung, rules);
    if (why) { prompt += `\n\nDein letzter Vorschlag ging nicht: ${why} Bitte ein anderes Gericht.`; continue; }
    return {
      warum: String(d.warum || '').slice(0, 400),
      gericht: {
        name: String(g.name).trim().slice(0, 120),
        category: DISH_KINDS.includes(g.kategorie) ? g.kategorie : 'gemischt',
        duration_min: Math.max(5, Math.round(Number(g.dauer_min) || 30)),
        tags: Array.isArray(g.tags) ? g.tags.map(String).slice(0, 8) : [],
        note: String(g.hinweis || '').slice(0, 400),
        prep: String(g.vorabend || '').slice(0, 300),
        ingredients: (g.zutaten || []).slice(0, 40).map((z: Row) => (z.abteilung === 'basis' || !(Number(z.menge) > 0)
          ? [null, '', String(z.name).trim(), 'basis'] : [Number(z.menge), String(z.einheit || ''), String(z.name).trim(), String(z.abteilung)])),
        steps: (g.schritte || []).slice(0, 20).map(String),
      },
      usage: res.usage || null,
    };
  }
  throw new Error('Claude hat zweimal nichts Passendes gefunden. Bitte mit einem anderen Wunsch noch einmal versuchen.');
}

/* ---------- Ersatz, wenn im Laden etwas fehlt ---------- */

export const SUBST_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['vorschlaege', 'rezept_hinweis'],
  properties: {
    vorschlaege: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'menge', 'warum'],
        properties: { name: { type: 'string' }, menge: { type: 'string' }, warum: { type: 'string' } },
      },
    },
    rezept_hinweis: { type: 'string' },
  },
};

export function substPrompt(o: { posten: string; menge: string; markt: string; gerichte: Row[]; rules: Rules }) {
  const dishes = (o.gerichte || []).slice(0, 4).map((d: Row) => `${d.name}${d.tag ? ` (${d.tag})` : ''}: Zutaten ${(d.zutaten || []).slice(0, 25).join(', ')}`);
  return [
    `Eine Familie (zwei Erwachsene, zwei Kinder) steht gerade bei ${o.markt || 'Aldi Süd'} und bekommt diesen Artikel nicht: ${o.posten}${o.menge ? ` (${o.menge})` : ''}.`,
    dishes.length ? `Er ist gedacht für:\n${dishes.join('\n')}` : 'Wofür er gedacht ist, ist nicht bekannt.',
    '',
    '- Schlag zwei bis drei Ersatzartikel vor, die es in einem Discounter wie Aldi Süd oder Lidl üblicherweise gibt. Der beste Vorschlag zuerst.',
    '- "menge": wie viel davon statt der ursprünglichen Menge, kurz mit Einheit.',
    '- "warum": ein kurzer Satz, warum das passt.',
    `- Beachte die Regeln der Familie. Nie verwenden: ${o.rules.ausschluesse.join(', ') || 'nichts'}. Vorlieben: ${o.rules.vorlieben}`,
    '- "rezept_hinweis": was sich am Rezept ändert, wenn man den ersten Vorschlag nimmt (Garzeit, Menge, Reihenfolge), ein bis zwei Sätze. Leer, wenn sich nichts ändert oder kein Rezept bekannt ist.',
    'Deutsch, schlicht, ohne Gedankenstriche.',
  ].join('\n');
}

export async function suggestSubstitute(store: Store, body: Row) {
  const settings = await store.get('ep_settings?select=key,value&key=eq.regeln');
  const rules = mergeRules((settings[0] || {}).value);
  const params = {
    model: 'claude-haiku-5-5', max_tokens: 4000,
    messages: [{ role: 'user', content: substPrompt({
      posten: String(body.posten || '').slice(0, 80), menge: String(body.menge || '').slice(0, 40), markt: String(body.markt || ''),
      gerichte: Array.isArray(body.gerichte) ? body.gerichte : [], rules,
    }) }],
    output_config: { format: { type: 'json_schema', schema: SUBST_SCHEMA } },
  };
  const res = JSON.parse(await apiCall('/messages', { method: 'POST', body: JSON.stringify(params) }));
  if (res.stop_reason === 'max_tokens') throw new Error('Die Antwort war zu lang.');
  const d = JSON.parse((res.content || []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join(''));
  const vorschlaege = (d.vorschlaege || []).filter((v: Row) => String(v.name || '').trim()).slice(0, 3)
    .map((v: Row) => ({ name: String(v.name).trim().slice(0, 80), menge: String(v.menge || '').slice(0, 40), warum: String(v.warum || '').slice(0, 200) }));
  if (!vorschlaege.length) throw new Error('Claude hatte keinen Vorschlag.');
  return { vorschlaege, rezept_hinweis: String(d.rezept_hinweis || '').slice(0, 400) };
}

/* ---------- Zutaten aus Foto (für die Einkaufsliste) ---------- */

export const INGREDIENTS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['erkannt', 'gericht', 'hinweis', 'posten'],
  properties: {
    erkannt: { type: 'boolean' },
    gericht: { type: 'string' },
    hinweis: { type: 'string' },
    posten: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'menge', 'abteilung'],
        properties: { name: { type: 'string' }, menge: { type: 'string' }, abteilung: { type: 'string', enum: [...SHOP, 'basis'] } },
      },
    },
  },
};

export function ingredientsPrompt() {
  return [
    'Auf den Fotos ist eine Zutatenliste, zum Beispiel ein Rezept aus Cookidoo oder eine Einkaufsliste. Mach daraus Posten für die Einkaufsliste einer Familie mit zwei Erwachsenen und zwei Kindern.',
    '- "erkannt": false, wenn keine Zutaten zu erkennen sind.',
    '- "gericht": Name des Rezepts, wenn es eins ist, sonst leer.',
    '- Ist es ein Rezept für eine andere Personenzahl als 4, rechne die Mengen auf 4 Portionen um und schreib das in "hinweis".',
    '- "name" ohne Menge, gut lesbar. "menge" kurz mit Einheit, etwa "250 g", "2 Stück", "1 Dose", sonst leer.',
    '- Gleiche Zutaten aus mehreren Rezeptteilen zusammenfassen (etwa 1 Zwiebel für die Soße und 1 für das Gemüse ergibt 2 Zwiebeln).',
    '- "abteilung": obst (Obst, Gemüse, Kräuter), brot, fleisch (Fleisch und Fisch), kuehl (Milchprodukte, Eier, Kühlregal), tk (Tiefkühl), vorrat (Nudeln, Reis, Konserven, Mehl), haushalt, sonst. "basis" für Dinge, die man meist im Haus hat: Salz, Pfeffer, Öl, Zucker, Wasser, Gewürze, Brühe.',
    '- "hinweis": kurz, was unsicher oder umgerechnet war, sonst leer.',
    'Erfinde keine Zutaten dazu.',
  ].join('\n');
}

export function toItems(d: Row) {
  if (!d.erkannt) throw new Error('Auf den Fotos waren keine Zutaten zu erkennen.');
  const posten = (d.posten || []).filter((p: Row) => String(p.name || '').trim()).map((p: Row) => ({
    name: String(p.name).trim().slice(0, 80), menge: String(p.menge || '').trim().slice(0, 40),
    abteilung: [...SHOP, 'basis'].includes(p.abteilung) ? p.abteilung : 'sonst',
  }));
  if (!posten.length) throw new Error('Auf den Fotos waren keine Zutaten zu erkennen.');
  return { gericht: String(d.gericht || '').trim().slice(0, 120), hinweis: String(d.hinweis || '').slice(0, 300), posten };
}

async function askPhotos(store: Store, photos: Photo[], prompt: string, schema: Row, maxTokens: number) {
  checkPhotos(photos);
  const settings = await store.get('ep_settings?select=key,value&key=eq.regeln');
  const rules = mergeRules((settings[0] || {}).value);
  const params = {
    model: rules.modell, max_tokens: maxTokens,
    messages: [{ role: 'user', content: [
      ...photos.map((p) => ({ type: 'image', source: { type: 'base64', media_type: p.media, data: p.data } })),
      { type: 'text', text: prompt },
    ] }],
    output_config: { format: { type: 'json_schema', schema } },
  };
  const res = JSON.parse(await apiCall('/messages', { method: 'POST', body: JSON.stringify(params) }));
  if (res.stop_reason === 'max_tokens') throw new Error('Die Antwort war zu lang.');
  return JSON.parse((res.content || []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join(''));
}

export async function readIngredients(store: Store, photos: Photo[]) {
  return toItems(await askPhotos(store, photos, ingredientsPrompt(), INGREDIENTS_SCHEMA, 16000));
}

type Store = ReturnType<typeof db>;
const nowIso = (ms = Date.now()) => new Date(ms).toISOString();

async function loadPlannerState(store: Store) {
  const settings = await store.get('ep_settings?select=*');
  const get = (k: string) => (settings.find((x) => x.key === k) || {}).value;
  const urlaub = get('urlaub');
  const wuensche = get('wuensche');
  const reste = get('reste');
  const packs = get('packungen');
  const fmt = (q: number, u: string) => (u === 'g' && q >= 1000 ? `${q / 1000} kg` : u === 'ml' && q >= 1000 ? `${q / 1000} l` : `${q} ${u}`);
  return {
    packungen: packs && typeof packs === 'object' ? Object.values(packs as Record<string, Row>).filter((p) => p && p.name && Number(p.q) > 0)
      .map((p) => `${p.name}: ${fmt(Number(p.q), String(p.u || ''))}${p.markt === 'lidl' ? ' (Lidl)' : ''}`).slice(0, 80) : [],
    reste: Array.isArray(reste) ? (reste as Row[]).map((x) => String(x.text || '').trim()).filter(Boolean).slice(0, 20) : [],
    rules: mergeRules(get('regeln')), ctx: get('ki_kontext') || null, wish: String(get('wunsch') || ''),
    urlaub: Array.isArray(urlaub) ? urlaub as Row[] : [], wuensche: Array.isArray(wuensche) ? wuensche as Row[] : [],
  };
}

/* ---------- Preisgedächtnis und Wünsche für den Planer ---------- */

const median = (xs: number[]) => { const s = xs.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const eur = (x: number) => `${(Math.round(x * 100) / 100).toFixed(2).replace('.', ',')} €`;

// Kompakte Preisliste aus den Kassenzetteln: pro Artikel und Markt der übliche Preis. Gleiche Regeln wie js/haushalt.js (priceBook).
export function priceTable(receipts: Row[], max = 120) {
  const book = new Map<string, { name: string; shops: Map<string, number[]>; n: number }>();
  for (const r of receipts) {
    for (const p of (r.items || [])) {
      const price = Number(p.preis);
      if (!(price > 0) || p.kategorie === 'Pfand und Rabatt') continue;
      const name = String(p.name || p.text || '').trim();
      const key = name.toLowerCase();
      if (!key) continue;
      const e = book.get(key) || { name, shops: new Map(), n: 0 };
      const shop = String(r.shop || 'anderer Markt');
      e.shops.set(shop, [...(e.shops.get(shop) || []), price]);
      e.n += 1;
      book.set(key, e);
    }
  }
  return [...book.values()].sort((a, b) => b.n - a.n).slice(0, max)
    .map((e) => `${e.name}: ${[...e.shops.entries()].map(([shop, xs]) => `${shop} ${eur(median(xs))}${xs.length > 1 ? ` (${xs.length}x)` : ''}`).join(', ')}`).join('\n');
}

export function wishesFor(wuensche: Row[], persons: Row[], week: string) {
  const name = (id: string) => (persons.find((p) => p.id === id) || {}).name || 'ein Kind';
  const wishes = wuensche.filter((w) => w.week === week && w.status !== 'nicht' && String(w.text || '').trim())
    .map((w) => ({ kind: name(w.person_id), wunsch: String(w.text).trim().slice(0, 120) }));
  const last = wuensche.filter((w) => w.status === 'erfuellt').sort((a, b) => (a.week < b.week ? 1 : -1))[0];
  return { wishes, lastWish: last ? name(last.person_id) : '' };
}

// Startet einen neuen Entwurf. Ein laufender Entwurf für dieselbe Woche wird ersetzt.
export async function startRun(store: Store, week: string, trigger: string, wishOverride?: string, nowMs = Date.now()) {
  const { rules, wish } = await loadPlannerState(store);
  const active = await store.get(`ep_ai_runs?select=*&week_start=eq.${week}&status=in.(angebote,plan)`);
  for (const r of active) await store.upsert('ep_ai_runs', [{ ...r, status: 'ersetzt', updated_at: nowIso(nowMs) }]);
  const id = `ki-${week}-${Date.now().toString(36)}`;
  const messages = [{ role: 'user', content: offersPrompt(week, rules.lidl !== false) }];
  const batch = await submit(`${id}-a`, offersParams(rules, messages));
  const row = {
    id, week_start: week, status: 'angebote', batch_id: batch, messages, offers: '', draft: null, warnings: [], error: '',
    attempts: 0, trigger, wish: wishOverride != null ? wishOverride : wish, model: rules.modell, created_at: nowIso(nowMs), updated_at: nowIso(nowMs),
  };
  await store.upsert('ep_ai_runs', [row]);
  // Der Wunsch gilt für diesen einen Entwurf.
  if (wish) await store.upsert('ep_settings', [{ key: 'wunsch', value: '', updated_at: nowIso(nowMs) }]);
  return row;
}

// Ein Schritt für alle laufenden Entwürfe. Liefert Push-Nachrichten für fertige oder gescheiterte Entwürfe.
export async function stepPlanner(store: Store, nowMs: number, adults: string[]): Promise<Due[]> {
  const out: Due[] = [];
  if (!env('ANTHROPIC_API_KEY')) return out;
  const { rules, ctx, urlaub, wuensche, reste, packungen } = await loadPlannerState(store);
  // Wünsche und Preise werden erst geladen, wenn ein Plan geschrieben wird.
  let extraCache: { persons: Row[]; prices: string } | null = null;
  const extraFor = async (run: Row): Promise<PlanExtra> => {
    if (!extraCache) {
      const since = addDays(berlin(nowMs).day, -120);
      const [persons, receipts] = await Promise.all([
        store.get('ep_persons?select=id,name,adult'),
        store.get(`ep_receipts?select=shop,items,day&day=gte.${since}`).catch(() => []),
      ]);
      extraCache = { persons, prices: priceTable(receipts) };
    }
    return { ...wishesFor(wuensche, extraCache.persons, String(run.week_start).slice(0, 10)), prices: extraCache.prices, reste, packungen };
  };
  const { day, min, wd } = berlin(nowMs);

  // Automatischer Start am eingestellten Tag ab der eingestellten Uhrzeit für die nächste Woche.
  const start = /^\d{1,2}:\d{2}$/.test(String(rules.zeit)) ? Number(String(rules.zeit).split(':')[0]) * 60 + Number(String(rules.zeit).split(':')[1]) : 12 * 60;
  // Startet der Großeinkauf wegen eines Feiertags früher, kommt der Entwurf zwei Tage vor dem neuen Einkaufstag.
  const autoWeek = (() => {
    for (const next of [addDays(mondayOf(day), 7), addDays(mondayOf(day), 14)]) {
      const g = shopDays(next).gross.day;
      let from = addDays(next, -7 + Number(rules.tag));
      if (from > g) from = addDays(g, -2);
      if (day === from ? min >= start : day > from && day < g) return next;
    }
    return null;
  })();
  if (rules.auto && autoWeek) {
    const next = autoWeek;
    const any = await store.get(`ep_ai_runs?select=id&week_start=eq.${next}&limit=1`);
    // Ist die Woche schon geplant (zum Beispiel von Hand), entsteht kein automatischer Entwurf.
    const planned = any.length ? [] : await store.get(`ep_plan?select=day&day=gte.${next}&day=lte.${addDays(next, 6)}&dish_id=not.is.null&limit=1`);
    // Ist die ganze Woche Urlaub, gibt es nichts zu planen.
    const allAway = Array.from({ length: 7 }, (_, n) => addDays(next, n)).every((x) => holidayOn(urlaub, x));
    if (!allAway && !any.length && !planned.length) await startRun(store, next, 'auto', undefined, nowMs);
  }

  // Liegt der Entwurf für die nächste Woche noch ungeprüft da, freitags um 19 Uhr und samstags ab 7:30 Uhr erinnern.
  // Ohne Freigabe gibt es keine Einkaufsliste für den Großeinkauf am Samstag.
  const remindWeek = [addDays(mondayOf(day), 7), addDays(mondayOf(day), 14)].find((w) => {
    const g = shopDays(w).gross.day;
    return (day === addDays(g, -1) && min >= 19 * 60) || (day === g && min >= 7 * 60 + 30 && min < 14 * 60);
  });
  if (remindWeek) {
    const next = remindWeek;
    const gday = shopDays(next).gross.day;
    const open = await store.get(`ep_ai_runs?select=id,week_start&week_start=eq.${next}&status=eq.fertig`).catch(() => []);
    for (const run of open) {
      out.push({
        key: `entwurf-offen:${run.id}:${day}`, to: adults, ttl: 6 * 3600,
        msg: { title: `Wochenplan KW ${isoWeekNo(run.week_start)} wartet auf Freigabe`, body: day === gday ? 'Ohne Freigabe gibt es noch keine Einkaufsliste für den Großeinkauf heute.' : `Ohne Freigabe gibt es noch keine Einkaufsliste für den Großeinkauf am ${shopDays(next).gross.wd}.`, tag: 'entwurf', url: './#gerichte' },
      });
    }
  }

  const running = await store.get('ep_ai_runs?select=*&status=in.(angebote,plan)');
  for (const run of running) {
    const kw = isoWeekNo(run.week_start);
    const fail = async (msg: string) => {
      await store.upsert('ep_ai_runs', [{ ...run, status: 'fehler', error: msg, updated_at: nowIso(nowMs) }]);
      out.push({ key: `entwurf:${run.id}:fehler`, to: adults, ttl: 12 * 3600, msg: { title: `Wochenplan KW ${kw} hat nicht geklappt`, body: `${msg} Ihr könnt „Woche vorschlagen“ nutzen oder es später noch einmal versuchen.`, tag: 'entwurf', url: './#gerichte' } });
    };
    try {
      if (Date.parse(run.created_at) < nowMs - 26 * 3600 * 1000) { await fail('Claude hat nicht rechtzeitig geantwortet.'); continue; }
      const result = await fetchResult(run.batch_id);
      if (!result) continue;

      if (run.status === 'angebote') {
        let offers = '';
        const warnings: string[] = [];
        if (result.type === 'succeeded') {
          const msg = result.message;
          // Lange Suchen pausiert die Schnittstelle. Dann mit dem bisherigen Stand weitermachen, höchstens dreimal.
          if (msg.stop_reason === 'pause_turn' && (run.attempts || 0) < 3) {
            const messages = [...run.messages, { role: 'assistant', content: msg.content }];
            const batch = await submit(`${run.id}-a${(run.attempts || 0) + 1}`, offersParams(rules, messages));
            await store.upsert('ep_ai_runs', [{ ...run, messages, batch_id: batch, attempts: (run.attempts || 0) + 1, updated_at: nowIso(nowMs) }]);
            continue;
          }
          offers = textOf(msg).trim();
          if (!offers || /keine angebote gefunden/i.test(offers)) { offers = ''; warnings.push('Für diese Woche hat Claude auf aldi-sued.de noch keine Angebote gefunden. Der Plan kommt ohne Angebote aus.'); }
        } else {
          warnings.push('Die Suche nach Angeboten hat nicht geklappt. Der Plan kommt ohne Angebote aus.');
        }
        const prompt = planPrompt({ rules, ctx, offers, week: run.week_start, wish: run.wish || '', urlaub, extra: await extraFor(run) });
        const batch = await submit(`${run.id}-p0`, planParams(rules, prompt));
        await store.upsert('ep_ai_runs', [{ ...run, status: 'plan', offers: offers.slice(0, 6000), batch_id: batch, attempts: 0, warnings, updated_at: nowIso(nowMs) }]);
        continue;
      }

      // Schritt 2: der Plan
      if (result.type !== 'succeeded') { await fail(`Claude konnte den Plan nicht schreiben (${(result.error && (result.error.message || result.error.type)) || result.type}).`); continue; }
      const msg = result.message;
      if (msg.stop_reason === 'max_tokens') {
        // Einmal mit mehr Platz neu anfragen, dann aufgeben.
        if ((run.attempts || 0) < 1) {
          const prompt = planPrompt({ rules, ctx, offers: run.offers || '', week: run.week_start, wish: run.wish || '', urlaub, extra: await extraFor(run) });
          const batch = await submit(`${run.id}-p1`, planParams(rules, prompt, PLAN_TOKENS_RETRY));
          await store.upsert('ep_ai_runs', [{ ...run, batch_id: batch, attempts: 1, updated_at: nowIso(nowMs) }]);
          continue;
        }
        await fail('Die Antwort war zu lang und wurde abgeschnitten.');
        continue;
      }
      if (msg.stop_reason === 'refusal') { await fail('Claude hat die Anfrage abgelehnt.'); continue; }
      let draft: Row;
      try { draft = JSON.parse(textOf(msg)); } catch (e) { await fail('Die Antwort war kein lesbarer Plan.'); continue; }
      const check = checkDraft(draft, { rules, ctx, week: run.week_start, urlaub });
      if (check.errors.length && (run.attempts || 0) < 1) {
        const prompt = planPrompt({ rules, ctx, offers: run.offers || '', week: run.week_start, wish: run.wish || '', problems: check.errors, urlaub, extra: await extraFor(run) });
        const batch = await submit(`${run.id}-p1`, planParams(rules, prompt));
        await store.upsert('ep_ai_runs', [{ ...run, batch_id: batch, attempts: 1, updated_at: nowIso(nowMs) }]);
        continue;
      }
      if (check.errors.length) { await fail(`Auch der zweite Entwurf hatte Fehler: ${check.errors.slice(0, 2).join(' ')}`); continue; }
      const imp = toImport(draft, run.week_start, rules.lidl !== false);
      const warnings = [...(run.warnings || []), ...check.warnings];
      await store.upsert('ep_ai_runs', [{
        ...run, status: 'fertig', updated_at: nowIso(nowMs), warnings,
        draft: {
          ...imp, hinweise: String(draft.hinweise || ''), angebote: draft.angebote_genutzt || [], neu: imp.dishes.map((g: Row) => g.name),
          wunsch: String(draft.wunsch_erfuellt || ''), kosten: Number(draft.kosten) > 0 ? Math.round(Number(draft.kosten)) : null,
        },
        usage: msg.usage || null,
      }]);
      const nNew = imp.dishes.length;
      const nOff = (draft.angebote_genutzt || []).length;
      out.push({
        key: `entwurf:${run.id}:fertig`, to: adults, ttl: 24 * 3600,
        msg: {
          title: `Wochenplan für KW ${kw} ist da`,
          body: `${nNew === 1 ? '1 neues Gericht' : `${nNew} neue Gerichte`}${nOff ? `, ${nOff} Angebote berücksichtigt` : ''}. Bitte ansehen und freigeben.`,
          tag: 'entwurf', url: `./?entwurf=${run.id}#woche`,
        },
      });
    } catch (e) {
      // Netz- oder Schnittstellenfehler: beim nächsten Lauf noch einmal versuchen, nur Dauerfehler beenden den Entwurf.
      const text = String(e instanceof Error ? e.message : e);
      console.warn('Planer', run.id, text);
      if (/ 4\d\d: /.test(text) && !/ 429: /.test(text)) await fail(text);
    }
  }
  return out;
}

/* ======================================================================
   Lernplaner (lernen.html)
   Die Daten liegen in lp_data (id, coll, data). Fehlt die Tabelle, passiert hier nichts.
   ====================================================================== */

export type LpData = {
  settings: Row; schoolEnd: Row; timetable: Row | null; open: Row[]; done: Row[]; exams: Row[]; help: Row[];
  /** Lerneinheiten, die auf die Bestätigung der Eltern warten (zu kurz oder ohne Uhr). */
  checks?: Row[];
  /** Applaus der Eltern (Sammlung clap), nur die letzten Stunden. */
  claps?: Row[];
  wins: Record<string, boolean>; kick: Record<string, string>; meets: Record<string, string>;
  lm?: Row | null; brk?: Row | null; days?: Record<string, Row>;
};

export function lpFromRows(rows: Row[]): LpData {
  const d: LpData = { settings: {}, schoolEnd: {}, timetable: null, open: [], done: [], exams: [], help: [], wins: {}, kick: {}, meets: {}, lm: null, brk: null };
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const v = r.data;
    if (v == null) continue;
    if (r.coll === 'settings') d.settings = v;
    else if (r.coll === 'schoolEnd') d.schoolEnd = v;
    else if (r.coll === 'timetable') d.timetable = v;
    else if (r.coll === 'task') { if (v.done) d.done.push(v); else if (v.check) (d.checks ||= []).push(v); else d.open.push(v); }
    else if (r.coll === 'exam') d.exams.push(v);
    else if (r.coll === 'help') d.help.push(v);
    else if (r.coll === 'win') d.wins[v.k] = !!v.v;
    else if (r.coll === 'kick') d.kick[v.k] = String(v.v);
    else if (r.coll === 'meet') d.meets[v.k] = String(v.v);
    else if (r.coll === 'day' && v && v.k) (d.days ||= {})[String(v.k)] = (v.v || {}) as Row;
    else if (r.coll === 'lm') d.lm = v;
    else if (r.coll === 'brk') d.brk = v;
    else if (r.coll === 'clap') (d.claps ||= []).push(v);
  }
  return d;
}

const hmMin = (t: unknown, fallback: number) => { const m = String(t ?? '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : fallback; };

// Schulschluss aus dem Stundenplan des Lernplaners (gleiche Regeln wie in lernen.html), sonst null.
export function lpSchoolEnd(tt: Row | null, day: string): number | null {
  if (!tt || !Array.isArray(tt.times)) return null;
  const wd = wdOf(day) + 1;
  if (wd > 5) return null;
  const filled = (p: Row | undefined) => !!p && [1, 2, 3, 4, 5].some((w) => (p[w] || []).some(Boolean));
  let type = 'A';
  if (tt.ab && tt.refWeek) {
    const weeks = Math.round((Date.parse(`${mondayOf(day)}T00:00:00Z`) - Date.parse(`${mondayOf(String(tt.refWeek))}T00:00:00Z`)) / (7 * DAY));
    type = Math.abs(weeks) % 2 === 0 ? tt.refType : (tt.refType === 'A' ? 'B' : 'A');
  }
  const other = type === 'A' ? 'B' : 'A';
  const plan = filled(tt[type]) ? tt[type] : tt[other];
  let lessons: string[] = (plan && plan[wd]) || [];
  if (!lessons.some(Boolean) && tt.ab && tt[other] && tt[other][wd]) lessons = tt[other][wd];
  let last = -1;
  lessons.forEach((x, i) => { if (x) last = i; });
  return last >= 0 && tt.times[last] ? hmMin(tt.times[last][1], 13 * 60) : null;
}

/* ---------- Wochenrückblick ---------- */
// Sonntags ab 18:30 Uhr eine Nachricht an die Eltern, die sie nicht abbestellt haben (ep_settings "rueckblick".aus).
export function isoWeekOf(day: string): number {
  const d = new Date(`${day}T12:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7;
  const thu = new Date(d.getTime() + (3 - wd) * DAY);
  const jan4 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4, 12));
  return 1 + Math.round(((thu.getTime() - jan4.getTime()) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}
export function reviewMessages(value: Row | null, persons: Row[], nowMs: number, urlaub: Row[] = []): Due[] {
  const { day, min, wd } = berlin(nowMs);
  if (wd !== 6 || min < 18 * 60 + 30 || min >= 21 * 60) return [];
  const h = holidayOn(urlaub, day);
  if (h && h.weg !== false) return [];
  const off: string[] = value && Array.isArray(value.aus) ? value.aus : [];
  const to = persons.filter((p) => p.adult && !off.includes(p.id)).map((p) => p.id);
  if (!to.length) return [];
  return [{
    key: `rueckblick:${mondayOf(day)}`, to, ttl: 6 * 3600,
    msg: { title: `Wochenrückblick KW ${isoWeekOf(day)}`, body: 'Essen, Aufgaben der Kinder, Lernen und Ausgaben der Woche auf einen Blick.', tag: 'rueckblick', url: './#rueckblick' },
  }];
}

/* ---------- Mülleimer in der Küche ---------- */
// Ampel aus ep_settings "kuechenmuell", gleiche Regeln wie in js/aufgaben.js (kmTask, kmBinOf).
// Steht ein Eimer auf Rot und hat ihn noch niemand als rausgebracht gemeldet, bekommen die Kinder der Aufgabe
// eine Nachricht. Nur zwischen 7 und 20:30 Uhr; wird es abends rot, kommt sie am nächsten Morgen.
// Pro Umschalten auf Rot genau einmal (Schlüssel mit dem Zeitpunkt des Umschaltens).
const KM_NAMEN: Record<string, string> = { plastik: 'Plastikmüll', rest: 'Restmüll' };
export function kmTaskOf(tasks: Row[]): Row | null {
  const live = (tasks || []).filter((t) => t.active !== false);
  return live.find((t) => t.id === 'muell')
    || live.find((t) => t.schedule === 'bedarf' && /müll|muell/i.test(t.name || '') && !/tonne/i.test(t.name || '')) || null;
}
export function muellMessages(value: Row | null, tasks: Row[], log: Row[], persons: Row[], nowMs: number, urlaub: Row[] = []): Due[] {
  const { day, min } = berlin(nowMs);
  if (min < 7 * 60 || min >= 20 * 60 + 30) return [];
  const h = holidayOn(urlaub, day);
  if (h && h.weg !== false) return [];
  const task = kmTaskOf(tasks);
  const kids = persons.filter((p) => !p.adult).map((p) => p.id);
  const to = task ? assignees(task, day).filter((id) => kids.includes(id)) : [];
  if (!to.length) return [];
  const v: Row = value && typeof value === 'object' ? value : {};
  const red = Object.keys(KM_NAMEN).filter((bin) => {
    const x = v[bin] || {};
    const at = Date.parse(String(x.at || ''));
    // Nur frisch umgeschaltet (letzte 24 Stunden) und noch ohne offene Meldung.
    if (x.stufe !== 'rot' || !Number.isFinite(at) || at < nowMs - DAY) return false;
    return !log.some((e) => String(e.id || '').startsWith(`km-${bin}-`) && e.status === 'offen');
  });
  if (!red.length) return [];
  const names = red.map((b) => KM_NAMEN[b]);
  return [{
    key: `kuechenmuell:${red.map((b) => `${b}@${v[b].at}`).join('|')}`, to, ttl: 3 * 3600,
    msg: {
      title: names.length > 1 ? `${names.join(' und ')} sind voll` : `${names[0]} ist voll`,
      body: `Bitte ${names.length > 1 ? 'beide Eimer' : 'den Eimer'} aus der Küche rausbringen und danach in der App auf „Rausgebracht“ tippen.`,
      tag: 'kuechenmuell', url: './#aufgaben',
    },
  }];
}

/* ---------- Spülmaschine ---------- */
// Ampel aus ep_settings "spuelmaschine" (gleiche Regeln wie js/aufgaben.js smState): Gelb mit vergangener Endzeit
// gilt als Rot ab der Endzeit. Bei Rot ohne offene Meldung (sm-…) eine Nachricht an die Kinder der Aufgabe,
// nur zwischen 7 und 20:30 Uhr, pro Fertig-Zeitpunkt genau einmal.
export function smTaskOf(tasks: Row[]): Row | null {
  const live = (tasks || []).filter((t) => t.active !== false);
  return live.find((t) => t.id === 'spuelmaschine')
    || live.find((t) => t.schedule === 'bedarf' && /spülmasch|spuelmasch|geschirrspül/i.test(t.name || '')) || null;
}
export function smEffective(value: Row | null, nowMs: number): { stufe: string; at: string | null } {
  const x: Row = value && typeof value === 'object' ? value : {};
  const end = Date.parse(String(x.bis || ''));
  if (x.stufe === 'gelb' && Number.isFinite(end) && end <= nowMs) return { stufe: 'rot', at: new Date(end).toISOString() };
  return { stufe: String(x.stufe || 'gruen'), at: x.at || null };
}
export function spuelMessages(value: Row | null, tasks: Row[], log: Row[], persons: Row[], nowMs: number, urlaub: Row[] = []): Due[] {
  const { day, min } = berlin(nowMs);
  if (min < 7 * 60 || min >= 20 * 60 + 30) return [];
  const h = holidayOn(urlaub, day);
  if (h && h.weg !== false) return [];
  const st = smEffective(value, nowMs);
  const at = Date.parse(String(st.at || ''));
  if (st.stufe !== 'rot' || !Number.isFinite(at) || at < nowMs - DAY) return [];
  if ((log || []).some((e) => String(e.id || '').startsWith('sm-') && e.status === 'offen')) return [];
  const task = smTaskOf(tasks);
  const kids = persons.filter((p) => !p.adult).map((p) => p.id);
  const to = task ? assignees(task, day).filter((id) => kids.includes(id)) : [];
  if (!to.length) return [];
  return [{
    key: `spuelmaschine:${st.at}`, to, ttl: 3 * 3600,
    msg: { title: 'Die Spülmaschine ist fertig', body: 'Bitte ausräumen und danach in der App auf „Ausgeräumt“ tippen.', tag: 'spuelmaschine', url: './#aufgaben' },
  }];
}

/* ---------- Stall ---------- */
// Ampel nach Rhythmus aus ep_settings "stall" (gleiche Regeln wie js/aufgaben.js stState): fällig am Tag last + tage.
// Ist er heute fällig oder überfällig und noch nicht gemeldet (st-…), bekommen die Kinder der Aufgabe einmal am Tag
// eine Nachricht, zur ersten Erinnerungszeit der Kinder (Standard 16:30). Nicht im Urlaub.
export function stTaskOf(tasks: Row[]): Row | null {
  const live = (tasks || []).filter((t) => t.active !== false);
  return live.find((t) => t.id === 'meerschwein-kaefig')
    || live.find((t) => /käfig|kaefig|stall/i.test(t.name || '') && !/futter|füttern|fuettern/i.test(t.name || '')) || null;
}
export function stallMessages(value: Row | null, tasks: Row[], log: Row[], persons: Row[], nowMs: number, urlaub: Row[] = [], erinnerung?: Row): Due[] {
  const v: Row = value && typeof value === 'object' ? value : {};
  if (v.on !== true || !/^\d{4}-\d{2}-\d{2}$/.test(String(v.last || ''))) return [];
  const { day, min } = berlin(nowMs);
  const h = holidayOn(urlaub, day);
  if (h && h.weg !== false) return [];
  const at = reminderTimes(erinnerung).kind1 ?? 16 * 60 + 30;
  if (min < at || min >= Math.min(at + 120, 20 * 60 + 30)) return [];
  const tage = Math.max(1, Math.min(60, parseInt(String(v.tage), 10) || 7));
  const due = addDays(String(v.last), tage);
  if (due > day) return [];
  if ((log || []).some((e) => String(e.id || '').startsWith('st-') && e.status === 'offen')) return [];
  const task = stTaskOf(tasks);
  const kids = persons.filter((p) => !p.adult).map((p) => p.id);
  const to = task ? assignees(task, day).filter((id) => kids.includes(id)) : [];
  if (!to.length) return [];
  const late = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / DAY);
  return [{
    key: `stall:${day}`, to, ttl: 4 * 3600,
    msg: { title: late > 0 ? `Der Stall ist seit ${late === 1 ? 'gestern' : `${late} Tagen`} dran` : 'Heute ist der Stall dran', body: 'Bitte sauber machen und danach in der App auf „Sauber gemacht“ tippen.', tag: 'stall', url: './#aufgaben' },
  }];
}

export function lernMessages(lp: LpData, persons: Row[], nowMs: number, urlaub: Row[] = []): Due[] {
  const out: Due[] = [];
  const st: Row = { afterSchool: 60, latest: '19:30', weekendStart: '10:00', winGoal: 4, bedtimeMin: 30, sundayFree: true, pushOn: true, ...lp.settings };
  if (st.pushOn === false) return out;
  const { day, min, wd } = berlin(nowMs);
  const h = holidayOn(urlaub, day);
  if (h && h.weg !== false) return out;
  const kid = persons.find((p) => p.id === st.kidId && !p.adult);
  const adults = persons.filter((p) => p.adult).map((p) => p.id);
  const kname = kid ? kid.name : 'Euer Sohn';
  const url = './lernen.html';
  // Spiel verlegt: keine Erinnerungen ans Kind, einmal Bescheid an die Eltern.
  const vd = (lp.days || {})[day];
  if (vd && vd.verlegt) {
    const g: Record<string, string> = { muede: 'müde', krank: 'krank', aerger: 'Ärger oder Streit', kopf: 'zu viel im Kopf', lust: 'einfach keine Lust' };
    if (adults.length) out.push({ key: `lp-verlegt:${day}`, to: adults, ttl: 6 * 3600, msg: { title: `${kname} hat heute das Spiel verlegt`, body: `${vd.grund ? `Grund: ${g[String(vd.grund)] || vd.grund}. ` : ''}Vielleicht kurz nachfragen, wie es geht.`, tag: 'lernplaner-eltern', url } });
    return out;
  }
  // Applaus: Tagessieg und echte Lerneinheiten melden die App den Eltern, ein Tipp klatscht. Applaus geht ans Kind.
  if (st.applausOn !== false && min >= 7 * 60 && min < 21 * 60 + 30) {
    const base = url.replace(/[?#].*$/, '');
    if (adults.length && lp.wins[day]) {
      out.push({ key: `lp-applaus-sieg:${day}`, to: adults, ttl: 6 * 3600, msg: { title: `Tagessieg für ${kname}!`, body: 'Alles geschafft und mehr Tore als der Schweinehund. Tippen zum Klatschen.', tag: 'lernplaner-applaus', url: `${base}?applaus=sieg-${day}` } });
    }
    for (const t of lp.done.filter((x) => x.kind === 'lern' && x.doneAt === day && Number(x.fin) > nowMs - 30 * 60000 && x.checked !== 'ok')) {
      if (!adults.length) break;
      out.push({ key: `lp-applaus:${t.id}`, to: adults, ttl: 3 * 3600, msg: { title: `${kname} hat gelernt: ${t.subject}`, body: `${t.title}, ${t.actual} Min. mit der Uhr. Tippen zum Klatschen.`, tag: 'lernplaner-applaus', url: `${base}?applaus=t-${t.id}` } });
    }
  }
  if (kid) {
    for (const c of (lp.claps || []).filter((x) => Number(x.at) > nowMs - 30 * 60000)) {
      out.push({ key: `lp-clap:${c.id}`, to: [kid.id], ttl: 3 * 3600, msg: { title: `${c.name || 'Jemand'} klatscht für dich`, body: `Für ${c.what || 'dein Spiel heute'}. Weiter so!`, tag: 'lernplaner-klatschen', url } });
    }
  }
  // Lerneinheit zu kurz oder ohne Uhr: die Eltern entscheiden, ob sie zählt. Eine Nachricht pro Meldung, nicht nachts.
  if (adults.length && min >= 7 * 60 && min < 21 * 60 + 30) {
    for (const t of lp.checks || []) {
      const c: Row = t.check || {};
      if (!c.at || nowMs - Number(c.at) > DAY) continue;
      const how = c.why === 'ohne' ? `ohne Handy gelernt, nach eigener Angabe etwa ${c.actual} Min.` : `${c.actual} von ${c.planned} Min. mit der Uhr gelernt`;
      out.push({ key: `lp-pruefen:${t.id}:${c.at}`, to: adults, ttl: 6 * 3600, msg: { title: `Zählt das? ${t.subject}: ${how.split(',')[0]}`, body: `${kname}: ${t.title}. ${how.charAt(0).toUpperCase()}${how.slice(1)}${how.endsWith('.') ? '' : '.'} Im Lernplaner mit „Zählt“ oder „Nochmal“ entscheiden.`, tag: 'lernplaner-pruefen', url } });
    }
  }
  const tomorrow = addDays(day, 1);
  const nextWork = wdOf(tomorrow) === 6 && st.sundayFree !== false ? addDays(tomorrow, 1) : tomorrow;
  const examDate: Record<string, string> = Object.fromEntries(lp.exams.map((e) => [e.id, String(e.date)]));
  // Was heute dran ist, wie im Lernplaner: Hausaufgaben bis zum nächsten Lerntag, Ludus Latinus, fällige Lerneinheiten.
  const openToday = lp.open.filter((t) => (t.kind === 'ha' && String(t.due) <= nextWork)
    || (t.kind === 'daily' && t.date === day)
    || (t.kind === 'lern' && String(t.date) <= day && (examDate[t.examId] || '') > day));
  const doneToday = lp.done.filter((t) => t.doneAt === day);
  const active = lernTag(day) || (wd === 5 && openToday.some((t) => t.kind === 'lern'));
  const latest = hmMin(st.latest, 19 * 60 + 30);
  const end = lpSchoolEnd(lp.timetable, day);
  const start = wd < 5 && schoolDay(day) ? (end ?? hmMin(lp.schoolEnd[String(wd + 1)], 13 * 60)) + (Number(st.afterSchool) || 0) : hmMin(st.weekendStart, 10 * 60);
  const names = (xs: Row[]) => xs.slice(0, 4).map((t) => (t.kind === 'daily' ? 'Ludus Latinus' : `${t.subject}: ${t.title}`)).join(', ') + (xs.length > 4 ? ` und ${xs.length - 4} weitere` : '');
  const anzahl = (n: number) => (n === 1 ? 'eine Aufgabe' : `${n} Aufgaben`);

  // Anpfiff zur geplanten Startzeit und Endspurt eine Stunde vor Schluss, nur wenn noch etwas offen ist.
  // Hat er seinen Anpfiff selbst geplant (Wenn-dann-Plan), kommt die Nachricht zu seiner Zeit und erinnert an den Plan.
  // Ohne Plan fragt die App vorher einmal, wann er anpfeifen will.
  if (kid && active && openToday.length) {
    const plan: Row | null = (vd && vd.kplan) || null;
    const planAt = plan ? hmMin(plan.at, start) : null;
    // Schulschluss aus dem Stundenplan, sonst aus dem geplanten Beginn zurückgerechnet. An freien Tagen eine Stunde vorher.
    const endEff = end ?? start - (Number(st.afterSchool) || 0);
    const askFrom = wd < 5 && schoolDay(day) ? Math.max(endEff + 20, start - 45) : start - 60;
    if (!plan && !lp.kick[day] && st.kickPlan !== false && min >= askFrom && min < start) {
      out.push({ key: `lp-plan:${day}`, to: [kid.id], ttl: 2 * 3600, msg: { title: 'Wann pfeifst du heute an?', body: `Heute ${anzahl(openToday.length)}. Wähl deine Anpfiff-Zeit und was du machst, wenn dich etwas abhält.`, tag: 'lernplaner', url } });
    }
    if (!lp.kick[day] && planAt != null && min >= planAt && min < planAt + 45) {
      const wenn = plan && plan.wenn && plan.dann ? ` Wenn ${plan.wenn}, dann: ${plan.dann}.` : '';
      out.push({ key: `lp-anpfiff-plan:${day}`, to: [kid.id], ttl: 2 * 3600, msg: { title: `Anpfiff! Dein Plan: ${plan!.at} Uhr`, body: `${names(openToday)}.${wenn}`, tag: 'lernplaner', url } });
    } else if (!lp.kick[day] && planAt == null && min >= start && min < start + 45) {
      out.push({ key: `lp-anpfiff:${day}`, to: [kid.id], ttl: 2 * 3600, msg: { title: 'Anpfiff!', body: `Heute ${anzahl(openToday.length)}: ${names(openToday)}. Wer gleich anfängt, holt ein Extra-Tor.`, tag: 'lernplaner', url } });
    }
    const late = latest - 60;
    if (late > start && min >= late && min < late + 45) {
      out.push({
        key: `lp-endspurt:${day}`, to: [kid.id], ttl: 2 * 3600,
        msg: { title: lp.kick[day] ? `Endspurt: noch ${anzahl(openToday.length)}` : 'Heute noch nicht angepfiffen', body: `${names(openToday)}. Bis ${st.latest} Uhr ist noch Zeit für den Tagessieg.`, tag: 'lernplaner', url },
      });
    }
  }

  // Bewegungspause vorbei: kurze Nachricht an ihn, höchstens 10 Minuten nach dem Ende.
  const brk = lp.brk;
  if (kid && brk && brk.date === day && Number(brk.until) <= nowMs && nowMs - Number(brk.until) < 10 * 60000) {
    const next = openToday.find((t) => !doneToday.some((x) => x.id === t.id));
    out.push({ key: `lp-pause:${brk.until}`, to: [kid.id], ttl: 600, msg: { title: 'Auszeit vorbei', body: next ? `Weiter geht's: ${names([next])}.` : 'Weiter geht\'s!', tag: 'lernplaner', url } });
  }

  // Lernmodus: länger als eingestellt außerhalb der App (Pausenzeit zählt nicht).
  const lm = lp.lm;
  // Ludus Latinus oder ein Übungsblatt geöffnet: das ist Arbeit, keine Ablenkung.
  if (lm && lm.on && lm.date === day && lm.awayAt && !lm.ext) {
    const from = Number(lm.awayAt);
    let gone = nowMs - from;
    if (brk && brk.at && brk.until) { const o = Math.min(nowMs, Number(brk.until)) - Math.max(from, Number(brk.at)); if (o > 0) gone -= o; }
    const limit = Math.max(2, Number(st.awayAlert) || 5) * 60000;
    if (gone >= limit && gone < 3 * 3600000) {
      const mins = Math.round(gone / 60000);
      if (kid) out.push({ key: `lp-weg-kind:${from}`, to: [kid.id], ttl: 900, msg: { title: 'Zurück zum Lernplaner?', body: `Du bist seit ${mins} Minuten raus. Der Schweinehund wartet nur darauf. Zurück an den Schreibtisch!`, tag: 'lernplaner', url } });
      if (adults.length) out.push({ key: `lp-weg:${from}`, to: adults, ttl: 1800, msg: { title: `Lernmodus: ${kname} ist raus`, body: `Seit etwa ${mins} Minuten nicht im Lernplaner.`, tag: 'lernplaner-eltern', url } });
    }
  }

  // Abend vor einer Prüfung.
  if (kid && min >= 19 * 60 && min < 20 * 60) {
    for (const e of lp.exams.filter((x) => String(x.date) === tomorrow)) {
      out.push({ key: `lp-pruefung:${e.id}`, to: [kid.id], ttl: 3 * 3600, msg: { title: `Morgen: ${e.subject} ${e.type}`, body: 'Kurz die Lernkarten durchgehen, Tasche packen und früh schlafen. Du bist vorbereitet!', tag: 'lernplaner-pruefung', url } });
    }
  }

  // Stand für die Eltern, eine Viertelstunde nach dem spätesten Lernende.
  if (active && adults.length && min >= latest + 15 && min < latest + 75 && (openToday.length || doneToday.length)) {
    const mins = doneToday.reduce((a, t) => a + (Number(t.actual) || 0), 0);
    const body = lp.wins[day]
      ? `Tagessieg! ${doneToday.length} erledigt, ${mins} Min. gelernt.`
      : `${doneToday.length} erledigt, ${mins} Min. gelernt.${openToday.length ? ` Noch offen: ${names(openToday)}.` : ''}${lp.kick[day] ? '' : ' Heute nicht angepfiffen.'}`;
    out.push({ key: `lp-stand:${day}`, to: adults, ttl: 3 * 3600, msg: { title: `Schule heute: ${kname}`, body, tag: 'lernplaner-eltern', url } });
  }

  // „Schwer“ markiert: die Eltern erfahren es gleich, nachts erst ab 7 Uhr.
  if (adults.length && min >= 7 * 60 && min < 21 * 60 + 30) {
    for (const x of lp.help.filter((y) => y.date === day)) {
      out.push({ key: `lp-hilfe:${x.id}`, to: adults, ttl: 12 * 3600, msg: { title: `${kname} braucht Hilfe in ${x.subject}`, body: `„${x.title}“ war heute schwer. Am besten kurz zusammen anschauen.`, tag: 'lernplaner-hilfe', url } });
    }
  }

  // Wochenspiel gewonnen.
  const mon = mondayOf(day);
  const won = [0, 1, 2, 3, 4].filter((i) => lp.wins[addDays(mon, i)]).length;
  if (won >= (Number(st.winGoal) || 4) && min >= 7 * 60 && min < 21 * 60 + 30) {
    const prize = `Siegprämie: Freitag und Samstag je ${st.bedtimeMin} Min. länger aufbleiben.`;
    if (kid) out.push({ key: `lp-sieg:${mon}:kind`, to: [kid.id], ttl: DAY / 1000, msg: { title: 'Wochenspiel gewonnen!', body: `${won} Tagessiege. ${prize}`, tag: 'lernplaner-sieg', url } });
    if (adults.length) out.push({ key: `lp-sieg:${mon}:eltern`, to: adults, ttl: DAY / 1000, msg: { title: `${kname} hat das Wochenspiel gewonnen`, body: `${won} von 5 Tagessiegen. ${prize}`, tag: 'lernplaner-sieg', url } });
  }

  // Sonntags die Mannschaftsbesprechung für die nächste Woche.
  if (wd === 6 && min >= 17 * 60 && min < 19 * 60) {
    const next = addDays(mon, 7);
    const to = [...(kid ? [kid.id] : []), ...adults];
    if (!lp.meets[next] && to.length) {
      out.push({ key: `lp-besprechung:${next}`, to, ttl: 4 * 3600, msg: { title: 'Mannschaftsbesprechung', body: 'Schaut euch zusammen die nächste Woche im Lernplaner an: Prüfungen, Training, volle Tage. Dafür gibt es ein Tor.', tag: 'lernplaner-woche', url } });
    }
  }
  return out;
}

async function loadLern(store: Store, today: string): Promise<LpData> {
  const base = 'lp_data?select=id,coll,data&deleted=is.false';
  const [a, b, c, d] = await Promise.all([
    store.get(`${base}&coll=in.(settings,schoolEnd,timetable,exam,help,meet,lm,brk)`),
    store.get(`${base}&coll=eq.task&data->>done=eq.false`),
    store.get(`${base}&coll=eq.task&data->>doneAt=eq.${today}`),
    store.get(`${base}&coll=in.(win,kick)&data->>k=gte.${addDays(mondayOf(today), -7)}`),
  ]);
  const e = await store.get(`${base}&coll=eq.day&data->>k=eq.${today}`).catch(() => []);
  const f = await store.get(`${base}&coll=eq.clap&data->>date=gte.${addDays(today, -1)}`).catch(() => []);
  return lpFromRows([...a, ...b, ...c, ...d, ...e, ...f]);
}

/* ---------- Datenbank über die REST-Schnittstelle ---------- */

function env(name: string): string {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  return (g.Deno ? g.Deno.env.get(name) : g.process?.env?.[name]) || '';
}

function db() {
  const url = env('SUPABASE_URL');
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    if (!res.ok) throw new Error(`${path.split('?')[0]}: ${res.status} ${await res.text()}`);
    // Schreibzugriffe mit „return=minimal“ antworten ohne Inhalt (204 oder 201). Dann gibt es nichts zu lesen.
    const text = await res.text();
    return text.trim() ? JSON.parse(text) : null;
  };
  return {
    get: (path: string): Promise<Row[]> => call(path),
    // Trägt die Schlüssel ein und liefert nur die, die neu waren. So geht keine Nachricht doppelt raus.
    claim: async (keys: string[]): Promise<Set<string>> => {
      if (!keys.length) return new Set();
      const rows = await call('ep_push_log?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(keys.map((key) => ({ key }))),
      }) as Row[];
      return new Set(rows.map((r) => r.key));
    },
    upsert: (table: string, rows: Row[]) => call(`${table}?on_conflict=${table === 'ep_settings' ? 'key' : 'id'}`, {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
    }),
    // Zustellung pro Gerät festhalten, damit die App zeigen kann, ob Nachrichten ankommen.
    markSub: (endpoint: string, fields: Row) => call(`ep_push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fields) }),
    // Eine gemerkte Nachricht wieder freigeben, damit der nächste Lauf sie erneut versucht.
    release: (key: string) => call(`ep_push_log?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    dropSub: (endpoint: string) => call(`ep_push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    // Einkaufslisten vergangener Wochen, deren Montag vor dem Stichtag liegt.
    dropShopping: (beforeDay: string) => call(`ep_shopping?week_start=lt.${beforeDay}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    cleanup: (beforeIso: string) => call(`ep_push_log?sent_at=lt.${encodeURIComponent(beforeIso)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
  };
}

/* ---------- Datensicherung ---------- */

// Montag der Woche, die acht Wochen vor dem angegebenen Tag liegt. Ältere Listen werden gelöscht.
export function oldListCut(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 56 - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Alles, was die Familie eingetragen hat. Push-Anmeldungen und das Sendeprotokoll gehören nicht dazu.
export const BACKUP_TABLES: [string, string][] = [
  ['ep_persons', '*'], ['ep_dishes', '*'], ['ep_plan', '*'], ['ep_ratings', '*'], ['ep_lunch_ratings', '*'], ['ep_week_hearts', '*'],
  ['ep_shopping', '*'], ['ep_tasks', '*'], ['ep_task_log', '*'], ['ep_events', '*'], ['ep_attendance', '*'], ['ep_pantry', '*'],
  ['ep_staples', '*'], ['ep_settings', '*'], ['ep_receipts', '*'], ['ep_abfuhr', '*'],
  // Ohne den langen Verlauf der Angebotssuche.
  ['ep_ai_runs', 'id,week_start,status,offers,draft,warnings,error,trigger,wish,model,created_at,updated_at,decided_at,decided_by'],
];
export const BACKUP_BUCKET = 'sicherung';
export const BACKUP_KEEP = 8;

function storageHeaders(): Record<string, string> {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

export async function makeBackup(store: Store, nowMs = Date.now()) {
  const data: Record<string, Row[]> = {};
  const counts: Record<string, number> = {};
  for (const [t, cols] of BACKUP_TABLES) {
    try { data[t] = await store.get(`${t}?select=${cols}`); } catch (e) { data[t] = []; }
    counts[t] = data[t].length;
  }
  const { day, min } = berlin(nowMs);
  const name = `familienplan-${day}-${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}.json`;
  const body = JSON.stringify({ app: 'Familienplan', version: 1, erstellt: new Date(nowMs).toISOString(), anzahl: counts, daten: data });
  const base = `${env('SUPABASE_URL')}/storage/v1/object`;
  const up = await fetch(`${base}/${BACKUP_BUCKET}/${name}`, { method: 'POST', headers: { ...storageHeaders(), 'Content-Type': 'application/json', 'x-upsert': 'true' }, body });
  if (!up.ok) throw new Error(`Sicherung: ${up.status} ${(await up.text()).slice(0, 200)}. Ist schema.sql neu ausgeführt?`);
  await up.body?.cancel();
  // Nur die letzten Sicherungen behalten.
  const list = await fetch(`${base}/list/${BACKUP_BUCKET}`, {
    method: 'POST', headers: { ...storageHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 200, sortBy: { column: 'name', order: 'desc' } }),
  });
  if (list.ok) {
    const files = ((await list.json()) as Row[]).map((f) => String(f.name)).filter((n) => n.startsWith('familienplan-')).sort().reverse();
    const old = files.slice(BACKUP_KEEP);
    if (old.length) {
      const del = await fetch(`${base}/${BACKUP_BUCKET}`, { method: 'DELETE', headers: { ...storageHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: old }) });
      await del.body?.cancel();
    }
  } else await list.body?.cancel();
  return { name, bytes: body.length, anzahl: counts };
}

/* ---------- Fotonachweis für Aufgaben ---------- */
// Die Kinder machen beim Melden ein Foto. Es liegt privat im Speicher "nachweise" (legt die Funktion selbst an),
// Dateiname ist die Kennung des Eintrags. Die Eltern bekommen Links, die eine Stunde gelten. Nach 14 Tagen weg.
export const FOTO_BUCKET = 'nachweise';
export const FOTO_DAYS = 14;
export const fotoName = (id: string) => `${String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)}.jpg`;
let fotoBucketOk = false;
async function ensureFotoBucket() {
  if (fotoBucketOk) return;
  const base = `${env('SUPABASE_URL')}/storage/v1`;
  const r = await fetch(`${base}/bucket/${FOTO_BUCKET}`, { headers: storageHeaders() });
  await r.body?.cancel();
  if (!r.ok) {
    const c = await fetch(`${base}/bucket`, {
      method: 'POST', headers: { ...storageHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: FOTO_BUCKET, name: FOTO_BUCKET, public: false, file_size_limit: 3000000, allowed_mime_types: ['image/jpeg'] }),
    });
    const t = await c.text();
    if (!c.ok && !/exist|duplicate/i.test(t)) throw new Error(`Speicher für Fotos: ${c.status} ${t.slice(0, 160)}`);
  }
  fotoBucketOk = true;
}
export async function saveFoto(id: string, b64: string) {
  const name = fotoName(id);
  if (name === '.jpg') throw new Error('Kennung fehlt.');
  const bin = Uint8Array.from(atob(String(b64 || '')), (c) => c.charCodeAt(0));
  if (bin.length < 1000) throw new Error('Das Foto ist leer.');
  if (bin.length > 2500000) throw new Error('Das Foto ist zu groß.');
  await ensureFotoBucket();
  const up = await fetch(`${env('SUPABASE_URL')}/storage/v1/object/${FOTO_BUCKET}/${name}`, {
    method: 'POST', headers: { ...storageHeaders(), 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: bin,
  });
  if (!up.ok) throw new Error(`Foto speichern: ${up.status} ${(await up.text()).slice(0, 160)}`);
  await up.body?.cancel();
  return { name, bytes: bin.length };
}
export async function fotoLinks(ids: string[]): Promise<Record<string, string>> {
  const list = [...new Set((ids || []).map(String))].slice(0, 60);
  if (!list.length) return {};
  const r = await fetch(`${env('SUPABASE_URL')}/storage/v1/object/sign/${FOTO_BUCKET}`, {
    method: 'POST', headers: { ...storageHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600, paths: list.map(fotoName) }),
  });
  if (!r.ok) { await r.body?.cancel(); return {}; }
  const out: Record<string, string> = {};
  for (const x of (await r.json()) as Row[]) {
    if (!x || x.error || !x.signedURL) continue;
    const id = list.find((i) => fotoName(i) === String(x.path || '').split('/').pop());
    if (id) out[id] = `${env('SUPABASE_URL')}/storage/v1${String(x.signedURL).startsWith('/') ? '' : '/'}${x.signedURL}`;
  }
  return out;
}
export async function cleanupFotos(nowMs = Date.now()) {
  const base = `${env('SUPABASE_URL')}/storage/v1/object`;
  const r = await fetch(`${base}/list/${FOTO_BUCKET}`, {
    method: 'POST', headers: { ...storageHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 1000, sortBy: { column: 'created_at', order: 'asc' } }),
  });
  if (!r.ok) { await r.body?.cancel(); return 0; }
  const cut = nowMs - FOTO_DAYS * DAY;
  const old = ((await r.json()) as Row[]).filter((f) => f && f.name && Date.parse(f.created_at || '') < cut).map((f) => String(f.name));
  if (old.length) {
    const del = await fetch(`${base}/${FOTO_BUCKET}`, { method: 'DELETE', headers: { ...storageHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: old }) });
    await del.body?.cancel();
  }
  return old.length;
}

function vapidFromEnv(): Vapid {
  const v = { publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY'), subject: env('VAPID_SUBJECT') || 'mailto:familienplan@example.com' };
  if (!v.publicKey || !v.privateKey) throw new Error('VAPID_PUBLIC_KEY oder VAPID_PRIVATE_KEY fehlt in den Secrets der Funktion.');
  return v;
}

async function deliver(store: ReturnType<typeof db>, subs: Row[], to: string[], msg: Message, ttl: number, vapid: Vapid) {
  let sent = 0;
  let transient = false;
  const now = new Date().toISOString();
  for (const s of subs.filter((x) => to.includes(x.person_id))) {
    try {
      const { status, reason } = await sendPushDetailed(s as Sub, msg, vapid, ttl);
      if (status === 404 || status === 410) { await store.dropSub(s.endpoint); continue; }
      if (status < 300) {
        sent++;
        await noteSub(store, s, { last_ok_at: now, last_status: status, last_error: '' }, { at: now, title: msg.title, ok: true });
      } else {
        // 429, 5xx und Anmelde- oder Verbindungsprobleme sind vorübergehend: im nächsten Lauf noch einmal.
        const again = status === 429 || status >= 500 || ['BadJwtToken', 'TooManyRequests', 'IdleTimeout', 'TooManyProviderTokenUpdates', 'ExpiredProviderToken'].includes(reason);
        if (again) transient = true;
        if (reason === 'BadJwtToken' || reason === 'ExpiredProviderToken') jwtCache.clear();
        const why = `abgelehnt, Status ${status}${reason ? ` (${reason})` : ''}`;
        console.warn('Push abgelehnt', status, reason, new URL(s.endpoint).host);
        await noteSub(store, s, { last_status: status, last_error: `${why} am ${now}` }, { at: now, title: msg.title, ok: false, why, again });
      }
    } catch (e) {
      transient = true;
      console.warn('Push fehlgeschlagen', String(e));
      await noteSub(store, s, { last_error: `nicht erreichbar am ${now}: ${String(e).slice(0, 120)}` }, { at: now, title: msg.title, ok: false, why: 'Push-Dienst nicht erreichbar', again: true });
    }
  }
  return { sent, transient };
}

// Zustellung an ein Gerät festhalten: letzter Stand und die letzten zehn Nachrichten.
// Fehlt die Spalte history noch (schema.sql nicht eingespielt), wird nur der letzte Stand gespeichert.
async function noteSub(store: ReturnType<typeof db>, s: Row, fields: Row, entry: Row) {
  s.history = [entry, ...(Array.isArray(s.history) ? s.history : [])].slice(0, 10);
  await store.markSub(s.endpoint, { ...fields, history: s.history })
    .catch(() => store.markSub(s.endpoint, fields))
    .catch(() => {});
}

// Fällige Nachrichten verschicken: erst merken (damit nichts doppelt kommt), dann zustellen.
// Scheitert die Zustellung nur vorübergehend, wird die Nachricht wieder freigegeben.
export async function sendDue(store: ReturnType<typeof db>, subs: Row[], due: Due[], vapid: Vapid) {
  if (!due.length) return { fresh: 0, sent: 0 };
  const fresh = await store.claim(due.map((d) => d.key));
  // Pro Person und Kennzeichen nur die erste Nachricht eines Laufs. Die späteren würden sie ohnehin ersetzen.
  const seen = new Set<string>();
  let sent = 0;
  for (const d of due.filter((x) => fresh.has(x.key))) {
    const to = d.to.filter((id) => !seen.has(`${d.msg.tag}|${id}`));
    if (!to.length) continue;
    to.forEach((id) => seen.add(`${d.msg.tag}|${id}`));
    const r = await deliver(store, subs, to, d.msg, d.ttl, vapid);
    sent += r.sent;
    if (!r.sent && r.transient) { await store.release(d.key).catch(() => {}); continue; }
    if (d.extraKeys && d.extraKeys.length) await store.claim(d.extraKeys);
  }
  return { fresh: fresh.size, sent };
}

// Nur der Lernplaner, für einen zusätzlichen Zeitplan im Minutentakt (Pause vorbei, Lernmodus).
async function runLernOnly(nowMs = Date.now()) {
  const store = db();
  const today = berlin(nowMs).day;
  const [persons, subs, urlaubRow] = await Promise.all([
    store.get('ep_persons?select=*'),
    store.get('ep_push_subs?select=*'),
    store.get('ep_settings?select=key,value&key=in.(urlaub,kuechenmuell,spuelmaschine)').catch(() => []),
  ]);
  const setting = (k: string) => (urlaubRow.find((x: Row) => x.key === k) || {}).value;
  const u = setting('urlaub');
  const due = lernMessages(await loadLern(store, today), persons, nowMs, Array.isArray(u) ? u : []);
  // Müll-Ampel: auch hier, damit die Nachricht bei Rot innerhalb einer Minute kommt.
  // Spülmaschine ebenso, damit „fertig“ zur eingestellten Endzeit pünktlich ankommt.
  try {
    const km = setting('kuechenmuell');
    const sm = setting('spuelmaschine');
    const kmRed = km && Object.values(km as Row).some((x) => !!x && (x as Row).stufe === 'rot');
    const smRed = smEffective(sm || null, nowMs).stufe === 'rot';
    if (kmRed || smRed) {
      const [tasks, pending] = await Promise.all([
        store.get('ep_tasks?select=*'),
        store.get('ep_task_log?select=id,status&or=(id.like.km-*,id.like.sm-*)&status=eq.offen'),
      ]);
      if (kmRed) due.push(...muellMessages(km, tasks, pending, persons, nowMs, Array.isArray(u) ? u : []));
      if (smRed) due.push(...spuelMessages(sm, tasks, pending, persons, nowMs, Array.isArray(u) ? u : []));
    }
  } catch (e) { console.warn('Küchen-Ampel', String(e)); }
  const r = await sendDue(store, subs, due, vapidFromEnv());
  return { due: due.length, new: r.fresh, sent: r.sent, nur: 'lern' };
}

async function runSchedule(nowMs = Date.now()) {
  const store = db();
  const vapid = vapidFromEnv();
  const since = new Date(nowMs - 3 * DAY).toISOString();
  const today = berlin(nowMs).day;
  const [persons, tasks, log, abfuhr, hearts, plan, subs, shopping, dishes, ratings, urlaubRow, added] = await Promise.all([
    store.get('ep_persons?select=*'),
    store.get('ep_tasks?select=*'),
    store.get(`ep_task_log?select=*&or=(created_at.gte.${since},decided_at.gte.${since},day.gte.${mondayOf(today)})`),
    store.get(`ep_abfuhr?select=*&day=gte.${today}&day=lte.${addDays(today, 2)}`),
    store.get(`ep_week_hearts?select=*&week_start=eq.${mondayOf(today)}`),
    store.get(`ep_plan?select=*&day=gte.${mondayOf(today)}&day=lte.${addDays(mondayOf(today), 7)}`),
    store.get('ep_push_subs?select=*'),
    store.get(`ep_shopping?select=*&due=eq.${today}&checked=is.false`).catch(() => []),
    store.get('ep_dishes?select=*'),
    store.get(`ep_ratings?select=day,person_id&day=eq.${today}`),
    store.get('ep_settings?select=key,value&key=in.(urlaub,aufgaben,kuechenmuell,spuelmaschine,rueckblick,stall)').catch(() => []),
    store.get(`ep_shopping?select=id,label,added_by,created_at,checked&added_by=not.is.null&created_at=gte.${encodeURIComponent(new Date(nowMs - 12 * 3600000).toISOString())}`).catch(() => []),
  ]);
  const setting = (k: string) => (urlaubRow.find((x: Row) => x.key === k) || {}).value;
  const urlaub = Array.isArray(setting('urlaub')) ? setting('urlaub') : [];
  const grundZuerst = (setting('aufgaben') || {}).grund_zuerst !== false;
  const erinnerung = (setting('aufgaben') || {}).erinnerung;
  const due = dueMessages({ persons, tasks, log, abfuhr, hearts, plan, shopping, dishes, ratings, urlaub, grundZuerst, added, erinnerung }, nowMs);
  due.push(...muellMessages(setting('kuechenmuell'), tasks, log, persons, nowMs, urlaub));
  due.push(...spuelMessages(setting('spuelmaschine'), tasks, log, persons, nowMs, urlaub));
  due.push(...stallMessages(setting('stall'), tasks, log, persons, nowMs, urlaub, erinnerung));
  due.push(...reviewMessages(setting('rueckblick'), persons, nowMs, urlaub));
  // Lernplaner: eigener Fehlerbereich. Fehlt die Tabelle lp_data, laufen die übrigen Nachrichten normal weiter.
  try { due.push(...lernMessages(await loadLern(store, today), persons, nowMs, urlaub)); } catch (e) { console.warn('Lernplaner', String(e)); }
  // Erinnerungen zuerst verschicken, damit sie nicht auf Sicherung oder Wochenplan warten müssen.
  const first = await sendDue(store, subs, due, vapid);
  // Datensicherung jeden Sonntag ab 3 Uhr, einmal pro Woche.
  {
    const b = berlin(nowMs);
    if (b.wd === 6 && b.min >= 180) {
      try {
        const fresh = await store.claim([`sicherung:${b.day}`]);
        if (fresh.size) {
          await makeBackup(store, nowMs);
          // Erst nach geglückter Sicherung: Einkaufslisten, die älter als acht Wochen sind, löschen.
          await store.dropShopping(oldListCut(b.day));
          // Fotonachweise älter als 14 Tage löschen.
          try { await cleanupFotos(nowMs); } catch (e) { console.warn('Fotos', String(e)); }
        }
      } catch (e) { console.warn('Sicherung', String(e)); }
      // Danach die Kosten pro Gericht mit den Preisen der Woche auffrischen.
      if (b.min >= 200 && env('ANTHROPIC_API_KEY')) {
        try {
          const fresh = await store.claim([`kosten:${b.day}`]);
          if (fresh.size) await estimateCosts(store, nowMs);
        } catch (e) { console.warn('Kosten', String(e)); }
      }
    }
  }
  // Wochenplan mit Claude: eigener Fehlerbereich, damit Probleme dort die Erinnerungen nicht aufhalten.
  let later: Due[] = [];
  try {
    later = await stepPlanner(store, nowMs, persons.filter((p) => p.adult).map((p) => p.id));
  } catch (e) { console.warn('Planer', String(e)); }
  const second = await sendDue(store, subs, later, vapid);
  await store.cleanup(new Date(nowMs - 60 * DAY).toISOString());
  return { due: due.length + later.length, new: first.fresh + second.fresh, sent: first.sent + second.sent, devices: subs.length };
}

// Testnachricht an das Gerät, das die App gerade benutzt. Nur für angemeldete Familienmitglieder.
async function runTest(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const check = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SERVICE_KEY') || env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${token}` },
  });
  await check.body?.cancel();
  if (!token || !check.ok) return { status: 401, body: { error: 'Nicht angemeldet.' } };
  const body = await req.json().catch(() => ({}));
  usageKind = String(body.action || 'sonstiges');
  // Neuer Wochenplan-Entwurf auf Knopfdruck aus der App.
  if (body.action === 'entwurf') {
    if (!env('ANTHROPIC_API_KEY')) return { status: 400, body: { error: 'Bei Supabase fehlt noch der Schlüssel ANTHROPIC_API_KEY. Die Anleitung steht in der README unter „Wochenplan mit Claude“.' } };
    const week = /^\d{4}-\d{2}-\d{2}$/.test(String(body.week || '')) ? mondayOf(String(body.week)) : addDays(mondayOf(berlin(Date.now()).day), 7);
    const run = await startRun(db(), week, 'hand', typeof body.wish === 'string' ? body.wish : undefined);
    return { status: 200, body: { id: run.id, week } };
  }
  // Haushaltsbuch: Kassenzettel-Foto auslesen. Gespeichert wird erst in der App, nach dem Prüfen.
  // Schnelles Mittagessen aus dem, was im Haus ist.
  if (body.action === 'mittag') {
    if (!env('ANTHROPIC_API_KEY')) return { status: 400, body: { error: 'Bei Supabase fehlt noch der Schlüssel ANTHROPIC_API_KEY.' } };
    try { return { status: 200, body: { mittag: await suggestLunch(db(), body.mittag || {}) } }; } catch (e) { return { status: 502, body: { error: String((e as Error).message || e) } }; }
  }
  // Kosten pro Gericht neu schätzen.
  if (body.action === 'kosten') {
    if (!env('ANTHROPIC_API_KEY')) return { status: 400, body: { error: 'Bei Supabase fehlt noch der Schlüssel ANTHROPIC_API_KEY.' } };
    try { return { status: 200, body: { kosten: await estimateCosts(db()) } }; } catch (e) { return { status: 502, body: { error: String((e as Error).message || e) } }; }
  }
  // Festtag planen: dauert je nach Umfang bis zu einer Minute.
  if (body.action === 'fest') {
    if (!env('ANTHROPIC_API_KEY')) return { status: 400, body: { error: 'Bei Supabase fehlt noch der Schlüssel ANTHROPIC_API_KEY.' } };
    try { return { status: 200, body: { fest: await planFeast(db(), body.fest || {}) } }; } catch (e) { return { status: 502, body: { error: String((e as Error).message || e) } }; }
  }
  // Termine aus den abonnierten Kalendern fürs Küchen-Display, heute und morgen.
  if (body.action === 'kalender') {
    try { return { status: 200, body: await loadCalendars(db(), Date.now(), Number(body.tage) || 2) }; } catch (e) { return { status: 502, body: { error: String((e as Error).message || e) } }; }
  }
  // Ein Gericht im Wochenplan zurückgeben und ein neues Rezept bekommen.
  if (body.action === 'neues-gericht') {
    if (!env('ANTHROPIC_API_KEY')) return { status: 400, body: { error: 'Bei Supabase fehlt noch der Schlüssel ANTHROPIC_API_KEY.' } };
    try { return { status: 200, body: { neu: await suggestNewDish(db(), body.neu || {}) } }; } catch (e) { return { status: 502, body: { error: String((e as Error).message || e) } }; }
  }
  // Ersatz für einen Artikel, den es im Laden nicht gab.
  if (body.action === 'ersatz') {
    if (!env('ANTHROPIC_API_KEY')) return { status: 400, body: { error: 'Bei Supabase fehlt noch der Schlüssel ANTHROPIC_API_KEY.' } };
    try { return { status: 200, body: { ersatz: await suggestSubstitute(db(), body) } }; } catch (e) { return { status: 502, body: { error: String((e as Error).message || e) } }; }
  }
  // Fotonachweis: hochladen (Kind) und ansehen (Eltern).
  if (body.action === 'foto') {
    try { return { status: 200, body: await saveFoto(String(body.id || ''), String(body.data || '')) }; } catch (e) { return { status: 502, body: { error: String((e as Error).message || e) } }; }
  }
  if (body.action === 'foto-links') {
    try { return { status: 200, body: { links: await fotoLinks(Array.isArray(body.ids) ? body.ids : []) } }; } catch (e) { return { status: 502, body: { error: String((e as Error).message || e) } }; }
  }
  // Datensicherung auf Knopfdruck.
  if (body.action === 'sicherung') {
    try { return { status: 200, body: await makeBackup(db()) }; } catch (e) { return { status: 502, body: { error: String((e as Error).message || e) } }; }
  }
  // Rezept aus Foto: das Gericht kommt zur Prüfung zurück in die App.
  if (body.action === 'kassenzettel' || body.action === 'rezept' || body.action === 'zutaten') {
    if (!env('ANTHROPIC_API_KEY')) return { status: 400, body: { error: 'Bei Supabase fehlt noch der Schlüssel ANTHROPIC_API_KEY.' } };
    try {
      const photos: Photo[] = (Array.isArray(body.photos) ? body.photos : [{ data: body.image, media: body.media }])
        .map((p: Row) => ({ data: String((p && p.data) || ''), media: String((p && p.media) || 'image/jpeg') }));
      if (body.action === 'zutaten') return { status: 200, body: { zutaten: await readIngredients(db(), photos) } };
      if (body.action === 'rezept') return { status: 200, body: { rezept: await readRecipe(db(), photos) } };
      const beleg = await readReceipt(db(), photos);
      return { status: 200, body: { beleg } };
    } catch (e) {
      return { status: 502, body: { error: String((e as Error).message || e) } };
    }
  }
  const { endpoint } = body;
  const store = db();
  const subs = await store.get(`ep_push_subs?select=*&endpoint=eq.${encodeURIComponent(endpoint || '')}`);
  if (!subs.length) return { status: 404, body: { error: 'Dieses Gerät ist noch nicht angemeldet.' } };
  const { status, reason } = await sendPushDetailed(subs[0] as Sub, { title: 'Familienplan', body: 'Testnachricht: Benachrichtigungen funktionieren auf diesem Gerät.', tag: 'test', url: './' }, vapidFromEnv(), 600);
  const at = new Date().toISOString();
  if (status === 404 || status === 410) {
    await store.dropSub(subs[0].endpoint);
    return { status: 502, body: { pushStatus: status, error: 'Der Push-Dienst kennt dieses Gerät nicht mehr. Bitte Benachrichtigungen aus- und wieder einschalten.' } };
  }
  await noteSub(store, subs[0], status < 300 ? { last_ok_at: at, last_status: status, last_error: '' } : { last_status: status, last_error: `abgelehnt, Status ${status}${reason ? ` (${reason})` : ''} am ${at}` },
    status < 300 ? { at, title: 'Testnachricht', ok: true } : { at, title: 'Testnachricht', ok: false, why: `abgelehnt, Status ${status}${reason ? ` (${reason})` : ''}` });
  return { status: status < 300 ? 200 : 502, body: { pushStatus: status, ...(status < 300 ? {} : { error: `Der Push-Dienst hat die Nachricht abgelehnt (Status ${status}).` }) } };
}

/* ---------- Einkaufsliste per Siri-Kurzbefehl ---------- */

// "Milch, Brot und Eier" wird zu drei Einträgen.
export function splitSpoken(text: string): string[] {
  return String(text || '').split(/\s*(?:,|;|\n|\bund\b|\bsowie\b)\s*/i)
    .map((x) => x.trim().replace(/[.!?]+$/, '')).filter((x) => x.length > 1).slice(0, 12)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1));
}

// Diktat ohne Kommas ("Milch Butter Käse"): Claude zerlegt es in Posten. Zusammengehöriges bleibt zusammen.
const SPLIT_SCHEMA = { type: 'object', additionalProperties: false, required: ['posten'], properties: { posten: { type: 'array', items: { type: 'string' } } } };
export function splitParams(text: string) {
  return {
    model: 'claude-haiku-5-5', max_tokens: 2000,
    messages: [{ role: 'user', content: [
      'Das ist eine diktierte Einkaufsliste ohne Satzzeichen. Zerlege sie in einzelne Posten.',
      'Wörter, die zusammen einen Artikel ergeben, bleiben zusammen, zum Beispiel "rote Linsen", "griechischer Joghurt", "Bio Milch", "Spaghetti", "geriebener Käse".',
      'Mengen bleiben beim Posten, zum Beispiel "2 Liter Milch". Schreib die Posten so, wie sie im Text stehen, nur mit großem Anfangsbuchstaben. Erfinde nichts dazu.',
      '', `Text: ${text}`,
    ].join('\n') }],
    output_config: { format: { type: 'json_schema', schema: SPLIT_SCHEMA } },
  };
}
export function checkSplit(text: string, posten: unknown): string[] | null {
  if (!Array.isArray(posten)) return null;
  const words = new Set(String(text).toLowerCase().split(/\s+/).map((w) => w.replace(/[.,!?]/g, '')));
  const out = posten.map((x) => String(x || '').trim()).filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  // Nur Posten, deren Wörter auch im Diktat vorkommen.
  if (!out.length || out.some((x) => x.toLowerCase().split(/\s+/).some((w) => !words.has(w.replace(/[.,!?]/g, ''))))) return null;
  return out.slice(0, 12);
}
async function splitWithClaude(text: string): Promise<string[] | null> {
  if (!env('ANTHROPIC_API_KEY')) return null;
  try {
    const res = JSON.parse(await apiCall('/messages', { method: 'POST', body: JSON.stringify(splitParams(text)) }));
    const t = (res.content || []).filter((c: Row) => c.type === 'text').map((c: Row) => c.text).join('');
    return checkSplit(text, JSON.parse(t).posten);
  } catch (e) {
    console.warn('Zerlegen', String(e));
    return null;
  }
}

export async function addFromShortcut(store: Store, key: string, body: Row, nowMs = Date.now()) {
  const settings = await store.get('ep_settings?select=value&key=eq.kurzbefehl');
  const saved = String(((settings[0] || {}).value || {}).schluessel || '');
  if (!saved || saved.length < 16 || key !== saved) return { status: 401, body: { text: 'Der Schlüssel stimmt nicht. Bitte den Kurzbefehl neu einrichten.' } };
  let labels = splitSpoken(String(body.text || ''));
  if (!labels.length) return { status: 400, body: { text: 'Ich habe nichts verstanden, was auf die Liste soll.' } };
  // Ein einziger Posten mit mehreren Wörtern: vermutlich ohne Kommas diktiert.
  if (labels.length === 1 && labels[0].split(/\s+/).length >= 2) {
    const split = await splitWithClaude(labels[0]);
    if (split && split.length > 1) labels = split;
  }
  const persons = await store.get('ep_persons?select=id,name');
  const person = persons.find((p) => p.id === body.person);
  const { day } = berlin(nowMs);
  const week = mondayOf(day);
  const items = await store.get(`ep_shopping?select=label,trip,due,sort,checked&week_start=eq.${week}`);
  // Gleiche Regel wie in der App: der erste Einkauf, der noch offen ist und nicht in der Vergangenheit liegt.
  const sorted = items.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const trips = [...new Set(sorted.map((i) => i.trip || 'Einkauf'))];
  const open = trips.find((t) => sorted.some((i) => (i.trip || 'Einkauf') === t && !i.checked && (!i.due || String(i.due).slice(0, 10) >= day)));
  const trip = open || trips[trips.length - 1] || 'Einkauf';
  const sample = sorted.find((i) => (i.trip || 'Einkauf') === trip) || {};
  const have = new Set(items.filter((i) => !i.checked).map((i) => String(i.label).toLowerCase()));
  const fresh = labels.filter((l) => !have.has(l.toLowerCase()));
  const maxSort = Math.max(0, ...items.map((i) => Number(i.sort) || 0));
  const now = new Date(nowMs).toISOString();
  const rows = fresh.map((label, n) => ({
    id: `s${nowMs.toString(36)}${n}${Math.random().toString(36).slice(2, 6)}`, week_start: week, trip, due: sample.due || null, category: 'sonst',
    label, qty: '', sort: maxSort + 1 + n, checked: false, manual: true, purpose: '', missing: false,
    added_by: person ? person.id : null, created_at: now,
  }));
  if (rows.length) await store.upsert('ep_shopping', rows);
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} und ${xs[xs.length - 1]}` : xs[0]);
  const skipped = labels.filter((l) => !fresh.includes(l));
  const text = [rows.length ? `${list(fresh)} ${rows.length === 1 ? 'steht' : 'stehen'} jetzt auf der Einkaufsliste.` : '', skipped.length ? `${list(skipped)} ${skipped.length === 1 ? 'stand' : 'standen'} schon drauf.` : ''].filter(Boolean).join(' ');
  return { status: 200, body: { text, neu: fresh } };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cron-secret, x-liste-schluessel',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const secret = env('CRON_SECRET');
    usageKind = 'kosten';
    if (secret && secret.length >= 16 && req.headers.get('x-cron-secret') === secret) {
      const b = await req.clone().json().catch(() => ({}));
      return json(200, b && b.nur === 'lern' ? await runLernOnly() : await runSchedule());
    }
    usageKind = 'siri';
    // Siri-Kurzbefehl, einfache Form: alles steht in der Adresse, die Antwort ist Text zum Vorlesen.
    const q = new URL(req.url).searchParams;
    if (q.get('schluessel')) {
      const r = await addFromShortcut(db(), String(q.get('schluessel')), { text: q.get('text') || '', person: q.get('person') || '' });
      return new Response(String(r.body.text || ''), { status: r.status, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    // Siri-Kurzbefehl mit Header und JSON (ältere Anleitung): eigener Familien-Schlüssel statt Anmeldung.
    const listKey = req.headers.get('x-liste-schluessel');
    if (listKey) {
      const r = await addFromShortcut(db(), listKey, await req.json().catch(() => ({})));
      return json(r.status, r.body);
    }
    const r = await runTest(req);
    return json(r.status, r.body);
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e instanceof Error ? e.message : e) });
  } finally {
    await flushUsage(db()).catch((e) => console.warn('Verbrauch', String(e)));
  }
}

// Für Tests: Zugriff auf die Datenbank wie im Betrieb.
export const makeDb = () => db();

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D && typeof D.serve === 'function') D.serve(handler);
