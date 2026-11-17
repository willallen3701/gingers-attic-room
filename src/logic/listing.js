// Item listing rules shared by the "Add an item" sheet: the choice lists and form validation.
// The Wix backend (site repo: src/backend/listing.js) checks the same rules again; keep the IDs in step.

export const CATEGORIES = Object.freeze([
  { id: 'furniture', label: 'Furniture' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'art-frames', label: 'Art & Frames' },
  { id: 'glass-ceramics', label: 'Glass & Ceramics' },
  { id: 'kitchen-barware', label: 'Kitchen & Barware' },
  { id: 'books-paper', label: 'Books & Paper' },
  { id: 'toys-games', label: 'Toys & Games' },
  { id: 'jewelry-accessories', label: 'Jewelry & Accessories' },
  { id: 'textiles-linens', label: 'Textiles & Linens' },
  { id: 'clocks-decor', label: 'Clocks & Decor' },
  { id: 'tools-hardware', label: 'Tools & Hardware' },
  { id: 'collectibles-other', label: 'Collectibles & Other' },
]);

export const CONDITIONS = Object.freeze([
  { id: 'excellent', label: 'Excellent', hint: 'Like new for its age. No chips, cracks, stains or repairs.' },
  { id: 'very-good', label: 'Very good', hint: 'Light wear from normal use; nothing broken or repaired.' },
  { id: 'good', label: 'Good', hint: 'Visible wear, small chips or marks. Described in the listing.' },
  { id: 'fair', label: 'Fair', hint: 'Obvious flaws, repairs or missing pieces. Still displays or works.' },
  { id: 'for-parts', label: 'For parts or repair', hint: "Broken or doesn't work. Sold as-is." },
]);

export const ERAS = Object.freeze([
  { id: 'pre-1900', label: 'Before 1900' },
  ...[1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000].map((y) => ({ id: `${y}s`, label: `${y}s` })),
  { id: 'unknown', label: 'Unknown' },
]);

export const MOUNTS = Object.freeze([
  { id: 'stand', label: 'Stands on a shelf, table or the floor' },
  { id: 'wall', label: 'Hangs on the wall' },
  { id: 'flat', label: 'Lies flat on the floor (rugs, mats)' },
]);

export const MAX_PHOTOS = 4;
export const LIMITS = Object.freeze({
  title: [3, 80],
  description: [10, 2000],
  eraNote: [0, 40],
  price: [1, 100000],
  quantity: [1, 99],
  sizeIn: [0.25, 240],
  weightLb: [0.01, 500],
  shippingPrice: [0, 1000],
});

const ids = (list) => new Set(list.map((x) => x.id));
const CAT_IDS = ids(CATEGORIES);
const COND_IDS = ids(CONDITIONS);
const ERA_IDS = ids(ERAS);
const MOUNT_IDS = ids(MOUNTS);

export const labelOf = (list, id) => list.find((x) => x.id === id)?.label ?? '';

/** Parse "12", "12.5", "$1,200.00" -> number, or NaN. */
export function parseNumber(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[$,\s]/g, '');
  if (s === '' || !/^\d*\.?\d+$/.test(s)) return NaN;
  return Number(s);
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Check the details form. `form` holds raw strings/booleans from the inputs plus weightLb/weightOz.
 * @returns {{ ok: boolean, errors: Record<string,string>, listing?: object }}
 */
