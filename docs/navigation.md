# Navigation and the caption bar

## Global back, three variants

After a jump between areas (体检 → 打开设置 → 网络, a home tile → its settings) the person can go back to where they were. One app-wide stack
(`createJumpHistory`, `src/nav/jumpHistory.js`) keeps the places left by a jump; a move the person makes (rail, list row, search) clears it; the page's own
sub-page back arrow is not part of it. Three looks share that stack:

| variant | what the person sees |
|---|---|
| A (default) | a round back button at the far left of the caption bar, left of the logo; enabled only when there is a place to go back to; tooltip 「返回：<页面名>」; Alt+Left and the system back (mouse button, gesture) take the same step |
| B | no button; after a jump a chip 「← 返回<页面名>」 at the top of the page; it disappears when the person navigates elsewhere |
| C | A and B together |

Choose one: add `?back=A`, `?back=B` or `?back=C` to the address (the Web UI in a browser), or set it in 开发者选项 › 全局返回 (stores
`foundation.back.variant` in the local storage; the panel has no address bar, so use the developer option there). The address wins over the stored choice.
A phone keeps its bottom bar and its page back arrow: the chip of B and C is drawn there too (it is the only form that fits), the button of A is not (no room in the caption bar).

## The version in the caption bar

`MCaptionVersion` (after the product name): the short version (`2026.1107`), a 测试版 tag for a pre-release build, a click or Enter copies the full version, channel,
commit, build time, package and system for a bug report. `src/about/titleVersion.js` is the one formatter (`shortVersion`, `titleVersionView`, `reportText`). A waiting
update adds 「有更新可用」 with the new short version (opens 软件更新) and a red dot on the navigation item that holds 软件更新; the state is `src/update/notice.js`
(remembered from the update checks that already run, nothing is asked again). A phone shows the same line at the top of 更多 (panel); the Web UI has no 更多 on a phone, its 帮助与关于 destination is the 关于 page, which already shows the version row and the update button.

## Window sizes: the navigation, the caption bar, the tiles

Two axes decide the layout: the width (Material's window classes) and the height (a window under 480 px tall is a short one: a phone on its side, a small window).

| window | navigation | content |
|---|---|---|
| under 600 wide | the bar at the bottom: four hubs and 更多 | one pane |
| under 480 tall (`SHORT_HEIGHT`) | the same hubs and 更多 as a narrow rail beside the content, 80 wide, the label under every icon; the window's height is for the content | one pane, the phone's flow |
| 600 and wider | the navigation rail, collapsed or expanded; when the labelled items do not fit the height, the labels stay (10.5 px) and the rail scrolls | list and detail from 720 |

`navigationOf(width, expandedChoice, height)` and `barSideOf(width, height)` (`src/nav/scenes.js`) are the rule; `isCompactNav(width, height)` is what a product asks for what it keeps per navigation (the router's phone stack). The bar and the side rail are the same `bar` mode, so every hub, 更多 and the single pane flow are one implementation.

The caption bar (`MCaption`) always keeps the product's window buttons. It picks the roomiest tier in which what it shows fits (`data-tier`, decided in the frame of the change): 1 the version and the update line, 2 the label of 连接设备 and the search field (their icons stay), 3 the name beside the logo, 4 公告 and 反馈, 5 连接设备. What a tier leaves out is listed in the product's 更多 (the `more` event), in the order it has in the bar; a product whose bar has a 更多 destination of its own (`bar-more`) shows no button while that bar is on.

The tiles: a pane under 800 px is filled edge to edge, the columns share the whole width (the unit between 148 and 200 px, `columnsOf`); a wider pane keeps the standard unit of 148 px and the grid sits in the middle. The dock layout wraps its tiles into the same columns (no row that scrolls, no arrows); the date and the status line shrink in a short window so the clock keeps its height. The small tile (方形) breaks its second line between the pieces of one fact and never cuts a piece; a processor or a graphics card shows a short name (`shortHardware`).

While a window is dragged, every frame is the layout of its size (`html.m-resizing` switches every transition off); nothing slides towards it and no component is mounted again at a breakpoint.
