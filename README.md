# GingersAttic: booth room app

Two plain-JS web components that run inside Wix HTML (iframe) elements and talk to the Wix page only through
`postMessage`:

- `<attic-booth>` (view mode, `index.html` / `embed.html`): a shopper's view of one booth. It shows a square, front-on room
  with wallpaper, floor, fixtures, windows and doors, decor, real-size items, price tags and an item card.
- `<attic-editor>` (edit mode, `editor.html`): the seller's booth editor. A left panel has tabs (Walls, Floor, Light & sound,
  Fixtures, Decor, My Items, Booth sign) and the room sits on the right. Things snap to the wall, shelves and floor.
  The editor has undo/redo, a draft that autosaves, an "Open my booth" / "Update booth" button, a 7-step setup guide
  shown on the first visit, and speech-bubble tips on later visits. Below 768 px wide it shows a read-only room and
  "Arrange your booth on a computer or tablet".

Every item in `data/demo-booth.json` is fake demo data. The photos are licensed: see `CREDITS.md` and
`../assets-src/LICENSES.md`.

## Run
- `npm install` (dev-only: vitest)
- `npm test` runs the logic unit tests
- `npm run serve` serves the pages at http://localhost:5178/:
  - `index.html` is the view demo; `?open=<itemId>` opens a card on load.
  - `editor.html` is the editor demo; it simulates saving, opening and uploads. Standalone URL options:
    `?wizard=0..6`, `?tab=…`, `?coach=1|0`, `?select=kind:id`, `?storage=id,id`, `?drag=kind:id:dx:dy`.
- `npm run shots` saves view and editor screenshots to `screenshots/`, using the installed Chrome in headless mode.
- `node scripts/editor-smoke.mjs` drives the editor with real mouse and keyboard input over the Chrome DevTools
  protocol. It checks drag, snap, undo, autosave, add, place, upload, open and the setup guide.

## Coordinates
Everything is measured in room inches. The room is 120 × 120 in, the wall runs from y 0 to 90 and the floor from y 90 to 120.
- Fixtures `{id, fixtureId, x, y}` use the top-left corner. Wall fixtures stay inside the wall. A floor fixture's base
  (`y + heightIn`) sits in the floor band, and that position is its depth.
- Item and decor placements `{surfaceId, x, y, scaleAdj}` use the LEFT edge and the BASE. `surfaceId` is `wall`,
  `floor` or `<fixtureInstanceId>:<surfaceId>`. `scaleAdj` is the ±20 % size tweak (0.8–1.2).
- Windows and doors are stored in `room.placeables[]` as `{id, archId, x, y}`, with `y` = BASE. Doors sit on the floor line.

## Message contract (iframe <-> Wix page)
Outgoing messages go to the parent origin, and only if it is on the allowlist. They have the shape
`{ source: 'attic-booth', version: 1, type, ... }`.
Incoming messages must come from `window.parent`, from an allowed origin, and carry `target: 'attic-booth'`.

Firefox has no `location.ancestorOrigins` and the page may withhold the referrer, so the parent's origin can be unknown
at first. Then `ready` alone (it carries no private data) is posted to `'*'`; the page's first reply, checked against
the allowlist, fixes the origin for every later message. Every page repeats `ready` until its data arrives.

### View (`<attic-booth>`)
- **Out:**
  - `ready`
  - `item-open`
  - `add-to-cart` {itemId, quantity}
  - `ask-seller` {itemId, fromName, fromEmail, message}. Shown as "Ask about this item": the question goes to
    GingersAttic, which relays the seller's answer; buyers and sellers never contact each other directly.
  - `toggle-favourite` {itemId, on}
  - `toggle-favourite-booth` {boothId, on}: the heart in the booth's name bar
  - `visit-booth` {itemId}
  - `sound-toggle` {on}: the shopper pressed the Sound button (shown only when the seller picked a booth sound;
    `room.sound`, see `src/logic/sounds.js`). Nothing plays until the shopper presses it. Booth sounds are currently
    switched OFF by the single switch `SOUNDS_ENABLED` in `src/logic/sounds.js` (no Sound button, no picker; saved
    choices are kept). Set it to `true` to turn them back on.
- **In:**
  - `load-booth` {booth, library?}. Without `library`, the app's own `library-src` is used.
  - `set-favourites` {itemIds?, boothIds?}. Either list may come alone; a list that isn't sent is left as it was.
  - `cart-result` {itemId, ok, message?}
  - `ask-seller-result` {itemId, ok, message?}
  - `open-item` {itemId, fromSearch?}

