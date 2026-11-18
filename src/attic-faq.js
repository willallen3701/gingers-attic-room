// <attic-faq> - GingersAttic questions and answers (an accordion) with a Contact us form, for the site's FAQ page.
// Usage: <attic-faq faq-src="data/faq.json"></attic-faq>. The questions ship with the app; the page sends only
// the business email address. Opened directly (no parent page) it shows the questions and simulates sending.
// Attributes: faq-src, allowed-origins.
//
// Message contract (see README):
//   app -> page  ready{mode:'faq'} (about every second until load-faq), contact-send{requestId, name, email, message}
//   page -> app  load-faq{businessEmail: string|null}, contact-result{requestId, ok, message?}

import { faqCss } from './faq-styles.js';
import { Bridge } from './bridge.js';
import { esc, ensureFonts } from './room-render.js';

const READY_MS = 1000;
const READY_TRIES = 90;
const SEND_TIMEOUT_MS = 30000;
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const CHEVRON = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class AtticFaq extends HTMLElement {
  #root;
  #bridge = null;
  #loaded = false; // load-faq arrived
  #readyTimer = null;
  #pending = null; // requestId of the message being sent
  #sendTimer = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `<style>${faqCss}</style>
      <div class="faq">
        <div class="groups"><p class="fmsg" role="status">Loading the questions...</p></div>
        ${contactHtml()}
      </div>`;
  }

  connectedCallback() {
    ensureFonts();
    const attr = this.getAttribute('allowed-origins');
    this.#bridge = new Bridge(this, { allowedOrigins: attr ? attr.split(/\s+/).filter(Boolean) : null, onMessage: (m) => this.#onMessage(m) });
    this.#wire();
    const src = this.getAttribute('faq-src');
    if (src) {
      fetch(src)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((faq) => this.#renderQuestions(faq))
        .catch((err) => {
          this.#root.querySelector('.groups').innerHTML = `<p class="fmsg" role="alert">Couldn't load the questions (${esc(err.message)}). You can still contact us below.</p>`;
        });
    }
    if (!this.#bridge.hasParent) {
      // Standalone: no page will send load-faq.
      this.#root.querySelector('.faq').insertAdjacentHTML('beforeend', '<p class="demo">Preview: messages are not sent anywhere.</p>');
      this.loadFaq({ businessEmail: null });
    }
    this.#announceReady();
  }

  disconnectedCallback() {
    clearTimeout(this.#readyTimer);
    clearTimeout(this.#sendTimer);
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

  /** The page's details: the business email address, or null while there isn't one yet. */
  loadFaq({ businessEmail } = {}) {
    this.#loaded = true;
    clearTimeout(this.#readyTimer);
    const line = this.#root.querySelector('.emailline');
    const email = typeof businessEmail === 'string' ? businessEmail.trim() : '';
    line.innerHTML = EMAIL_RE.test(email)
      ? `Email us at <a href="mailto:${esc(email)}">${esc(email)}</a>`
      : 'Our email address is coming soon - use the form below.';
    line.hidden = false;
  }

  #onMessage(m) {
    if (m.type === 'load-faq') this.loadFaq(m);
    else if (m.type === 'contact-result') this.#contactResult(m);
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
    // faq.html#q-shipping-cost opens that question.
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && this.#root.getElementById(id);
    if (target?.tagName === 'DETAILS') {
      target.open = true;
      target.scrollIntoView({ block: 'start' });
    }
  }

  // ---------------------------------------------------------------- contact form

  #wire() {
    const form = this.#root.querySelector('.cform');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#send(form);
    });
    this.#root.querySelector('.again').addEventListener('click', () => {
      form.reset();
      form.hidden = false;
      this.#root.querySelector('.csent').hidden = true;
      this.#root.querySelector('.again').hidden = true;
      form.querySelector('[name="name"]').focus();
    });
  }

  #send(form) {
    if (this.#pending) return;
    const err = this.#root.querySelector('.cerr');
    err.hidden = true;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const message = String(fd.get('message') || '').trim();
    if (!name || !EMAIL_RE.test(email) || message.length < 3) {
      this.#showError(!name ? 'Please add your name.' : !EMAIL_RE.test(email) ? 'Please check your email address.' : 'Please write a little more in your message.');
      return;
    }
    const requestId = `ct${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.#pending = requestId;
    const btn = form.querySelector('.send');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    this.#bridge.emit('contact-send', { requestId, name, email, message });
    clearTimeout(this.#sendTimer);
    this.#sendTimer = setTimeout(() => this.#contactResult({ requestId, ok: false, message: 'The site took too long to answer. Please try again.' }), SEND_TIMEOUT_MS);
    if (!this.#bridge.hasParent) {
      setTimeout(() => this.#contactResult({ requestId, ok: true, message: 'Thanks! (Preview: nothing was actually sent.)' }), 400);
    }
  }

  #contactResult({ requestId, ok, message }) {
    if (!this.#pending || requestId !== this.#pending) return;
    this.#pending = null;
    clearTimeout(this.#sendTimer);
    const form = this.#root.querySelector('.cform');
    const btn = form.querySelector('.send');
    btn.disabled = false;
    btn.textContent = 'Send message';
    if (ok) {
      const sent = this.#root.querySelector('.csent');
      sent.textContent = message || 'Thanks! Your message is on its way.';
      sent.hidden = false;
      form.hidden = true;
      this.#root.querySelector('.again').hidden = false;
      sent.focus();
    } else {
      this.#showError(message || "Couldn't send your message. Please try again.");
    }
  }

  #showError(text) {
    const err = this.#root.querySelector('.cerr');
    err.textContent = text;
    err.hidden = false;
  }
}

function contactHtml() {
  return `
    <section class="contact paper" aria-labelledby="h-contact">
      <h2 id="h-contact">Contact us</h2>
      <p class="emailline" hidden></p>
      <form class="cform">
        <label>Your name<input name="name" required maxlength="100" autocomplete="name"></label>
        <label>Your email<input name="email" type="email" required maxlength="200" autocomplete="email" inputmode="email"></label>
        <label>Your message<textarea name="message" required minlength="3" maxlength="2000" rows="5"></textarea></label>
        <p class="cerr" role="alert" hidden></p>
        <button class="primary send" type="submit">Send message</button>
      </form>
      <p class="csent" role="status" tabindex="-1" hidden></p>
      <button class="primary again" type="button" hidden>Send another message</button>
    </section>`;
}

if (!customElements.get('attic-faq')) customElements.define('attic-faq', AtticFaq);
