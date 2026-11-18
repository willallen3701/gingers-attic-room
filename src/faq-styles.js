// Shadow-DOM styles for <attic-faq>. Builds on the room tokens (styles.js :host variables). The page sits on the
// site's solid theme purple with cream text; questions are light paper cards.
// Tap targets are at least 40 px.
export const faqCss = /* css */ `
:host {
  --purple: #633761;
  --purple-deep: #4e2a4c;
  --cream: #fee6c4;
  --paper: #f3e8d0;
  --ink: #3a2a1e;
  --ink-soft: #6d5a48;
  --plum-dark: #4b2741;
  --serif: "Playfair Display", "Iowan Old Style", Georgia, "Times New Roman", serif;
  --type: "Special Elite", "Courier Prime", "Courier New", Courier, monospace;
  display: block;
  color: var(--cream);
  font-family: var(--serif);
}
* { box-sizing: border-box; }
button, input, textarea { font: inherit; }
.faq { max-width: 860px; margin: 0 auto; padding: 16px; }
.fmsg { margin: 0; padding: 16px 0; font: 16px/1.4 var(--type); color: var(--cream); }
.group { margin: 0 0 26px; }
.group > h2 { margin: 0 0 12px; font: 700 26px/1.2 var(--serif); color: var(--cream); }
.paper {
  background:
    radial-gradient(ellipse at 20% 0%, rgba(255,255,255,.45), transparent 60%),
    radial-gradient(ellipse at 90% 100%, rgba(120,80,40,.10), transparent 55%),
    var(--paper);
  color: var(--ink); border-radius: 12px; box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 8px 20px rgba(25,8,22,.3);
}
.acc { display: flex; flex-direction: column; gap: 10px; }
.qa { overflow: hidden; }
.qa summary {
  display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 12px 16px; cursor: pointer; list-style: none;
  border-radius: 12px;
}
.qa summary::-webkit-details-marker { display: none; }
.qa summary:focus-visible { outline: 3px solid var(--cream); outline-offset: 3px; }
.qa summary h3 { flex: 1; min-width: 0; margin: 0; font: 700 17px/1.3 var(--serif); color: var(--plum-dark); overflow-wrap: anywhere; }
.chev {
  flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%;
  background: var(--purple); color: var(--cream); transition: transform .2s ease;
}
.chev svg { width: 14px; height: 14px; }
.qa[open] .chev { transform: rotate(180deg); }
.qa[open] summary { border-bottom: 1px dashed #cdb88c; border-radius: 12px 12px 0 0; }
.ans { padding: 12px 18px 16px; font: 16px/1.55 var(--serif); color: var(--ink); }
/* When the frame is shorter than the answer, src/attic-faq.js caps the height and the answer scrolls by touch. */
.ans[data-capped] { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: auto; }
.ans[data-capped]:focus-visible { outline: 3px solid var(--purple); outline-offset: -3px; }
.ans[data-capped][data-more] { box-shadow: inset 0 -14px 10px -10px rgba(58, 42, 30, .45); }
.ans p { margin: 0 0 10px; }
.ans p:last-child { margin-bottom: 0; }
.ans ul { margin: 0 0 10px; padding-left: 22px; }
.ans li { margin: 0 0 4px; }

.more { margin: 18px 0 0; font: 16px/1.45 var(--serif); color: var(--cream); text-align: center; }
.more[hidden] { display: none; }
@media (max-width: 480px) {
  .faq { padding: 12px; }
  .group > h2 { font-size: 23px; }
  .qa summary { padding: 10px 12px; }
  .ans { padding: 10px 14px 14px; }
}
@media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
`;
