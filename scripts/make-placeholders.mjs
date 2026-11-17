// Generates PLACEHOLDER art (simple vector drawings) for the Phase 1 demo booth.
// Every file is marked "PLACEHOLDER ART"; replace them with real cutouts / licensed textures later.
// Run: node scripts/make-placeholders.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'placeholder');
mkdirSync(out, { recursive: true });

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
  `<!-- PLACEHOLDER ART - Ginger's Attic demo, replace before launch -->` +
  (defs ? `<defs>${defs}</defs>` : '') +
  body +
  `</svg>`;

const files = {};

// ---------- Textures (10 units = 1 inch) ----------
// Blue-green vine wallpaper, 24 in tile.
files['wallpaper-floral-blue.svg'] = (() => {
  const leaf = (x, y, r, c) =>
    `<ellipse cx="${x}" cy="${y}" rx="15" ry="6" transform="rotate(${r} ${x} ${y})" fill="${c}" opacity=".85"/>`;
  const sprig = (ox, oy, flip) => {
    const s = flip ? -1 : 1;
    return (
      `<g transform="translate(${ox} ${oy}) scale(${s} 1)">` +
      `<path d="M0 0 C20 -30 10 -60 35 -90 S60 -150 40 -190" stroke="#6f9a8c" stroke-width="2.5" fill="none"/>` +
      leaf(14, -22, -50, '#8fb5a6') + leaf(30, -45, 30, '#6d9fb3') + leaf(18, -70, -35, '#9cc1b0') +
      leaf(42, -100, 40, '#7aa7bd') + leaf(52, -128, -30, '#8fb5a6') + leaf(48, -160, 25, '#6d9fb3') +
      `<circle cx="40" cy="-192" r="7" fill="#e9eef0" stroke="#a9bfcc" stroke-width="2"/>` +
      `<circle cx="40" cy="-192" r="2.5" fill="#c9a96a"/>` +
      `</g>`
    );
  };
  return svg(240, 240,
    `<rect width="240" height="240" fill="#f3ecdc"/>` +
    sprig(40, 225, false) + sprig(200, 110, true) + sprig(150, 250, false) + sprig(80, 115, true) +
    `<circle cx="120" cy="40" r="4" fill="#b8ccd6"/><circle cx="10" cy="120" r="3" fill="#b8ccd6"/>`);
})();

// Yellow stripe wallpaper, 6 in tile.
files['wallpaper-yellow-stripe.svg'] = svg(60, 60,
  `<rect width="60" height="60" fill="#fbf1c7"/><rect x="0" width="22" height="60" fill="#f4dc7c"/>` +
  `<rect x="26" width="3" height="60" fill="#f0d36a"/>`);

// Sage gingham wallpaper, 8 in tile.
files['wallpaper-sage-gingham.svg'] = svg(80, 80,
  `<rect width="80" height="80" fill="#e7ecd9"/>` +
  `<rect width="40" height="80" fill="#9bab7c" opacity=".55"/><rect width="80" height="40" fill="#9bab7c" opacity=".55"/>`);

// Honey wood floor, 48 in tile; planks run toward the viewer (vertical stripes).
files['floor-wood-honey.svg'] = (() => {
  const tones = ['#d39a5c', '#c98f52', '#dba66a', '#cf9656', '#c78c4e', '#d8a163', '#cc9354', '#d49c5e'];
  let b = '';
  tones.forEach((t, i) => {
    const x = i * 60;
    const j = 120 + ((i * 173) % 300);
    b += `<rect x="${x}" y="0" width="60" height="480" fill="${t}"/>`;
    b += `<path d="M${x + 12} 0 Q${x + 20} 240 ${x + 14} 480 M${x + 38} 0 Q${x + 30} 200 ${x + 44} 480" stroke="#b97f45" stroke-width="1.2" fill="none" opacity=".5"/>`;
    b += `<rect x="${x}" y="${j}" width="60" height="2.5" fill="#7a4a24" opacity=".7"/>`;
    b += `<rect x="${x + 58}" y="0" width="2.5" height="480" fill="#7a4a24" opacity=".8"/>`;
  });
  return svg(480, 480, b);
})();

files['floor-white-tile.svg'] = svg(120, 120,
  `<rect width="120" height="120" fill="#eef0ef"/><rect x="1" y="1" width="118" height="118" fill="#f7f8f8" stroke="#cfd5d6" stroke-width="2"/>`);

