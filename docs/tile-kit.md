# Tile kit

The parts the overview tiles are built from. Every tile at every size has a **hero**: a full-bleed chart, an expressive shape, art, a stack, or a display
numeral. The hero is the tile's one focal element (see [The focal element](#the-focal-element-hero-share): the robot's `hero-share` check). A larger size adds detail and keeps the hero. Colours are theme roles only; all parts work in light, dark and 纯黑 with any seed.

Import from `foundation-ui/vue`; styles are in `src/css/tilekit.css` (part of `all.css`).

## Tokens

| Token | Use |
|---|---|
| `.m-tile` | The tile's root (padding 16 px, radius of the dash, card colour, `overflow: hidden`, `isolation`). Children are stacked over the bleed layers. |
| `data-accent="primary\|secondary\|tertiary\|ok\|warn\|error"` | The tile's accent: sets `--tk`, `--on-tk`, `--tk-c`, `--on-tk-c` from the scheme. Default primary. `.is-hot` = error (a load at its limit). |
| `.m-tile--tonal` | The whole tile filled with the accent's container (`--tk-c`), text in `--on-tk-c`. Use for a tile that is a state or must read from a distance. |
| `.m-tile__bleed` | A layer on the card's left, right and bottom edges, under the content; height `--tile-bleed` (default 56 %). Put a chart in it. |
| `.m-tile__corner` | A decoration in the free top-right corner, under every layer of the tile: 60 px at one and two cells, 88 px at 大 and 特大, 6 px past the edges. A word never runs over it: the head keeps clear of it (padding), and at one cell the head's glyph is dropped and the name wraps in balance. Put an `MTileShape` in it, no larger. Checked by the decoration gate (a decoration's box against every text box of its tile). |
| `.m-tile__head` | The header row: `<MIcon>` in the accent, a `<span>` title, optional `.m-tile__more` chevron button. |
| `--tk-fill-top`, `--tk-fill-mid` | Opacity of the chart's gradient at the top of the plot area and at 60 % (0 at the bottom edge). Light .36/.12, dark .44/.15. |
| `--tk-line` | The chart's line width (3 px). |
| `--m-font-display` | The display face: Google Sans Flex as `M3E Display` (src/fonts, OFL), then the interface face and the CJK stack. Use it for numerals and Latin display text in tiles; body text keeps `--md-ref-typeface-brand`. Numerals file 20.7 KB (opsz 144, wdth 25–125, wght 300–800, ROND 0–100), Latin file 44.3 KB (opsz 18–144, wght 400–700); each loads only when its characters are drawn; `font-display: swap` over a metric-matched fallback. |
| `--m-tile-text-<px>`, `--m-tile-text-<px>-strong` | The type of a tile's chrome (labels, chips, captions): 12 (12/16), 13 (13/18), 14 (14/20), 17-strong (17/22); `-strong` is the semibold. Use these, not a hard-coded `font:` shorthand (typography A's small-text check). The numerals use `--m-font-display`; the letters that scale with an avatar or a cover keep their own size. |
| `--tn-wdth`, `--tn-rond`, `--tn-wght`, `--tn-track` | The numeral's width (`font-stretch`, 25–125 %), roundness (`ROND` 0–100), weight and tracking; set by `MTileNumeral`'s `width`, `round`, `weight`. |
| `--m-spring-<fast\|default\|slow>-<spatial\|effects>` (+ `-duration`) | The M3 motion springs (tokens.css). Every kit animation uses them: spatial for movement and shape (the chart's slide, the ring, the tank, the shape morph), effects for colour and opacity. |

## Parts

| Part | One line |
|---|---|
| `MTileChart` | `<MTileChart class="m-tile__bleed" :points="pts" :max="100" kind="area" dot :window="36" />`: a live chart, edge to edge, newest at the right; `kind` area, line or bars; `dot` adds the now dot and runs the line flat to the edge; `grid` adds three faint guides. A new sample slides in on a transform (≤ 1 per second, none under reduced motion or off screen). |
| `springOf`, `morphShape`, `TILE_SHAPES` | `springOf('default-spatial')` → `{ easing, duration }` for an animation started from script (`el.animate(frames, springOf('fast-effects'))`); `morphShape(el, 'circle', 'cookie')` morphs a clip-path between two library shapes on the slow spatial spring (idle → streaming); `TILE_SHAPES.cookie` is `'var(--m-shape-cookie)'`. `MTileShape` morphs by itself when its `shape` prop changes. All of them do nothing under reduced motion. |
| `MTileShape` | `<MTileShape icon="speed" shape="cookie" size="96px" tone="container" />`: an M3 library shape (cookie, clover, gem, sunny, burst, squircle, circle; empty = the group's shape) with its icon at 46 %; tones container, solid, tonal. |
| `MTileNumeral` | `<MTileNumeral value="47" unit="%" size="m" caption="Ryzen 9 7950X" width="condensed" round="soft" :weight="500" />`: the display numeral in Google Sans Flex, sizes s 40, m 57, l 76, xl 96 px, tabular figures, tracking −0.02 em; `width` normal / condensed (62 %, a tall numeral as the 07 30 clock) / wide; `round` crisp (0) / soft (100); `weight` 300–800 (600). The number rolls on change. |
| `MTileChip` | `<MTileChip label="HDR 开" icon="hdr_on" tone="ok" />`: a state or short fact; tones '' (accent tint), accent, ok, warn, err. |
| `MTileRing` | `<MTileRing :value="0.47"><MTileNumeral … size="s" /></MTileRing>`: the shared Material 3 circular progress indicator ([MProgressRing](progress-ring.md): closed from 12 o'clock, a track a gap behind the active indicator, round caps; `wavy` for the Expressive wavy indicator); `:segments="[{ value, tone: 'a' }, { value, tone: 'b' }]"` for parts of a whole; the slot is the centre, kept inside the ring. Sized by its container (aspect 1). |
| `MTileStack` | `<MTileStack kind="covers" :items="[{ cover, letter }]" :more="4" size="88px" />`: fanned covers (games, apps) or `kind="avatars"` overlapping circles (`{ icon, tone }`) with a +n bubble. |
| `MTileCover` | `<MTileCover :item="coverOf(app)" />` or `<MTileCover :name="app.name" :cover="app.cover" :icon="app.icon" />`: the art of a game or an application; without art the app's own icon (an image URL from the app entry, or the glyph of a built-in app: 桌面, Steam Big Picture, Playnite, TV) on surface-container-high; with neither a neutral glyph (`NEUTRAL_GLYPH.game` gamepad, `.app` window). Never a gradient, never an initial letter. Fills the box it is given (height, `aspect-ratio`, radius from outside). `coverOf` is exported from `foundation-ui/vue`. |
| `MTileHead` | `<MTileHead icon="memory" title="CPU" chevron @open="…"><MTileChip … /></MTileHead>`: the header row: the icon in the accent, the title, an optional end slot, the chevron that opens the sheet. |
| `MTileEmpty` | `<MTileEmpty icon="sports_esports" shape="clover" title="最近玩过" text="还没有玩过" :action="{ label: '开始串流', type: 'guide-go', value: { id: 'connect' } }" size="s" @act="…" />`: the empty state: the shape as hero (cut by the corner at 方形, at the start at 中, centred at 大), one line of state, one action. |

## Rules

- One hero per tile; a larger size adds detail beside or under it and never removes it.
- Text over a chart stays at the top; the chart's fill is translucent so it never hides text, and its line never runs through a numeral (give the chart the lower part with `--tile-bleed`).
- Numerals: `MTileNumeral` size s at 方形, m at 中, l at 大 unless the tile's hero is something else (then the numeral may be s).
- No supporting line that restates the title; a caption carries a state, a number or a name.
- Live parts update at most once per second and animate transforms or dash arrays only.
- A chart never stands alone: it sits next to its labelled current value (a label and the number in display type, the line under it in the same column); a line without them is removed.

## The focal element (hero-share)

The robot's `hero-share` check (a browser check kept outside this repository; calm, one focal element, no shapes as noise) reads every tile's candidates: display text
(`--m-font-display` at 24 px or more), art or a cover, a chart (an svg of 40 px or more that draws a path), any other painted visual, and painted containers holding text
(one group per parent); a rolling numeral (`MRoll`) is one text. The largest is the focal element. A tile passes when the focal element covers at least 15 % of the tile and no second candidate reaches 60 % of
its area. The calibrated tiles sit at 35 % to 100 % (the metric family 36-52 %, 正在玩 35-100 %, 在线客户端 中 54 %); the round-30 tiles the team rejected at 3-8 %.

- **Controls do not compete.** An element with a button or link role and an accessible name (`aria-label`, `title` or its text), and what it holds, is an affordance:
  the hero's 重启主机 / 结束串流 shape. It can be the focal element, never the second one. Name every control; an unnamed one competes.
- **Decorative layers do not compete.** A fill drawn at an alpha under 15 % (its colour's alpha times the opacity down to it) is background: A's 9 % sunny behind the
  action, the 11 % fact blocks. Anything meant to be read as a shape is drawn at 15 % or more.
- **State indicators do not compete.** A dot under 12 px on both sides that declares a state (`data-state`, role `status` or `img`, a `title` or an `aria-label`)
  is status, not a visual: the hero's 运行中 dot. Give every state dot `data-state`.
- **A toolbar** (the content is a `role="toolbar"` group of at least 2 named controls: 快捷操作) is its own focal element; it passes unless a visual outside it that
  is not a control reaches 60 % of the group. A toolbar has one tab stop and moves between its buttons with the arrow keys, Home and End (WAI-ARIA APG).
- **A display numeral is focal by its size.** A numeral (digits and separators) in display type at the kit's numeral size for its tile or larger is the focal
  element by its size, not its area: it passes when nothing else reaches 60 % of its line box (its text's width times its line height): a one-digit count
  at 48 px has a line box of about 29 × 44 px. A count with its members (a row of 2 to 4 equal small avatars, up to 64 px: 在线客户端 方形's 44 px circles) is one focal group with the numeral.
- **A whole-tile action** (the root is the button: 添加应用, the Quick Settings pattern) is its own focal element: its glyph container at least 40 px on its short side,
  its label at title size (16 px) or more, nothing else at 60 % of the glyph container.
- **A summary card** (the 本主机 hero) states one thing about several facts. It declares itself: `data-tile-summary` on the root, `data-tile-name` on its name and
  `data-tile-facts` on every part that holds facts (the chips, the F1 blocks, the F2 band). When it fails the rule above, it passes if the name is display text at the
  size the kit sets for the tile's size (方形 28 px, 中 and up 32 px) or larger and is the focal element: all the facts together are one secondary element whose weight (the area of what paints in them: a fill times its alpha, display
  text, a chart, art) does not exceed the name's (the area of its text), and nothing outside the facts reaches 60 % of the name. One emphasised fact block is allowed (a filled block as large as its sibling blocks: F1's solid 客户端 block). A part of the facts may declare itself the focus (`data-tile-focus`: the streaming hero's now-playing band); it is then the focal element, the name stays at display size, and nothing else reaches 60 % of the focus. Use it for a card that summarises a
  host or a session, not to excuse a tile with two heroes.

### The kit's numbers (the check reads the same values)

| what | 方形 | 中 | 大 | 特大 |
| --- | --- | --- | --- | --- |
| `MTileNumeral` (the kit's numeral scale; the least a numeral needs to be focal by its size) | 40 px | 57 px | 76 px | 96 px |
| the calibrated metric squares' value and 在线客户端's count | 48 px | | | |
| a summary card's name (`data-tile-name`) | 28 px | 32 px | 32 px | 32 px |

Shares: focal at least 15 % of the tile, a second element under 60 % of the focal one (of the numeral's line box, the toolbar, the glyph container or the name);
a decorative layer under 15 % alpha; a state dot under 12 px; a whole-tile action's glyph container 40 px and label 16 px.

## Tile designs (one component per tile family)

- A design is a file `src/vue/tiles/Tile<Name>.vue` with `<script>export const tileIds = ['cpu', 'gpu']</script>` beside its `<script setup>`; `tiles/index.js` registers every such file (no shared list to edit). An id `comp:*` covers every component tile.
- Props from `MDashCardView`: `card` (`{ id, title, group, size, data }`; `size` is the effectiveSize: s, m, l, xl, xlp), `texts`, `details`, `variant` (1 or 2), `chevron` (a detail sheet exists), `preview` (drawn in the gallery or the edit sheet: start nothing), `empty` (null, or `{ icon, title, value, action }` of the square while the card has no data: draw `MTileEmpty` with it). Emit `act` with `{ type, value }` (`detail` opens the sheet; pass an empty state's action through as it is).
- The root is `<section class="m-tile" :data-accent>` and fills the cell; draw every size of the tile's range (homeRanges.js), each with its hero.
- Dev flag: `?tiles=bold` (or localStorage `foundation-ui.dev.tiles` = `bold`); variants `?tv=cpu:2,net:2`. Off: the tiles are drawn as before.

## Tiles that are a number or a state (round 3)

- A resolution (串流分辨率, 虚拟显示器) is display type on the tile's own surface, the state or the mode in a caption under it, as the name of 编码器 is. No block of colour and no drawn frame behind it. 
- An end action (停止串流) is an error action on the calm card: the glyph uses the error role, a slight tint of it is on the card, the words keep the surface text colour.
- The head of a tile breaks a Chinese or Japanese title between its words (`MTileHead` keeps each word whole), never inside one.

Round 3, second pass: the hero of a resolution tile is its name (`resNameOf` in `tiles/b2.js`: 3840x2160 and 4096x2160 -> 4K, 2560x1440 -> 2K, 7680x4320 -> 8K, the others keep their height, 1080p); it is set in the type of the name of 编码器 (600, 28 px at one cell, 36 px at two). A switch tile at one cell (HDR, 使用虚拟显示器) puts the word of the state at the bottom left and its picture at the bottom right: an expressive shape (sunny for HDR, cookie for the display) with the glyph, solid in the accent when on, tonal when off. Switching it changes colours only: the boxes of the tile, the word and the shape stay where they are (measured per frame).
