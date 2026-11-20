// Company knowledge base (Tandem / "radar" KB, e.g. https://radar.margbooks.com): product facts for scripts and ideas.
// Settings in config/.env: KB_URL, KB_EMAIL, KB_PASSWORD. A channel uses it when its flow has kb: true.
// Login: POST /api/auth/login (cookie session; every request carries the header X-Radar-CSRF: 1).
// Search: POST /api/knowledge/search {query, top_k} -> {results: [{text, filename, similarity, metadata.question, ...}]}.

const H = { 'Content-Type': 'application/json', 'X-Radar-CSRF': '1' };
let cookie = '', loggedAt = 0;

export const kbReady = () => !!(process.env.KB_URL && process.env.KB_EMAIL && process.env.KB_PASSWORD);
const base = () => String(process.env.KB_URL || '').replace(/\/+$/, '');

async function login() {
  const r = await fetch(base() + '/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: process.env.KB_EMAIL, password: process.env.KB_PASSWORD }), signal: AbortSignal.timeout(30000) });
  const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie') || ''];
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.ok) throw new Error('knowledge base login failed (' + r.status + ' ' + (body.error || '') + ')');
  cookie = set.map(c => c.split(';')[0]).filter(Boolean).join('; '); loggedAt = Date.now();
}

async function call(p, payload) {
  if (!cookie || Date.now() - loggedAt > 6 * 3600e3) await login();
  for (let a = 0; a < 2; a++) {
    const r = await fetch(base() + p, { method: 'POST', headers: { ...H, Cookie: cookie }, body: JSON.stringify(payload), signal: AbortSignal.timeout(90000) });
    if (r.status === 401 && a === 0) { await login(); continue; }
    if (!r.ok) throw new Error('knowledge base ' + p + ' HTTP ' + r.status);
    return r.json();
  }
}

export async function search(query, topK = 6) {
  const j = await call('/api/knowledge/search', { query: String(query).slice(0, 1500), top_k: topK });
  return (j.results || []).map(x => ({ text: String(x.text || '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim(), q: x.metadata?.question || x.filename || '', score: +x.similarity || 0, builtin: !!x.is_builtin }))
    .filter(x => !x.builtin && x.text);
}

// A block of product facts for a prompt: a few searches around the topic, best passages first, de-duplicated, capped.
export async function factsFor(queries, { max = 9000, maxQueries = 4, log = () => {} } = {}) {
  if (!kbReady()) return '';
  const seen = new Set(), picked = [];
  for (const q of queries.filter(Boolean).slice(0, maxQueries)) {
    try { for (const r of await search(q, 6)) { const k = r.text.slice(0, 160); if (!seen.has(k) && r.score >= 0.45) { seen.add(k); picked.push(r); } } }
    catch (e) { log('knowledge base: ' + e.message); break; }
  }
  picked.sort((a, b) => b.score - a.score);
  let out = '', n = 0;
  for (const r of picked) { const s = `\n[${++n}] ${r.q}\n${r.text.slice(0, 1800)}\n`; if (out.length + s.length > max) break; out += s; }
  if (n) log(`knowledge base: ${n} passage(s): ` + picked.slice(0, n).map(r => r.q.slice(0, 60)).join(' | '));
  else log('knowledge base: nothing relevant found');
  return out.trim();
}

export const KB_RULES = `PRODUCT KNOWLEDGE BASE (from the company's own help centre and documentation; the most reliable source on what the product does and how):
- Use these passages for every feature, menu name, step and claim about the product. Prefer them over your memory and over third-party pages.
- Never invent features, prices, offers, numbers, awards or testimonials. If a passage is old or unclear, leave the claim out (or check the official website).
- Wherever sources are asked for, cite the passages you used as "KB: <passage title>" (they have no URL), next to any web pages.`;

// one long request (e.g. an ideas prompt with a list of segments and pains) -> several focused searches
export function queriesFrom(text, product = '') {
  const parts = String(text || '').split(/\r?\n|;|•/).map(s => s.replace(/^[\s\-*\d.)]+/, '').trim()).filter(s => s.length > 12);
  const pref = product ? product + ' ' : '';
  return [String(text || '').slice(0, 400), ...parts.slice(0, 12).map(s => pref + s.slice(0, 200))];
}