files['floor-wood-light.svg'] = (() => {
  let b = '';
  for (let i = 0; i < 8; i++) {
    const x = i * 60;
    b += `<rect x="${x}" width="60" height="480" fill="${i % 2 ? '#e2c49a' : '#dcbb8c'}"/><rect x="${x + 58}" width="2" height="480" fill="#a98656" opacity=".6"/>`;
    b += `<rect x="${x}" y="${(i * 211) % 420 + 30}" width="60" height="2" fill="#a98656" opacity=".6"/>`;
  }
  return svg(480, 480, b);
})();

// ---------- Fixtures (10 units = 1 inch) ----------
// 4-board wall shelf unit: 39 x 31 in. Board tops at 0, 8.8, 17.6, 26.4 in; boards 1.2 in thick.
files['fixture-shelf-stack-4.svg'] = (() => {
  let b = '';
  for (const y of [0, 88, 176, 264]) {
    b += `<rect x="0" y="${y}" width="390" height="12" rx="2" fill="url(#wood)"/>`;
    b += `<rect x="0" y="${y + 10}" width="390" height="3" fill="#8a5a33" opacity=".7"/>`;
    for (const bx of [40, 336]) {
      b += `<path d="M${bx} ${y + 12} h14 v34 l-14 -34z" fill="#a8703f"/>`;
      b += `<path d="M${bx} ${y + 12} h4 v30 l-4 -6z" fill="#7d5130"/>`;
    }
  }
  return svg(390, 310, b,
    `<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2a46a"/><stop offset="1" stop-color="#c2834c"/></linearGradient>`);
})();

// Farmhouse table: 60 x 30 in, top surface at y = 0.
files['fixture-table-farm-60.svg'] = svg(600, 300,
  `<rect x="0" y="0" width="600" height="16" rx="3" fill="#9b5f45"/>` +
  `<rect x="0" y="0" width="600" height="5" fill="#b57458"/>` +
  `<rect x="22" y="16" width="556" height="34" fill="#83503a"/>` +
  `<rect x="30" y="16" width="26" height="284" fill="#7a4934"/><rect x="544" y="16" width="26" height="284" fill="#7a4934"/>` +
  `<rect x="150" y="16" width="20" height="260" fill="#6c4030" opacity=".85"/><rect x="430" y="16" width="20" height="260" fill="#6c4030" opacity=".85"/>` +
  `<rect x="30" y="16" width="8" height="284" fill="#94593f"/><rect x="544" y="16" width="8" height="284" fill="#94593f"/>`);

// ---------- Items (viewBox height 100, width = 100 * aspect) ----------
files['item-genie-lamp.svg'] = svg(220, 100,
  `<path d="M60 70 Q50 40 100 38 Q150 36 160 58 Q175 50 215 30 Q200 55 170 72 Q130 92 90 88 Q62 86 60 70z" fill="url(#brass)"/>` +
  `<path d="M60 62 Q20 40 30 75 Q38 92 70 82" stroke="#9c7426" stroke-width="7" fill="none"/>` +
  `<ellipse cx="105" cy="36" rx="22" ry="7" fill="#c99b3c"/><circle cx="105" cy="22" r="8" fill="#d8b04e"/>` +
  `<ellipse cx="105" cy="96" rx="30" ry="4" fill="#8f6a24"/><rect x="92" y="86" width="26" height="10" fill="#b68a33"/>`,
  `<linearGradient id="brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0cf6e"/><stop offset=".6" stop-color="#c39434"/><stop offset="1" stop-color="#8b6420"/></linearGradient>`);

const teacup = (fill, rim, deco) => svg(160, 100,
  `<ellipse cx="80" cy="90" rx="74" ry="9" fill="${fill}" stroke="${rim}" stroke-width="3"/>` +
  `<path d="M25 22 Q30 84 80 84 Q130 84 135 22z" fill="${fill}" stroke="${rim}" stroke-width="3"/>` +
  `<path d="M133 34 Q160 34 156 52 Q152 68 128 64" stroke="${fill}" stroke-width="9" fill="none"/>` +
  `<path d="M133 34 Q160 34 156 52 Q152 68 128 64" stroke="${rim}" stroke-width="2" fill="none"/>` +
  `<ellipse cx="80" cy="22" rx="55" ry="7" fill="#f7f1e3" stroke="${rim}" stroke-width="3"/>` + deco);
