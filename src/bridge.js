// postMessage bridge between an embedded room-app component and its Wix parent page.
// Outgoing: { source:'attic-booth', version:1, type, ...data } to the parent's origin, only if allowed.
// Incoming: must come from window.parent, from an allowed origin, and carry target:'attic-booth'.
// Also dispatches a composed "attic-booth:event" DOM event (used by the standalone harness pages).

import { isAllowedOrigin, DEFAULT_ALLOWED_ORIGINS } from './logic/origin.js';

export const MSG_SOURCE = 'attic-booth';

export class Bridge {
  #host;
  #allowed;
  #parentOrigin = null;
  #onMessage;
  #listener = (e) => this.#handle(e);

  /**
   * @param {HTMLElement} host  element that dispatches the DOM event mirror
   * @param {{allowedOrigins?:string[], onMessage:(msg:object)=>void}} opts
   */
  constructor(host, { allowedOrigins, onMessage }) {
    this.#host = host;
    this.#allowed = allowedOrigins?.length ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS;
    this.#onMessage = onMessage;
    this.#parentOrigin = this.#detectParentOrigin();
    window.addEventListener('message', this.#listener);
  }

  get hasParent() {
    return typeof window !== 'undefined' && window.parent && window.parent !== window;
  }

  dispose() {
    window.removeEventListener('message', this.#listener);
  }

  emit(type, data = {}) {
    const msg = { source: MSG_SOURCE, version: 1, type, ...data };
    this.#host.dispatchEvent(new CustomEvent('attic-booth:event', { detail: msg, bubbles: true, composed: true }));
    if (!this.hasParent) return;
    if (this.#parentOrigin) window.parent.postMessage(msg, this.#parentOrigin);
    else console.warn('[attic-booth] parent origin not allowed; message not sent', type);
  }

  #detectParentOrigin() {
    if (!this.hasParent) return null;
    let origin = null;
    try {
      origin = window.location.ancestorOrigins?.[0] ?? null;
    } catch {
      /* not supported */
    }
    if (!origin && document.referrer) {
      try {
        origin = new URL(document.referrer).origin;
      } catch {
        origin = null;
      }
    }
    return origin && isAllowedOrigin(origin, this.#allowed) ? origin : null;
  }

  #handle(e) {
    if (!this.hasParent || e.source !== window.parent) return;
    if (!isAllowedOrigin(e.origin, this.#allowed)) return;
    const m = e.data;
    if (!m || typeof m !== 'object' || m.target !== MSG_SOURCE) return;
    this.#parentOrigin = e.origin;
    this.#onMessage(m);
  }
}
