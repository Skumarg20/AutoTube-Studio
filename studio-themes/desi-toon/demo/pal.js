// Desi Toon: palette and colour helpers. Flat colours only; one darker "shadow side" per shape, no outlines, no gradients on characters.
export const SKIN = { fair: '#EDC29E', light: '#DDA57A', wheat: '#C98B5E', tan: '#A9693F', deep: '#7D4A2C' };
export const HAIR = { black: '#1E1714', brown: '#3B2418', grey: '#B9B3AE', white: '#E9E4DE' };
export const INK = '#1A1412';
export const EYEW = '#FFFFFF';
export const TEXT = { white: '#FFFFFF', yellow: '#FFD23F', dark: '#141018' };

export function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
export function rgb2hex([r, g, b]) { const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); return '#' + c(r) + c(g) + c(b); }
// k < 0 darkens, k > 0 lightens (towards white)
export function shade(h, k) { const c = hex2rgb(h); return rgb2hex(c.map(v => k < 0 ? v * (1 + k) : v + (255 - v) * k)); }
export function mix(a, b, k) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * k)); }
export function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }

// deterministic helpers (no Math.random in films)
export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = k => (k = clamp(k), k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
export const easeOut = k => 1 - (1 - clamp(k)) ** 3;
export const easeBack = k => { k = clamp(k); const c = 1.70158; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