files['item-teacup-mint.svg'] = teacup('#bfe4c9', '#c9a04a', `<path d="M40 45 Q80 60 120 45" stroke="#e9c7d4" stroke-width="4" fill="none"/>`);
files['item-teacup-black.svg'] = teacup('#2a2626', '#c9a04a',
  `<circle cx="62" cy="50" r="7" fill="#d9536f"/><circle cx="85" cy="58" r="6" fill="#f2b3c2"/><circle cx="104" cy="46" r="5" fill="#e6d35b"/><path d="M55 58 q8 6 16 0" stroke="#5c9a63" stroke-width="3" fill="none"/>`);
files['item-teacup-gold.svg'] = teacup('#f4e6c8', '#b98a2e',
  `<path d="M36 40 Q80 70 124 40" stroke="#c9a04a" stroke-width="3" fill="none" stroke-dasharray="6 4"/>`);

files['item-mug-brown.svg'] = svg(125, 100,
  `<rect x="10" y="6" width="84" height="90" rx="8" fill="#7b3f2a"/><rect x="10" y="6" width="84" height="10" rx="5" fill="#965139"/>` +
  `<path d="M94 26 Q122 26 120 52 Q118 76 94 74" stroke="#6b3524" stroke-width="12" fill="none"/>` +
  `<rect x="24" y="40" width="40" height="22" rx="3" fill="#e9d9b8" opacity=".85"/>`);

