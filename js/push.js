// Push-Nachrichten auf diesem Gerät: Service Worker anmelden, Erlaubnis einholen, Abo verwalten.
// Verschickt werden die Nachrichten von der Supabase-Funktion in supabase/functions/push.

const key = () => ((window.ESSENSPLAN_CONFIG || {}).vapidPublicKey || '').trim();
const framed = () => { try { return window.self !== window.top; } catch (e) { return true; } };
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

let reg = null;

export async function register() {
  if (framed() || !('serviceWorker' in navigator)) return null;
  try { reg = await navigator.serviceWorker.register('./sw.js'); } catch (e) { reg = null; }
  return reg;
}

function keyBytes(b64) {
  const t = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Stand auf diesem Gerät. reason erklärt, warum Push hier nicht geht.
export async function status(mode) {
  const out = { available: false, reason: '', permission: 'default', subscribed: false, endpoint: null };
  if (mode !== 'supabase') { out.reason = 'Push-Nachrichten gibt es nur mit der gemeinsamen Datenbank, nicht im Demo-Modus.'; return out; }
  if (framed()) { out.reason = 'In dieser Vorschau nicht möglich. In der veröffentlichten App einschalten.'; return out; }
  if (!key()) { out.reason = 'Der öffentliche Schlüssel fehlt noch in js/config.js. Die Anleitung steht in der README unter „Push-Nachrichten“.'; return out; }
  if (!supported()) {
    out.reason = isIOS() && !standalone()
      ? 'Auf dem iPhone geht das nur aus der installierten App: im Safari-Menü „Teilen“ und dann „Zum Home-Bildschirm“ wählen, die App von dort öffnen und hier einschalten.'
      : 'Dieser Browser kann keine Push-Nachrichten empfangen.';
    return out;
  }
  out.permission = Notification.permission;
  if (out.permission === 'denied') { out.reason = 'Benachrichtigungen sind für diese Seite gesperrt. Sie lassen sich in den Einstellungen des Browsers wieder erlauben.'; return out; }
  out.available = true;
  if (!reg) await register();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  out.subscribed = !!sub;
  out.endpoint = sub ? sub.endpoint : null;
  return out;
}

// Fragt nach der Erlaubnis und meldet das Gerät beim Push-Dienst an. Liefert die Daten für ep_push_subs.
export async function subscribe() {
  if (!reg) await register();
  if (!reg) throw new Error('Der Service Worker ließ sich nicht starten.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Ohne Erlaubnis kann die App keine Nachrichten schicken.');
  await navigator.serviceWorker.ready;
  const opts = { userVisibleOnly: true, applicationServerKey: keyBytes(key()) };
  let sub;
  try {
    sub = await reg.pushManager.subscribe(opts);
  } catch (e) {
    // Altes Abo mit anderem Schlüssel: abmelden und neu anmelden.
    const old = await reg.pushManager.getSubscription();
    if (!old) throw e;
    await old.unsubscribe();
    sub = await reg.pushManager.subscribe(opts);
  }
  const j = sub.toJSON();
  return { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth };
}

export async function unsubscribe() {
  if (!reg) await register();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return null;
  const { endpoint } = sub;
  await sub.unsubscribe();
  return endpoint;
}

export async function current() {
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const j = sub.toJSON();
  return { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth };
}