The booth can include `decor[]`, `room.placeables[]` and `boxes[]` (collectibles boxes, shape below). View mode draws
them; decor is never clickable. A decor lamp with `lit: true` glows, and the Lights button (shown for a lighting preset
or any lit lamp) turns preset and lamps off and on. Clicking a box opens it up close; its items open their normal card,
so `booth.items` must include the boxed items (their placement is `null`). Hovering an item (tapping on touch) shows a
magnified close-up.

### Edit (`<attic-editor>`)
**Out:**
- `ready` {mode:'edit'}, repeated every 1.5 s, up to 20 times, until `load-editor` arrives.
- `save-draft` {draft}. Debounced 1.5 s after the last change, and retried with backoff (2 s, 4 s, … up to 30 s) when
  `save-result` fails or no answer comes within 15 s. The draft is:
  `{ room, fixtures, decor, boxes, placements: { [itemId]: {surfaceId,x,y,scaleAdj} | null } }`, where:
  - `room` = `{ wall, floor, light|null, architecture:[stripIds], placeables:[…], sign:{style}, sound }`; `sound` is
    `fireplace`, `rain`, `record`, `clock`, `shop` or null (files and licences: `assets/sounds/LICENSES.md`)
  - `wall` = `{type:'wallpaper', textureId|src+uploadId+tileIn, mode:'tile'|'fill', scale}` or `{type:'paint', paintId}`
  - `floor` = `{textureId|src+uploadId+tileIn, mode, scale}`
  - `decor[]` = `{id, decorId, placement:{surfaceId,x,y,scaleAdj}, lit?}`; `lit: true|false` only on lighting decor
    (new lamps start `false`)
  - `highlights[]` = up to 6 of the seller's item ids for the directory card's listing reel (`logic/reel.js`); they go
    live with "Update booth", like the layout
  - `boxes[]` = collectibles boxes (at most 3):
    `{id:'bx1', style:'crate'|'jewelry'|'curio', lining:'plum'|'green'|'red'|'blue'|'cream', cols:2..4, rows:2..4,
    placement:{surfaceId,x,y}, slots:[itemId|null, ...]}`; `slots` has exactly `cols * rows` entries, row by row from
    the top left; one item per compartment; an item is in at most one slot and then has a `null` placement. A box
    counts as one of the 40 placed pieces (the items in it don't count). `placement` is like decor (x = left edge,
    y = base) on a shelf board, a tabletop or the floor.
  - a `null` placement = the item waits in the storage crate (or sits in a box)
  - `scaleAdj` is 0.8..1.2; the editor also keeps each item at least 4 in and no bigger than the room allows
- `open-booth` {}. Unsaved changes are saved first.
- `upload-texture` {requestId, kind:'wall'|'floor', dataUrl, fileName}. `dataUrl` is a JPEG, at most 1600 px on the long
  side and 600 KB.
- `save-info` {name, about, signStyle}. `signStyle` is one of `wood`, `cream` or `brass`.
- `wizard-done` {}

**In:**
- `load-editor` {booth (draft already applied), library?, meta:{isFirstVisit, boothStatus:'new'|'live', hasUnopenedChanges, lastSavedAt, maxPlaced:40}, uploads:[{id, kind, src, approved, tileIn?}]}
- `save-result` {ok, savedAt, message?}
- `open-result` {ok, openedAt, message?}
- `upload-result` {ok, requestId, upload?:{id, kind, src, approved, rejected?, tileIn?}, message?}
- `info-result` {ok, message?}
- `need-login` {message}: the visitor closed the Wix log-in window; the editor shows a Log in button (sends `login-request`).

**Items (Phase 3).** Shown only when `meta.itemsEnabled` is true (always in standalone), so the room app can go live on
GitHub Pages before the Wix site code that answers these. Every request carries a `requestId` that its answer repeats;
no answer within 90 s counts as a failure.

| App -> page | Page -> app |
|---|---|
| `accept-agreement` {requestId, version} | `agreement-result` {requestId, ok, message?} |
| `upload-item-image` {requestId, role:'cutout'\|'photo', dataUrl} (cutout: WebP/PNG with alpha; photo: JPEG; each at most 600 KB) | `item-image-result` {requestId, ok, file?:{id, url}, message?} |
| `submit-item` {requestId, itemId\|null, listing:{title, description, price, quantity, category, condition, era, eraNote, mount, heightIn, widthIn, depthIn, weightLb, lightWeightConfirmed, shippingPrice:null, cutout:{id, url, aspect, w, h}\|null, photos:[{id, url}]}} | `item-result` {requestId, ok, item?, review?:'new'\|'all'\|'some'\|'none', message?} |
| `delete-item` {requestId, itemId} | `delete-item-result` {requestId, ok, itemId?, message?} |

