// Strompreis von Tibber: Antwort lesen, Zwischenspeicher nur neu abrufen, wenn nötig.
import { tibberRows, pricesFresh } from '../supabase/functions/push/index.ts';
const json = { data: { viewer: { homes: [{ currentSubscription: null }, { currentSubscription: { priceInfo: { today: [{ total: 0.2831, startsAt: '2026-11-21T00:00:00.000+01:00' }, { total: 0.2795, startsAt: '2026-11-21T00:15:00.000+01:00' }], tomorrow: [] } } }] } } };
console.log('Zeilen:', JSON.stringify(tibberRows(json)), '| leer:', tibberRows({}).length);
const now = Date.parse('2026-11-21T10:00:00Z');
console.log('frisch:', pricesFresh({ tag: '2026-11-21', stand: '2026-11-21T09:45:00Z', preise: [] }, '2026-11-21', now), pricesFresh({ tag: '2026-11-21', stand: '2026-11-21T09:00:00Z', preise: [] }, '2026-11-21', now), pricesFresh({ tag: '2026-11-21', stand: '2026-11-21T05:00:00Z', preise: [], morgen: true }, '2026-11-21', now), pricesFresh({ tag: '2026-11-20', stand: '2026-11-20T15:00:00Z', preise: [], morgen: true }, '2026-11-21', now));
