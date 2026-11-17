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
.topbar { justify-content: space-between; }
.status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font: 13px var(--type); color: var(--ink); }
.savedot { width: 9px; height: 9px; border-radius: 50%; background: #6f9e60; }
.savedot.pending, .savedot.saving { background: #d1a24a; }
.savedot.error { background: var(--sold); }
.chip { padding: 3px 9px; border: 1px solid; border-radius: 12px; font: 12px var(--type); }
.chip.on { color: #2f5d2a; border-color: #8cb37f; background: #eef6e9; }
.chip.warn { color: #7a4a10; border-color: #d9a65a; background: #fbf0dc; }
.chip.off { color: var(--ink-soft); border-color: #cbb385; background: #fbf5e6; }
.acts { display: flex; align-items: center; gap: 8px; }
.tb {
  padding: 7px 11px; border: 1px solid #cbb385; border-radius: 5px; background: #fbf5e6; cursor: pointer;
  font: 13px var(--type); color: var(--plum-dark);
}
.tb:hover { background: #fff; }
.tb:disabled { opacity: .45; cursor: default; background: #fbf5e6; }
.tb.danger { color: var(--sold); border-color: #d9a19a; }

.roomframe {
  position: relative; z-index: 0; isolation: isolate; /* keep the room's own z-indexes below the bubbles */
  width: min(100%, calc(100vh - 150px)); min-width: 320px; align-self: center;
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

.selbar { min-height: 54px; }
.selbar.idle .hint { font: 12.5px/1.4 var(--type); color: var(--ink-soft); }
kbd { padding: 0 4px; border: 1px solid #cbb385; border-bottom-width: 2px; border-radius: 3px; background: #fffaf0; font: 11px var(--type); }
.selbar .thumb { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid #e0cfa8; border-radius: 4px; background: #fffaf0; }
.selbar .thumb img { max-width: 34px; max-height: 34px; object-fit: contain; }
.selname { display: flex; flex-direction: column; margin-right: auto; font: 15px/1.15 var(--serif); }
.selname small { font: 11.5px var(--type); color: var(--ink-soft); }
.range.small { gap: 6px; font: 12px var(--type); color: var(--plum-dark); }
.range.small input { width: 110px; }
.nudges { display: flex; gap: 3px; }
.nudges .tb { padding: 6px 9px; }

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
`;
