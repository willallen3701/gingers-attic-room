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
.item.mount-wall img { filter: drop-shadow(.35cqw .55cqw .35cqw rgba(30,20,10,.35)); }
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

/* ---------- light overlays ---------- */
.light { position: absolute; inset: 0; pointer-events: none; z-index: 3500; }
.light .wash { position: absolute; inset: 0; mix-blend-mode: soft-light; }
.light .panes { position: absolute; mix-blend-mode: soft-light; filter: blur(.35cqw); }
.light .vignette { position: absolute; inset: 0; mix-blend-mode: multiply;
  background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(60,35,20,.55) 100%); }

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
.booth.narrow .viewport { margin: 4px 0; }
.booth.narrow { padding: 8px; }
@media (prefers-reduced-motion: reduce) {
  .tag.swing { animation: none; }
  .item img, .item .contact { transition: none; }
  .booth.narrow .card { animation: none; }
}
`;
