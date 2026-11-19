// Shadow-DOM styles for <attic-editor>. Loaded after the room styles (styles.js) and builds on its tokens.
export const editorCss = /* css */ `
:host { display: block; min-height: 100%; }
.ed {
  position: relative;
  display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 16px; padding: 12px;
  min-height: 100%;
  background:
    radial-gradient(ellipse at 15% 0%, rgba(255,255,255,.4), transparent 55%),
    radial-gradient(ellipse at 90% 100%, rgba(120,80,40,.10), transparent 50%),
    var(--paper);
  color: var(--ink); font-family: var(--serif);
}
.ed.loading, .ed.narrowmode { display: block; }
.loadmsg { font: 16px/1.4 var(--type); color: var(--plum-dark); padding: 24px; }

/* ---------- side panel ---------- */
.panel {
  position: sticky; top: 12px; align-self: start;
  display: flex; flex-direction: column; max-height: calc(100vh - 24px); overflow: hidden;
  background: #f7efdc; border: 1px solid #d8c59c; border-radius: 6px;
  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 6px 20px rgba(60,35,20,.10);
}
.brand { padding: 12px 14px 10px; border-bottom: 1px dashed #cdb88c; }
.brand .kicker { display: block; font: 12px/1.2 var(--type); letter-spacing: .14em; text-transform: uppercase; color: var(--plum); }
.brand .title { display: block; font: 700 22px/1.15 var(--serif); color: var(--plum-dark); }
.panelbody { display: grid; grid-template-columns: 84px minmax(0, 1fr); flex: 1; min-height: 0; }
.tabs { display: flex; flex-direction: column; gap: 2px; padding: 8px 6px; border-right: 1px dashed #cdb88c; background: rgba(255,255,255,.28); overflow: auto; }
.tab {
  display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 4px;
  border: 0; border-radius: 6px; background: none; cursor: pointer;
  font: 11.5px/1.15 var(--type); color: var(--ink-soft); text-align: center;
}
.tab svg { width: 22px; height: 22px; }
.tab:hover { background: rgba(107,58,92,.08); color: var(--plum-dark); }
.tab[aria-selected="true"] { background: var(--plum); color: var(--paper); }
.tab.pulse { box-shadow: 0 0 0 2px #1d1612; animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 0 2px #1d1612, 0 0 0 6px rgba(29,22,18,.18); } }
.tab:focus-visible, .sw:focus-visible, .srccard:focus-visible, .tb:focus-visible, .primary:focus-visible, .mini:focus-visible,
.toggle:focus-visible, .lightopt:focus-visible, .seg button:focus-visible, .wb:focus-visible { outline: 2px dashed var(--plum); outline-offset: 2px; }
.tabbody { overflow: auto; padding: 12px 14px 16px; }
.tabbody section { margin: 0 0 16px; }
.tabbody h3 {
  display: flex; align-items: center; gap: 6px; margin: 0 0 8px;
  font: 700 12px/1.2 var(--type); letter-spacing: .1em; text-transform: uppercase; color: var(--plum-dark);
}
.tabbody h3 svg { width: 16px; height: 16px; }
.tabbody h3 small { font-weight: 400; letter-spacing: 0; color: var(--ink-soft); }
.lede { margin: 0 0 12px; font: italic 14px/1.4 var(--serif); color: var(--ink-soft); }
.empty { margin: 0; font: italic 13.5px/1.4 var(--serif); color: var(--ink-soft); }
.foot { margin: 8px 0 0; padding-top: 8px; border-top: 1px dashed #cdb88c; font: 12px/1.35 var(--type); color: var(--ink-soft); }
.note { margin: 8px 0 0; padding: 6px 8px; border-left: 3px solid var(--plum); background: #f3e3ee; font: 12.5px/1.35 var(--serif); color: var(--plum-dark); }

.swatches { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.sw {
  position: relative; aspect-ratio: 1; padding: 0; overflow: hidden; cursor: pointer;
  border: 2px solid #d8c59c; border-radius: 6px; background-color: #efe4cb; background-size: 72px auto;
}
.sw span {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 2px 4px;
  background: rgba(250,244,230,.92); font: 10px/1.25 var(--type); color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sw:hover { border-color: var(--plum-soft); }
.sw.on { border-color: var(--plum); box-shadow: 0 0 0 2px var(--plum); }
.paints { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sw.paint { aspect-ratio: auto; display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: none; padding: 2px 0; overflow: visible; }
.sw.paint i { width: 42px; height: 42px; border-radius: 50%; border: 2px solid #fffaf0; box-shadow: 0 0 0 1px #c9b28a; }
.sw.paint span { position: static; background: none; text-align: center; white-space: normal; }
.sw.paint.on { box-shadow: none; }
.sw.paint.on i { box-shadow: 0 0 0 3px var(--plum); }

.range { display: flex; align-items: center; gap: 10px; }
.range input { flex: 1; accent-color: var(--plum); }
.range output { min-width: 40px; font: 12px var(--type); color: var(--plum-dark); }

.uploadbtn {
  position: relative; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px 12px;
  border: 1px dashed var(--plum); border-radius: 6px; background: #fffaf0; cursor: pointer;
  font: 13px var(--type); color: var(--plum-dark);
}
.uploadbtn:hover { background: #fff; }
.uploadbtn:focus-within { outline: 2px dashed var(--plum); outline-offset: 2px; }
.uploadbtn svg { width: 18px; height: 18px; }
.uploadbtn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.seg { display: flex; margin-top: 8px; border: 1px solid #cbb385; border-radius: 6px; overflow: hidden; }
.seg button { flex: 1; padding: 7px 6px; border: 0; background: #fbf5e6; cursor: pointer; font: 12px var(--type); color: var(--plum-dark); }
.seg button + button { border-left: 1px solid #cbb385; }
.seg button[aria-pressed="true"] { background: var(--plum); color: var(--paper); }

.toggles { display: flex; flex-direction: column; gap: 6px; }
.toggle {
  display: flex; align-items: center; gap: 8px; padding: 7px 9px; text-align: left; cursor: pointer;
  border: 1px solid #cbb385; border-radius: 6px; background: #fbf5e6; font: 13.5px/1.2 var(--serif); color: var(--ink);
}
.toggle i { width: 26px; height: 10px; border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.2); }
.toggle.on { background: #f3e3ee; border-color: var(--plum); box-shadow: inset 3px 0 0 var(--plum); }

.lights { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lightopt {
  display: flex; flex-direction: column; gap: 5px; padding: 6px; cursor: pointer; text-align: left;
  border: 2px solid #d8c59c; border-radius: 6px; background: #fbf5e6; font: 12px/1.2 var(--type); color: var(--ink);
}
.lightopt i { height: 46px; border-radius: 4px; }
.lightopt i.none { background: repeating-linear-gradient(45deg, #f2e8d2 0 6px, #e8dbbd 6px 12px); }
.lightopt.on { border-color: var(--plum); box-shadow: 0 0 0 2px var(--plum); }

/* Booth sound picker (Light & sound tab): one row per sound, a Listen button for the seller only. */
.soundlist { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
.soundopt { display: flex; align-items: stretch; gap: 6px; }
.soundopt .pick {
  display: flex; flex: 1; align-items: center; gap: 8px; min-height: 40px; padding: 0 10px; cursor: pointer; text-align: left;
  border: 2px solid #d8c59c; border-radius: 6px; background: #fbf5e6; font: 13px/1.2 var(--serif); color: var(--ink);
}
.soundopt .pick i { display: inline-grid; place-items: center; flex: none; width: 18px; height: 18px; border: 2px solid #b99a66; border-radius: 50%; font: 700 11px/1 var(--serif); font-style: normal; color: #fff; }
.soundopt.on .pick { border-color: var(--plum); box-shadow: 0 0 0 1px var(--plum); background: #f3e3ee; }
.soundopt.on .pick i { border-color: var(--plum); background: var(--plum); }
.soundopt .listen {
  flex: none; min-width: 84px; min-height: 40px; padding: 0 10px; cursor: pointer;
  border: 1px solid #d8c59c; border-radius: 20px; background: #fffaf0; font: 12px/1 var(--type); color: var(--plum-dark);
}
.soundopt .listen.on { background: var(--plum); border-color: var(--plum); color: var(--paper); }
.soundopt .pick:focus-visible, .soundopt .listen:focus-visible { outline: 2px dashed var(--plum); outline-offset: 2px; }

.srcgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.srccard {
  display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 6px;
  border: 1px solid #d8c59c; border-radius: 6px; background: #fffaf0; cursor: grab; touch-action: none; text-align: center;
}
.srccard:hover { border-color: var(--plum-soft); box-shadow: 0 2px 8px rgba(60,35,20,.12); }
.srccard .thumb { width: 100%; height: 66px; display: grid; place-items: center; }
.srccard img { max-width: 100%; max-height: 66px; object-fit: contain; pointer-events: none; }
.srccard .nm { font: 13px/1.2 var(--serif); color: var(--ink); }
.srccard .dim { font: 10.5px/1.25 var(--type); color: var(--ink-soft); }

.count { margin-bottom: 12px; padding: 8px 10px; border: 1px solid #d8c59c; border-radius: 6px; background: #fbf5e6; font: 13px var(--type); color: var(--ink-soft); }
.count b { font: 700 20px var(--serif); color: var(--plum-dark); }
.count.full { background: #f8e3df; border-color: #c97a6c; }
.crate {
  padding: 10px; border: 1px solid #c9ad7c; border-radius: 6px;
  background: repeating-linear-gradient(90deg, rgba(150,110,60,.10) 0 22px, rgba(150,110,60,.03) 22px 44px), #f4e6c6;
}
.itemlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.itemrow { display: flex; align-items: center; gap: 8px; padding: 6px; border: 1px solid #e0cfa8; border-radius: 6px; background: #fffaf0; }
.itemrow.src { cursor: grab; touch-action: none; }
.itemrow .thumb { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: 4px; background: #f3e8d0; }
.itemrow img { max-width: 40px; max-height: 40px; object-fit: contain; pointer-events: none; }
.itemrow .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.itemrow .nm { font: 13.5px/1.25 var(--serif); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.itemrow .dim { font: 12px var(--type); color: var(--ink-soft); }
.mini { padding: 5px 11px; border: 1px solid var(--plum); border-radius: 14px; background: #fff; cursor: pointer; font: 12px var(--type); color: var(--plum-dark); }
.mini:hover { background: var(--plum); color: var(--paper); }
.mini:disabled { opacity: .45; cursor: default; background: #fff; color: var(--plum-dark); }

.signform { display: flex; flex-direction: column; gap: 12px; }
.signform > label { display: flex; flex-direction: column; gap: 4px; font: 12px var(--type); letter-spacing: .05em; color: var(--plum-dark); }
.signform input, .signform textarea {
  padding: 8px 10px; border: 1px solid #cbb385; border-radius: 6px; background: #fffaf0;
  font: 15px/1.35 var(--serif); color: var(--ink); resize: vertical;
}
.signform input:focus-visible, .signform textarea:focus-visible { outline: 2px solid var(--plum); outline-offset: 1px; }
.signform fieldset { margin: 0; padding: 0; border: 0; }
.signform legend { margin-bottom: 6px; font: 12px var(--type); letter-spacing: .05em; color: var(--plum-dark); }
.signstyles { display: flex; flex-direction: column; gap: 6px; }
.signopt { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.signopt input { accent-color: var(--plum); }
.signchip { display: inline-block; padding: 8px 14px; border-radius: 5px; font: 700 14px var(--serif); }
.signchip.style-wood { background: linear-gradient(180deg, #8a5a36, #6a4127); color: #f6e7c4; }
.signchip.style-cream { background: linear-gradient(180deg, #f4ead2, #e2d1aa); color: var(--plum-dark); box-shadow: inset 0 0 0 1px #7a5a3a; }
.signchip.style-brass { background: linear-gradient(160deg, #e7cf8a, #b8913f 45%, #8a6a2a 70%, #d9bd73); color: #3a2a12; }

.primary {
  padding: 10px 18px; border: 0; border-radius: 20px; cursor: pointer;
  background: var(--plum); color: var(--paper); font: 700 14px var(--type); box-shadow: 0 2px 0 var(--plum-dark);
}
.primary:hover { background: var(--plum-dark); }
.primary:disabled { background: #bfaeb8; box-shadow: none; cursor: default; }

/* ---------- stage ---------- */
.stage { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.topbar, .selbar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px;
  background: #f7efdc; border: 1px solid #d8c59c; border-radius: 6px;
}
.topbar { justify-content: space-between; flex-wrap: nowrap; } /* one line always: a wrap changes the editor's height by ~30px and the embed's scrollbar flickers */
.status { display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; min-width: 0; flex: 1 1 auto; font: 13px var(--type); color: var(--ink); }
.status .savetext { flex: none; white-space: nowrap; }
.status .chip { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.savedot { width: 9px; height: 9px; border-radius: 50%; background: #6f9e60; }
.savedot.pending, .savedot.saving { background: #d1a24a; }
.savedot.error { background: var(--sold); }
.chip { padding: 3px 9px; border: 1px solid; border-radius: 12px; font: 12px var(--type); }
.chip.on { color: #2f5d2a; border-color: #8cb37f; background: #eef6e9; }
.chip.warn { color: #7a4a10; border-color: #d9a65a; background: #fbf0dc; }
.chip.off { color: var(--ink-soft); border-color: #cbb385; background: #fbf5e6; }
.acts { display: flex; align-items: center; gap: 8px; flex: none; }
.acts .tb, .acts .primary { white-space: nowrap; }
.tb {
  padding: 7px 11px; border: 1px solid #cbb385; border-radius: 5px; background: #fbf5e6; cursor: pointer;
  font: 13px var(--type); color: var(--plum-dark);
}
.tb:hover { background: #fff; }
.tb:disabled { opacity: .45; cursor: default; background: #fbf5e6; }
.tb.danger { color: var(--sold); border-color: #d9a19a; }

.roomframe {
  position: relative; z-index: 0; isolation: isolate; /* keep the room's own z-indexes below the bubbles */
  /* 166 px = padding + top bar + gaps + selection bar + frame shadow, with a few px to spare: if the
     editor is even 1 px taller than its embed, a scrollbar flickers in and out while dragging. */
  width: min(100%, calc(100vh - 166px)); min-width: 320px; align-self: center;
  border-radius: 4px;
  box-shadow: 0 0 0 1px #b99a66, 0 0 0 5px #e3d1a8, 0 0 0 6px #b99a66, 0 10px 26px rgba(50,30,15,.25);
}
.room.edit { outline: none; touch-action: none; }
.room.edit .fixture.movable, .room.edit .placeable.movable, .room.edit .item.movable { pointer-events: auto; cursor: grab; }
.room.edit.dragging, .room.edit.dragging * { cursor: grabbing !important; }
.room.edit .item:hover img { transform: none; }
.room.edit .sel { outline: 2px dashed var(--plum); outline-offset: .35cqw; border-radius: .3cqw; }
.room.edit .fixture.sel img, .room.edit .placeable.sel img { filter: drop-shadow(0 0 .35cqw rgba(107,58,92,.5)) drop-shadow(0 .5cqw .35cqw rgba(40,25,10,.3)); }
.room.edit .bad { outline: 2px solid var(--sold); outline-offset: .25cqw; border-radius: .3cqw; }
.room.edit .bad img { filter: drop-shadow(0 0 .5cqw rgba(179,38,30,.9)) sepia(.35); opacity: .85; }
.room.edit .lifted.item { z-index: 3900 !important; } /* fixtures keep their depth so their contents stay on top */
.room.edit .lifted.item img { transform: translateY(-.6cqw); }
.room.edit .tags, .room.edit .tag { pointer-events: none; }
.room.edit.dropping { box-shadow: inset 0 0 0 .6cqw rgba(107,58,92,.35); }
.guide {
  position: absolute; height: .5cqw; margin-top: -.25cqw; border-radius: .3cqw; pointer-events: none; z-index: 3950;
  background: rgba(107,58,92,.7); box-shadow: 0 0 .7cqw rgba(107,58,92,.6);
}
.was { position: absolute; z-index: 6; pointer-events: none; border: 2px dashed rgba(107,58,92,.75); border-radius: .3cqw; background: rgba(107,58,92,.07); }

.selbar { min-height: 56px; box-sizing: border-box; } /* same height selected or idle, so nothing jumps */
.selbar.idle .hint { font: 12.5px/1.4 var(--type); color: var(--ink-soft); }
kbd { padding: 0 4px; border: 1px solid #cbb385; border-bottom-width: 2px; border-radius: 3px; background: #fffaf0; font: 11px var(--type); }
.selbar .thumb { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid #e0cfa8; border-radius: 4px; background: #fffaf0; }
.selbar .thumb img { max-width: 34px; max-height: 34px; object-fit: contain; }
.selname { display: flex; flex-direction: column; margin-right: auto; font: 15px/1.15 var(--serif); }
.selname small { font: 11.5px var(--type); color: var(--ink-soft); }
.variants { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.variants .vlabel { margin-right: 2px; font: 12px var(--type); color: var(--plum-dark); }
.variant {
  display: flex; flex-direction: column; align-items: center; gap: 2px; width: 74px; padding: 3px 3px 2px; cursor: pointer;
  border: 2px solid #d8c59c; border-radius: 6px; background: #fffaf0; font: 10px/1.15 var(--type); color: var(--ink-soft);
}
.variant img { width: 100%; height: 30px; object-fit: contain; }
.variant span { max-width: 100%; text-align: center; }
.variant:hover { border-color: var(--plum-soft); }
.variant.on { border-color: var(--plum); box-shadow: 0 0 0 1px var(--plum); color: var(--plum-dark); font-weight: 700; }
.range.small { gap: 6px; font: 12px var(--type); color: var(--plum-dark); }
.range.small input { width: 110px; }
.nudges { display: flex; gap: 3px; }
.nudges .tb { padding: 6px 9px; }

/* ---------- selected things come to the front, so they can always be grabbed ---------- */
.room.edit .item.sel, .room.edit .box.sel { z-index: 3800 !important; }
.room.edit .box.movable { cursor: grab; }
.room.edit .box:hover .boxin { transform: none; }
.tb.primaryish { background: var(--plum); color: var(--paper); border-color: var(--plum); }
.tb.primaryish:hover { background: var(--plum-dark); }
.srccard[disabled] { opacity: .5; cursor: not-allowed; }

/* ---------- collectibles boxes: little pictures and the "fill the compartments" sheet ---------- */
.minibox { display: inline-grid; gap: 2px; width: 54px; height: 54px; padding: 4px; border-radius: 4px; box-shadow: 0 2px 4px rgba(30,15,5,.3); }
.minibox i { background: var(--lining); border-radius: 1px; box-shadow: inset 0 1px 2px rgba(0,0,0,.45); }
.minibox.style-crate { background: repeating-linear-gradient(0deg, #c99d63 0 5px, #b98c52 5px 6px); border: 2px solid #8c6236; }
.minibox.style-jewelry { background: linear-gradient(160deg, #6b2a17, #3d160b 70%); border: 2px solid #2a0f07; box-shadow: inset 0 0 0 2px #c9a14a, 0 2px 4px rgba(30,15,5,.3); }
.minibox.style-curio { background: linear-gradient(180deg, #b07c4a, #8a5c33); border: 2px solid #5e3c1f; }
.selbar .thumb .minibox { width: 34px; height: 34px; padding: 2px; gap: 1px; }
.boxsheet .sheetcard { width: min(920px, 100%); }
.bxcols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.bxgrid { gap: 8px; padding: 12px; }
.bxcellwrap { position: relative; min-width: 0; }
.bxcell {
  display: grid; place-items: center; width: 100%; aspect-ratio: 1; padding: 0; border: 0; border-radius: 6px; cursor: pointer;
  background: radial-gradient(ellipse at 50% 35%, rgba(255,255,255,.16), transparent 70%), var(--lining, #5b2a4a);
  box-shadow: inset 0 3px 6px rgba(0,0,0,.45); color: rgba(255,255,255,.65); font: 700 15px var(--type);
}
.bxcell img { width: 80%; height: 80%; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,.4)); }
.bxcell.sel { box-shadow: inset 0 3px 6px rgba(0,0,0,.45), 0 0 0 3px #fffaf0, 0 0 0 6px var(--plum); }
.bxcell:focus-visible { outline: 2px dashed #fffaf0; outline-offset: -5px; }
.bxclear {
  position: absolute; top: -8px; right: -8px; width: 28px; height: 28px; border: 2px solid #fffaf0; border-radius: 50%;
  background: #1d1612; color: #fff; cursor: pointer; font: 16px/1 var(--serif);
}
.bxfs { margin: 0 0 14px; padding: 0; border: 0; min-width: 0; }
.bxfs legend, .bxh { margin: 0 0 6px; padding: 0; font: 700 12px/1.2 var(--type); letter-spacing: .1em; text-transform: uppercase; color: var(--plum-dark); }
.bxh small { font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--ink-soft); }
.bxfs .seg { margin: 0; }
.linings { display: flex; flex-wrap: wrap; gap: 8px; }
.lining { width: 40px; height: 40px; padding: 4px; border: 2px solid #d8c59c; border-radius: 50%; background: #fffaf0; cursor: pointer; }
.lining i { display: block; width: 100%; height: 100%; border-radius: 50%; box-shadow: inset 0 1px 3px rgba(0,0,0,.4); }
.lining.on { border-color: var(--plum); box-shadow: 0 0 0 2px var(--plum); }
.bxdims { display: flex; align-items: flex-end; gap: 8px; font: 15px var(--serif); color: var(--ink-soft); }
.bxdims label { display: flex; flex-direction: column; gap: 3px; font: 12px var(--type); color: var(--plum-dark); }
.bxdims select { min-height: 38px; padding: 4px 10px; border: 1px solid #cbb385; border-radius: 6px; background: #fffdf7; font: 15px var(--serif); color: var(--ink); }
.bxitems { display: flex; flex-direction: column; gap: 6px; max-height: 300px; margin: 0; padding: 0 4px 0 0; overflow: auto; list-style: none; }
.bxitems .empty { padding: 8px; }
.bxitem {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px; border: 1px solid #e0cfa8; border-radius: 6px;
  background: #fffaf0; cursor: pointer; text-align: left; font: inherit; color: var(--ink);
}
.bxitem:hover { border-color: var(--plum-soft); }
.bxitem.here { border-color: var(--plum); background: #f3e3ee; }
.bxitem .thumb { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 4px; background: #f3e8d0; }
.bxitem img { max-width: 36px; max-height: 36px; object-fit: contain; }
.bxitem .txt { display: flex; flex-direction: column; min-width: 0; }
.bxitem .nm { font: 14px/1.25 var(--serif); }
.bxitem .dim { font: 11.5px/1.3 var(--type); color: var(--ink-soft); }
@media (max-width: 720px) { .bxcols { grid-template-columns: 1fr; } }

/* ---------- a selected lamp's On/Off switch ---------- */
.lampswitch {
  display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 4px 12px 4px 6px; cursor: pointer;
  border: 1px solid #cbb385; border-radius: 18px; background: #fbf5e6; font: 700 13px var(--type); color: var(--plum-dark);
}
.lampswitch .track { position: relative; width: 38px; height: 22px; border-radius: 11px; background: #cdbd9f; box-shadow: inset 0 1px 2px rgba(0,0,0,.25); transition: background .2s; }
.lampswitch .knob { position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fffaf0; box-shadow: 0 1px 2px rgba(0,0,0,.35); transition: transform .2s; }
.lampswitch[aria-checked="true"] { border-color: #d9a65a; background: #fff3d6; }
.lampswitch[aria-checked="true"] .track { background: #e0a43a; box-shadow: inset 0 1px 2px rgba(0,0,0,.2), 0 0 8px rgba(255,190,90,.8); }
.lampswitch[aria-checked="true"] .knob { transform: translateX(16px); }
.lampswitch:focus-visible { outline: 2px dashed var(--plum); outline-offset: 2px; }
.lampnote { margin: 0 0 8px; }
@media (prefers-reduced-motion: reduce) { .lampswitch .track, .lampswitch .knob { transition: none; } }

/* ---------- drag ghost from the panel ---------- */
.ghost { position: fixed; z-index: 9999; pointer-events: none; transform: translate(-50%, -100%); filter: drop-shadow(0 6px 10px rgba(40,25,10,.35)); }
.ghost img { display: block; max-width: 130px; max-height: 130px; opacity: .92; }
.ghost.kind-fixture, .ghost.kind-placeable { transform: translate(-50%, -50%); }

/* ---------- speech bubbles (wizard + coach marks), after the mockup's black cloud ---------- */
.overlay { position: absolute; inset: 0; z-index: 50; pointer-events: none; }
.bubble {
  position: absolute; pointer-events: auto; padding: 16px 18px; border-radius: 22px;
  background: #1d1612; color: #fbf3e3; font: 15px/1.4 var(--serif);
  box-shadow: 0 12px 34px rgba(20,10,5,.38);
}
.bubble::before { content: ""; position: absolute; width: 18px; height: 18px; background: #1d1612; transform: rotate(45deg); }
.wizard { left: 362px; top: 76px; width: 350px; }
.wizard::before { left: -8px; top: 42px; }
.wizard.at-open { left: auto; right: 18px; top: 72px; }
.wizard.at-open::before { left: auto; right: 70px; top: -8px; }
.wizard h3 { margin: 2px 0 6px; font: 700 21px/1.2 var(--serif); color: #fbf3e3; }
.wizard p { margin: 0 0 10px; }
.wizard .stepno { margin: 0 0 4px; font: 12px var(--type); letter-spacing: .08em; color: #d9c3a0; }
.steps { display: flex; gap: 5px; margin-bottom: 8px; }
.steps span { width: 24px; height: 4px; border-radius: 2px; background: #5a4a3e; }
.steps .done { background: #b48aa6; }
.steps .cur { background: #fbf3e3; }
.soon { margin-bottom: 10px; padding: 6px 9px; border: 1px dashed #b48aa6; border-radius: 8px; background: #3a2e26; font: 12.5px var(--type); color: #f0d8e8; }
.wbtns { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.wb { padding: 8px 14px; border: 0; border-radius: 16px; background: #fbf3e3; color: #1d1612; cursor: pointer; font: 700 13px var(--type); }
.wb.alt { background: transparent; color: #fbf3e3; border: 1px solid #7d6a5a; }
.wb.link { padding: 8px 4px; background: none; color: #d9c3a0; text-decoration: underline; font-weight: 400; }
.coach { width: 236px; padding: 12px 15px; font-size: 14px; }
.coach p { margin: 0; }
.c-tabs { left: 104px; top: 148px; }
.c-tabs::before { left: -8px; top: 20px; }
.c-room { left: 400px; top: 210px; }
.c-room::before { left: 30px; bottom: -8px; }
.c-open { right: 18px; top: 72px; width: 268px; }
.c-open::before { right: 64px; top: -8px; }
.c-open .wbtns { margin-top: 10px; }

/* ---------- toast ---------- */
.ed > .toast {
  position: fixed; left: 50%; bottom: 24px; top: auto; z-index: 10000; pointer-events: none;
  max-width: min(90vw, 520px); padding: 10px 16px; border-radius: 20px; text-align: center;
  background: #1d1612; color: #fbf3e3; font: 14px/1.35 var(--serif);
  opacity: 0; transform: translate(-50%, 20px); transition: opacity .2s ease, transform .2s ease;
}
.ed > .toast.show { opacity: 1; transform: translate(-50%, 0); }

/* ---------- phones: read-only room + notice ---------- */
.narrowmsg { margin: 0 0 12px; padding: 14px 16px; border: 1px solid #d8c59c; border-radius: 6px; background: #f7efdc; }
.narrowmsg h2 { margin: 0 0 6px; font: 700 20px/1.2 var(--serif); color: var(--plum-dark); }
.narrowmsg p { margin: 0; font: 14.5px/1.4 var(--serif); color: var(--ink-soft); }
.narrowmode .roomframe { width: 100%; min-width: 0; }
.room.viewonly .tag { pointer-events: none; }
.narrowitems { margin: 0 0 12px; padding: 12px; border: 1px solid #d8c59c; border-radius: 6px; background: #f7efdc; }
.narrowitems .additem { margin-bottom: 10px; }
/* Phones: tap targets of at least 40 px. */
.narrowmode .primary, .ed.loading .primary { min-height: 44px; }
.narrowmode .lnk { min-height: 40px; padding: 0 6px; }
.narrowmode .rowacts { gap: 0 6px; margin-left: -6px; }

/* ---------- items: add button, status badges, row actions ---------- */
.additem { width: 100%; margin-bottom: 12px; }
.ibadge { display: block; align-self: flex-start; max-width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; padding: 1px 6px; border-radius: 8px; font: 11px/1.4 var(--type); white-space: nowrap; }
.itemrow { align-items: flex-start; }
.itemrow .mini { flex: none; margin-top: 2px; }
.ibadge.wait { background: #f5e6c4; color: #6b4a12; }
.ibadge.bad { background: #f6d6cf; color: #8a2b1a; }
.ibadge.sold { background: #e4dcd2; color: #4a3b2e; }
.ibadge.sale { background: #dcefd6; color: #2f5d2a; }
.ibadge + .ibadge { margin-top: 2px; }
.brand .whose { display: block; margin-top: 2px; font: italic 13px/1.3 var(--serif); color: var(--ink-soft); }
.rowacts { display: flex; flex-wrap: wrap; gap: 2px 10px; }
.lnk { padding: 0; border: 0; background: none; cursor: pointer; font: 12px var(--type); color: var(--plum); text-decoration: underline; }
.lnk.danger { color: #a3301c; font-weight: 700; }
/* Listing-reel highlights (My Items): a star toggle per item and a short summary at the top. */
.lnk.hl { text-decoration: none; color: #8a6a1f; }
.lnk.hl.on { color: #a8740b; font-weight: 700; }
.lnk.hl[aria-disabled="true"] { color: #a99a86; cursor: not-allowed; }
.hlsum { margin-top: 10px; }
.hlsum .note { margin-top: 4px; }
.rownote { font: italic 12px/1.3 var(--serif); color: #8a2b1a; }
.item.unapproved img { opacity: .6; }
.item.unapproved::after { content: ""; position: absolute; inset: -3px; border: 2px dashed #b07a1a; border-radius: 4px; pointer-events: none; }

/* ---------- add / edit item sheet ---------- */
.sheethost { display: contents; }
.sheet {
  position: fixed; inset: 0; z-index: 9000; display: grid; place-items: start center; padding: 16px;
  background: rgba(29, 22, 18, .55); font-family: var(--serif); color: var(--ink);
}
/* Pinned to the top and capped: the embed can be taller than the visitor's window, so the
   buttons must not sit below what they can see (the page also scrolls the embed into view). */
.sheetcard {
  width: min(980px, 100%); max-height: min(calc(100vh - 32px), 700px); display: flex; flex-direction: column; overflow: hidden;
  background: var(--paper); border: 1px solid #cdb88c; border-radius: 10px; box-shadow: 0 18px 50px rgba(0,0,0,.35); outline: none;
}
.sheethead { display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-bottom: 1px dashed #cdb88c; background: #f7efdc; }
.sheethead h2 { flex: 1; min-width: 0; margin: 0; font: 700 20px/1.2 var(--serif); color: var(--plum-dark); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sheetsteps { display: flex; gap: 6px; margin: 0; padding: 0; list-style: none; font: 12px var(--type); color: var(--ink-soft); }
/* Steps read as plain text, not as buttons (testers took a "Send" chip for a button next to "Looks good"). */
.sheetsteps li { padding: 2px 0; color: var(--ink-soft); }
.sheetsteps li + li::before { content: "A"; margin-right: 6px; color: #b9a684; }
.sheetsteps li.cur { color: var(--plum-dark); font-weight: 700; text-decoration: underline; text-underline-offset: 4px; }
.sheetsteps li.done { color: var(--ink-soft); }
.weightwarn .note { margin-top: 6px; }
.sheetx { width: 34px; height: 34px; border: 0; border-radius: 50%; background: none; cursor: pointer; font: 26px/1 var(--serif); color: var(--plum-dark); }
.sheetx:hover { background: #efe2c4; }
.sheetconfirm { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: #f6d6cf; font: 14px var(--serif); color: #8a2b1a; }
.sheetbody { flex: 1; min-height: 0; overflow: auto; padding: 16px; }
.sheetbtns { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.wb2 { padding: 9px 16px; border: 1px solid var(--plum); border-radius: 20px; background: #fffaf0; cursor: pointer; font: 13px var(--type); color: var(--plum-dark); }
.wb2:hover { background: #f3e3ee; }
.tips { margin: 0 0 14px; padding-left: 20px; font: 14.5px/1.5 var(--serif); }
.bigdrop {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 200px;
  border: 2px dashed var(--plum-soft); border-radius: 10px; background: #fffaf0; cursor: pointer; font: 16px var(--type); color: var(--plum-dark);
}
.bigdrop:hover { background: #f8eef3; }
.bigdrop svg { width: 46px; height: 46px; }
.bigdrop input, .uploadbtn.small input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.agreebox { max-height: 46vh; overflow: auto; padding: 12px 16px; border: 1px solid #d8c59c; border-radius: 6px; background: #fffaf0; font: 14px/1.5 var(--serif); }
.agreebox h3 { margin: 0 0 6px; font: 700 18px var(--serif); color: var(--plum-dark); }
.agreebox h4 { margin: 14px 0 4px; font: 700 14.5px var(--serif); }
.agreebox p { margin: 0 0 8px; }
.agreebox ul { margin: 0; padding-left: 20px; }
.agreebox .ver { margin-top: 12px; font: 12px var(--type); color: var(--ink-soft); }
.agreecheck { display: flex; gap: 10px; align-items: flex-start; margin-top: 12px; font: 14.5px/1.4 var(--serif); }
.agreecheck input { margin-top: 3px; accent-color: var(--plum); }
.cutbusy { display: grid; justify-items: center; gap: 10px; padding: 40px 10px; text-align: center; font: 15px/1.4 var(--serif); }
.cutbusy p { margin: 0; max-width: 460px; }
.spinner { width: 34px; height: 34px; border: 3px solid #e0cfa8; border-top-color: var(--plum); border-radius: 50%; animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 3s; } }
.bar { width: min(360px, 80%); height: 8px; border-radius: 4px; background: #e0cfa8; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--plum); }
.sheet .dim { margin: 0; font: 12px var(--type); color: var(--ink-soft); }
.cutwrap { display: grid; place-items: center; padding: 8px; border: 1px solid #d8c59c; border-radius: 6px; background: #efe4cc; }
.cutcanvas {
  max-width: 100%; max-height: 52vh; touch-action: none; cursor: crosshair;
  background: conic-gradient(#ddd 25%, #fff 0 50%, #ddd 0 75%, #fff 0) 0 0 / 16px 16px;
}
.cuttools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 10px; }
.cuttools .seg { margin: 0; min-width: 170px; }
.hint { margin: 8px 0 0; font: 13.5px/1.4 var(--serif); color: var(--ink-soft); }
.sendlines { margin: 0; padding: 0; list-style: none; text-align: left; font: 14px/1.8 var(--type); }
.sendlines li::before { content: "\\25CB  "; color: #b9a684; }
.sendlines li.doing::before { content: "\\25D4  "; color: var(--plum); }
.sendlines li.done::before { content: "\\2713  "; color: #2e7d32; }
.formcols { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 18px; }
.formside { display: flex; flex-direction: column; gap: 8px; }
.formside h4 { margin: 8px 0 0; font: 700 14px var(--serif); }
.cutprev { display: grid; place-items: center; height: 200px; border: 1px solid #d8c59c; border-radius: 6px; background: conic-gradient(#eee 25%, #fff 0 50%, #eee 0 75%, #fff 0) 0 0 / 14px 14px; }
.cutprev { overflow: hidden; }
.cutprev img { max-width: 92%; max-height: 184px; object-fit: contain; }
.photogrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 0; padding: 0; list-style: none; }
.photogrid li { position: relative; aspect-ratio: 1; border: 1px solid #d8c59c; border-radius: 4px; overflow: hidden; background: #fff; }
.photogrid img { width: 100%; height: 100%; object-fit: cover; }
.ph-x { position: absolute; top: 2px; right: 2px; width: 22px; height: 22px; border: 0; border-radius: 50%; background: rgba(29,22,18,.75); color: #fff; cursor: pointer; font: 16px/1 var(--serif); }
.uploadbtn.small { position: relative; justify-content: center; padding: 8px; }
.itemform .fld { display: flex; flex-direction: column; gap: 4px; margin: 0 0 12px; font: 13px var(--type); color: var(--plum-dark); border: 0; padding: 0; min-width: 0; }
.itemform fieldset.fld { border-top: 1px dashed #d8c59c; padding-top: 8px; }
.itemform legend { padding: 0; font: 13px var(--type); color: var(--plum-dark); }
.itemform small { color: var(--ink-soft); }
.itemform input:not([type]), .itemform input[inputmode], .itemform textarea, .itemform select, .itemform input[name="title"], .itemform input[name="eraNote"] {
  width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbb385; border-radius: 6px; background: #fffdf7;
  font: 15px/1.35 var(--serif); color: var(--ink);
}
.itemform input:focus, .itemform textarea:focus, .itemform select:focus { outline: 2px solid var(--plum-soft); outline-offset: 1px; }
.itemform input:disabled { background: #eee3cc; color: #9a8a76; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.row3 label, .row2.tight label { display: flex; flex-direction: column; gap: 4px; font: 12px var(--type); color: var(--ink-soft); }
.row2.tight label { flex-direction: row; align-items: center; gap: 6px; }
.radio, .check { display: flex; align-items: flex-start; gap: 8px; margin: 3px 0; font: 14.5px/1.35 var(--serif); color: var(--ink); cursor: pointer; }
.radio input, .check input { margin-top: 3px; accent-color: var(--plum); }
.radio small { display: block; font: 12.5px/1.3 var(--serif); }
.fld.inline { margin-bottom: 6px; }
.ferr { font: 12.5px/1.3 var(--serif); color: #a3301c; }
.note.warn { border-left-color: #a3301c; background: #f8e3df; color: #6e2416; }
@media (max-width: 720px) {
  .sheet { padding: 0; place-items: stretch; }
  .sheetcard { max-height: none; height: 100%; border-radius: 0; }
  .sheetsteps { display: none; }
  .formcols { grid-template-columns: 1fr; }
  .formside { order: -1; }
  .cutprev { height: 160px; }
  .cutprev img { max-height: 148px; }
  .cutcanvas { max-height: 46vh; }
  /* tap targets of at least 40 px on phones */
  .sheetx { width: 44px; height: 44px; }
  .wb2, .sheet .primary, .uploadbtn, .seg button, .bigdrop { min-height: 44px; }
  .ph-x { width: 40px; height: 40px; }
  .radio, .check, .agreecheck { min-height: 40px; align-items: center; }
  .radio input, .check input, .agreecheck input { width: 20px; height: 20px; margin-top: 0; }
  .itemform input:not([type]), .itemform input[inputmode], .itemform select, .itemform input[name="title"], .itemform input[name="eraNote"] { min-height: 44px; }
}

/* ---------- "Use a template" sheet ---------- */
.tplhost { display: contents; }
.tplsheet .sheetcard { width: min(900px, 100%); max-height: min(calc(100vh - 32px), 920px); }
.tplgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; margin: 0 0 6px; padding: 0; list-style: none; }
.tplcard {
  display: flex; flex-direction: column; gap: 5px; width: 100%; padding: 8px; text-align: left; cursor: pointer;
  border: 1px solid #d8c59c; border-radius: 8px; background: #fffaf0; font-family: var(--serif); color: var(--ink);
}
.tplcard:hover { border-color: var(--plum-soft); box-shadow: 0 2px 10px rgba(60,35,20,.16); }
.tplcard:focus-visible { outline: 2px dashed var(--plum); outline-offset: 2px; }
.tplcard .nm { font: 700 16px/1.2 var(--serif); color: var(--plum-dark); }
.tplcard .dim { font: 12.5px/1.35 var(--serif); color: var(--ink-soft); }
.tplseason { display: inline-block; margin-left: 4px; padding: 1px 7px; border-radius: 10px; background: #a8341f; color: #fff; font: 700 11px var(--type); letter-spacing: .02em; vertical-align: 2px; }
.tplthumb { position: relative; display: block; aspect-ratio: 1; overflow: hidden; border-radius: 5px; background: #ddd; }
.tplthumb .tplwall { position: absolute; left: 0; right: 0; top: 0; height: 75%; background-color: #efe6d2; }
.tplthumb .tplfloor { position: absolute; left: 0; right: 0; bottom: 0; height: 25%; background-color: #b98b55; }
.tplthumb img { position: absolute; height: auto; pointer-events: none; }
.tplconfirm { max-width: 520px; margin: 0 auto; padding: 8px 4px; font: 15.5px/1.5 var(--serif); }
.tplconfirm h3 { margin: 0 0 8px; font: 700 20px var(--serif); color: var(--plum-dark); }
.tplconfirm p { margin: 0 0 10px; }
@media (max-width: 720px) { .tplgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .tplcard { min-height: 44px; } }
`;