files['item-horseshoe.svg'] = svg(95, 100,
  `<path d="M18 96 L14 50 Q12 8 47 8 Q82 8 80 50 L76 96" stroke="#5d544c" stroke-width="18" fill="none" stroke-linecap="round"/>` +
  `<path d="M18 96 L14 50 Q12 8 47 8 Q82 8 80 50 L76 96" stroke="#8a7e72" stroke-width="6" fill="none" stroke-linecap="round"/>` +
  [[17, 70], [16, 45], [77, 70], [78, 45], [30, 18], [64, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#2e2924"/>`).join(''));

files['item-goblet-brass.svg'] = svg(65, 100,
  `<path d="M4 4 H61 Q60 44 32 50 Q5 44 4 4z" fill="url(#g)"/><rect x="29" y="50" width="7" height="34" fill="#9c7426"/>` +
  `<ellipse cx="32.5" cy="92" rx="26" ry="7" fill="#b68a33"/><ellipse cx="32.5" cy="4" rx="28.5" ry="4" fill="#e7c766"/>`,
  `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#8f6a24"/><stop offset=".45" stop-color="#f1d277"/><stop offset="1" stop-color="#8f6a24"/></linearGradient>`);

files['item-tin-motorcycle.svg'] = svg(130, 100,
  `<circle cx="28" cy="74" r="22" fill="#2b2b2b"/><circle cx="28" cy="74" r="9" fill="#bfbfbf"/>` +
  `<circle cx="104" cy="74" r="22" fill="#2b2b2b"/><circle cx="104" cy="74" r="9" fill="#bfbfbf"/>` +
  `<path d="M24 60 Q40 36 70 40 L100 52 Q110 60 104 70 L36 72z" fill="#c23b30"/>` +
  `<rect x="58" y="30" width="30" height="16" rx="6" fill="#2f5fa8"/><circle cx="72" cy="14" r="10" fill="#e7c49a"/>` +
  `<rect x="64" y="4" width="18" height="8" rx="3" fill="#2f5fa8"/><path d="M60 46 L48 64" stroke="#2f5fa8" stroke-width="6"/>`);

files['item-framed-art.svg'] = svg(72, 100,
  `<rect width="72" height="100" fill="#1d1a18"/><rect x="5" y="5" width="62" height="90" fill="url(#m)"/>` +
  `<path d="M5 40 Q30 30 40 48 Q55 70 67 58 L67 75 Q45 85 30 70 Q18 60 5 66z" fill="#1b2d3d" opacity=".85"/>` +
  `<path d="M5 22 Q25 18 36 28 Q50 38 67 30" stroke="#f4f7f8" stroke-width="3" fill="none" opacity=".8"/>`,
  `<linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f0f2"/><stop offset=".4" stop-color="#7fc1d8"/><stop offset=".7" stop-color="#3c8bb0"/><stop offset="1" stop-color="#d6e8ee"/></linearGradient>`);

files['item-cameo.svg'] = svg(85, 100,
  `<ellipse cx="42.5" cy="50" rx="41" ry="48" fill="#6e4b2a"/><ellipse cx="42.5" cy="50" rx="35" ry="42" fill="#c7a46a"/>` +
  `<ellipse cx="42.5" cy="50" rx="30" ry="37" fill="#c98a58"/>` +
  `<path d="M34 78 Q30 62 36 52 Q30 44 36 32 Q44 22 54 30 Q58 38 54 44 Q60 50 54 56 Q52 66 58 78z" fill="#f6ead7"/>`);

files['item-amber-lamp.svg'] = svg(42, 100,
  `<path d="M6 6 Q21 0 36 6 Q40 18 30 30 Q21 36 12 30 Q2 18 6 6z" fill="#d7801c" opacity=".95"/>` +
  `<rect x="15" y="30" width="12" height="8" fill="#a77a2c"/><circle cx="34" cy="36" r="3" fill="#a77a2c"/>` +
  `<path d="M8 40 Q21 34 34 40 Q40 56 30 66 Q21 70 12 66 Q2 56 8 40z" fill="#c96f16"/>` +
  `<rect x="17" y="66" width="8" height="18" fill="#9c7426"/><ellipse cx="21" cy="93" rx="17" ry="6" fill="#8f6a24"/>`);

files['item-rotary-phone.svg'] = svg(125, 100,
  `<path d="M14 96 L30 46 H96 L112 96z" fill="#c9a24c"/><circle cx="63" cy="70" r="20" fill="#e8d7a8" stroke="#8f6a24" stroke-width="3"/>` +
  `<circle cx="63" cy="70" r="6" fill="#8f6a24"/>` +
  `<path d="M8 30 Q8 10 30 12 H96 Q118 10 118 30 Q118 40 104 40 L100 26 H26 L22 40 Q8 40 8 30z" fill="#b8902f"/>` +
  `<path d="M112 70 q14 4 8 18" stroke="#6d4c1d" stroke-width="3" fill="none"/>`);

files['item-iron-truck.svg'] = svg(200, 100,
  `<rect x="60" y="24" width="132" height="44" fill="#7a5a3a"/><path d="M60 24 h132 M60 40 h132 M60 54 h132" stroke="#5a4029" stroke-width="3"/>` +
  `<path d="M10 70 V44 Q12 30 30 30 H60 V70z" fill="#8a6a45"/><rect x="18" y="36" width="24" height="16" fill="#3a2c20"/>` +
  `<circle cx="38" cy="76" r="18" fill="#3a3330"/><circle cx="38" cy="76" r="7" fill="#c9a24c"/>` +
  `<circle cx="160" cy="76" r="18" fill="#3a3330"/><circle cx="160" cy="76" r="7" fill="#c9a24c"/>`);

files['item-yellow-armchair.svg'] = svg(95, 100,
  `<path d="M14 8 Q47 0 80 8 L82 60 H12z" fill="#e6b31e"/><path d="M47 10 v40" stroke="#c99a12" stroke-width="2"/>` +
  `<circle cx="34" cy="30" r="2" fill="#b0850e"/><circle cx="60" cy="30" r="2" fill="#b0850e"/>` +
  `<rect x="2" y="40" width="18" height="38" rx="8" fill="#f0c02a"/><rect x="75" y="40" width="18" height="38" rx="8" fill="#f0c02a"/>` +
  `<rect x="14" y="56" width="67" height="22" rx="6" fill="#f2c535"/>` +
  `<path d="M14 78 L10 98 M81 78 L85 98 M30 78 L32 94 M65 78 L63 94" stroke="#7a4b2a" stroke-width="5" stroke-linecap="round"/>`);

files['item-braided-rug.svg'] = svg(420, 100,
  [48, 40, 32, 24, 16, 8].map((ry, i) =>
    `<ellipse cx="210" cy="50" rx="${ry * 4.2}" ry="${ry}" fill="${i % 2 ? '#b9ad9a' : '#d8cdb8'}" stroke="#968a76" stroke-width="2"/>`).join(''));

files['item-book-stack.svg'] = svg(140, 100,
  `<rect x="10" y="66" width="120" height="30" rx="3" fill="#6b4a2b"/><rect x="10" y="66" width="120" height="6" fill="#c9a24c" opacity=".7"/>` +
  `<rect x="22" y="38" width="100" height="28" rx="3" fill="#4a3a2c"/><rect x="22" y="56" width="100" height="4" fill="#d9c08a"/>` +
  `<rect x="30" y="14" width="86" height="24" rx="3" fill="#7d3a2a"/><rect x="30" y="14" width="86" height="5" fill="#a85540"/>`);

for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
console.log(`wrote ${Object.keys(files).length} placeholder SVGs to ${out}`);