Listing rules (`src/logic/listing.js`, the server checks the same): height, width and depth are all required,
0.25 to 108 in; packed with 4 in on each side, length + girth (2 x the other two) is at most 130 in ("Too big to ship
by USPS. Large furniture can't be listed yet."); weight 0.05 to 65 lb ("USPS takes up to 70 lb including packing, so
items over 65 lb can't be listed yet."); over 0.30 lb per cubic inch is an error ("That's heavier than solid iron for
its size. Check the weight and the measurements."); under 0.0002 lb per cubic inch (over 50 cubic inches) needs the
seller's tick, sent as `lightWeightConfirmed: true`. There is no local pickup: everything ships by USPS within the US.

`load-editor` meta also carries `itemsEnabled`, `sellerAgreed` and `agreementVersion`; the seller's items carry `status`
(`pending`, `approved`, `rejected`, `sold`), `rejectionNote`, `pendingEdit` and `photoFiles`. The agreement text is
`data/agreement.json`. Background removal runs in a worker (`src/cutout-worker.js`) with the model in `assets/models/`
(see `src/cutout-spec.js` and CREDITS.md).

### Use a template (`src/logic/templates.js`)
The editor's top bar has a **Use a template** button. It opens a picker with five looks (Cozy Cottage, Victorian Parlor,
Farmhouse, Antique Library, and a Christmas look). A look sets the wall (wallpaper or paint), floor, wall strips, light
preset, a window where it suits, shelving and furniture, and a lamp or two (lamps start on), then places the seller's items by
size: rugs on the floor, wall hangings on the wall, tiny things (longest side 5.5 in or less) in collectibles boxes, big things
on tables and the floor, small things on shelves. It is built only from the editor's own operations, so every result passes
`buildLayout`/`boxProblems`; whatever does not fit (or would pass 40 pieces, or has no size) waits in the storage crate, and
items the site rejected stay there too. It keeps the booth sign, sound and highlights.
- Over an existing layout (`hasExistingLayout()`) the picker asks first ("Replace what's in your booth?"); Undo brings the old
  booth back. On a new booth it applies at once. The result is an ordinary draft change: nothing reaches shoppers until Update booth.
- Seasonal looks carry `until: 'YYYY-MM-DD'` and are offered while the visitor's local time is before that date's midnight
  (Christmas: through December 31, 2026; gone on January 1, 2027). Nothing about a template is stored in the booth, so a booth
  already using the Christmas layout keeps it. Edit `TEMPLATES` to rename a look or change its pieces.
