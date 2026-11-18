// Shadow-DOM styles for <attic-faq>. Builds on the room tokens (styles.js :host variables). The page sits on the
// site's solid theme purple with cream text; questions and the contact form are light paper cards.
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
.group > h2, .contact h2 { margin: 0 0 12px; font: 700 26px/1.2 var(--serif); color: var(--cream); }
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
.ans p { margin: 0 0 10px; }
.ans p:last-child { margin-bottom: 0; }
.ans ul { margin: 0 0 10px; padding-left: 22px; }
.ans li { margin: 0 0 4px; }

.contact { margin-top: 8px; padding: 20px 18px; }
.contact h2 { color: var(--plum-dark); }
.emailline { margin: 0 0 14px; font: 16px/1.45 var(--serif); color: var(--ink); overflow-wrap: anywhere; }
.emailline a { display: inline-flex; align-items: center; min-height: 40px; color: var(--purple); font-weight: 700; text-underline-offset: 3px; }
.cform { display: grid; gap: 12px; }
.cform label { display: grid; gap: 5px; font: 13px/1.2 var(--type); letter-spacing: .04em; color: var(--plum-dark); }
.cform input, .cform textarea {
  width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #cbb385; border-radius: 8px; background: #fffaf0;
  color: var(--ink); font: 16px/1.4 var(--serif); resize: vertical;
}
.cform textarea { min-height: 128px; }
.cform input:focus-visible, .cform textarea:focus-visible { outline: 3px solid var(--purple); outline-offset: 1px; }
.cerr { margin: 0; padding: 8px 10px; border-left: 3px solid #a3301c; background: #f8e3df; font: 14px/1.4 var(--serif); color: #6e2416; }
.cerr[hidden] { display: none; }
.primary {
  justify-self: start; min-height: 44px; padding: 0 22px; border: 0; border-radius: 22px; cursor: pointer;
  background: var(--purple); color: var(--cream); font: 700 15px/1 var(--serif); box-shadow: 0 2px 0 var(--purple-deep);
}
.primary:hover { background: var(--purple-deep); }
.primary[disabled] { opacity: .7; cursor: default; }
.primary:focus-visible { outline: 3px solid var(--purple); outline-offset: 2px; }
.csent { margin: 0; padding: 12px 14px; border-left: 3px solid #2f5d2a; background: #eef6e9; font: 16px/1.45 var(--serif); color: #24461f; }
.csent[hidden], .cform[hidden] { display: none; }
.again { margin-top: 12px; }
.demo { margin: 20px 0 0; font: 12px/1.4 var(--type); color: var(--cream); opacity: .85; text-align: center; }
@media (max-width: 480px) {
  .faq { padding: 12px; }
  .group > h2, .contact h2 { font-size: 23px; }
  .qa summary { padding: 10px 12px; }
  .ans { padding: 10px 14px 14px; }
  .contact { padding: 16px 14px; }
  .primary { justify-self: stretch; }
}
@media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
`;
