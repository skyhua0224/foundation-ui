# Text contrast: roles, rule and gate

Every word of the kit is 4.5 : 1 against what is behind it (3 : 1 for large text: 24 px, or 18.66 px and bold), in both themes, at every tile size and in every state. Disabled controls are the one exception (WCAG 2.2, 1.4.3), and they are listed apart by the gate.

## Roles

| Token | Role | Where it is defined |
| --- | --- | --- |
| `--md-sys-color-on-surface-variant` | The secondary text of a surface: captions, units, labels, small words. Guarded by the theme: `SECONDARY_MIN` (4.9 : 1) on every surface of the scheme (surface, dim, bright, the five containers, the variant), in every colour style, variant and seed. The Material tone (NV30 / NV80) is 4.5 : 1 on the surface and falls under it on the darker ones, so the theme moves it along its own hue and chroma. | `src/tokens/theme.js` (`withTextRoles`), `src/tokens/tokens.css` |
| `--tile-text-2` | The secondary word of a tile. A tile's card is washed with its accent, so the surface's secondary colour moved towards the primary text colour (30 % / 70 %); on a tonal tile the on-colour of the fill (90 %, mixed with the fill). Opaque. | `src/css/tilekit.css` |
| `--tile-err-text` | An error as a word on a tile: the error colour moved towards the primary text colour. | `src/css/tilekit.css` |
| `--tile-deco-ink` | The ink of a decorative glyph in a corner shape, the accent a third of the way to the shape's fill, so a figure over it keeps 3 : 1. | `src/css/tiles-text.css` |

## Rule

A word is never see-through: no `opacity` under 1 and no colour mixed with `transparent` on text. A word at 55 to 90 % lets the tint of the card, the plate or the selection through it and falls under 4.5 : 1 on those tints. The hierarchy between a figure, its name and its caption is the size and weight of the type. `test/textcontrast.test.js` holds this for the stylesheets (captions, notes, hints, units and sub-lines) and holds the guard of the theme.

Decoration under words (a shape, a glyph, a poster, a banner) is the designer's job to keep clear of them: the tile's name gets the tile's own fill as its plate where a shape passes under it, a banner or poster has a scrim strong enough under its label, a shape is placed clear of the figure.

## Gate

`scripts/contrast-fit.mjs` measures the rendered words, not the declared colours. Two screenshots per combination, with and without the words (each text node is wrapped in a span that is hidden for the second); the word's colour is its computed colour with its alpha and the opacity of its ancestors; what it sits on is the second screenshot under the glyphs (the glyphs' own pixels come from the same page drawn with the words in black and in white). The ratio is the worst tenth of the pixels. Words painted as a clipped background (the rolling digits) are measured from the first screenshot. It reports below-the-line words, disabled words apart, and words that are in the page but not painted (covered by a picture, clipped by their tile).

```sh
node scripts/contrast-fit.mjs --panel http://127.0.0.1:PORT --host-port N --out DIR        # the overview: every tile, sizes s m l xl strip, themes, states live idle off empty
node scripts/contrast-fit.mjs --pages http://127.0.0.1:PORT/tiles.html,... --out DIR       # the gallery pages: the shared components
```

`--panel` is the Panel over a host mock that answers `/__mock/live?on=`, `/__mock/switches?off=` (every boolean setting off) and `/__mock/reset` (no paired client). `QA_ENV` names a module that exports `chromium` (a launcher with the shared browser lock); otherwise `playwright-core` is resolved from `PW_REQUIRE_FROM` or from here. `--keep 1` keeps the screenshots.
