// Hier die Zugangsdaten deines Supabase-Projekts eintragen.
// Beide Werte stehen im Supabase-Dashboard unter "Connect" oder "Settings > API Keys".
// Der Publishable Key (früher "anon key") darf öffentlich sein. Geschützt sind die Daten
// durch die Anmeldung und die Regeln aus supabase/schema.sql.
// Bleiben die Felder leer, läuft die App im Demo-Modus und speichert nur auf diesem Gerät.

window.ESSENSPLAN_CONFIG = {
  supabaseUrl: 'https://jwoxzihlmrmeoltkodhd.supabase.co',   // z. B. 'https://abcdefghijkl.supabase.co'
  supabaseKey: 'sb_publishable_9W0pUrPVm_XaLuzhM0EXFg_VR6waRj8',   // z. B. 'sb_publishable_...'
  // Öffentlicher Schlüssel für Push-Nachrichten. Erzeugt mit push-einrichten.html.
  // Der private Schlüssel gehört NICHT hierher, sondern nur in die Secrets der Supabase-Funktion.
  vapidPublicKey: 'BCMwSOB6axgLNEFWpcqMfJCVoZvA6gxyI0h3jfn_OhJxPZxEEvz-sain83aUuAVsQ0dcgdcHe74f0bh49Z4qjM0',
};
