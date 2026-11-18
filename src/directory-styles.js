// Shadow-DOM styles for <attic-directory> (the site's Booths page). Loaded after the room styles (styles.js),
// whose sign rules draw each booth's sign. The page sits on the site's solid theme purple; text on it is cream,
// cards are light paper. Tap targets are at least 40 px.
export const directoryCss = /* css */ `
:host {
  --purple: #633761;
  --purple-deep: #4e2a4c;
  --cream: #fee6c4;
  --heart: #c2185b;
  display: block;
  color: var(--cream);
  font-family: var(--serif);
}
.dir { max-width: 1180px; margin: 0 auto; padding: 16px; }
.dmsg { margin: 0; padding: 24px 0; font: 16px/1.4 var(--type); color: var(--cream); }
.vh { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
button { font: inherit; }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid var(--cream); outline-offset: 2px; }
.bcard button:focus-visible, .mcard button:focus-visible, .icard button:focus-visible, .gate button:focus-visible { outline-color: var(--purple); }

/* ---------- tabs ---------- */
.tabs { display: flex; gap: 6px; margin: 0 0 16px; border-bottom: 2px solid rgba(254,230,196,.35); }
.tab {
  display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 16px; margin-bottom: -2px;
  border: 2px solid transparent; border-bottom: 0; border-radius: 10px 10px 0 0; background: none; cursor: pointer;
  color: var(--cream); font: 700 16px/1 var(--serif); letter-spacing: .01em;
}
.tab:hover { background: rgba(254,230,196,.1); }
.tab[aria-selected="true"] { background: var(--cream); color: var(--purple); }
.tcount {
  display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px;
  background: var(--purple); color: var(--cream); font: 700 12px/1 var(--serif);
}
.tab[aria-selected="false"] .tcount { background: var(--cream); color: var(--purple); }

/* ---------- search, filter, sort ---------- */
.tools { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 10px; align-items: end; }
.tools[hidden] { display: none; }
.search { position: relative; display: block; }
.search svg { position: absolute; left: 13px; top: 50%; width: 18px; height: 18px; transform: translateY(-50%); color: var(--plum); pointer-events: none; }
.search input {
  width: 100%; min-height: 44px; padding: 0 14px 0 40px; border: 1px solid #d8c59c; border-radius: 22px;
  background: #fffaf0; color: var(--ink); font: 16px/1.2 var(--serif);
}
.search input::placeholder { color: #8a7560; }
.pick { display: flex; flex-direction: column; gap: 4px; min-width: 0; font: 12px/1 var(--type); letter-spacing: .05em; color: var(--cream); }
.pick select {
  width: 100%; min-height: 44px; padding: 0 34px 0 14px; border: 1px solid #d8c59c; border-radius: 22px; cursor: pointer;
  background: #fffaf0 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23633761' stroke-width='2'/%3E%3C/svg%3E") no-repeat right 14px center / 12px 8px;
  color: var(--ink); font: 15px/1.2 var(--serif); -webkit-appearance: none; appearance: none;
}
.ghostbtn {
  min-height: 44px; padding: 0 16px; border: 1px solid var(--cream); border-radius: 22px; background: none; cursor: pointer;
  color: var(--cream); font: 700 14px/1 var(--serif); white-space: nowrap;
}
.ghostbtn:hover { background: rgba(254,230,196,.12); }
.ghostbtn[hidden] { display: none; }
.resultline { min-height: 18px; margin: 10px 2px 12px; font: 13px/1.4 var(--type); color: var(--cream); }

/* ---------- booth cards ---------- */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 268px), 1fr)); gap: 18px; }
.paper {
  background:
    radial-gradient(ellipse at 20% 0%, rgba(255,255,255,.45), transparent 60%),
    radial-gradient(ellipse at 90% 100%, rgba(120,80,40,.12), transparent 55%),
    var(--paper);
  color: var(--ink); border-radius: 12px; box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 10px 24px rgba(25,8,22,.35);
}
.bcard { position: relative; display: flex; flex-direction: column; min-width: 0; padding: 12px 14px 14px; transition: transform .15s ease, box-shadow .15s ease; }
.bcard:hover { transform: translateY(-2px); box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 14px 30px rgba(25,8,22,.45); }
.bcard:focus-within { outline: 3px solid var(--cream); outline-offset: 3px; }
/* The booth's own sign: room-render signHtml() inside a box 120/26 times the sign's width, so the sign's
   cqw sizes (fractions of a 120 in room) come out right; the box is clipped to the sign. */
.signclip { position: relative; width: 84%; max-width: 300px; margin: 0 auto 10px; aspect-ratio: 26 / 11; overflow: hidden; }
.signroom { position: absolute; top: 0; left: -180.7692%; width: 461.5385%; aspect-ratio: 1 / 1; container-type: inline-size; pointer-events: none; }
/* Room peek: a small, look-only view into the booth's room (room-render, as the booth view draws it), the whole
   square room. Not cropped: things on top of tall shelves reach the ceiling. The room's own sign and the price
   tags are left out at this size (the card has the sign above it). The card's Visit overlay takes the clicks. */
.peek {
  position: relative; isolation: isolate; overflow: hidden; aspect-ratio: 1 / 1; margin: 0 0 10px;
  border-radius: 6px; pointer-events: none; background: #e9dfc8;
  box-shadow: 0 0 0 1px #b99a66, 0 0 0 4px #e3d1a8, 0 0 0 5px #b99a66, 0 6px 14px rgba(50,30,15,.22);
}
.peek .sign, .peek .tags { display: none; }
.peek .item img { transition: none; }
/* Listing reel: up to six listings between the room peek and the bio, scrolled by hand (swipe, wheel/trackpad,
   the round buttons, or the arrow keys). It sits above the card's Visit overlay so it gets its own taps. */
.reel { position: relative; z-index: 2; margin: 0 0 10px; min-width: 0; }
.reelhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; margin-bottom: 4px; }
.reeltag { font: 12px/1 var(--type); letter-spacing: .06em; text-transform: uppercase; color: var(--plum-dark); }
.reelnav { display: flex; gap: 6px; }
.reelnav[hidden] { display: none; }
.rnav {
  display: inline-grid; place-items: center; width: 40px; height: 40px; padding: 0 0 3px; border: 1px solid #d8c59c; border-radius: 50%;
  background: #fffaf0; color: var(--purple); font: 700 24px/1 var(--serif); cursor: pointer;
}
.rnav:hover:not([disabled]) { border-color: var(--purple); }
.rnav[disabled] { opacity: .4; cursor: default; }
.reeltrack {
  display: flex; gap: 8px; margin: 0; padding: 2px 2px 6px; list-style: none;
  overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scroll-padding: 2px;
  scrollbar-width: thin; scrollbar-color: #c9b58a transparent; -webkit-overflow-scrolling: touch;
}
.reeltrack li { flex: 0 0 auto; scroll-snap-align: start; }
.ritem {
  display: flex; flex-direction: column; align-items: stretch; gap: 3px; width: 76px; padding: 0; border: 0; background: none; cursor: pointer;
}
.rimg { display: grid; place-items: center; width: 76px; height: 76px; overflow: hidden; border: 1px solid #e3d3ad; border-radius: 6px; background: #fffaf0; }
.rimg img { width: 86%; height: 86%; object-fit: contain; pointer-events: none; }
.rprice { font: 700 14px/1.2 var(--serif); color: var(--ink); text-align: center; }
.ritem:hover .rimg { border-color: var(--purple); }
.bcard .ritem:focus-visible, .bcard .rnav:focus-visible { outline: 3px solid var(--purple); outline-offset: 2px; }
.by { margin: 0; font: 13px/1.35 var(--type); color: var(--ink-soft); overflow-wrap: anywhere; }
.babout {
  margin: 6px 0 0; font: italic 15px/1.4 var(--serif); color: var(--ink);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere;
}
.thumbs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 10px 0 0; padding: 0; list-style: none; }
.thumbs li { display: grid; place-items: center; aspect-ratio: 1; overflow: hidden; border: 1px solid #e3d3ad; border-radius: 6px; background: #fffaf0; }
.thumbs li.none { border-style: dashed; background: repeating-linear-gradient(45deg, #f3e8d0 0 6px, #ece0c3 6px 12px); }
.thumbs img { width: 86%; height: 86%; object-fit: contain; }
.hits { margin: 8px 0 0; font: 13px/1.35 var(--type); color: var(--plum-dark); overflow-wrap: anywhere; }
.bfoot { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: auto; padding-top: 12px; }
.bfoot .meta { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 2px 10px; flex: 1 0 100%; }
.bfoot .visit { flex: 1; }
.count { font: 13px/1.2 var(--type); color: var(--ink-soft); }
.count b { font: 700 18px/1 var(--serif); color: var(--plum-dark); }
.upd { font: 12px/1.2 var(--type); color: var(--ink-soft); }
.visit, .primary {
  min-height: 44px; padding: 0 18px; border: 0; border-radius: 22px; cursor: pointer;
  background: var(--purple); color: var(--cream); font: 700 15px/1 var(--serif); letter-spacing: .01em; white-space: nowrap; box-shadow: 0 2px 0 var(--purple-deep);
}
.visit:hover, .primary:hover { background: var(--purple-deep); }
.primary[disabled] { opacity: .7; cursor: default; }
/* The whole card opens the booth: the Visit button's hit area covers the card (the heart sits above it). */
.bcard .visit::after { content: ""; position: absolute; inset: 0; border-radius: 12px; }
.heart {
  position: relative; z-index: 2; display: inline-grid; place-items: center; width: 44px; height: 44px; flex: none;
  border: 1px solid #d8c59c; border-radius: 50%; background: #fffaf0; color: var(--purple); cursor: pointer;
}
.heart:hover { border-color: var(--purple); }
.heart svg { width: 22px; height: 22px; }
.heart path { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
.heart[aria-pressed="true"] { color: var(--heart); border-color: #e7a3bd; background: #fff1f5; }
.heart[aria-pressed="true"] path { fill: currentColor; }

/* ---------- empty states ---------- */
.empty { margin: 0; font: italic 15px/1.45 var(--serif); color: var(--ink-soft); }
.nobooths, .nomatch { grid-column: 1 / -1; padding: 28px 20px; text-align: center; }
.nobooths p, .nomatch p { margin: 0 0 6px; font: 17px/1.45 var(--serif); color: var(--ink); }
.nomatch .primary { margin-top: 10px; }

/* ---------- My collection ---------- */
.gate { max-width: 520px; margin: 8px auto; padding: 24px 22px; text-align: center; }
.gate h2 { margin: 0 0 8px; font: 700 24px/1.2 var(--serif); color: var(--plum-dark); }
.gate p { margin: 0 0 14px; font: 16px/1.45 var(--serif); color: var(--ink); }
.colsec { margin: 0 0 26px; }
.colsec > h2 { display: flex; align-items: baseline; gap: 8px; margin: 0 0 12px; font: 700 22px/1.2 var(--serif); color: var(--cream); }
.colsec > h2:focus { outline: none; }
.colsec > h2 small { font: 14px var(--type); opacity: .85; }
.colsec .empty { padding: 16px 18px; color: var(--ink-soft); }
.mgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 16px; }
.mcard { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 12px 14px 14px; }
.mcard .signclip { margin-bottom: 0; }
.macts { display: flex; align-items: center; gap: 10px; margin-top: auto; }
.macts .primary { flex: 1; }
.igrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 16px; }
.icard { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; min-width: 0; padding: 12px; }
.iphoto { display: grid; place-items: center; width: 96px; height: 96px; overflow: hidden; border-radius: 8px; background: #fffaf0; box-shadow: 0 0 0 1px #e3d3ad; }
.iphoto img { width: 88%; height: 88%; object-fit: contain; }
.icard.out .iphoto img { filter: saturate(.6); opacity: .75; }
.ibody { display: flex; flex-direction: column; min-width: 0; }
.ititle { margin: 0; font: 700 16px/1.25 var(--serif); color: var(--plum-dark); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.iprice { margin: 4px 0 0; font: 700 20px/1.1 var(--serif); color: var(--ink); }
.icard.out .iprice { color: var(--ink-soft); text-decoration: line-through; text-decoration-thickness: 1px; }
.ifrom { margin: 0; font: 13px/1.3 var(--type); color: var(--ink-soft); }
.lnk {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0; border: 0; background: none; cursor: pointer; text-align: left;
  color: var(--plum); font: 13px/1.3 var(--type); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere;
}
.istatus { align-self: flex-start; margin: 2px 0 0; padding: 2px 9px; border-radius: 10px; font: 700 13px/1.5 var(--serif); letter-spacing: .02em; }
.istatus.sold, .istatus.soldout { background: #f6d6cf; color: #8a2b1a; }
.istatus.unavailable { background: #e4dcd2; color: #4a3b2e; }
.iacts { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.cartbtn {
  display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 0; border-radius: 22px; cursor: pointer;
  background: var(--purple); color: var(--cream); font: 700 14px/1 var(--serif); white-space: nowrap;
}
.cartbtn:hover { background: var(--purple-deep); }
.cartbtn[disabled] { opacity: .7; cursor: default; }
.cartbtn svg { width: 18px; height: 18px; }

.demo { margin: 22px 0 0; font: 12px/1.4 var(--type); color: var(--cream); opacity: .85; text-align: center; }
.dtoast {
  position: fixed; left: 50%; bottom: 16px; z-index: 50; max-width: min(92vw, 480px); padding: 10px 16px; border-radius: 20px;
  background: #1d1612; color: #fbf3e3; font: 14px/1.35 var(--serif); text-align: center; pointer-events: none;
  opacity: 0; transform: translate(-50%, 16px); transition: opacity .2s ease, transform .2s ease;
}
.dtoast.show { opacity: 1; transform: translate(-50%, 0); }

@media (max-width: 680px) {
  .dir { padding: 12px; }
  .tools { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .search, .ghostbtn { grid-column: 1 / -1; }
  .tab { flex: 1; justify-content: center; padding: 0 8px; font-size: 14px; }
}
@media (max-width: 360px) {
  .icard { grid-template-columns: 76px minmax(0, 1fr); gap: 10px; }
  .iphoto { width: 76px; height: 76px; }
}
@media (prefers-reduced-motion: reduce) {
  .bcard, .dtoast { transition: none; }
  .bcard:hover { transform: none; }
}
`;
