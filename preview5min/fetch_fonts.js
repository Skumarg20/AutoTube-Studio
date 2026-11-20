import fs from 'fs';
const get = async (u, o) => { const r = await fetch(u, o); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r; };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const fams = ['family=Anton', 'family=Inter:wght@500;700;900', 'family=Special+Elite', 'family=IM+Fell+English:ital@0;1', 'family=JetBrains+Mono:wght@400;700', 'family=Cormorant+Garamond:ital,wght@0,600;1,500', 'family=Bebas+Neue'];
let out = '', n = 0; fs.mkdirSync('fonts', { recursive: true });
for (const f of fams) {
  let css = await (await get(`https://fonts.googleapis.com/css2?${f}&display=block`, { headers: { 'User-Agent': UA } })).text();
  css = css.split('/*').filter(b => !b.trim() || /^\s*latin(-ext)?\s*\*\//.test(b)).map(b => b.trim() ? '/*' + b : b).join('');
  for (const u of [...new Set(css.match(/https:\/\/[^)]+/g) || [])]) { const name = `f${n++}.woff2`; fs.writeFileSync('fonts/' + name, Buffer.from(await (await get(u)).arrayBuffer())); css = css.split(u).join('fonts/' + name); }
  out += css;
}
fs.writeFileSync('fonts.css', out); console.log('font files', n);
