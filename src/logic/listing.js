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
  sizeIn: [0.25, 108],
  weightLb: [0.05, 65],
  shippingPrice: [0, 1000],
});

// USPS parcel rules (the site's server checks the same numbers). Everything ships by USPS within the US.
export const SHIP = Object.freeze({
  packingIn: 4, // added to every dimension for the box and padding
  maxLengthGirthIn: 130, // length + girth of the packed parcel
  maxLbPerIn3: 0.3, // heavier than this is denser than solid iron: the numbers must be wrong
  lightLbPerIn3: 0.0002, // lighter than this (for anything over 50 in3) asks the seller to confirm
  lightMinVolumeIn3: 50,
});

export const MESSAGES = Object.freeze({
  tooBig: "Too big to ship by USPS. Large furniture can't be listed yet.",
  tooHeavy: "USPS takes up to 70 lb including packing, so items over 65 lb can't be listed yet.",
  impossible: "That's heavier than solid iron for its size. Check the weight and the measurements.",
  veryLight: "That's very light for its size. Check the weight and the measurements: USPS prices shipping from them.",
});

/** Length + girth of the packed parcel: add 4 in to each side, length = the longest, girth = 2 x the other two. */
export function lengthPlusGirth(h, w, d) {
  const [length, a, b] = [h, w, d].map((v) => v + SHIP.packingIn).sort((x, y) => y - x);
  return length + 2 * (a + b);
}

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
 * Check the details form. `form` holds raw strings/booleans from the inputs plus weightLb/weightOz, and
 * lightWeightOk (the seller's tick under the very-light warning).
 * @returns {{ ok: boolean, errors: Record<string,string>, warnings: Record<string,string>, needsConfirm: boolean, listing?: object }}
 *   needsConfirm: the weight is very light for the size and the tick isn't set yet (a warning, not an error)
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

  // Height, width and depth are all required, each 0.25 to 108 in (a rug's "height" is its length).
  const [lo, hi] = LIMITS.sizeIn;
  const dim = (k, name) => {
    const v = parseNumber(form[k]);
    if (!between(v, LIMITS.sizeIn)) errors[k] = `Enter the ${name} in inches, from ${lo} to ${hi}.`;
    return v;
  };
  const heightIn = dim('heightIn', mount === 'flat' ? 'length' : 'height');
  const widthIn = dim('widthIn', 'width');
  const depthIn = dim('depthIn', mount === 'flat' ? 'thickness' : 'depth');
  const sizeOk = !errors.heightIn && !errors.widthIn && !errors.depthIn;
  if (sizeOk && lengthPlusGirth(heightIn, widthIn, depthIn) > SHIP.maxLengthGirthIn) errors.size = MESSAGES.tooBig;

  const lb = text('weightLb') === '' ? 0 : parseNumber(form.weightLb);
  const oz = text('weightOz') === '' ? 0 : parseNumber(form.weightOz);
  const weightLb = round2((Number.isFinite(lb) ? lb : NaN) + (Number.isFinite(oz) ? oz : NaN) / 16);
  if (!Number.isFinite(lb) || !Number.isFinite(oz) || oz >= 16 || !(weightLb >= LIMITS.weightLb[0])) {
    errors.weight = 'Enter the weight (pounds and ounces) so shipping can be worked out.';
  } else if (weightLb > LIMITS.weightLb[1]) {
    errors.weight = MESSAGES.tooHeavy;
  }

  // Weight against size: denser than iron is impossible; very light (over 50 in3) must be confirmed with a tick.
  let warnings = {};
  if (sizeOk && !errors.weight) {
    const volume = heightIn * widthIn * depthIn;
    if (weightLb > volume * SHIP.maxLbPerIn3) errors.weight = MESSAGES.impossible;
    else if (volume > SHIP.lightMinVolumeIn3 && weightLb < volume * SHIP.lightLbPerIn3) warnings = { weight: MESSAGES.veryLight };
  }
  const lightWeightConfirmed = !!warnings.weight && !!form.lightWeightOk;
  const needsConfirm = !!warnings.weight && !lightWeightConfirmed;

  if (Object.keys(errors).length || needsConfirm) return { ok: false, errors, warnings, needsConfirm };
  return {
    ok: true,
    errors,
    warnings,
    needsConfirm: false,
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
      depthIn: round2(depthIn),
      weightLb,
      lightWeightConfirmed,
      shippingPrice: null,
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
    lightWeightOk: false,
  };
}

/** Which of the changed fields need GingersAttic's review for an already-approved item. */
export const INSTANT_FIELDS = Object.freeze(['price', 'quantity']);
export function needsReview(before, after) {
  const changed = Object.keys(after).filter((k) => JSON.stringify(after[k] ?? null) !== JSON.stringify(before[k] ?? null));
  return changed.filter((k) => !INSTANT_FIELDS.includes(k));
}
