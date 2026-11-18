// The magnifier: a round close-up of an item's photo above it, so tiny things (a thimble drawn at 4 in) can be
// seen properly. Shown on hover (mouse or pen), on keyboard focus, and on a tap (touch). Used by the shop view
// and the editor; the host must be position: relative (the .booth / .ed shell). Styles: styles.js ".lens".
import { esc } from './room-render.js';

const SIZE = 176;
const GAP = 12;

export class Lens {
  #host;
  #el;
  #forId = null;

  constructor(host) {
    this.#host = host;
    this.#el = document.createElement('div');
    this.#el.className = 'lens';
    this.#el.hidden = true;
    this.#el.setAttribute('aria-hidden', 'true');
    host.append(this.#el);
  }

  get forId() {
    return this.#forId;
  }

  /** Show the close-up of `target` (the item's element in the room). */
  show(target, { id, src, title = '', sub = '' }) {
    if (!target || !src) return;
    this.#forId = id;
    this.#el.innerHTML = `<div class="glass"><img src="${esc(src)}" alt=""></div>${title ? `<span class="cap">${esc(title)}${sub ? `<b>${esc(sub)}</b>` : ''}</span>` : ''}`;
    this.#el.hidden = false;
    const h = this.#host.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const capH = title ? 40 : 0;
    const total = SIZE + capH;
    let left = r.left - h.left + r.width / 2 - SIZE / 2;
    left = Math.max(6, Math.min(left, h.width - SIZE - 6));
    // Above the item when there is room in the shell, else below it.
    let top = r.top - h.top - GAP - total;
    if (top < 6) top = r.bottom - h.top + GAP;
    this.#el.style.left = `${Math.round(left)}px`;
    this.#el.style.top = `${Math.round(top)}px`;
  }

  hide() {
    this.#forId = null;
    this.#el.hidden = true;
  }
}