export function validateListing(form) {
  const errors = {};
  const text = (k) => String(form[k] ?? '').trim();
  const between = (n, [lo, hi]) => Number.isFinite(n) && n >= lo && n <= hi;

  const title = text('title');
  if (title.length < LIMITS.title[0]) errors.title = 'Give it a name of at least 3 characters.';
  else if (title.length > LIMITS.title[1]) errors.title = `Keep the name under ${LIMITS.title[1]} characters.`;

  const description = text('description');
  if (description.length < LIMITS.description[0]) errors.description = 'Describe it in a sentence or two: what it is, any marks or flaws.';
  else if (description.length > LIMITS.description[1]) errors.description = `Keep the description under ${LIMITS.description[1]} characters.`;

  const price = parseNumber(form.price);
  if (!between(price, LIMITS.price)) errors.price = 'Enter a price between $1 and $100,000.';

  const quantity = parseNumber(form.quantity ?? 1);
  if (!Number.isInteger(quantity) || !between(quantity, LIMITS.quantity)) errors.quantity = 'Quantity is a whole number from 1 to 99.';

  if (!CAT_IDS.has(form.category)) errors.category = 'Pick a category.';
  if (!COND_IDS.has(form.condition)) errors.condition = 'Pick the condition.';
  if (!ERA_IDS.has(form.era)) errors.era = 'Pick a decade, or Unknown.';
  const eraNote = text('eraNote');
  if (eraNote.length > LIMITS.eraNote[1]) errors.eraNote = `Keep the note under ${LIMITS.eraNote[1]} characters.`;
  const mount = MOUNT_IDS.has(form.mount) ? form.mount : 'stand';

  const heightIn = parseNumber(form.heightIn);
  const widthIn = parseNumber(form.widthIn);
  const depthRaw = text('depthIn');
  const depthIn = depthRaw === '' ? null : parseNumber(depthRaw);
  if (!between(heightIn, LIMITS.sizeIn)) errors.heightIn = mount === 'flat' ? 'Enter the length in inches.' : 'Enter the height in inches.';
  if (!between(widthIn, LIMITS.sizeIn)) errors.widthIn = 'Enter the width in inches.';
  if (depthIn !== null && !between(depthIn, LIMITS.sizeIn)) errors.depthIn = 'Depth is in inches (or leave it blank).';

  const lb = text('weightLb') === '' ? 0 : parseNumber(form.weightLb);
  const oz = text('weightOz') === '' ? 0 : parseNumber(form.weightOz);
  const weightLb = round2((Number.isFinite(lb) ? lb : NaN) + (Number.isFinite(oz) ? oz : NaN) / 16);
  if (!Number.isFinite(lb) || !Number.isFinite(oz) || oz >= 16 || !between(weightLb, LIMITS.weightLb)) {
    errors.weight = 'Enter the weight (pounds and ounces) so shipping can be worked out.';
  }

  const localPickupOnly = !!form.localPickupOnly;
  const shippingPrice = localPickupOnly ? null : parseNumber(form.shippingPrice);
  if (!localPickupOnly && !between(shippingPrice, LIMITS.shippingPrice)) errors.shippingPrice = 'Enter a shipping price ($0 for free shipping), or tick local pickup only.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    errors,
    listing: {
      title,
      description,
      price: round2(price),
      quantity,
      category: form.category,
      condition: form.condition,
      era: form.era,
      eraNote,
      mount,
      heightIn: round2(heightIn),
      widthIn: round2(widthIn),
      depthIn: depthIn === null ? null : round2(depthIn),
      weightLb,
      localPickupOnly,
      shippingPrice: localPickupOnly ? null : round2(shippingPrice),
    },
  };
}

/** Form values for editing an existing item (its pending edit, if any, wins). */
export function formFromItem(item) {
  const pe = item?.pendingEdit ?? {};
  const src = { ...item, ...pe, dims: { h: pe.heightIn ?? item?.dims?.h, w: pe.widthIn ?? item?.dims?.w, d: 'depthIn' in pe ? pe.depthIn : item?.dims?.d } };
  const w = Number(src.weightLb) || 0;
  const lb = Math.floor(w);
  const oz = Math.round((w - lb) * 16 * 10) / 10;
  const str = (v) => (v === null || v === undefined ? '' : String(v));
  return {
    title: str(src.title),
    description: str(src.description),
    price: str(src.price),
    quantity: str(src.quantity ?? 1),
    category: src.category ?? '',
    condition: src.condition ?? '',
    era: src.era ?? '',
    eraNote: str(src.eraNote),
    mount: src.mount ?? 'stand',
    heightIn: str(src.dims?.h ?? src.heightIn),
    widthIn: str(src.dims?.w ?? src.widthIn),
    depthIn: str(src.dims?.d ?? src.depthIn),
    weightLb: w ? String(lb) : '',
    weightOz: w ? String(oz) : '',
    localPickupOnly: !!src.localPickupOnly,
    shippingPrice: src.localPickupOnly ? '' : str(src.shippingPrice),
  };
}

/** Which of the changed fields need Ginger's review for an already-approved item. */
export const INSTANT_FIELDS = Object.freeze(['price', 'quantity']);
export function needsReview(before, after) {
  const changed = Object.keys(after).filter((k) => JSON.stringify(after[k] ?? null) !== JSON.stringify(before[k] ?? null));
  return changed.filter((k) => !INSTANT_FIELDS.includes(k));
}
