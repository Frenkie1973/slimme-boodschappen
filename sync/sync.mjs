// Slimme Boodschappen – dagelijkse synchronisatie van aanbiedingen (PrijsProfeet API)
// Draait in GitHub Actions. Schrijft naar Firestore (niet openbaar; alleen ingelogde, goedgekeurde gebruikers kunnen lezen).
import admin from 'firebase-admin';

const BASE = 'https://www.prijsprofeet.nl/api/v1';
const KEY = process.env.PRIJSPROFEET_API_KEY || '';
const UA = 'SlimmeBoodschappen/2.0 (+https://github.com/frenkie1973/slimme-boodschappen)';
// PrijsProfeet-ketencode -> app-ketencode
export const RETAILERS = {
  albert_heijn: 'ah', jumbo: 'jumbo', lidl: 'lidl', plus: 'plus', aldi: 'aldi', dirk: 'dirk',
  dekamarkt: 'deka', hoogvliet: 'hoogvliet', poiesz: 'poiesz', vomar: 'vomar', ekoplaza: 'ekoplaza'
};
const PAGE_SIZE = 100;
const DELAY_MS = KEY ? 600 : 2300;          // zonder key: max 30 req/min op lijst-endpoints
const CHUNK_BYTES = 700_000;               // Firestore-document max 1 MB
const sleep = ms => new Promise(r => setTimeout(r, ms));
const todayNL = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);

export function compact(p) {
  return {
    id: p.product_id, n: p.name, b: p.brand || null, p: p.price ?? null, op: p.original_price ?? null,
    q: p.quantity || null, up: p.unit_price ?? null, uu: p.unit || null,
    pt: p.promotion_type || null, mq: p.multi_buy_quantity ?? null, mp: p.multi_buy_price ?? null,
    lp: p.loyalty_price ?? null, lprog: p.loyalty_program || null, max: p.max_per_customer ?? null,
    kw: (p.promotional_keywords || []).slice(0, 4), vf: p.valid_from || null, vu: p.valid_until || null,
    st: p.promotion_status || null, ins: !!p.in_store_only, url: p.product_url || null, cat: p.unified_category || null,
    ean: p.ean || null
  };
}

async function getJson(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json', ...(KEY ? { 'X-API-Key': KEY } : {}) } });
    if (r.status === 429 || r.status >= 500) { await sleep(15000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} bij ${url.replace(BASE, '')}`);
    return r.json();
  }
  throw new Error(`Na 5 pogingen geen antwoord: ${url.replace(BASE, '')}`);
}

export async function fetchRetailer(code) {
  const out = new Map(); const today = todayNL();
  for (let page = 1; page <= 200; page++) {
    const j = await getJson(`${BASE}/products?retailer=${code}&is_promotional=true&page=${page}&page_size=${PAGE_SIZE}`);
    const list = j.products || [];
    for (const p of list) {
      if (!p.product_id || p.price == null) continue;
      if (p.valid_until && p.valid_until < today) continue;                 // verlopen
      if (!['active', 'upcoming'].includes(p.promotion_status)) continue;
      out.set(p.product_id, compact(p));                                    // ontdubbelen
    }
    if (!list.length || page * PAGE_SIZE >= (j.total || 0)) break;
    await sleep(DELAY_MS);
  }
  return [...out.values()];
}

export function chunk(items) {
  const chunks = []; let cur = [], size = 2;
  for (const it of items) {
    const s = JSON.stringify(it).length + 1;
    if (size + s > CHUNK_BYTES && cur.length) { chunks.push(cur); cur = []; size = 2; }
    cur.push(it); size += s;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

function nextRun() {
  const now = new Date(); const c = [];
  for (const d of [0, 1]) for (const h of [4, 16]) { const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d, h, 15)); if (t > now) c.push(t); }
  return c.sort((a, b) => a - b)[0].toISOString();
}

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Secret FIREBASE_SERVICE_ACCOUNT ontbreekt');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();
  const started = new Date().toISOString();
  const cfg = (await db.doc('meta/config').get()).data() || {};
  const disabled = new Set(cfg.disabled || []);
  const prev = (await db.doc('meta/status').get()).data() || {};
  const perRetailer = { ...(prev.perRetailer || {}) };
  const errors = [];
  let okCount = 0;

  for (const [code, key] of Object.entries(RETAILERS)) {
    if (disabled.has(key) || disabled.has('prijsprofeet')) { perRetailer[key] = { ...(perRetailer[key] || {}), state: 'uitgeschakeld' }; continue; }
    try {
      const items = await fetchRetailer(code);
      const chunks = chunk(items);
      const existing = await db.collection('offers').where('chain', '==', key).get();
      const batch = db.batch();
      const syncedAt = new Date().toISOString();
      chunks.forEach((c, i) => batch.set(db.doc(`offers/${key}_${i}`), { chain: key, part: i, parts: chunks.length, syncedAt, items: c }));
      existing.docs.filter(d => d.data().part >= chunks.length).forEach(d => batch.delete(d.ref));
      await batch.commit();
      perRetailer[key] = { state: 'ok', count: items.length, lastSuccess: syncedAt, error: null };
      okCount++;
      console.log(`✔ ${key}: ${items.length} aanbiedingen in ${chunks.length} delen`);
    } catch (e) {
      perRetailer[key] = { ...(perRetailer[key] || {}), state: 'fout', error: String(e.message || e), lastAttempt: new Date().toISOString() };
      errors.push({ chain: key, at: new Date().toISOString(), message: String(e.message || e) });
      console.error(`✘ ${key}: ${e.message || e}`);
    }
    await sleep(DELAY_MS);
  }

  const total = Object.values(perRetailer).reduce((s, r) => s + (r.state === 'ok' ? r.count || 0 : 0), 0);
  const run = { started, finished: new Date().toISOString(), ok: okCount, failed: errors.length, total };
  await db.doc('meta/status').set({
    source: 'PrijsProfeet API (gratis laag' + (KEY ? ', met key' : ', zonder key') + ')',
    lastAttempt: run.finished,
    lastSuccess: okCount ? run.finished : (prev.lastSuccess || null),
    nextPlanned: nextRun(),
    totalOffers: total,
    perRetailer,
    lastErrors: [...errors, ...(prev.lastErrors || [])].slice(0, 30),
    runs: [run, ...(prev.runs || [])].slice(0, 20)
  }, { merge: false });
  console.log(`Klaar: ${okCount} ketens ok, ${errors.length} fouten, ${total} aanbiedingen.`);
  if (!okCount) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