- Uses library ids only, so the site's `cleanDraft` accepts the result unchanged (30 fixtures / 30 decor / 3 boxes / 40 pieces limits hold).
- Decor that comes in choices (the Christmas stockings' design) is one library entry per choice sharing
  `family: {id, label, choice, swatch?, order?}`. The Decor tab lists a family once; selecting the placed piece shows the choices
  in the selection bar (`setDecorVariant` swaps `decorId` in place). The booth just stores the chosen entry's id, so the site
  needs no change. The Size slider stays 80-120 % (the site clamps `scaleAdj` to that), so a wider range would need more choices (the Christmas garland has none: it is one real photographed swag, sized with the slider, because every longer version had to repeat or mirror its fir).
- Standalone harness options: `editor.html?fresh=1` (empty booth) and `?now=2026-12-31T23:30:00` (pretend date).
  `node scripts/template-smoke.mjs` clicks through the picker; `node scripts/template-shots.mjs [dir]` saves the screenshots.

### Booth directory (`<attic-directory>`, `directory.html`, the Booths page)
**Out:** `ready` {mode:'directory'} (about every second until `load-directory`), `open-booth` {slug, itemId?} (itemId from
the listing reel; the Booths page opens `/booth?b=<slug>&i=<itemId>` and the booth page sends `open-item`),
`toggle-favourite-booth` {boothId, on}, `toggle-favourite` {itemId, on:false}, `login-request` {}, `get-collection` {},
`add-to-cart` {itemId, quantity:1}
**In:** `load-directory` {booths:[{id, slug, boothNumber, name, about, signStyle, sellerName, itemCount, categories,
itemTitles, previews, updatedAt, peek?, reel?}], loggedIn, favourites:{boothIds, itemIds}, categories:[{id, label}]},
`set-favourites` {boothIds?, itemIds?}, `collection` {booths, items:[{id, title, price, image, status, quantity, boothSlug,
boothName}]}, `cart-result` {itemId, ok, message?}

**Room peek.** `peek` = `{room, fixtures, decor, boxes, items:[{id, image, mount, aspect, heightIn|widthIn+flat, placement|null, sold?}]}`,
built by the site's `publicPeek()` (`site/src/backend/boothShape.js`): the room's look and only the approved or sold items
that are out in the room or in a box, with no titles, prices or owner data. The card then shows a small, look-only view of
the whole room (`logic/peek.js` drops malformed rows; no sign or price tags; inert, the card itself opens the booth)
instead of the thumbnails. It needs `library-src` on the element (`directory.html` sets `data/library.json`); without a
peek, or if the library can't load, the card shows `previews` as before. Sample peeks:
`node scripts/make-sample-peeks.mjs` (`--check` only compares).

**Listing reel.** `reel` = `{kind:'picks'|'newest', items:[{id, title, price, image}]}` (at most 6), built by the site's
`publicReel()`: the seller's live highlights that are still for sale, in their order, else the newest listings for sale.
The card shows it between the room peek and the bio (`logic/reel.js` drops malformed rows): photo and price per item,
scrolled only by hand (swipe, wheel, the back/forward buttons shown when it overflows, or the arrow keys, Home and End
on its single tab stop). Sellers pick highlights with the star in the editor's My Items tab (`draft.highlights`).

### FAQ (`<attic-faq>`, `faq.html`)
Questions ship with the app in `data/faq.json`. **Out:** `ready` {mode:'faq'} (about every second until `load-faq`),
`contact-send` {requestId, name, email, message}. **In:** `load-faq` {businessEmail: string|null},
`contact-result` {requestId, ok, message?}

### Approvals (`<attic-approvals>`, `approvals.html`)
**Out:** `ready` {mode:'approvals'}, `refresh-queue` {requestId}, `review` {requestId, action:'approve-item'|'reject-item'|'approve-upload'|'reject-upload', itemId?, boothId?, uploadId?, note?}
**In:** `load-queue` {queue:{items, uploads}}, `queue-result` {requestId, ok, queue}, `review-result` {requestId, ok, message?}, `not-admin` {message}

The allowlist covers `https://*.wixsite.com`, `https://*.wix.com` (the editor and preview), `https://gingersattic.com`,
`https://www.gingersattic.com` and localhost. Override it with the `allowed-origins` attribute (space-separated).

## Layout
- `src/logic/`: pure, unit-tested maths
  - `room`, `scale`, `surfaces`, `snap`, `validate`, `tile`, `origin` and `layout`: the room maths shared by both components
  - `library` normalises the library JSON with defaults
  - `fixtures` handles fixture snap, validation and moves
  - `editops` holds every editor change, each returning `{ok, booth, errors}`
  - `draft` converts between a booth and a draft
  - `history` is the undo/redo stack
  - `downscale` sizes uploads
  - `lamps` places lamp glows; `boxes` is the collectibles box shape; `directory` searches and sorts booths;
    `peek` cleans a directory card's room peek; `listing` holds the listing rules
- `src/room-render.js`: shared room HTML, used by both components
- `src/attic-booth.js` + `src/styles.js`: view component
- `src/attic-editor.js` + `src/editor-styles.js`: editor component
- `src/bridge.js`: the postMessage bridge used by the editor, directory and FAQ
- `src/attic-directory.js`, `src/attic-faq.js` (+ `*-styles.js`): booth directory and FAQ; `src/lens.js`: the magnifier
- `scripts/pages-smoke.mjs`: smoke test of lamps, sizing, boxes, directory, FAQ, phone widths and Firefox vs Chrome
  (headless Chrome over CDP, Firefox over WebDriver BiDi via `scripts/firefox-bidi.mjs`); `scripts/editor-smoke.mjs`:
  the editor
- `scripts/make-agreement-docs.mjs`: regenerates `../docs/seller-agreement.md` and `../docs/prohibited-items.md` from
  `data/agreement.json` (`--check` only compares)
- `scripts/make-sample-peeks.mjs`: arranges the sample booths' rooms with the editor's own operations and writes their
  peeks (through the site's `publicPeek()`) into `data/sample-directory.json` (`--check` only compares)
- `data/library.json`: wallpapers, floors, paints, lights, architecture (strips and placeables), fixtures and decor
- `data/demo-booth.json`: demo booth
