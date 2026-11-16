// AutoTube Studio illustration kit: drawn props + an animated character rig, rendered in several skins
// (whiteboard draw-on, flat cartoon, rubber-hose retro, paper cut-out). Deterministic: everything is a function of t.
window.ILLUS = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; document.documentElement.appendChild(svg);
  const PC = new Map();
  function P(d) { let c = PC.get(d); if (!c) { const e = document.createElementNS(NS, 'path'); e.setAttribute('d', d); svg.appendChild(e); let len = 1; try { len = e.getTotalLength() || 1; } catch {} c = { p: new Path2D(d), len, e }; PC.set(d, c); } return c; }
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------------- palettes per skin ----------------
  const BASE = { skin: '#f1c29b', skin2: '#c98c5a', skin3: '#8d5a3a', c1: '#e4573d', c2: '#3a78d4', c3: '#f2bf3a', c4: '#3fa36b', c5: '#8a4fbf', dark: '#2d2a32', light: '#ffffff', gold: '#f4b630', wood: '#a8713f', sand: '#e8c886', water: '#5aaee6', stone: '#a7a39b', green: '#57a957', red: '#d8402f', sky: '#bfe3ff', cloth: '#f3ead6', metal: '#9aa4ad', orange: '#f08a2c', khaki: '#c2a46b' };
  const GREY = k => { const m = { skin: '#f4f1ea', skin2: '#e2ddd2', skin3: '#cfc8ba', c1: '#57514c', c2: '#8a8279', c3: '#c9c1b3', c4: '#a39b8f', c5: '#6b645d', dark: '#151413', light: '#fbf8f1', gold: '#d7cdb8', wood: '#6e675f', sand: '#d9d0bf', water: '#8f8a83', stone: '#a49d92', green: '#6f6a63', red: '#2b2826', sky: '#ece5d6', cloth: '#efe8da', metal: '#9b958c', orange: '#8a847b', khaki: '#b5ad9e' }; return m[k] || '#888'; };
  const PAPER = { skin: '#f0bf94', skin2: '#c8875a', skin3: '#8a5636', c1: '#e05a47', c2: '#3f7fc9', c3: '#f0c04a', c4: '#4da46f', c5: '#8d5bc0', dark: '#3a3438', light: '#fffdf7', gold: '#efb63a', wood: '#b07a48', sand: '#ecd29a', water: '#69b2e0', stone: '#b5b0a6', green: '#62ad62', red: '#d9473a', sky: '#cde8fa', cloth: '#f5eedd', metal: '#a3acb4', orange: '#f19544', khaki: '#c9ad76' };
  const SKINS = {
    whiteboard: { col: k => BASE[k] || k, ink: '#1c1c1f', lw: 3.2, fillA: .82, outline: true },
    cartoon: { col: k => BASE[k] || k, ink: '#2a2737', lw: 2.6, fillA: 1, outline: true },
    // 80s cel animation: saturated paints, thick violet ink, hard two-tone cel shading, big glossy eyes
    cel: { col: k => ({ skin: '#f7c8a2', skin2: '#e3a576', skin3: '#a9663f', c1: '#ff3d6e', c2: '#2f6bff', c3: '#ffc63a', c4: '#18c48f', c5: '#9b4dff', dark: '#24123d', light: '#fff8f0', red: '#ff3d4f', sky: '#8fd8ff', metal: '#a9b8c9', gold: '#ffbf2e', orange: '#ff8a2a', green: '#3fd06a', wood: '#b8733a', stone: '#9aa3b5' }[k] || BASE[k] || k), ink: '#2b1055', lw: 3.4, fillA: 1, outline: true, cel: true },
    rubberhose: { col: GREY, ink: '#111', lw: 3.6, fillA: 1, outline: true, hose: true },
    paper: { col: k => PAPER[k] || k, ink: null, lw: 0, fillA: 1, outline: false, paper: true },
    shadow: { col: k => '#140a04', ink: '#140a04', lw: 1, fillA: 1, outline: true },
    clay: { col: k => ({ skin: '#f3efe8', skin2: '#ece7de', skin3: '#e3ddd2', dark: '#b9b3a8', red: '#ff5a36', c1: '#ff5a36' }[k] || '#f4f2ee'), ink: 'rgba(60,55,50,.35)', lw: 1.6, fillA: 1, outline: true },
  };

  // ---------------- props: 100x100 box, bottom-centre anchor (50,100). parts: [colour role or 'line', svg path, line width?] ----------------
  const I = {
    camel: [['sand', 'M14 58 Q16 44 30 46 Q36 26 47 40 Q52 30 60 42 Q66 38 70 46 L76 40 Q80 22 88 26 Q94 28 92 34 L86 36 Q84 50 78 58 Q70 64 56 64 L30 64 Q18 64 14 58 Z'], ['line', 'M26 62 L23 99 M34 63 L36 99 M64 62 L62 99 M72 60 L75 99', 5], ['line', 'M14 56 Q8 60 9 70', 2], ['dark', 'M88 29 a1.6 1.6 0 1 0 0.1 0 Z']],
    horse: [['wood', 'M16 52 Q18 40 34 40 L66 40 Q72 26 80 22 L90 26 L92 34 L84 34 Q80 46 78 56 Q74 62 64 62 L30 62 Q18 62 16 52 Z'], ['dark', 'M72 24 Q70 36 64 42 L68 42 Q74 34 78 24 Z'], ['line', 'M26 60 L22 99 M34 61 L36 99 M64 60 L62 99 M72 58 L76 99', 5], ['line', 'M16 50 Q6 56 8 72', 3]],
    elephant: [['stone', 'M14 66 Q12 36 40 34 Q62 32 70 44 Q84 40 86 56 Q88 70 82 82 L78 80 Q80 66 76 60 Q74 66 70 68 L30 68 Q16 70 14 66 Z'], ['stone', 'M60 40 Q50 36 52 52 Q54 60 64 56 Z'], ['line', 'M24 66 L22 99 M36 68 L36 99 M58 68 L58 99 M68 66 L70 99', 8], ['dark', 'M74 48 a1.8 1.8 0 1 0 0.1 0 Z']],
    ship: [['wood', 'M8 72 L92 72 L82 92 L18 92 Z'], ['line', 'M50 72 L50 14', 3], ['cloth', 'M52 18 Q74 30 70 66 L52 66 Z'], ['cloth', 'M48 24 Q30 36 32 66 L48 66 Z'], ['red', 'M50 14 L64 18 L50 22 Z'], ['water', 'M0 96 Q12 90 25 96 T50 96 T75 96 T100 96 L100 100 L0 100 Z']],
    boat: [['wood', 'M14 80 L86 80 Q80 96 50 96 Q20 96 14 80 Z'], ['line', 'M50 80 L50 40', 3], ['cloth', 'M52 42 L76 74 L52 74 Z'], ['water', 'M0 97 Q12 92 25 97 T50 97 T75 97 T100 97 L100 100 L0 100 Z']],
    cart: [['wood', 'M18 56 L82 56 L78 76 L22 76 Z'], ['cloth', 'M24 56 Q50 30 76 56 Z'], ['dark', 'M34 88 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 Z'], ['dark', 'M68 88 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 Z'], ['line', 'M82 64 L98 70', 3]],
    train: [['c1', 'M8 44 L56 44 L56 84 L8 84 Z'], ['dark', 'M56 56 L90 56 L94 84 L56 84 Z'], ['dark', 'M70 30 L80 30 L80 56 L70 56 Z'], ['light', 'M14 50 L28 50 L28 62 L14 62 Z M34 50 L48 50 L48 62 L34 62 Z'], ['dark', 'M24 92 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M46 92 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M78 92 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z'], ['stone', 'M74 10 Q88 4 92 16 Q84 22 76 20 Z']],
    fort: [['sand', 'M10 100 L10 46 L18 46 L18 40 L26 40 L26 46 L36 46 L36 40 L44 40 L44 46 L56 46 L56 40 L64 40 L64 46 L74 46 L74 40 L82 40 L82 46 L90 46 L90 100 Z'], ['sand', 'M40 46 L40 22 L46 22 L46 16 L54 16 L54 22 L60 22 L60 46 Z'], ['dark', 'M42 100 L42 76 Q50 66 58 76 L58 100 Z'], ['red', 'M50 16 L50 4 L62 8 L50 12 Z']],
    palace: [['cloth', 'M14 100 L14 56 L86 56 L86 100 Z'], ['cloth', 'M30 56 Q30 30 50 22 Q70 30 70 56 Z'], ['gold', 'M48 22 L50 10 L52 22 Z'], ['cloth', 'M4 100 L4 44 L12 44 L12 100 Z M88 100 L88 44 L96 44 L96 100 Z'], ['c1', 'M6 44 Q8 36 8 30 Q8 36 10 44 Z M90 44 Q92 36 92 30 Q92 36 94 44 Z'], ['dark', 'M42 100 L42 78 Q50 68 58 78 L58 100 Z']],
    temple: [['stone', 'M6 100 L6 92 L94 92 L94 100 Z'], ['stone', 'M14 92 L14 50 L86 50 L86 92 Z'], ['c1', 'M8 50 L50 22 L92 50 Z'], ['light', 'M20 54 L26 54 L26 90 L20 90 Z M37 54 L43 54 L43 90 L37 90 Z M57 54 L63 54 L63 90 L57 90 Z M74 54 L80 54 L80 90 L74 90 Z']],
    pyramid: [['sand', 'M4 100 L50 18 L96 100 Z'], ['dark', 'M50 18 L96 100 L64 100 Z']],
    hut: [['wood', 'M18 100 L18 62 L82 62 L82 100 Z'], ['khaki', 'M8 66 L50 30 L92 66 Z'], ['dark', 'M42 100 L42 76 L58 76 L58 100 Z']],
    house: [['cloth', 'M18 100 L18 56 L82 56 L82 100 Z'], ['c1', 'M10 58 L50 24 L90 58 Z'], ['c2', 'M26 66 L40 66 L40 80 L26 80 Z M60 66 L74 66 L74 80 L60 80 Z'], ['wood', 'M44 100 L44 78 L56 78 L56 100 Z']],
    city: [['stone', 'M2 100 L2 58 L18 58 L18 100 Z'], ['cloth', 'M18 100 L18 40 L36 40 L36 100 Z'], ['sand', 'M36 100 L36 66 Q46 50 56 66 L56 100 Z'], ['stone', 'M56 100 L56 30 L68 30 L68 100 Z'], ['cloth', 'M68 100 L68 50 L86 50 L86 100 Z'], ['sand', 'M86 100 L86 62 L98 62 L98 100 Z'], ['gold', 'M46 52 L46 40 L48 52 Z']],
    wall: [['stone', 'M0 100 L0 56 L8 56 L8 48 L16 48 L16 56 L24 56 L24 48 L32 48 L32 56 L40 56 L40 48 L48 48 L48 56 L56 56 L56 48 L64 48 L64 56 L72 56 L72 48 L80 48 L80 56 L88 56 L88 48 L96 48 L96 56 L100 56 L100 100 Z'], ['line', 'M0 72 L100 72 M0 86 L100 86 M20 56 L20 72 M50 56 L50 72 M80 56 L80 72 M35 72 L35 86 M65 72 L65 86', 1.5]],
    tower: [['stone', 'M34 100 L38 30 L62 30 L66 100 Z'], ['stone', 'M30 30 L30 20 L36 20 L36 26 L46 26 L46 20 L54 20 L54 26 L64 26 L64 20 L70 20 L70 30 Z'], ['dark', 'M46 50 L54 50 L54 62 L46 62 Z']],
    coin: [['gold', 'M50 70 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0 Z'], ['line', 'M50 70 m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0 Z', 2], ['line', 'M44 62 L56 62 M50 58 L50 82 M44 82 L56 82', 3]],
    coins: [['gold', 'M20 96 L20 84 L60 84 L60 96 Z'], ['gold', 'M24 84 L24 72 L64 72 L64 84 Z'], ['gold', 'M18 72 L18 60 L58 60 L58 72 Z'], ['gold', 'M64 82 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0 Z']],
    goldbar: [['gold', 'M14 96 L22 76 L78 76 L86 96 Z'], ['gold', 'M28 76 L36 58 L64 58 L72 76 Z']],
    moneybag: [['khaki', 'M30 46 Q8 70 22 92 Q50 104 78 92 Q92 70 70 46 Z'], ['khaki', 'M36 46 L30 30 L44 36 L50 28 L56 36 L70 30 L64 46 Z'], ['line', 'M44 62 Q38 68 46 72 Q56 76 50 82 Q44 86 40 80 M48 58 L48 88', 3]],
    chest: [['wood', 'M12 60 L88 60 L88 96 L12 96 Z'], ['wood', 'M12 60 Q12 36 50 36 Q88 36 88 60 Z'], ['gold', 'M44 56 L56 56 L56 70 L44 70 Z'], ['line', 'M12 60 L88 60', 3]],
    crown: [['gold', 'M14 90 L10 44 L30 64 L50 34 L70 64 L90 44 L86 90 Z'], ['red', 'M50 70 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z'], ['c2', 'M28 78 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z M72 78 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z']],
    sword: [['metal', 'M47 10 L53 10 L54 70 L46 70 Z'], ['gold', 'M34 70 L66 70 L66 76 L34 76 Z'], ['wood', 'M46 76 L54 76 L54 94 L46 94 Z'], ['gold', 'M50 98 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z']],
    shield: [['c1', 'M20 26 Q50 16 80 26 Q82 70 50 98 Q18 70 20 26 Z'], ['gold', 'M50 30 L50 88 M26 50 L74 50', 0], ['line', 'M50 30 L50 88 M28 48 L72 48', 4]],
    spear: [['line', 'M50 98 L50 22', 4], ['metal', 'M50 4 L58 24 L42 24 Z']],
    cannon: [['dark', 'M20 64 L80 40 L86 54 L26 78 Z'], ['wood', 'M30 70 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0 Z'], ['dark', 'M30 70 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z']],
    scroll: [['cloth', 'M20 30 L80 30 L80 86 L20 86 Z'], ['wood', 'M14 26 L86 26 L86 34 L14 34 Z M14 82 L86 82 L86 90 L14 90 Z'], ['line', 'M30 46 L70 46 M30 56 L66 56 M30 66 L70 66', 2]],
    book: [['c2', 'M14 40 L50 46 L50 94 L14 88 Z'], ['c1', 'M86 40 L50 46 L50 94 L86 88 Z'], ['line', 'M50 46 L50 94', 2]],
    letter: [['cloth', 'M14 46 L86 46 L86 92 L14 92 Z'], ['line', 'M14 46 L50 74 L86 46', 2], ['red', 'M50 76 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z']],
    quill: [['cloth', 'M70 8 Q90 20 70 56 L48 90 L46 86 Q52 40 70 8 Z'], ['line', 'M48 90 L40 100', 2]],
    compass: [['gold', 'M50 62 m-34 0 a34 34 0 1 0 68 0 a34 34 0 1 0 -68 0 Z'], ['light', 'M50 62 m-27 0 a27 27 0 1 0 54 0 a27 27 0 1 0 -54 0 Z'], ['red', 'M50 36 L56 62 L44 62 Z'], ['dark', 'M50 88 L56 62 L44 62 Z']],
    globe: [['water', 'M50 56 m-36 0 a36 36 0 1 0 72 0 a36 36 0 1 0 -72 0 Z'], ['green', 'M30 40 Q42 34 46 44 Q40 54 46 62 Q36 70 28 60 Q24 50 30 40 Z M58 48 Q70 40 78 52 Q76 70 64 76 Q58 66 62 58 Z'], ['wood', 'M46 92 L54 92 L58 100 L42 100 Z']],
    flag: [['line', 'M24 100 L24 10', 4], ['c1', 'M26 12 Q46 6 56 14 Q68 22 82 14 L82 46 Q68 54 56 46 Q46 38 26 44 Z']],
    sack: [['khaki', 'M28 40 Q10 70 22 94 Q50 102 78 94 Q90 70 72 40 Z'], ['khaki', 'M32 40 L28 28 L72 28 L68 40 Z'], ['line', 'M30 40 L70 40', 3]],
    barrel: [['wood', 'M26 30 Q20 64 26 96 L74 96 Q80 64 74 30 Z'], ['line', 'M24 44 L76 44 M22 64 L78 64 M24 84 L76 84', 3]],
    crate: [['wood', 'M16 44 L84 44 L84 96 L16 96 Z'], ['line', 'M16 44 L84 96 M84 44 L16 96 M16 70 L84 70', 3]],
    amphora: [['orange', 'M42 20 L58 20 L60 34 Q82 52 66 86 L56 96 L44 96 L34 86 Q18 52 40 34 Z'], ['line', 'M40 30 Q28 30 30 46 M60 30 Q72 30 70 46', 3]],
    teacup: [['light', 'M22 58 L78 58 Q76 92 50 94 Q24 92 22 58 Z'], ['line', 'M78 64 Q94 66 88 80 Q84 86 74 84', 3], ['wood', 'M24 60 L76 60 L74 66 L26 66 Z'], ['line', 'M40 50 Q36 42 42 36 M54 50 Q50 40 56 32', 2]],
    silk: [['c5', 'M14 52 L74 52 L74 92 L14 92 Z'], ['c5', 'M74 72 m-12 0 a12 20 0 1 0 24 0 a12 20 0 1 0 -24 0 Z'], ['line', 'M14 62 Q40 58 74 62 M14 76 Q40 72 74 76', 1.5], ['c3', 'M74 92 L96 100 L60 100 Z']],
    spice: [['orange', 'M10 98 Q30 60 50 64 Q70 60 90 98 Z'], ['red', 'M28 98 Q40 78 52 80 Q60 78 70 98 Z'], ['wood', 'M4 98 L96 98 L90 100 L10 100 Z']],
    salt: [['light', 'M8 98 Q30 52 50 50 Q70 52 92 98 Z'], ['line', 'M30 80 l2 2 M46 66 l2 2 M62 74 l2 2 M56 88 l2 2 M38 90 l2 2', 2]],
    wheat: [['line', 'M50 100 L50 30', 3], ['gold', 'M50 30 Q40 24 44 14 Q54 20 50 30 Z M50 44 Q38 40 40 30 Q52 34 50 44 Z M50 44 Q62 40 60 30 Q48 34 50 44 Z M50 58 Q38 54 40 44 Q52 48 50 58 Z M50 58 Q62 54 60 44 Q48 48 50 58 Z']],
    tree: [['wood', 'M44 100 L46 60 L54 60 L56 100 Z'], ['green', 'M50 64 m-30 0 a30 26 0 1 0 60 0 a30 26 0 1 0 -60 0 Z M50 36 m-22 0 a22 20 0 1 0 44 0 a22 20 0 1 0 -44 0 Z']],
    palm: [['wood', 'M48 100 Q44 70 52 36 L56 36 Q50 70 54 100 Z'], ['green', 'M54 36 Q30 20 10 36 Q30 30 54 38 Z M54 36 Q76 18 94 34 Q74 30 54 38 Z M54 36 Q46 14 30 8 Q50 18 56 36 Z M54 36 Q66 12 82 10 Q62 20 56 36 Z']],
    mountain: [['stone', 'M0 100 L36 24 L58 64 L70 44 L100 100 Z'], ['light', 'M36 24 L46 46 L40 42 L34 48 L28 40 Z']],
    sun: [['gold', 'M50 50 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 Z'], ['line', 'M50 18 L50 8 M50 82 L50 92 M18 50 L8 50 M82 50 L92 50 M27 27 L20 20 M73 73 L80 80 M73 27 L80 20 M27 73 L20 80', 4]],
    moon: [['c3', 'M60 18 Q30 22 30 54 Q30 86 62 90 Q40 76 40 54 Q40 32 60 18 Z']],
    cloud: [['light', 'M20 78 Q8 76 10 64 Q12 52 26 54 Q30 36 48 38 Q62 30 72 46 Q90 44 90 62 Q92 78 76 78 Z']],
    waves: [['water', 'M0 70 Q12 60 25 70 T50 70 T75 70 T100 70 L100 100 L0 100 Z'], ['line', 'M6 84 Q18 76 30 84 M50 88 Q62 80 74 88', 2]],
    factory: [['stone', 'M6 100 L6 56 L26 44 L26 56 L46 44 L46 56 L66 44 L66 100 Z'], ['dark', 'M70 100 L70 18 L84 18 L84 100 Z'], ['stone', 'M72 12 Q84 0 96 8 Q90 16 80 14 Z'], ['c3', 'M14 66 L24 66 L24 76 L14 76 Z M34 66 L44 66 L44 76 L34 76 Z M52 66 L62 66 L62 76 L52 76 Z']],
    chains: [['line', 'M14 60 m-10 0 a10 7 0 1 0 20 0 a10 7 0 1 0 -20 0 M34 60 m-10 0 a10 7 0 1 0 20 0 a10 7 0 1 0 -20 0 M54 60 m-10 0 a10 7 0 1 0 20 0 a10 7 0 1 0 -20 0 M74 60 m-10 0 a10 7 0 1 0 20 0 a10 7 0 1 0 -20 0', 5]],
    bars: [['line', 'M10 20 L90 20 L90 100 M10 20 L10 100 M26 20 L26 100 M42 20 L42 100 M58 20 L58 100 M74 20 L74 100 M10 56 L90 56', 5]],
    fire: [['orange', 'M50 98 Q18 92 24 62 Q30 44 40 36 Q40 52 48 54 Q46 30 62 14 Q60 40 72 52 Q84 70 74 88 Q66 98 50 98 Z'], ['c3', 'M50 98 Q36 94 38 78 Q42 68 48 64 Q50 76 56 76 Q62 70 62 62 Q70 76 64 88 Q58 98 50 98 Z']],
    skull: [['light', 'M50 22 Q20 22 20 52 Q20 66 30 72 L30 86 L70 86 L70 72 Q80 66 80 52 Q80 22 50 22 Z'], ['dark', 'M38 52 m-8 0 a8 9 0 1 0 16 0 a8 9 0 1 0 -16 0 Z M62 52 m-8 0 a8 9 0 1 0 16 0 a8 9 0 1 0 -16 0 Z M46 66 L54 66 L50 72 Z']],
    hourglass: [['wood', 'M24 14 L76 14 L76 20 L24 20 Z M24 86 L76 86 L76 92 L24 92 Z'], ['light', 'M30 20 L70 20 Q70 40 52 53 Q70 66 70 86 L30 86 Q30 66 48 53 Q30 40 30 20 Z'], ['sand', 'M36 30 L64 30 Q60 42 50 48 Q40 42 36 30 Z M34 86 Q40 70 50 68 Q60 70 66 86 Z']],
    bulb: [['c3', 'M50 14 Q24 14 24 42 Q24 56 38 66 L38 76 L62 76 L62 66 Q76 56 76 42 Q76 14 50 14 Z'], ['stone', 'M38 76 L62 76 L60 90 L40 90 Z'], ['line', 'M44 50 L50 40 L56 50', 2]],
    question: [['c1', 'M30 34 Q30 12 52 12 Q74 12 74 32 Q74 46 58 52 Q54 54 54 64 L44 64 Q44 48 56 42 Q64 38 64 32 Q64 22 52 22 Q40 22 40 34 Z M49 80 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z']],
    exclaim: [['c1', 'M42 12 L58 12 L54 66 L46 66 Z M50 82 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z']],
    scale: [['line', 'M50 96 L50 20 M18 30 L82 30 M30 96 L70 96', 4], ['gold', 'M8 56 Q18 66 28 56 Z M72 56 Q82 66 92 56 Z'], ['line', 'M18 30 L8 56 M18 30 L28 56 M82 30 L72 56 M82 30 L92 56', 1.5]],
    handshake: [['skin', 'M4 56 L30 46 L52 54 L74 46 L96 56 L96 72 L76 70 L56 82 Q46 86 40 78 L20 70 L4 72 Z'], ['c2', 'M0 50 L14 46 L16 76 L0 78 Z'], ['c1', 'M100 50 L86 46 L84 76 L100 78 Z']],
    magnifier: [['line', 'M42 42 m-24 0 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0', 6], ['light', 'M42 42 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 Z'], ['wood', 'M58 60 L66 52 L94 82 L86 90 Z']],
    tent: [['c1', 'M6 100 L50 26 L94 100 Z'], ['dark', 'M50 26 L40 100 L60 100 Z'], ['line', 'M50 26 L50 14', 2]],
    well: [['stone', 'M20 70 L80 70 L80 100 L20 100 Z'], ['wood', 'M24 70 L24 30 L30 30 L30 70 Z M70 70 L70 30 L76 30 L76 70 Z'], ['c1', 'M16 32 L50 14 L84 32 Z'], ['line', 'M50 30 L50 54', 2], ['wood', 'M44 54 L56 54 L54 64 L46 64 Z']],
    map: [['cloth', 'M8 30 L34 22 L66 30 L92 22 L92 86 L66 94 L34 86 L8 94 Z'], ['line', 'M34 22 L34 86 M66 30 L66 94', 1.5], ['line', 'M18 70 Q34 50 50 62 Q64 72 80 44', 2.5], ['red', 'M80 44 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z']],
    anchor: [['line', 'M50 18 L50 92 M34 34 L66 34 M18 66 Q22 92 50 92 Q78 92 82 66', 6], ['line', 'M50 18 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', 4]],
    bridge: [['stone', 'M0 60 L100 60 L100 70 L0 70 Z'], ['stone', 'M8 70 L20 70 Q30 46 40 70 L60 70 Q70 46 80 70 L92 70 L92 100 L80 100 Q70 80 60 100 L40 100 Q30 80 20 100 L8 100 Z']],
    tea: [['green', 'M50 96 Q20 80 22 50 Q40 52 50 70 Q48 44 60 24 Q80 46 72 72 Q66 90 50 96 Z'], ['line', 'M50 96 Q50 70 58 40', 2]],
    road: [['sand', 'M40 0 L60 0 L100 100 L0 100 Z'], ['line', 'M50 10 L50 22 M50 36 L50 52 M50 68 L50 90', 3]],
    arrowR: [['c1', 'M6 44 L66 44 L66 28 L96 52 L66 76 L66 60 L6 60 Z']],
    cane: [['wood', 'M45 14 Q47 4 58 6 Q66 10 62 20 L57 19 Q59 13 54 12 Q50 12 50 18 L52 100 L46 100 Z']],
    people: [['c2', 'M20 100 L20 70 Q20 60 28 60 Q36 60 36 70 L36 100 Z'], ['skin', 'M28 54 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z'], ['c1', 'M42 100 L42 66 Q42 56 50 56 Q58 56 58 66 L58 100 Z'], ['skin', 'M50 49 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z'], ['c4', 'M64 100 L64 70 Q64 60 72 60 Q80 60 80 70 L80 100 Z'], ['skin', 'M72 54 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z']],
    // ---- modern / everyday objects for exam-prep (real-life physics, chemistry and biology examples) ----
    ball: [['c2', 'M50 99 m-20 -20 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 Z'], ['line', 'M33 70 Q50 80 67 70', 3], ['light', 'M42 66 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z']],
    cricketball: [['red', 'M50 99 m-18 -18 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0 Z'], ['line', 'M38 66 Q50 81 38 96 M62 66 Q50 81 62 96', 2], ['light', 'M43 70 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z']],
    phone: [['dark', 'M36 34 Q36 28 42 28 L58 28 Q64 28 64 34 L64 94 Q64 99 58 99 L42 99 Q36 99 36 94 Z'], ['c2', 'M40 36 L60 36 L60 88 L40 88 Z'], ['light', 'M47 92 L53 92 L53 95 L47 95 Z']],
    car: [['c1', 'M8 86 L8 74 Q8 68 16 66 L26 64 L34 52 Q36 49 42 49 L64 49 Q70 49 74 54 L82 64 L90 67 Q94 69 94 75 L94 86 Z'], ['sky', 'M37 54 L46 54 L46 64 L30 64 Z M50 54 L66 54 Q69 54 71 57 L76 64 L50 64 Z'], ['dark', 'M28 88 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 Z M74 88 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 Z'], ['metal', 'M28 88 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z M74 88 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z']],
    bike: [['line', 'M24 82 L40 60 L62 60 L76 82 M40 60 L50 82 L62 60 M60 52 L66 52 M38 54 L46 54', 4], ['dark', 'M24 82 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 Z M76 82 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 Z'], ['light', 'M24 82 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 Z M76 82 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 Z']],
    apple: [['red', 'M50 58 Q34 46 24 62 Q16 82 34 96 Q42 100 50 96 Q58 100 66 96 Q84 82 76 62 Q66 46 50 58 Z'], ['line', 'M50 58 Q50 48 54 42', 3], ['green', 'M54 46 Q64 36 72 42 Q64 52 54 46 Z']],
    table: [['wood', 'M6 54 L94 54 L94 62 L6 62 Z'], ['line', 'M14 62 L14 99 M86 62 L86 99 M22 62 L22 92 M78 62 L78 92', 5]],
    rocket: [['light', 'M50 8 Q66 26 64 70 L36 70 Q34 26 50 8 Z'], ['c2', 'M50 34 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z'], ['red', 'M36 58 L22 80 L36 74 Z M64 58 L78 80 L64 74 Z M42 70 L58 70 L54 80 L46 80 Z'], ['orange', 'M44 80 Q50 100 56 80 Z']],
    clock: [['light', 'M50 62 m-34 0 a34 34 0 1 0 68 0 a34 34 0 1 0 -68 0 Z'], ['line', 'M50 62 L50 40 M50 62 L64 70', 4], ['line', 'M50 31 L50 35 M50 89 L50 93 M19 62 L23 62 M77 62 L81 62', 3]],
    laptop: [['dark', 'M20 40 L80 40 L80 80 L20 80 Z'], ['c2', 'M25 45 L75 45 L75 75 L25 75 Z'], ['metal', 'M8 82 L92 82 L86 92 L14 92 Z']],
    magnet: [['red', 'M22 30 L40 30 L40 66 Q40 76 50 76 Q60 76 60 66 L60 30 L78 30 L78 66 Q78 94 50 94 Q22 94 22 66 Z'], ['metal', 'M22 30 L40 30 L40 42 L22 42 Z M60 30 L78 30 L78 42 L60 42 Z']],
    battery: [['dark', 'M22 40 L78 40 L78 94 L22 94 Z'], ['gold', 'M22 40 L78 40 L78 58 L22 58 Z'], ['metal', 'M40 32 L60 32 L60 40 L40 40 Z'], ['line', 'M44 72 L56 72 M50 66 L50 78', 3]],
    flask: [['light', 'M42 20 L58 20 L58 46 L80 92 Q82 98 74 98 L26 98 Q18 98 20 92 L42 46 Z'], ['green', 'M31 72 L69 72 L79 92 Q81 96 74 96 L26 96 Q19 96 21 92 Z'], ['line', 'M40 20 L60 20', 4]],
    heart: [['red', 'M50 96 Q14 72 14 48 Q14 30 32 30 Q44 30 50 42 Q56 30 68 30 Q86 30 86 48 Q86 72 50 96 Z'], ['line', 'M28 60 L40 60 L46 50 L54 70 L60 60 L72 60', 3]],
    trophy: [['gold', 'M30 26 L70 26 L68 52 Q64 66 50 68 Q36 66 32 52 Z M44 68 L56 68 L56 82 L44 82 Z M34 84 L66 84 L66 96 L34 96 Z'], ['line', 'M30 32 Q16 32 18 44 Q20 54 32 52 M70 32 Q84 32 82 44 Q80 54 68 52', 4]],
    building: [['stone', 'M26 14 L74 14 L74 99 L26 99 Z'], ['sky', 'M33 22 L43 22 L43 32 L33 32 Z M57 22 L67 22 L67 32 L57 32 Z M33 40 L43 40 L43 50 L33 50 Z M57 40 L67 40 L67 50 L57 50 Z M33 58 L43 58 L43 68 L33 68 Z M57 58 L67 58 L67 68 L57 68 Z'], ['wood', 'M44 80 L56 80 L56 99 L44 99 Z']],
    pendulum: [['wood', 'M20 8 L80 8 L80 14 L20 14 Z'], ['line', 'M50 14 L50 74', 3], ['c1', 'M50 84 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 Z']],
  };
  const ICON_NAMES = Object.keys(I);
  function jitter(skin, t, k) { return skin === 'rubberhose' ? Math.sin(t * 9 + k) * .6 : skin === 'whiteboard' ? (hash(Math.floor(t * 8) + k) - .5) * .35 : 0; }

  // draw a list of parts at (x,y) bottom-centre, size = box height in px. p = draw-on progress (whiteboard), returns pen tip
  function drawParts(g, parts, x, y, size, skin, p, t, opt = {}) {
    const S = SKINS[skin] || SKINS.cartoon, sc = size / 100, flip = opt.flip ? -1 : 1;
    g.save(); g.translate(x, y); g.rotate(opt.rot || 0); g.scale(sc * flip * (opt.sx || 1), sc * (opt.sy || 1)); g.translate(-50, -100);
    g.lineJoin = 'round'; g.lineCap = 'round';
    let tip = null;
    if (S.paper) { // paper cut-out: white border + drop shadow, then flat fills
      g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 10; g.shadowOffsetX = 4 / sc; g.shadowOffsetY = 6 / sc;
      for (const [role, d, lw] of parts) { const c = P(d); if (role === 'line') { g.strokeStyle = '#fffdf7'; g.lineWidth = (lw || 3) + 6; g.stroke(c.p); } else { g.fillStyle = '#fffdf7'; g.fill(c.p); g.strokeStyle = '#fffdf7'; g.lineWidth = 7; g.stroke(c.p); } }
      g.restore();
      for (const [role, d, lw] of parts) { const c = P(d); if (role === 'line') { g.strokeStyle = S.col('dark'); g.lineWidth = lw || 3; g.stroke(c.p); } else { g.fillStyle = S.col(role); g.fill(c.p); } }
      g.restore(); return null;
    }
    const total = parts.reduce((a, [, d]) => a + P(d).len, 0); let drawn = total * clamp(p), acc = 0;
    // fills first (fade in once that part's outline is drawn)
    for (const [role, d] of parts) { const c = P(d); if (role !== 'line') { const done = clamp((drawn - acc) / c.len); const a = skin === 'whiteboard' ? clamp((done - .85) / .15) * S.fillA : (p >= 1 ? 1 : clamp(p * 3)); if (a > 0) { g.globalAlpha *= 1; const ga = g.globalAlpha; g.globalAlpha = ga * a; g.fillStyle = S.col(role); g.fill(c.p);
      if (S.cel) { g.save(); g.clip(c.p); g.fillStyle = 'rgba(43,16,85,.32)'; g.fillRect(-20, -20, 140, 140); g.translate(-4.5, -4.5); g.fillStyle = S.col(role); g.fill(c.p); g.restore(); }   // hard-edged cel shadow on the lower-right
      g.globalAlpha = ga; } } acc += c.len; }
    acc = 0; g.strokeStyle = S.ink;
    for (const [role, d, lw] of parts) {
      const c = P(d), seg = clamp((drawn - acc) / c.len); acc += c.len; if (seg <= 0) continue;
      const w = role === 'line' ? (lw || 3) * (S.hose ? 1.3 : 1) : S.lw; if (!w) continue; g.lineWidth = w / Math.max(.35, sc / 1.6) * Math.min(1, sc * 1.4);
      if (seg < 1) { g.setLineDash([c.len * seg, c.len * 2]); g.stroke(c.p); g.setLineDash([]); try { const pt = c.e.getPointAtLength(c.len * seg); tip = [x + (pt.x - 50) * sc * flip, y + (pt.y - 100) * sc]; } catch {} }
      else g.stroke(c.p);
    }
    g.restore(); return tip;
  }
  function drawIcon(g, name, x, y, size, skin, p = 1, t = 0, opt = {}) { const parts = I[name] || I.question; return drawParts(g, parts, x, y, size, skin, p, t, opt); }

  // ---------------- character rig ----------------
  // costume: colours + accessories. Body box: 100 units tall, feet at y=100.
  const COST = {
    merchant: { skin: 'skin2', shirt: 'c2', pants: 'dark', hat: 'turban', robe: true, beard: true },
    king: { skin: 'skin', shirt: 'c1', pants: 'dark', hat: 'crown', robe: true, beard: true, cape: 'c5' },
    emperor: { skin: 'skin', shirt: 'c3', pants: 'c1', hat: 'chinese', robe: true, beard: true },
    soldier: { skin: 'skin', shirt: 'c1', pants: 'dark', hat: 'helmet' },
    roman: { skin: 'skin', shirt: 'red', pants: 'skin', hat: 'roman', skirt: true },
    officer: { skin: 'skin', shirt: 'khaki', pants: 'khaki', hat: 'pith', mustache: true },
    farmer: { skin: 'skin3', shirt: 'cloth', pants: 'cloth', hat: 'wrap' },
    worker: { skin: 'skin2', shirt: 'c4', pants: 'dark', hat: 'cap' },
    monk: { skin: 'skin2', shirt: 'orange', pants: 'orange', hat: 'bald', robe: true },
    scholar: { skin: 'skin', shirt: 'c2', pants: 'dark', hat: 'scholar', robe: true, beard: true },
    woman: { skin: 'skin2', shirt: 'c1', pants: 'c1', hat: 'hair', robe: true },
    gandhi: { skin: 'skin3', shirt: 'cloth', pants: 'cloth', hat: 'bald', glasses: true, robe: true, shawl: true },
    explorer: { skin: 'skin', shirt: 'khaki', pants: 'wood', hat: 'wide' },
    sailor: { skin: 'skin', shirt: 'light', pants: 'c2', hat: 'cap', stripes: true },
    viking: { skin: 'skin', shirt: 'wood', pants: 'dark', hat: 'horns', beard: true },
    child: { skin: 'skin', shirt: 'c3', pants: 'c2', hat: 'hair', small: true },
    mongol: { skin: 'skin2', shirt: 'wood', pants: 'dark', hat: 'fur', mustache: true, robe: true },
    general: { skin: 'skin', shirt: 'red', pants: 'dark', hat: 'chinahelm', mustache: true },
    knight: { skin: 'skin', shirt: 'metal', pants: 'metal', hat: 'visor' },
    pharaoh: { skin: 'skin3', shirt: 'cloth', pants: 'skin3', hat: 'nemes', skirt: true },
    maharaja: { skin: 'skin2', shirt: 'c3', pants: 'cloth', hat: 'pagri', robe: true, mustache: true },
    samurai: { skin: 'skin', shirt: 'c2', pants: 'dark', hat: 'topknot', robe: true },
    // modern people for exam-prep and everyday-life examples
    student: { skin: 'skin2', shirt: 'c2', pants: 'dark', hat: 'short' },
    studentgirl: { skin: 'skin2', shirt: 'c5', pants: 'c2', hat: 'pony', robe: true },
    teacher: { skin: 'skin2', shirt: 'light', pants: 'dark', hat: 'short', glasses: true, mustache: true },
    doctor: { skin: 'skin', shirt: 'light', pants: 'c2', hat: 'short', glasses: true, robe: true },
    cricketer: { skin: 'skin2', shirt: 'light', pants: 'light', hat: 'cap' },
  };
  const COSTUMES = Object.keys(COST);
  const D2 = Math.PI / 180;
  function limb(x0, y0, a1, l1, a2, l2) { const x1 = x0 + Math.sin(a1) * l1, y1 = y0 + Math.cos(a1) * l1, x2 = x1 + Math.sin(a1 + a2) * l2, y2 = y1 + Math.cos(a1 + a2) * l2; return [x1, y1, x2, y2]; }
  // pose -> joint angles (radians; 0 = straight down, positive = forward/right)
  function poseAngles(pose, t, k) {
    const s = Math.sin(t * 7 + k), c = Math.cos(t * 7 + k), b = Math.sin(t * 2.2 + k);
    const A = { la: [-12, 10], ra: [12, -10], ll: [-4, 0], rl: [4, 0], bob: b * .8, lean: 0, head: 0 };
    switch (pose) {
      case 'walk': A.la = [-s * 30, 18]; A.ra = [s * 30, 18]; A.ll = [s * 28, Math.max(0, -s) * 30]; A.rl = [-s * 28, Math.max(0, s) * 30]; A.bob = -Math.abs(c) * 2.5; A.lean = 4; break;
      case 'run': A.la = [-s * 50, 70]; A.ra = [s * 50, 70]; A.ll = [s * 45, Math.max(0, -s) * 60]; A.rl = [-s * 45, Math.max(0, s) * 60]; A.bob = -Math.abs(c) * 5; A.lean = 10; break;
      case 'point': A.ra = [110 + b * 4, 8]; A.la = [-10, 12]; break;
      case 'talk': A.ra = [40 + s * 14, 50 + c * 12]; A.la = [-14, 14]; A.head = b * 3; break;
      case 'cheer': A.la = [-160 + s * 8, 10]; A.ra = [160 - s * 8, -10]; A.bob = -Math.abs(Math.sin(t * 5 + k)) * 6; break;
      case 'think': A.ra = [150, 125]; A.la = [30, 70]; A.head = 6; break;
      case 'shock': A.la = [-120, -20]; A.ra = [120, 20]; A.bob = -Math.abs(Math.sin(t * 12)) * 3; break;
      case 'carry': A.la = [-170, 0]; A.ra = [170, 0]; break;
      case 'wave': A.ra = [150 + s * 20, 10]; A.la = [-10, 12]; break;
      case 'sad': A.la = [-4, 4]; A.ra = [4, -4]; A.head = 14; A.lean = 6; break;
      case 'fight': A.ra = [80 + s * 30, -40]; A.la = [-60, 60]; A.ll = [-18, 0]; A.rl = [22, 10]; A.lean = 6; break;
      case 'bow': A.la = [-20, 0]; A.ra = [20, 0]; A.lean = 32; A.head = 10; break;
    }
    return A;
  }
  function drawChar(g, ch, x, y, size, skin, t, p = 1) {
    const S = SKINS[skin] || SKINS.cartoon, C = COST[ch.costume] || COST.merchant, k = (ch.id || '').length * 1.7, small = C.small ? .72 : 1;
    const A = poseAngles(ch.pose || 'stand', t, k), talk = ch.talk || 0, face = ch.face === 'left' ? -1 : 1;
    const sc = size * small / 100; g.save(); g.translate(x, y + A.bob * sc); g.scale(sc * face, sc); g.rotate(A.lean * D2 * .5);
    if (S.hose && ch.pose !== 'walk') { const sq = 1 + Math.sin(t * 6 + k) * .03; g.scale(1 / sq, sq); }
    const col = r => S.col(r);
    const ink = S.ink || 'rgba(0,0,0,.0)', lw = S.paper ? 0 : S.lw * 1.15;
    const shadow = S.paper ? (fn => { g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8; g.shadowOffsetX = 3; g.shadowOffsetY = 5; fn(); g.restore(); }) : (fn => fn());
    const reveal = clamp(p); g.globalAlpha *= skin === 'whiteboard' ? 1 : clamp(p * 2);
    const hipY = -44, shY = -72, neckY = -76, hx = 0;
    // limbs
    const L = (ang, l1, l2, x0, y0) => limb(x0, y0, ang[0] * D2, l1, ang[1] * D2, l2);
    const legs = [[L(A.ll, 22, 22, -5, hipY), -5], [L(A.rl, 22, 22, 5, hipY), 5]];
    const arms = [[L(A.la, 16, 16, -9, shY), -9], [L(A.ra, 16, 16, 9, shY), 9]];
    const limbW = S.hose ? 6.5 : 7.5;
    function drawLimb(j, x0, y0, colr, end) {
      const [x1, y1, x2, y2] = j; g.strokeStyle = S.hose ? '#111' : col(colr); g.lineWidth = limbW; g.lineCap = 'round';
      if (S.paper) shadow(() => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = '#fffdf7'; g.lineWidth = limbW + 5; g.stroke(); });
      g.beginPath(); g.moveTo(x0, y0); if (S.hose) g.quadraticCurveTo(x1, y1, x2, y2); else { g.lineTo(x1, y1); g.lineTo(x2, y2); } g.strokeStyle = S.hose ? '#111' : col(colr); g.lineWidth = limbW; g.stroke();
      if (!S.paper && !S.hose && S.ink) { g.save(); g.globalCompositeOperation = 'destination-over'; g.strokeStyle = S.ink; g.lineWidth = limbW + lw * 1.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore(); }
      if (end === 'hand') { g.fillStyle = S.hose ? '#fff' : col(C.skin); g.beginPath(); g.arc(x2, y2, S.hose ? 5.2 : 3.8, 0, 6.29); g.fill(); if (S.ink) { g.strokeStyle = S.ink; g.lineWidth = lw * .8; g.stroke(); } }
      if (end === 'foot') { g.fillStyle = S.hose ? '#111' : col('dark'); g.beginPath(); g.ellipse(x2 + 3, y2 - 1, S.hose ? 7 : 5.5, 3.2, 0, 0, 6.29); g.fill(); }
      return [x2, y2];
    }
    // back arm + back leg, body, front leg + arm
    drawLimb(legs[0][0], legs[0][1], hipY, C.pants, 'foot');
    const back = drawLimb(arms[0][0], arms[0][1], shY, C.shirt, 'hand');
    // torso / robe
    const body = C.robe ? 'M-7 -77 Q-12.5 -76 -12.5 -70 L-17 -19 Q0 -15 17 -19 L12.5 -70 Q12.5 -76 7 -77 Z' : C.skirt ? 'M-7 -77 Q-12 -76 -12 -70 L-10 -46 L-14 -30 Q0 -27 14 -30 L10 -46 L12 -70 Q12 -76 7 -77 Z' : 'M-7 -77 Q-12 -76 -12 -70 L-10.5 -43 Q0 -41 10.5 -43 L12 -70 Q12 -76 7 -77 Z';
    const bp = P(body);
    if (!C.robe || true) drawLimb(legs[1][0], legs[1][1], hipY, C.pants, 'foot');
    shadow(() => { if (S.paper) { g.fillStyle = '#fffdf7'; g.strokeStyle = '#fffdf7'; g.lineWidth = 6; g.fill(bp.p); g.stroke(bp.p); } });
    g.fillStyle = col(C.shirt); g.fill(bp.p); if (S.ink && !S.paper) { g.strokeStyle = S.ink; g.lineWidth = lw; g.stroke(bp.p); }
    if (C.shawl) { g.fillStyle = col('cloth'); g.beginPath(); g.moveTo(-11, shY); g.quadraticCurveTo(0, -56, 11, shY + 2); g.lineTo(13, -50); g.quadraticCurveTo(0, -60, -12, -50); g.closePath(); g.fill(); if (S.ink) { g.strokeStyle = S.ink; g.lineWidth = lw * .7; g.stroke(); } }
    if (C.stripes && !S.hose) { g.strokeStyle = col('c2'); g.lineWidth = 2; for (let yy = -68; yy < -46; yy += 6) { g.beginPath(); g.moveTo(-9, yy); g.lineTo(9, yy); g.stroke(); } }
    if (C.cape) { g.fillStyle = col(C.cape); g.globalAlpha *= .95; g.beginPath(); g.moveTo(-11, shY); g.lineTo(-17, -20); g.lineTo(-9, -22); g.closePath(); g.fill(); }
    // head
    const hy = -88 + (A.head || 0) * .15, hr = 12.5;
    g.save(); g.translate(0, hy); g.rotate((A.head || 0) * D2);
    shadow(() => { if (S.paper) { g.fillStyle = '#fffdf7'; g.beginPath(); g.arc(0, 0, hr + 3, 0, 6.29); g.fill(); } });
    g.fillStyle = S.hose ? '#f4f1ea' : col(C.skin); g.beginPath(); g.arc(0, 0, hr, 0, 6.29); g.fill(); if (S.ink && !S.paper) { g.strokeStyle = S.ink; g.lineWidth = lw; g.stroke(); }
    // hair / hats
    const H = C.hat, dk = S.hose ? '#111' : col('dark');
    const hat = (fill, path) => { const hp = P(path); g.fillStyle = fill; g.fill(hp.p); if (S.ink && !S.paper) { g.strokeStyle = S.ink; g.lineWidth = lw * .9; g.stroke(hp.p); } };
    if (H === 'turban') hat(S.hose ? '#f3efe6' : col('c3'), 'M-12 -2 Q-14 -18 0 -19 Q14 -18 12 -2 Q0 -8 -12 -2 Z');
    else if (H === 'crown') hat(S.hose ? '#d7cdb8' : col('gold'), 'M-10 -8 L-11 -20 L-5 -13 L0 -22 L5 -13 L11 -20 L10 -8 Z');
    else if (H === 'chinese') { hat(dk, 'M-11 -6 Q0 -16 11 -6 Z'); hat(S.hose ? '#d7cdb8' : col('gold'), 'M-16 -10 L16 -10 L14 -14 L-14 -14 Z'); }
    else if (H === 'helmet') hat(S.hose ? '#777' : col('metal'), 'M-12 -1 Q-13 -16 0 -16 Q13 -16 12 -1 L8 -3 Q0 -9 -8 -3 Z');
    else if (H === 'roman') { hat(S.hose ? '#777' : col('metal'), 'M-12 0 Q-13 -15 0 -15 Q13 -15 12 0 L8 -2 Q0 -8 -8 -2 Z'); hat(S.hose ? '#111' : col('red'), 'M-9 -13 Q0 -28 9 -13 Q0 -17 -9 -13 Z'); }
    else if (H === 'pith') hat(S.hose ? '#e2ddd2' : col('khaki'), 'M-17 -5 L17 -5 Q14 -9 10 -9 Q8 -20 0 -20 Q-8 -20 -10 -9 Q-14 -9 -17 -5 Z');
    else if (H === 'wrap') hat(S.hose ? '#f3efe6' : col('cloth'), 'M-11 -4 Q-12 -15 0 -15 Q12 -15 11 -4 Q0 -9 -11 -4 Z');
    else if (H === 'cap') hat(dk, 'M-11 -5 Q-11 -15 0 -15 Q11 -15 11 -5 L17 -4 L11 -3 Z');
    else if (H === 'scholar') hat(dk, 'M-11 -6 L-11 -15 L11 -15 L11 -6 Q0 -10 -11 -6 Z');
    else if (H === 'wide') hat(S.hose ? '#6e675f' : col('wood'), 'M-19 -5 L19 -5 L12 -8 Q10 -19 0 -19 Q-10 -19 -12 -8 Z');
    else if (H === 'horns') { hat(S.hose ? '#777' : col('metal'), 'M-11 -2 Q-12 -15 0 -15 Q12 -15 11 -2 Z'); hat(S.hose ? '#f3efe6' : col('cloth'), 'M-10 -10 Q-20 -14 -18 -26 Q-14 -16 -8 -14 Z M10 -10 Q20 -14 18 -26 Q14 -16 8 -14 Z'); }
    else if (H === 'fur') { hat(S.hose ? '#6e675f' : col('wood'), 'M-13 -3 Q-14 -17 0 -19 Q14 -17 13 -3 Q0 -8 -13 -3 Z'); hat(S.hose ? '#111' : col('dark'), 'M-14 -1 L14 -1 L13 -7 L-13 -7 Z'); }
    else if (H === 'chinahelm') { hat(S.hose ? '#777' : col('metal'), 'M-12 -2 Q-12 -14 0 -20 Q12 -14 12 -2 Q0 -7 -12 -2 Z'); hat(S.hose ? '#111' : col('red'), 'M-1.5 -20 L1.5 -20 L5 -31 L-3 -29 Z'); }
    else if (H === 'visor') { hat(S.hose ? '#777' : col('metal'), 'M-12.5 5 Q-13.5 -15 0 -16 Q13.5 -15 12.5 5 L8 5 L8 0 L-8 0 L-8 5 Z'); }
    else if (H === 'nemes') { hat(S.hose ? '#d7cdb8' : col('gold'), 'M-13 16 L-12 -5 Q0 -19 12 -5 L13 16 L8 16 L8 0 Q0 -7 -8 0 L-8 16 Z'); hat(S.hose ? '#111' : col('c2'), 'M-12 -1 L12 -1 L12 2 L-12 2 Z'); }
    else if (H === 'pagri') { hat(S.hose ? '#f3efe6' : col('c1'), 'M-13 -2 Q-15 -19 0 -20 Q15 -19 13 -2 Q0 -9 -13 -2 Z'); hat(S.hose ? '#d7cdb8' : col('gold'), 'M0 -14 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z'); hat(S.hose ? '#f3efe6' : col('cloth'), 'M1 -17 L4 -26 L5 -17 Z'); }
    else if (H === 'topknot') { hat(dk, 'M-11 -4 Q-11 -13 0 -13 Q11 -13 11 -4 Q0 -8 -11 -4 Z'); hat(dk, 'M-3 -12 L3 -12 L2 -20 L-2 -20 Z'); }
    else if (H === 'hair') hat(dk, 'M-12 4 Q-14 -14 0 -13 Q14 -14 12 4 Q14 20 8 26 L6 6 Q0 -6 -6 6 L-8 26 Q-14 20 -12 4 Z');
    // modern short hair (face stays visible) and a ponytail
    else if (H === 'short') hat(dk, 'M-12.5 -1 Q-14 -15 -2 -15.5 Q12 -16 13 -3 Q12 -5 9 -6 Q4 -10 -3 -8 Q-9 -7 -12.5 -1 Z');
    else if (H === 'pony') { hat(dk, 'M-12.5 -1 Q-14 -15 0 -15.5 Q14 -15 12.5 -1 Q9 -9 0 -9 Q-9 -9 -12.5 -1 Z'); hat(dk, 'M10 -10 Q22 -8 20 8 Q19 16 14 20 Q16 8 11 -2 Z'); }
    else if (H !== 'bald') hat(dk, 'M-11 -3 Q-11 -13 0 -13 Q11 -13 11 -3 Q0 -8 -11 -3 Z');
    if (C.beard) hat(S.hose ? '#111' : (C.hat === 'crown' || C.hat === 'chinese' ? col('stone') : dk), 'M-9 3 Q-8 14 0 16 Q8 14 9 3 Q4 9 0 8 Q-4 9 -9 3 Z');
    if (C.mustache) hat(dk, 'M-6 4 Q0 1 6 4 Q0 6 -6 4 Z');
    // face: eyes (blink), brows, mouth (talk)
    const blink = (hash(Math.floor((t + k) / 3.3)) > .3 && ((t + k) % 3.3) < .12);
    const ex = 4.2, ey = -1.5, eyeScale = ch.pose === 'shock' ? 1.6 : 1;
    if (S.hose) { for (const sx of [-ex, ex]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(sx + 1, ey - 1, 3, blink ? .5 : 4.2 * eyeScale, 0, 0, 6.29); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1.2; g.stroke(); if (!blink) { g.fillStyle = '#111'; g.beginPath(); g.moveTo(sx + 1.5, ey); g.arc(sx + 1.5, ey, 2.4, -.6, 4.2); g.closePath(); g.fill(); } } }
    else if (S.cel) { // 80s cel-anime eyes: big, coloured iris, two light highlights
      for (const sx of [-ex, ex]) {
        const cx = sx + 1.6, h = blink ? .3 : 3.3 * eyeScale;
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, ey - .6, 2.5, h, 0, 0, 6.29); g.fill(); g.strokeStyle = S.ink; g.lineWidth = .9; g.stroke();
        if (!blink) { g.fillStyle = '#5a2d82'; g.beginPath(); g.ellipse(cx + .3, ey - .2, 1.75, 2.5 * eyeScale, 0, 0, 6.29); g.fill(); g.fillStyle = '#1b0f2e'; g.beginPath(); g.ellipse(cx + .4, ey + .1, .9, 1.4 * eyeScale, 0, 0, 6.29); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx - .4, ey - 1.6, .75, 0, 6.29); g.fill(); g.beginPath(); g.arc(cx + 1, ey + 1, .35, 0, 6.29); g.fill(); }
        g.strokeStyle = S.ink; g.lineWidth = 1.3; g.beginPath(); g.moveTo(cx - 2.8, ey - h - .3); g.quadraticCurveTo(cx, ey - h - 1.4, cx + 2.9, ey - h - .1); g.stroke();   // upper lash line
      } }
    else { g.fillStyle = S.ink || col('dark'); for (const sx of [-ex, ex]) { g.beginPath(); g.ellipse(sx + 2, ey, 1.4 * eyeScale, blink ? .25 : 1.8 * eyeScale, 0, 0, 6.29); g.fill(); } }
    if (C.glasses) { g.strokeStyle = S.ink || dk; g.lineWidth = 1; for (const sx of [-ex, ex]) { g.beginPath(); g.arc(sx + 2, ey, 3.2, 0, 6.29); g.stroke(); } }
    if (ch.pose === 'shock' || ch.pose === 'sad' || ch.pose === 'think') { g.strokeStyle = S.ink || dk; g.lineWidth = 1.3; g.beginPath(); const by = ch.pose === 'shock' ? -8 : -6; g.moveTo(-ex + .5, by + (ch.pose === 'sad' ? -1 : 0)); g.lineTo(-ex + 3.5, by + (ch.pose === 'sad' ? 1 : 0)); g.moveTo(ex + .5, by + (ch.pose === 'sad' ? 1 : 0)); g.lineTo(ex + 3.5, by + (ch.pose === 'sad' ? -1 : 0)); g.stroke(); }
    const mo = ch.pose === 'shock' ? 1 : talk; g.fillStyle = S.hose ? '#111' : '#5a2a2a';
    if (ch.mouth && ch.pose !== 'shock') {   // real lip-sync shapes
      const M = { A: [2.6, .25], B: [2.3, .9], C: [2.5, 1.7], D: [2.9, 2.7], E: [1.8, 2.1], F: [1.2, 1.3], G: [2.4, .6], H: [2.3, 1.5], X: [0, 0] }[ch.mouth] || [0, 0];
      if (ch.mouth === 'X') { g.strokeStyle = S.ink || dk; g.lineWidth = 1.2; g.beginPath(); g.arc(3, 3.6, 3, .4, 2.7); g.stroke(); }
      else if (ch.mouth === 'A') { g.strokeStyle = S.ink || dk; g.lineWidth = 1.5; g.beginPath(); g.moveTo(.6, 6); g.quadraticCurveTo(3, 6.6, 5.4, 6); g.stroke(); }
      else { g.beginPath(); g.ellipse(3, 6, M[0], M[1], 0, 0, 6.29); g.fill();
        if (['B', 'G', 'C', 'D'].includes(ch.mouth)) { g.fillStyle = '#fff'; g.fillRect(3 - M[0] * .7, 6 - M[1], M[0] * 1.4, Math.min(.7, M[1] * .5)); }   // upper teeth
        if (ch.mouth === 'H' || ch.mouth === 'D') { g.fillStyle = '#e06b7a'; g.beginPath(); g.ellipse(3, 6 + M[1] * .45, M[0] * .55, M[1] * .35, 0, 0, 6.29); g.fill(); } }   // tongue
    }
    else if (mo > .08) { g.beginPath(); g.ellipse(3, 6, 2.1 + mo * .5, .6 + mo * 2.4, 0, 0, 6.29); g.fill(); }
    else { g.strokeStyle = S.ink || dk; g.lineWidth = 1.2; g.beginPath(); if (ch.pose === 'sad') g.arc(3, 8, 3, 3.6, 5.8); else g.arc(3, 3.6, 3, .4, 2.7); g.stroke(); }
    g.restore();
    // front leg/arm
    const front = drawLimb(arms[1][0], arms[1][1], shY, C.shirt, 'hand');
    if (ch.hold) { const hs = (ch.holdSize || 26); const [fx, fy] = ch.pose === 'carry' ? [0, Math.min(back[1], front[1]) - 2] : front; g.save(); g.scale(face, 1); drawIcon(g, ch.hold, fx * face, fy + hs * .45, hs, skin, 1, t); g.restore(); }
    g.restore();
  }

  // ---------------- backgrounds per scene + skin ----------------
  function bg(g, W, H, skin, scene, t) {
    const S = SKINS[skin] || SKINS.cartoon, gy = H * (H > W ? .7 : .8);
    if (skin === 'whiteboard') { g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, W, H); const gr = g.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .5, Math.max(W, H) * .8); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(120,120,110,.18)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(30,30,30,.55)'; g.lineWidth = 2.2; g.lineCap = 'round'; if (scene && scene !== 'blank') { g.beginPath(); g.moveTo(W * .04, gy); g.lineTo(W * .96, gy); g.stroke(); } return gy; }
    if (skin === 'paper') { g.fillStyle = '#d9c3a0'; g.fillRect(0, 0, W, H); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,60,30,${hash(i) * .06})`; g.fillRect(hash(i * 1.7) * W, hash(i * 2.3) * H, 2, 2); } }
    const sky = { desert: ['#ffd9a0', '#ffefcf'], sea: ['#9fd4ff', '#e3f4ff'], city: ['#a9d8ff', '#e8f6ff'], palace: ['#ffc9a8', '#fff0e0'], village: ['#b6e3ff', '#effaff'], mountains: ['#a8cfff', '#edf6ff'], night: ['#1c2350', '#3a3f7a'], road: ['#b6e3ff', '#f2fbff'], blank: ['#fff4e0', '#fff8ee'] }[scene] || ['#bfe3ff', '#f1f9ff'];
    const ground = { desert: 'sand', sea: 'water', city: 'stone', palace: 'sand', village: 'green', mountains: 'green', night: 'dark', road: 'sand', blank: 'sand' }[scene] || 'green';
    if (skin !== 'paper') { const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, S.col === GREY ? '#e9dcc0' : sky[0]); gr.addColorStop(1, S.col === GREY ? '#f6ecd6' : sky[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    const U = Math.min(W, H) / 1080;
    // distant scenery
    const layer = (fn, depth) => { g.save(); if (skin === 'paper') { g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 12; g.shadowOffsetY = 6; } fn(); g.restore(); };
    if (scene === 'desert' || scene === 'palace' || scene === 'road') layer(() => { g.fillStyle = S.col('sand'); g.globalAlpha = .7; g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= W; x += 20) g.lineTo(x, gy - 60 * U - Math.sin(x / W * 7 + 1) * 40 * U); g.lineTo(W, gy); g.fill(); g.globalAlpha = 1; });
    if (scene === 'mountains' || scene === 'village') layer(() => { g.fillStyle = S.col('stone'); g.globalAlpha = .55; g.beginPath(); g.moveTo(0, gy); for (let i = 0; i <= 8; i++) { g.lineTo(W * i / 8, gy - (i % 2 ? 260 : 120) * U * (1 + hash(i) * .5)); } g.lineTo(W, gy); g.fill(); g.globalAlpha = 1; });
    if (scene === 'city') layer(() => { for (let i = 0; i < 9; i++) drawIcon(g, ['city', 'tower', 'house', 'palace'][i % 4], W * (i + .5) / 9, gy, 220 * U * (.8 + hash(i) * .4), skin, 1, t, {}); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, gy - 300 * U, W, 300 * U); });
    if (scene === 'night') { g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { g.globalAlpha = .4 + .6 * hash(i + Math.floor(t * 2)); g.fillRect(hash(i) * W, hash(i + 9) * gy * .8, 2.5, 2.5); } g.globalAlpha = 1; drawIcon(g, 'moon', W * .82, H * .32, 160 * U, skin, 1, t); }
    else if (scene !== 'blank' && scene !== 'sea') drawIcon(g, 'sun', W * .84, H * .26, 150 * U, skin, 1, t, { rot: t * .1 });
    // clouds drift
    if (scene !== 'night' && scene !== 'blank') for (let i = 0; i < 3; i++) drawIcon(g, 'cloud', ((W * (.2 + i * .33) + t * 12 * U * (1 + i * .3)) % (W * 1.2)) - W * .1, H * (.12 + i * .07), 140 * U, skin, 1, t);
    // ground
    layer(() => { g.fillStyle = S.col(ground); g.fillRect(0, gy, W, H - gy); if (scene === 'sea') { g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = (t * 30) % 80 - 80; x < W; x += 80) { g.beginPath(); g.ellipse(x, gy + 40 * U, 30 * U, 5 * U, 0, 0, 6.29); g.fill(); } } });
    if (S.ink && skin !== 'paper') { g.strokeStyle = S.ink; g.lineWidth = 3 * U; g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke(); }
    if (skin === 'rubberhose') { g.fillStyle = 'rgba(120,85,40,.16)'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = 5 * U; g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke(); }
    return gy;
  }
  // pencil/marker hand for the whiteboard
  function hand(g, x, y, U) { g.save(); g.translate(x, y); g.rotate(-.5); g.fillStyle = '#2b2b2b'; g.fillRect(-4 * U, -4 * U, 8 * U, 60 * U); g.fillStyle = '#e4573d'; g.fillRect(-4 * U, 40 * U, 8 * U, 22 * U); g.fillStyle = '#f1c29b'; g.strokeStyle = '#1c1c1f'; g.lineWidth = 2.5 * U; g.beginPath(); g.ellipse(14 * U, 70 * U, 26 * U, 34 * U, -.3, 0, 6.29); g.fill(); g.stroke(); g.beginPath(); g.ellipse(-8 * U, 40 * U, 10 * U, 16 * U, .4, 0, 6.29); g.fill(); g.stroke(); g.fillStyle = '#f1c29b'; g.fillRect(10 * U, 96 * U, 36 * U, 120 * U); g.strokeRect(10 * U, 96 * U, 36 * U, 120 * U); g.restore(); }

  return { drawIcon, drawChar, bg, hand, ICON_NAMES, COSTUMES, SKINS: Object.keys(SKINS), I };
})();
