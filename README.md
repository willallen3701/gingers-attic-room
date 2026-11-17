# Ginger's Attic: booth room app (Phase 1, view mode)

`<attic-booth>` is a plain-JS web component that draws one seller's booth: a square, front-on room with wallpaper,
floor, fixtures, real-size items, price tags and an item card. It runs inside a Wix HTML (iframe) element and talks to
the Wix page only through `postMessage`.

**All art in `assets/placeholder/` is PLACEHOLDER ART, and every item in `data/demo-booth.json` is fake demo data.**

## Run
- `npm install` (dev-only: vitest)
- `npm test` runs the logic unit tests
- `npm run serve` serves the demo at http://localhost:5178/ (`?open=<itemId>` opens a card on load)
- `npm run shots` saves desktop and 390 px screenshots to `screenshots/` (uses the installed Chrome headless)
- `node scripts/make-placeholders.mjs` regenerates the placeholder SVGs

## Message contract (iframe <-> Wix page)
Outgoing messages go to the parent origin, and only if it is on the allowlist. They have the shape
`{ source: 'attic-booth', version: 1, type, boothId, ... }`, where `type` is one of: `ready`, `item-open`,
`add-to-cart` {itemId, quantity}, `ask-seller` {itemId}, `toggle-favourite` {itemId, on},
`visit-booth` {itemId}, `sound-toggle` {on}.

Incoming messages must come from `window.parent`, from an allowed origin, and carry `target: 'attic-booth'`:
- `load-booth` {booth, library}
- `set-favourites` {itemIds}
- `cart-result` {itemId, ok, message?}
- `open-item` {itemId, fromSearch?}

The allowlist covers `https://*.wixsite.com`, `https://gingersattic.com`, `https://www.gingersattic.com` and localhost.
Override it with the `allowed-origins` attribute (space-separated).

## Layout
- `src/logic/`: pure, unit-tested maths in room inches (room, scale, surfaces, snap, validate, tile, origin, layout)
- `src/attic-booth.js`: the component
- `src/styles.js`: its CSS
- `data/library.json`: wallpapers, floors, paints, lights, architecture, fixtures (snap surfaces in fixture-local inches)
- `data/demo-booth.json`: demo booth
