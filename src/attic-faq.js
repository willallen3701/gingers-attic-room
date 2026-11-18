// <attic-faq> - GingersAttic questions and answers (an accordion) for the site's FAQ page. There is no contact
// form here: the site footer has one on every page, and a line under the questions points to it.
// Usage: <attic-faq faq-src="data/faq.json"></attic-faq>. The questions ship with the app.
// Attributes: faq-src, allowed-origins.
//
// Message contract (see README):
//   app -> page  ready{mode:'faq'} (about every second until load-faq)
//   page -> app  load-faq{...} - only stops the ready ping; its content (e.g. the old businessEmail) is ignored.
//   Old site code may still bridge contact-send; this app never sends it, and it ignores contact-result.

import { faqCss } from './faq-styles.js';
import { Bridge } from './bridge.js';
import { esc, ensureFonts } from './room-render.js';

const READY_MS = 1000;
const READY_TRIES = 90;
const CHEVRON = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class AtticFaq extends HTMLElement {
  #root;
  #bridge = null;
  #loaded = false; // load-faq arrived
  #readyTimer = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `<style>${faqCss}</style>
      <div class="faq">
        <div class="groups"><p class="fmsg" role="status">Loading the questions...</p></div>
        <p class="more" hidden>Can't find your answer? Use the contact form at the bottom of the page.</p>
      </div>`;
  }

  connectedCallback() {
    ensureFonts();
    const attr = this.getAttribute('allowed-origins');
    this.#bridge = new Bridge(this, { allowedOrigins: attr ? attr.split(/\s+/).filter(Boolean) : null, onMessage: (m) => this.#onMessage(m) });
    const src = this.getAttribute('faq-src');
    if (src) {
      fetch(src)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((faq) => this.#renderQuestions(faq))
        .catch((err) => {
          this.#root.querySelector('.groups').innerHTML = `<p class="fmsg" role="alert">We couldn't load the questions just now. Please try again in a little while.</p>`;
        });
    }
    if (!this.#bridge.hasParent) {
      // Standalone: no page will send load-faq.
      this.loadFaq();
    }
    this.#announceReady();
  }

  disconnectedCallback() {
    clearTimeout(this.#readyTimer);
    this.#bridge?.dispose();
  }

  #announceReady() {
    let tries = 0;
    const tick = () => {
      if (this.#loaded) return;
      this.#bridge.emit('ready', { mode: 'faq' });
      tries += 1;
      if (this.#bridge.hasParent && tries < READY_TRIES) this.#readyTimer = setTimeout(tick, READY_MS);
    };
    tick();
  }

  /** The page's hello. Only stops the ready ping; whatever it carries (the old businessEmail) is ignored. */
  loadFaq() {
    this.#loaded = true;
    clearTimeout(this.#readyTimer);
  }

  #onMessage(m) {
    if (m.type === 'load-faq') this.loadFaq();
  }

  #renderQuestions(faq) {
    const groups = Array.isArray(faq?.groups) ? faq.groups : [];
    const html = groups
      .map((g) => {
        const items = (Array.isArray(g.items) ? g.items : []).filter((q) => q && q.q);
        if (!items.length) return '';
        return `
        <section class="group" aria-labelledby="g-${esc(g.id)}">
          <h2 id="g-${esc(g.id)}">${esc(g.title)}</h2>
          <div class="acc">${items
            .map(
              (q) => `
            <details class="qa paper" id="q-${esc(q.id)}">
              <summary><h3>${esc(q.q)}</h3><span class="chev">${CHEVRON}</span></summary>
              <div class="ans">
                ${(q.a ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}
                ${Array.isArray(q.list) && q.list.length ? `<ul>${q.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>` : ''}
                ${(q.after ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}
              </div>
            </details>`,
            )
            .join('')}</div>
        </section>`;
      })
      .join('');
    this.#root.querySelector('.groups').innerHTML = html || '<p class="fmsg">No questions yet.</p>';
    if (html) this.#root.querySelector('.more').hidden = false;
    // faq.html#q-shipping opens that question.
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && this.#root.getElementById(id);
    if (target?.tagName === 'DETAILS') {
      target.open = true;
      target.scrollIntoView({ block: 'start' });
    }
  }
}

if (!customElements.get('attic-faq')) customElements.define('attic-faq', AtticFaq);
