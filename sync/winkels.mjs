// Slimme Boodschappen – wekelijks alle supermarktfilialen in Nederland ophalen uit OpenStreetMap (ODbL)
// Resultaat: data/winkels.json. De app zoekt hierin, zodat hij niet afhankelijk is van een live Overpass-aanroep.
import { writeFileSync } from 'node:fs';
const CHAINS = [
  ['ah', /albert\s*heijn|^ah(\s|$)/i], ['jumbo', /jumbo/i], ['lidl', /lidl/i], ['aldi', /aldi/i], ['plus', /^plus(\s|$)/i],
  ['dirk', /^dirk/i], ['deka', /deka/i], ['hoogvliet', /hoogvliet/i], ['poiesz', /poiesz/i], ['vomar', /vomar/i],
  ['ekoplaza', /ekoplaza/i], ['spar', /^spar/i], ['coop', /^coop|co-op/i], ['nettorama', /nettorama/i], ['janlinders', /jan linders/i]
];
const chainOf = t => { for (const [k, re] of CHAINS) if (re.test((t || '').trim())) return k; return null; };
const Q = '[out:json][timeout:180];area["ISO3166-1"="NL"][admin_level=2]->.nl;nwr["shop"="supermarket"](area.nl);out center tags;';
const EPS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
let data = null;
for (let round = 0; round < 3 && !data; round++) for (const ep of EPS) {
  try {
    const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(Q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SlimmeBoodschappen/2.0 (github.com/frenkie1973/slimme-boodschappen)' } });
    if (r.ok) { data = await r.json(); console.log('Bron:', ep); break; }
    console.log(ep, 'HTTP', r.status);
  } catch (e) { console.log(ep, e.message); }
  if (!data) await new Promise(r => setTimeout(r, 20000));
}
if (!data) { console.error('Geen Overpass-server bereikbaar; bestaand bestand blijft staan.'); process.exit(1); }
const stores = [];
for (const e of data.elements) {
  const t = e.tags || {}; const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  const c = chainOf(t.brand) || chainOf(t.name); if (!c || lat == null) continue;
  stores.push({ c, n: t.name || t.brand, lat: +lat.toFixed(5), lon: +lon.toFixed(5),
    a: [t['addr:street'] && `${t['addr:street']} ${t['addr:housenumber'] || ''}`.trim(), t['addr:city']].filter(Boolean).join(', ') });
}
if (stores.length < 3000) { console.error(`Te weinig winkels (${stores.length}); bestaand bestand blijft staan.`); process.exit(1); }
stores.sort((a, b) => a.c.localeCompare(b.c) || a.lat - b.lat);
writeFileSync('../data/winkels.json', JSON.stringify({ bron: '© OpenStreetMap-bijdragers (ODbL)', bijgewerkt: new Date().toISOString(), aantal: stores.length, winkels: stores }));
console.log(`Klaar: ${stores.length} supermarkten opgeslagen.`);
