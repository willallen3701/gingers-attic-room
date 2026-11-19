// Shadow-DOM styles for <attic-booth>. Vintage restyle: aged paper, serif + typewriter type, muted plum.
// Sizes inside the room use cqw (room width = 100cqw) so everything scales with the room.
export const css = /* css */ `
:host {
  --plum: #6b3a5c;
  --plum-dark: #4b2741;
  --plum-soft: #b48aa6;
  --paper: #f3e8d0;
  --paper-2: #e8d8b5;
  --ink: #3a2a1e;
  --ink-soft: #6d5a48;
  --brass: #b08a3e;
  --sold: #b3261e;
  --serif: "Playfair Display", "Iowan Old Style", Georgia, "Times New Roman", serif;
  --type: "Special Elite", "Courier Prime", "Courier New", Courier, monospace;
  display: block;
  position: relative;
  color: var(--ink);
  font-family: var(--serif);
  -webkit-tap-highlight-color: transparent;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; }

.booth {
  position: relative;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(255,255,255,.35), transparent 60%),
    radial-gradient(ellipse at 80% 90%, rgba(120,80,40,.12), transparent 55%),
    var(--paper);
  border: 1px solid #d8c59c;
  border-radius: 6px;
  padding: 12px;
  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 6px 24px rgba(60,35,20,.12);
}

/* ---------- name bar ---------- */
.namebar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 4px 4px 12px;
  border-bottom: 1px dashed #cdb88c;
  margin-bottom: 12px;
}
.avatar {
  width: 48px; height: 48px; border-radius: 50%; flex: none;
  display: grid; place-items: center;
  background: var(--plum); color: var(--paper);
  font: 700 22px/1 var(--serif);
  border: 3px solid var(--paper-2); box-shadow: 0 0 0 1px var(--plum-soft);
  overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.who { flex: 1 1 220px; min-width: 0; }
.who h2 { margin: 0; font: 700 clamp(18px, 2.4vw, 24px)/1.15 var(--serif); color: var(--plum-dark); }
.who .meta { margin: 2px 0 0; font: 13px/1.35 var(--type); color: var(--ink-soft); }
.who .chip {
  display: inline-block; padding: 1px 7px; margin-right: 6px;
  border: 1px solid var(--plum-soft); border-radius: 3px; color: var(--plum);
  font: 700 12px/1.5 var(--type); letter-spacing: .06em; text-transform: uppercase;
}
.who .about { margin: 4px 0 0; font: italic 14px/1.35 var(--serif); color: var(--ink-soft); }
.controls { display: flex; gap: 6px; align-items: center; }
.ctl {
  height: 34px; min-width: 34px; padding: 0 10px;
  border: 1px solid #cbb385; border-radius: 4px; background: #fbf5e6;
  font: 13px/1 var(--type); cursor: pointer; color: var(--plum-dark);
}
.ctl:hover { background: #fff; border-color: var(--plum-soft); }
.ctl[aria-pressed="true"] { background: var(--plum); color: var(--paper); border-color: var(--plum); }
.ctl:focus-visible, .item:focus-visible, .card button:focus-visible, .card summary:focus-visible {
  outline: 2px dashed var(--plum); outline-offset: 2px;
}

/* ---------- viewport / room ---------- */
.viewport {
  position: relative; z-index: 0; isolation: isolate; /* keep room z-indexes below the card */
  overflow: auto; border-radius: 4px;
  box-shadow: 0 0 0 1px #b99a66, 0 0 0 5px #e3d1a8, 0 0 0 6px #b99a66, 0 10px 26px rgba(50,30,15,.25);
  margin: 6px;
  touch-action: pan-x pan-y;
  max-height: 85vh;
}
.room {
  position: relative; width: 100%; aspect-ratio: 1 / 1;
  container-type: inline-size;
  overflow: hidden; user-select: none;
  background: #e9dfc8;
}
.wall { position: absolute; left: 0; top: 0; width: 100%; height: 75%; }
.wall::after { /* soft shading toward the floor and corners */
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(60,40,20,.10) 85%, rgba(40,25,15,.28));
}
.floor {
  position: absolute; left: 0; top: 75%; width: 100%; height: 25%; overflow: hidden;
  perspective: 46cqw; perspective-origin: 50% 0%;
  background: #b98450;
}
.floor-plane {
  position: absolute; left: -70%; width: 240%; top: 0; height: 150%;
  transform-origin: 50% 0%;
  transform: rotateX(66deg);
}
.floor::after { /* darker at the back wall, lighter toward the viewer */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(30,15,5,.45), rgba(30,15,5,.10) 40%, rgba(255,240,220,.06));
}
.baseboard { position: absolute; left: 0; width: 100%; }
.baseboard::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -0.4cqw; height: .4cqw;
  background: rgba(20,10,5,.35); filter: blur(.2cqw);
}
.layer { position: absolute; inset: 0; }
.fixture { position: absolute; pointer-events: none; }
.fixture img { width: 100%; height: 100%; display: block; filter: drop-shadow(0 .5cqw .35cqw rgba(40,25,10,.35)); }

/* ---------- items ---------- */
.item {
  position: absolute; padding: 0; margin: 0; border: 0; background: none;
  cursor: pointer; display: block;
}
.item img {
  position: relative; display: block; width: 100%; height: 100%;
  transition: transform .18s ease, filter .18s ease;
  pointer-events: none;
}
/* Wall-hung things (decor, wall items, frames): a soft shadow on the wall just behind them, down and to the right
   (the booth's light comes from the upper left), following the silhouette. No floor-style contact ellipse. */
.item.mount-wall img { filter: drop-shadow(.35cqw .5cqw .5cqw rgba(30,15,8,.46)); }
.item.mount-wall .contact { display: none; }
.item .contact {
  position: absolute; left: 6%; right: 6%; bottom: -0.5cqw; height: 1.1cqw;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(25,15,8,.5), rgba(25,15,8,.18) 55%, transparent 72%);
  transition: transform .18s ease, opacity .18s ease;
}
.item.mount-flat .contact { display: none; }
.item.mount-flat img { filter: drop-shadow(0 .25cqw .25cqw rgba(30,20,10,.25)); }
.item:hover img, .item:focus-visible img, .item.active img { transform: translateY(-0.45cqw); }
.item.mount-stand:hover img { filter: drop-shadow(0 .6cqw .5cqw rgba(30,20,10,.25)); }
.item:hover .contact, .item.active .contact { transform: scale(.88); opacity: .7; }
.item.mount-flat:hover img { transform: translateY(-0.2cqw); }

/* ---------- price tags (separate top layer so they stay readable) ---------- */
.tags { position: absolute; inset: 0; pointer-events: none; z-index: 4000; }
.tag {
  position: absolute; transform-origin: 0 0; transform: rotate(-4deg);
  pointer-events: auto; cursor: pointer;
  padding-top: 1.1cqw;
}
.tag::before { /* the string */
  content: ""; position: absolute; left: .2cqw; top: 0; width: .15cqw; min-width: 1px; height: 1.6cqw;
  background: var(--plum); transform: rotate(-22deg); transform-origin: top;
}
.tag .paper {
  position: relative; display: inline-block; white-space: nowrap;
  padding: .25cqw .7cqw .25cqw 1.1cqw;
  font: 700 clamp(9px, 1.2cqw, 15px)/1.1 var(--type); color: var(--ink);
  background: linear-gradient(180deg, #fffaf0, #f2e3c4);
  border: 1px solid #c5ab78; border-radius: 1px .5cqw .5cqw 1px;
  clip-path: polygon(.6cqw 0, 100% 0, 100% 100%, .6cqw 100%, 0 50%);
  box-shadow: 0 .15cqw .3cqw rgba(40,25,10,.3);
}
.tag .paper::before { /* punched hole */
  content: ""; position: absolute; left: .45cqw; top: 50%; width: .45cqw; height: .45cqw; min-width: 3px; min-height: 3px;
  margin-top: -.22cqw; border-radius: 50%; background: #c9b894; box-shadow: inset 0 0 0 1px #9c8456;
}
.tag.swing { animation: swing 1.1s ease-in-out; }
@keyframes swing {
  0% { transform: rotate(-4deg); } 20% { transform: rotate(9deg); } 45% { transform: rotate(-8deg); }
  70% { transform: rotate(4deg); } 100% { transform: rotate(-4deg); }
}
.tag .sold {
  position: absolute; left: 30%; top: 30%; transform: rotate(-14deg);
  padding: .1cqw .5cqw; border: .2cqw solid var(--sold); color: var(--sold);
  background: rgba(255,250,240,.9);
  font: 900 clamp(8px, 1.05cqw, 13px)/1 var(--serif); letter-spacing: .12em;
}
.item.sold img { filter: saturate(.75) brightness(.95); }
.item.sold.mount-wall img { filter: saturate(.75) brightness(.95) drop-shadow(.35cqw .5cqw .5cqw rgba(30,15,8,.46)); }

/* ---------- sign ---------- */
.sign { position: absolute; z-index: 3000; pointer-events: none; text-align: center; }
.sign .chain { position: absolute; top: 0; width: .25cqw; height: 2.4cqw; background: repeating-linear-gradient(180deg, #7b6a4a 0 .35cqw, #b7a37a .35cqw .6cqw); }
.sign .board {
  position: absolute; left: 0; right: 0; top: 2.2cqw; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .35cqw;
  padding: .6cqw 1cqw .7cqw; overflow: hidden;
  background:
    repeating-linear-gradient(92deg, rgba(255,255,255,.05) 0 .6cqw, rgba(0,0,0,.05) .6cqw 1.1cqw),
    linear-gradient(180deg, #8a5a36, #6a4127);
  border: .3cqw solid #4c2c18; border-radius: .6cqw;
  box-shadow: 0 .6cqw 1cqw rgba(30,15,5,.4), inset 0 0 0 .25cqw rgba(255,220,170,.25);
  color: #f6e7c4;
}
.sign .no { font: 700 1.05cqw/1 var(--type); letter-spacing: .28em; text-transform: uppercase; opacity: .9; }
.sign .nm {
  font: 700 1.75cqw/1.08 var(--serif); text-shadow: 0 .15cqw 0 rgba(0,0,0,.35);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 100%;
}

.sign.style-cream .board {
  background:
    repeating-linear-gradient(92deg, rgba(255,255,255,.08) 0 .6cqw, rgba(0,0,0,.03) .6cqw 1.1cqw),
    linear-gradient(180deg, #f4ead2, #e2d1aa);
  border-color: #7a5a3a; color: var(--plum-dark);
  box-shadow: 0 .6cqw 1cqw rgba(30,15,5,.35), inset 0 0 0 .25cqw rgba(107,58,92,.35);
}
.sign.style-cream .nm { text-shadow: none; }
.sign.style-brass .board {
  background: linear-gradient(160deg, #e7cf8a, #b8913f 45%, #8a6a2a 70%, #d9bd73);
  border-color: #6d5220; color: #3a2a12; border-radius: .3cqw;
  box-shadow: 0 .6cqw 1cqw rgba(30,15,5,.4), inset 0 0 0 .2cqw rgba(255,245,210,.5);
}
.sign.style-brass .nm { text-shadow: 0 .1cqw 0 rgba(255,240,200,.6); }

/* ---------- wall strips, windows/doors, decor ---------- */
.strip { position: absolute; left: 0; width: 100%; box-shadow: 0 .2cqw .3cqw rgba(20,10,5,.25); }
.placeable { position: absolute; pointer-events: none; }
.placeable img { width: 100%; height: 100%; display: block; filter: drop-shadow(0 .3cqw .3cqw rgba(40,25,10,.3)); }
.item.decor { cursor: default; pointer-events: none; }
.item.decor:hover img { transform: none; }
/* overhead lights: the cord from the top of the wall to the piece (room-render hangCordHtml); x/width/colour come from the library */
.item.decor .cord { position: absolute; bottom: 100%; width: .3%; min-width: 1px; transform: translateX(-50%); background: var(--cord, #6b5a3a); pointer-events: none;
  box-shadow: .12cqw 0 .15cqw rgba(20,10,5,.3); }
.item.decor .cord .rose { position: absolute; left: 50%; top: -.1cqw; width: 2.6cqw; height: .8cqw; transform: translateX(-50%); border-radius: .5cqw .5cqw .2cqw .2cqw;
  background: var(--cord, #6b5a3a); box-shadow: 0 .15cqw .25cqw rgba(20,10,5,.35); }

/* ---------- light overlays ---------- */
.light { position: absolute; inset: 0; pointer-events: none; z-index: 3500; transition: opacity .45s ease; }
.room.lights-off .light { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .light { transition: none; } }
.light .wash { position: absolute; inset: 0; mix-blend-mode: soft-light; }
.light .panes { position: absolute; mix-blend-mode: soft-light; filter: blur(.35cqw); }
.light .vignette { position: absolute; inset: 0; mix-blend-mode: multiply;
  background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(60,35,20,.55) 100%); }

/* ---------- decor lamps switched on (room-render lampsHtml) ---------- */
/* .lamps is a plain wrapper; its two layers sit above the lighting preset. The wash uses normal blending
   (a pale wall turns warm, a dark one brightens); the bright cores are screen-blended. */
.lamps { position: absolute; inset: 0; pointer-events: none; }
.lamps > .wash, .lamps > .glow { position: absolute; inset: 0; z-index: 3600; transition: opacity .45s ease; }
.lamps > .glow { z-index: 3601; mix-blend-mode: screen; }
.room.lights-off .lamps > .wash, .room.lights-off .lamps > .glow { opacity: 0; }
.lamp > span { position: absolute; border-radius: 50%; }
.lamp .pool { background: radial-gradient(closest-side, rgba(255,190,96,.42), rgba(255,176,88,.26) 35%, rgba(255,160,80,.10) 68%, rgba(255,150,70,0)); }
.lamp .ground { background: radial-gradient(closest-side, rgba(255,198,112,.55), rgba(255,176,92,.25) 55%, rgba(255,160,80,0)); }
.lamp .halo { background: radial-gradient(closest-side, rgba(255,232,170,.95), rgba(255,200,110,.55) 35%, rgba(255,176,90,.18) 70%, rgba(255,160,80,0)); }
.lamp .core { background: radial-gradient(closest-side, #fffef6, #fff4cc 40%, rgba(255,214,130,.8) 70%, rgba(255,190,100,0)); }
.lamp.kind-shade .core { background: radial-gradient(closest-side, rgba(255,250,230,.95), rgba(255,236,186,.85) 55%, rgba(255,210,140,.45) 82%, rgba(255,190,110,0)); }
.lamp.kind-shade .halo { background: radial-gradient(closest-side, rgba(255,226,160,.7), rgba(255,196,110,.38) 45%, rgba(255,170,90,.1) 75%, rgba(255,160,80,0)); }
.lamp.flicker .halo, .lamp.flicker .core { animation: lamp-flicker 2.6s ease-in-out infinite; }
@keyframes lamp-flicker {
  0%, 100% { opacity: 1; transform: scale(1); } 18% { opacity: .82; transform: scale(.94); } 37% { opacity: .97; transform: scale(1.04); }
  55% { opacity: .78; transform: scale(.93); } 76% { opacity: .93; transform: scale(1.02); }
}
@media (prefers-reduced-motion: reduce) {
  .lamps > .wash, .lamps > .glow { transition: none; }
  .lamp.flicker .halo, .lamp.flicker .core { animation: none; }
}

/* ---------- collectibles boxes (room-render boxesHtml) ---------- */
.box {
  position: absolute; padding: 0; margin: 0; border: 0; background: none; cursor: pointer; display: block;
}
.box .boxin {
  position: absolute; inset: 0; display: grid; gap: .22cqw; padding: .55cqw;
  border-radius: .35cqw; box-shadow: 0 .45cqw .5cqw rgba(30,15,5,.35);
  transition: transform .18s ease;
}
.box .cell {
  position: relative; display: grid; place-items: center; overflow: hidden; min-width: 0; min-height: 0;
  background: radial-gradient(ellipse at 50% 35%, rgba(255,255,255,.14), transparent 70%), var(--lining, #5b2a4a);
  box-shadow: inset 0 .2cqw .35cqw rgba(0,0,0,.45);
}
.box .cell img { width: 86%; height: 86%; object-fit: contain; filter: drop-shadow(0 .1cqw .1cqw rgba(0,0,0,.4)); pointer-events: none; }
.box .cell.sold img { filter: saturate(.6) brightness(.9); }
.box.style-crate .boxin {
  background: repeating-linear-gradient(0deg, #c99d63 0 .9cqw, #b98c52 .9cqw 1cqw), #c99d63;
  border: .2cqw solid #8c6236;
}
.box.style-crate .cell { border-radius: .1cqw; }
.box.style-jewelry .boxin {
  background: linear-gradient(160deg, #6b2a17, #3d160b 70%);
  border: .2cqw solid #2a0f07; box-shadow: inset 0 0 0 .2cqw #c9a14a, 0 .45cqw .5cqw rgba(30,15,5,.35);
}
.box.style-jewelry .cell { border-radius: .25cqw; box-shadow: inset 0 0 0 .08cqw rgba(201,161,74,.6), inset 0 .2cqw .35cqw rgba(0,0,0,.45); }
.box.style-curio .boxin {
  background: linear-gradient(180deg, #b07c4a, #8a5c33);
  border: .2cqw solid #5e3c1f; gap: .3cqw;
}
.box.style-curio .cell { border-radius: .05cqw; box-shadow: inset 0 0 0 .1cqw #5e3c1f, inset 0 .25cqw .35cqw rgba(0,0,0,.4); }
.box .contact {
  position: absolute; left: 6%; right: 6%; bottom: -0.5cqw; height: 1.1cqw; border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(25,15,8,.5), rgba(25,15,8,.18) 55%, transparent 72%);
}
.box:hover .boxin, .box:focus-visible .boxin { transform: translateY(-0.35cqw); }
.box:focus-visible { outline: 2px dashed var(--plum); outline-offset: 2px; }

/* ---------- magnifier: a close-up of an item (hover on desktop, tap on touch) ---------- */
.lens {
  position: absolute; z-index: 30; width: 176px; pointer-events: none; text-align: center;
  transform-origin: 50% 100%; animation: lens-in .14s ease-out;
}
.lens[hidden] { display: none; }
.lens .glass {
  display: grid; place-items: center; width: 176px; height: 176px; border-radius: 50%; overflow: hidden;
  background: radial-gradient(circle at 35% 30%, #ffffff, #f6eedd 70%);
  box-shadow: 0 0 0 5px #c9a14a, 0 0 0 7px #7d5f22, 0 12px 28px rgba(30,15,5,.4), inset 0 0 18px rgba(120,90,40,.25);
}
.lens .glass img { width: 78%; height: 78%; object-fit: contain; }
.lens .cap {
  display: inline-block; max-width: 220px; margin-top: 10px; padding: 4px 10px; border-radius: 12px;
  background: var(--plum-dark); color: var(--paper); font: 13px/1.3 var(--serif); box-shadow: 0 4px 10px rgba(30,15,5,.3);
}
.lens .cap b { font-family: var(--type); font-weight: 400; margin-left: 4px; }
@keyframes lens-in { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }

/* ---------- shop view: a collectibles box up close ---------- */
.boxview {
  position: absolute; z-index: 9; left: 50%; top: 92px; transform: translateX(-50%);
  width: min(560px, calc(100% - 24px)); max-height: calc(100% - 104px); overflow: auto;
  padding: 14px; border-radius: 16px; background: var(--paper);
  box-shadow: 0 18px 44px rgba(30,10,25,.45), 0 0 0 1px #cdb88c;
}
.boxview[hidden] { display: none; }
.bvhead { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; }
.bvhead h3 { flex: 1; margin: 0; font: 700 20px/1.2 var(--serif); color: var(--plum-dark); }
.bvhead p { margin: 0; font: 13px/1.3 var(--type); color: var(--ink-soft); }
.bvclose { width: 40px; height: 40px; flex: none; border: 0; border-radius: 50%; background: #efe2c4; color: var(--plum-dark); font-size: 22px; cursor: pointer; }
.bvbox { display: grid; gap: 6px; padding: 10px; border-radius: 10px; }
.bvbox.style-crate { background: repeating-linear-gradient(0deg, #c99d63 0 18px, #b98c52 18px 20px); border: 3px solid #8c6236; }
.bvbox.style-jewelry { background: linear-gradient(160deg, #6b2a17, #3d160b 70%); border: 3px solid #2a0f07; box-shadow: inset 0 0 0 3px #c9a14a; }
.bvbox.style-curio { background: linear-gradient(180deg, #b07c4a, #8a5c33); border: 3px solid #5e3c1f; }
.bvcell {
  position: relative; display: grid; place-items: center; aspect-ratio: 1; min-width: 0; padding: 0; border: 0; border-radius: 6px; cursor: pointer;
  background: radial-gradient(ellipse at 50% 35%, rgba(255,255,255,.16), transparent 70%), var(--lining, #5b2a4a);
  box-shadow: inset 0 3px 6px rgba(0,0,0,.45);
}
.bvcell.empty { cursor: default; }
.bvcell img { width: 82%; height: 82%; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,.4)); transition: transform .15s ease; }
.bvcell:hover img, .bvcell:focus-visible img { transform: scale(1.06); }
.bvcell:focus-visible { outline: 3px solid var(--paper); outline-offset: -3px; }
.bvcell .bvtag {
  position: absolute; right: 4px; bottom: 4px; padding: 1px 6px; border-radius: 3px;
  background: linear-gradient(180deg, #fffaf0, #f2e3c4); border: 1px solid #c5ab78; font: 700 12px/1.3 var(--type); color: var(--ink);
}
.bvcell .bvtag.sold { color: var(--sold); border-color: var(--sold); }
.bvcell.active { box-shadow: inset 0 3px 6px rgba(0,0,0,.45), 0 0 0 3px var(--plum); }
.booth.narrow .boxview { position: fixed; left: 0; right: 0; top: auto; bottom: 0; transform: none; width: auto; max-height: 82vh; border-radius: 18px 18px 0 0; }

/* ---------- favourite the whole booth (name bar) ---------- */
.ctl.favbooth { display: inline-flex; align-items: center; gap: 5px; }
.ctl.favbooth svg { width: 16px; height: 16px; color: var(--plum); }
.ctl.favbooth[aria-pressed="true"] svg { color: #f4a3bd; }

/* ---------- placeholder badge ---------- */
.badge {
  position: absolute; left: 1cqw; bottom: 1cqw; z-index: 4100; pointer-events: none;
  padding: .3cqw .8cqw; border-radius: .4cqw;
  background: rgba(255,250,235,.85); border: 1px dashed var(--plum);
  font: 700 clamp(9px, 1.05cqw, 12px)/1.2 var(--type); color: var(--plum-dark); letter-spacing: .04em;
}

/* ---------- item card ---------- */
.card {
  position: absolute; z-index: 10; width: 312px; max-width: calc(100% - 16px);
  background: linear-gradient(180deg, #7a4569, var(--plum) 40%, var(--plum-dark));
  color: #fbf1e0; border-radius: 16px; padding: 14px 14px 12px;
  box-shadow: 0 14px 34px rgba(30,10,25,.45), 0 0 0 1px rgba(255,230,240,.15) inset;
  font-family: var(--serif);
}
.card[hidden] { display: none; }
.card::before { /* pointer nub toward the item */
  content: ""; position: absolute; top: var(--nub-top, 28px); width: 14px; height: 14px;
  background: #7a4569; transform: rotate(45deg);
}
.card.right::before { left: -7px; }
.card.left::before { right: -7px; }
.card .close {
  position: absolute; right: 6px; top: 6px; width: 30px; height: 30px; border-radius: 50%;
  border: 0; background: rgba(255,255,255,.12); color: #fbf1e0; cursor: pointer; font-size: 18px; line-height: 1;
}
.card .close:hover { background: rgba(255,255,255,.25); }
.card .top { display: grid; grid-template-columns: 92px 1fr; gap: 12px; padding-right: 26px; }
.card .photo {
  width: 92px; height: 92px; border-radius: 6px; background: #fbf5e6; display: grid; place-items: center;
  box-shadow: 0 0 0 3px #fbf5e6, 0 0 0 4px rgba(0,0,0,.2);
}
.card .photo { overflow: hidden; }
.card .photo img { width: 84%; height: 84%; object-fit: contain; display: block; }
.card h3 { margin: 0; font: 700 18px/1.15 var(--serif); }
.card h3:focus { outline: none; }
.card .desc { margin: 6px 0 0; font: 13.5px/1.35 var(--serif); opacity: .92; }
.card details { margin-top: 10px; border-top: 1px solid rgba(255,255,255,.18); padding-top: 8px; }
.card summary { cursor: pointer; font: 700 13px/1.4 var(--type); letter-spacing: .04em; list-style: none; }
.card summary::-webkit-details-marker { display: none; }
.card summary::before { content: "+ "; }
.card details[open] summary::before { content: "\\2212  "; }
.card dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 8px 0 0; font: 13px/1.35 var(--serif); }
.card dt { font: 700 12px/1.5 var(--type); opacity: .8; }
.card dd { margin: 0; }
.card .buy { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.card .price { font: 700 24px/1 var(--serif); margin-right: auto; }
.card .fav, .card .cart {
  height: 40px; border-radius: 20px; border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
}
.card .fav { width: 40px; justify-content: center; background: rgba(255,255,255,.14); color: #fbf1e0; }
.card .fav[aria-pressed="true"] { background: #fbf1e0; color: var(--sold); }
.card .cart { padding: 0 16px; white-space: nowrap; background: #fbf1e0; color: var(--plum-dark); font: 700 14px/1 var(--type); }
.card .cart:hover { background: #fff; }
.card .cart[disabled] { opacity: .6; cursor: default; }
.card .links { display: flex; gap: 14px; margin-top: 10px; font: 13px/1.3 var(--type); }
.card .links button { border: 0; background: none; padding: 0; cursor: pointer; color: #f7d9ea; text-decoration: underline; text-underline-offset: 3px; }
.card svg { width: 18px; height: 18px; }
.card .askform { display: grid; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.18); }
.card .askform label { display: grid; gap: 3px; font: 12px/1.2 var(--type); color: #f7d9ea; }
.card .askform .askhow { margin: 0; font: 13px/1.4 var(--serif); color: #fbf1e0; opacity: .92; }
.card .askform input, .card .askform textarea {
  font: 14px/1.35 var(--serif); color: var(--plum-dark); background: #fbf1e0;
  border: 1px solid rgba(255,255,255,.4); border-radius: 6px; padding: 7px 9px; resize: vertical;
}
.card .askform input:focus-visible, .card .askform textarea:focus-visible { outline: 2px solid #fbf1e0; outline-offset: 1px; }
.card .askbtns { display: flex; gap: 10px; align-items: center; }
.card .askbtns .send { height: 34px; padding: 0 16px; border: 0; border-radius: 17px; background: #fbf1e0; color: var(--plum-dark); font: 700 13px/1 var(--type); cursor: pointer; }
.card .askbtns .send[disabled] { opacity: .6; cursor: default; }
.card .askbtns .askcancel { border: 0; background: none; color: #f7d9ea; text-decoration: underline; cursor: pointer; font: 13px/1 var(--type); }
.card .asksent { margin: 12px 0 0; font: 13.5px/1.35 var(--serif); color: #fbf1e0; }

/* bottom sheet on narrow screens */
.booth.narrow .card {
  position: fixed; left: 0; right: 0; bottom: 0; top: auto; width: auto; max-width: none;
  border-radius: 18px 18px 0 0; max-height: 72vh; overflow: auto; padding-bottom: 18px;
  animation: sheet .22s ease-out;
}
.booth.narrow .card::before { display: none; }
.booth.narrow .card .grab { display: block; }
.card .grab { display: none; width: 44px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.4); margin: -4px auto 10px; }
@keyframes sheet { from { transform: translateY(40%); opacity: .4; } to { transform: none; opacity: 1; } }

.toast {
  position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 20;
  background: var(--ink); color: var(--paper); padding: 8px 14px; border-radius: 4px;
  font: 13px/1.3 var(--type); opacity: 0; transition: opacity .2s; pointer-events: none;
}
.toast.show { opacity: .95; }
.booth.narrow .namebar { gap: 8px; }
/* Phones: the name-bar buttons wrap instead of pushing the page sideways, and every tap target is at least 40 px. */
.controls { flex-wrap: wrap; }
.booth.narrow .ctl { height: 40px; min-width: 40px; }
.booth.narrow .card .close { width: 40px; height: 40px; }
.booth.narrow .card summary { display: flex; align-items: center; min-height: 40px; }
.booth.narrow .card .links button, .booth.narrow .card .askbtns .send, .booth.narrow .card .askbtns .askcancel { min-height: 40px; }
.booth.narrow .card .askform input, .booth.narrow .card .askform textarea { min-height: 40px; }
.booth.narrow .viewport { margin: 4px 0; }
.booth.narrow { padding: 8px; }
@media (prefers-reduced-motion: reduce) {
  .tag.swing { animation: none; }
  .item img, .item .contact { transition: none; }
  .booth.narrow .card { animation: none; }
}
`;
