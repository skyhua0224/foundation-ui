# Home tiles: every card and where its data comes from

The home (概览) of both products is a catalogue of cards in a grid of about one column per 160 px (eight at the least; see Layout below); the person picks, sizes and orders them (edit mode, the pencil). Nothing on a card is
invented: a card is backed by a field of the running session, a route or a Tauri command of the product, a key of the host configuration, the window's own
appearance, or it is a pure action or link. A card whose source is missing in a product shows as unavailable in the picker and cannot be added.

Sizes are S (a quarter of the width), M (half) and L (half the width and twice the height, or the whole width for lists). The window's size class moves every card one
size at draw time (compact one smaller, extra-wide one larger; the setting 磁贴尺寸 in 个性化 turns this off), see `homeSizes.js`.

**The size of a tile is the same on every window.** One unit (the square of a 方形) is 148 CSS px at the standard density, plus a 12 px gap (a pitch of 160 px), at any window size and on any screen at the same OS scale; the density setting scales it, nothing else does. A bigger window holds more columns and rows of standard tiles (the smart overview fills the free places with more tiles), a smaller one fewer; only a pane narrower than two units and a gap (a phone) gets a smaller unit. The grid is as wide as its columns and sits in the middle of the pane. 148 px packs the content widths of the common windows (1280, 1440, 1920) into 7, 8 and 11 columns with 12 px to spare. The grid has at most 12 columns (1908 px): a wider window keeps the tiles at their size and gets wider margins on both sides, and there is no sectioned layout any more (it was the answer to a grid wider than the catalogue can fill). The smart overview fills the free places with more tiles with data; when they run out it takes the column count (up to six less than the window holds) that leaves the fewest empty cells, so the grid has no holes.

Totals: 17 default cards, 7 component-status cards (`comp:*`), 66 catalogue cards. The default home ships 配对 and 下载客户端 (both ordinary cards: they can be resized, moved, removed and added back).

## Default cards

| Card | Group | Shown | Source |
|---|---|---|---|
| `hero` | Host | always | host version, session, clients, application: the host status routes of each product |
| `vdd` | Host | always | virtual display state (panel: `get_vdd_status`; Web: the VDD routes) |
| `encoder` | Host | always | host configuration (`encoder`, codec modes) and the performance recorder while streaming |
| `display` | Host | always | the running session's size and HDR, else the display state |
| `bitrate`, `fps` | Stream | while streaming | `/api/runtime/sessions`, `/api/perf/current` |
| `table` | Stream | after setup | paired clients (`/api/clients/list`), the host log |
| `cpu`, `gpu` | Performance | idle | native Windows counters (`system_load`, `/api/runtime/system`) |
| `memory` | Performance | always | `get_process_memory_info`, `/api/runtime/system` |
| `gamepad-type` | Control | always | host configuration `gamepad` (saved through the one saving path) |
| `sw:mic` | Control | always | the microphone status route / `get_virtual_microphone_status` |
| `devices` | Devices | always | gamepad, microphone and USB state of each product |
| `guide`, `download` | Get started | on a new setup | the real state of setup; the release metadata |
| `apps` | Resources | after setup | `/api/apps` |
| `sponsor` | Resources | after setup | fixed links (`config/sponsors.js`) |

## Component status cards

`comp:vdd`, `comp:usbip`, `comp:dualsense`, `comp:drivers`, `comp:mic`, `comp:encoder`, `comp:host`: the state of each component (see `docs/m3e-status.md`, "Component status").

## Catalogue cards (66)

| Card | Name (en / zh) | Group | Sizes | Source |
| `latency` | Host latency / 主机延迟 | Stream | S/M/L | Session latency series of the performance recorder |
| `loss` | Packet loss / 丢包率 | Stream | S/M/L | Client report, only with adaptive bitrate on |
| `dropped` | Dropped frames / 丢帧 | Stream | S/M/L | Running session |
| `session-time` | Streaming for / 串流时长 | Stream | S/M | Running session |
| `current-app` | Now playing / 正在玩 | Stream | S/M/L | Running session and the application list |
| `budget` | Frame budget / 帧时间占用 | Stream | S/M | Host latency against the frame time |
| `last-session` | Last session / 上次串流 | Stream | S/M/L | Kept locally by this interface |
| `session-heat` | Streaming history / 串流历史 | Stream | S/M/L | Minutes per day: host log and this interface |
| `recent-games` | Recently played / 最近玩过 | Stream | S/M/L | Kept locally by this interface |
| `clients-paired` | Paired clients / 已配对客户端 | Devices | S/M/L | Paired client list |
| `clients-online` | Online now / 当前在线 | Devices | S/M | Paired clients that are streaming |
| `covers` | Library / 游戏库 | Resources | M/L | Application list covers |
| `codecs` | Codecs / 编解码 | Host | S/M | Host codec settings |
| `hdr` | HDR / HDR | Host | S/M | Session or display HDR state |
| `audio-out` | Audio / 音频 | Devices | S/M | Host audio settings |
| `gamepad-status` | Gamepad / 手柄 | Devices | S/M | Gamepad state of the host |
| `usb-devices` | USB devices / USB 设备 | Devices | S/M | USB/IP state (control panel) |
| `errors` | Errors / 错误 | Host | M/L | Host log, last 24 hours |
| `logs` | Log / 日志 | Host | M/L | Newest errors of the host log |
| `update` | Version / 版本 | Host | S/M | Host version and update state |
| `announcements` | Announcements / 公告 | Resources | S/M/L | Announcement feed |
| `act-pair` | Pair a client / 配对客户端 | Resources | S/M | Opens pairing |
| `act-add-app` | Add an application / 添加应用 | Resources | S/M | Opens the application editor |
| `act-restart` | Restart the host / 重启主机 | Resources | S/M | Restarts the streaming service |
| `act-docs` | Documentation / 文档 | Resources | S/M | Fixed link |
| `act-community` | Community / 社区 | Resources | S/M | Fixed link |
| `act-star` | Star on GitHub / 在 GitHub 点 Star | Resources | S/M | Fixed link |
| `temperature` | Temperature / 温度 | Performance | S/M | Hardware sensors (HWiNFO, control panel only) |
| `ctl-vdd` | Virtual display / 虚拟显示器 | Control | M/L | The shared virtual display control |
| `ctl-encoder` | Encoder / 编码器 | Control | M/L | Host setting, saved like the settings page |
| `ctl-bitrate` | Bitrate cap / 码率上限 | Control | M/L | Host setting, saved like the settings page |
| `ports-check` | Ports / 端口 | Host | S/M/L | Port check of the host (`/api/network/reachability`): reachable ports out of all |
| `file-maps` | File mappings / 文件映射 | Host | S/M/L | Host configuration `file_mappings` and `file_mapping_port` |
| `encode-budget` | Encode budget / 编码预算 | Stream | S/M/L | Host configuration `active_nvenc_frame_budget`: the encode time estimate against the frame time |
| `web-access` | Web page access / 网页访问范围 | Control | S/M | Host setting `origin_web_ui_allowed`, saved like the settings page; a change that locks the person out or opens the page to the internet asks first |
| `link-margin` | Link headroom / 链路余量 | Stream | S/M/L | Default network adapter of the host (`/api/system/info` `nics`: `link_speed_mbps`) against the session's bitrate (`measured_bitrate_kbps`, else the budget) and the FEC share (host setting `fec_percentage`); the link speed is the negotiated rate, not a measured throughput, and only the host's end |
| `frame-supply` | Frame supply / 帧率来源 | Stream | S/M/L | `frame_rates` of `/api/perf/current` (source, capture, submitted, encoded, repeated frames per second, `source_kind`), passed by the product as `session.frameRates`; a stage that delivers clearly fewer frames than the one before it is marked |
| `mic-health` | Microphone / 麦克风 | Devices | S/M/L | The microphone status (`/api/microphone/status`, passed as `mic`): the state, the gap, dropped and error counters; the path (`microphone_redirect_backend`: 自动, VB-CABLE, USB/IP, 关闭) is chosen on the tile at 中 and 大, saved like the settings page |
| `capture-method` | Capture method / 捕获方式 | Control | S/M/L | Host setting `capture` ('' auto, ddx, wgc, amd, vdd; Windows), chosen on the tile at 中 and 大, saved like the settings page, in effect after a restart of the host; the method of the running session (`perfCapture`) is shown at 大 |
| `ctl-fps` | Frame rates / 帧率预设 | Control | M/L | Host setting, saved like the settings page |
| `memory-trend` | Memory over time / 内存变化 | Performance | S/M/L | Memory counters, kept locally |
| `load` | CPU and GPU / CPU 与 GPU | Performance | M/L | Load counters, kept locally |
| `pair` | Pair a client / 配对客户端 | Stream | S/M/L | Paired clients and the host pairing route |
| `stream-resolution` | Stream resolution / 串流分辨率 | Stream | S/M | Running session |
| `stream-client` | Streaming to / 正在串流到 | Stream | S/M/L | Running session |
| `stream-fps` | Frame rate / 帧率 | Stream | S/M | Running session and the performance recorder |
| `stream-bitrate` | Bitrate / 码率 | Stream | S/M | Running session and the bitrate cap of the host settings |
| `stream-mic` | Client microphone / 客户端麦克风 | Stream | S/M | Running session |
| `stream-vdd` | Virtual display in use / 使用虚拟显示器 | Stream | S/M | Running session |
| `act-stop` | Stop streaming / 停止串流 | Stream | S/M | Stops the running session |
| `host-ports` | Port / 端口 | Host | S/M | Host settings: port and UPnP |
| `host-name` | Host name / 主机名 | Host | S/M | Host settings |
| `host-encryption` | Encryption / 加密 | Host | S/M | Host settings: LAN and WAN encryption |
| `host-adapter` | Graphics card / 显卡 | Host | S/M | Host settings: adapter and output |
| `ctl-controller` | Gamepad input / 手柄输入 | Control | M | Host setting, saved like the settings page |
| `ctl-keyboard` | Keyboard input / 键盘输入 | Control | M | Host setting, saved like the settings page |
| `ctl-mouse` | Mouse input / 鼠标输入 | Control | M | Host setting, saved like the settings page |
| `ctl-cursor` | Show the cursor / 显示光标 | Control | M | Host setting, saved like the settings page |
| `ctl-audio` | Stream audio / 串流音频 | Control | M | Host setting, saved like the settings page |
| `pers-theme` | Light or dark / 明暗 | Personal | M | The window appearance |
| `pers-wallpaper` | Wallpaper / 壁纸 | Personal | M/L | The window appearance |
| `pers-colour` | Colour / 取色 | Personal | M | The window appearance |
| `vivi` | Vivi / 薇薇 | Personal | S/M/L | The mascot art of the product |
| `tip` | Tip of the day / 今日小技巧 | Personal | M/L | Fixed tips about this interface, one a day |
| `act-settings` | Stream settings / 串流设置 | Resources | S/M | Opens the settings |
| `act-diagnostics` | Diagnostics / 诊断 | Resources | S/M | Opens logs and diagnostics |
| `act-clients` | Clients / 客户端 | Resources | S/M | Opens the client list |
| `act-apps` | Applications / 应用 | Resources | S/M | Opens the application list |
| `act-downloads` | Download a client / 下载客户端 | Get started | S/M | Opens the client downloads |

The `act-*` cards are links or actions: `open` opens a page (`settings`, `diagnostics`, `clients`, `apps`, `downloads`), `hero` asks to stop the running stream (the same confirmation as the
overview's main button), `link` opens a fixed address. The `ctl-*` cards write the host configuration like the settings pages (`enabled`/`disabled` or `true`/`false` per key, see `SWITCHES` in
`homeCatalogueMore.js`); `pers-*` change the window's own appearance (`useAppearance`); `vivi` uses the mascot art of the package and a greeting by the hour; `tip` is one of eight fixed tips about this
interface, one a day.

## Needs host support (not in the catalogue)

A candidate without a real source is not a card. These are asked of the host or the control panel; each is a read-only route or a command, none touches the streaming code.

| Candidate | Why it is not a card yet |
|---|---|
| network latency, jitter | the host receives the client's feedback only for adaptive bitrate and exposes no route for it (packet loss is a card, only with adaptive bitrate on) |
| GPU encoder load, VRAM, GPU power (NVML) | no route or command reads them; the load counters give GPU usage only |
| network up / down throughput | the host reports no client-to-host traffic and keeps no interface counters |
| host uptime | the panel has `get_sunshine_start_time`; the Web UI has no route, so the card would not be the same in both products |
| power plan switch | no route or command |
| resolution and refresh-rate quick switch | no single configuration key: the modes are per client (virtual display) |
| HDR toggle | `hdr_prep` is a multi-mode setting with a risk confirmation, not a switch; needs a confirmed control |
| 画质增强 toggle | a Tauri setting of the panel only |
| DualSense battery and light bar | the host snapshot has no battery field; the light bar lives in the tuning snapshot the home does not load |
| 手柄测试 launch | a panel tool; the Web page has the test as a sub-page, to be linked once the sub-page route is stable |
| pending pairing request | the host exposes no list of pending pair requests |
| pin one application as a launch tile | no route starts an application without a client |
| 米塔 AI quick ask | panel only (the assistant), not a card of both products |

## Sizes: three layouts per card

Every card offers small, medium and large, each its own layout (not a scaled copy). A card without a hand-made layout at a size gets the generic one of that size, described below,
so the table of what a card draws is: a layout of its own where the card's table names the size (`homeSizes.js`, `SIZE_TABLE` and `CATALOGUE_SIZES`), else the generic layout.

| Size | Box (columns of 8 x rows) | What it draws |
|---|---|---|
| Small | 2 x 1 | an icon and one value or state (a count, the current choice, the label of the action) with the name under it; the curve and info cards draw their own small layout (value and a tiny curve or chip) |
| Medium | 4 x 1 (control cards that need room: 4 x 2) | the value with a graphic (curve, ring, gauge, bar) or a short list (two or three rows), or the control itself (a chip set) |
| Large | 4 x 2 (lists and charts 8 x 1 or 8 x 2) | the full card: the long list or chart, every control, the time range; a card without its own large layout draws the medium layout and a line that says where its data comes from, and, when the card has a detail sheet (`buildCatalogueDetails` and the product's own details), the sections of that sheet inline beside it (8 x 1; smaller charts, no range switch, `MDashSections.vue`); without sections it keeps the medium box |

The generic small layout is `homeSmall.js` (`smallOf`): for a list it is the count, for a chip card the state, for a control the current option, for an action its label, for 配对 the paired
count. The 配对 card is medium by default and has its own three layouts: small (icon and the paired count; a tap opens the pairing sheet), medium (one line with the PIN as four digit boxes and 配对,
the QR code rendered on the trailing side with its countdown, and one line with the paired count and the latest client; it shares the row with the host card and does not make it taller), large
(the same with bigger digit boxes and a bigger code). The 下载客户端 card: small (generic), medium (device chips, the recommended client, the three steps and the way to the page), large (the
same with two clients side by side).

The QR code opens a pairing window on the host, so the card asks for it only while it is on screen at medium or large (`usePairQr.js`): it is created when the card shows, cancelled when the card goes
away (hidden, resized to small, edit mode, the page left), shown with a countdown, and when it expires the card shows a refresh button instead of opening a new window by itself. The picker and edit mode
show the card without asking for a code.

Row heights: a card keeps the row class of its own layout (strip 54 px, hero 164 px, card 190 px, tall 232 px, list 270 px). The generic small tile is a strip (icon and one value do not need a card), and the
catalogue cards whose content is short (a value and a few rows, chips, a control, a few covers) take the tile class, a row that the content sets (at least 96 px), at every size, so no 190 px row is left mostly empty.

How it is checked: A browser check (kept outside this repository) renders every card at the three sizes with a live session and measures a part of a card outside its box and content taller
than its card; `tools/home-empty-check.mjs` measures the share of each card that is empty (a band of 8 px with no content within 12 px) at one size and fails a card above 40 %.
The last run: 76 of the 86 cards had data in that check and were measured at all three sizes; 74 pass. Two measure a scroll height beyond their box that the screenshots show as
clipped padding and rows (gamepad-type small, a 54 px strip; apps, the application list); they are listed here and not hidden. The ten cards with no data in that check (no source there) are not rendered.

Persisting: the size is saved per card with the layout (`foundation-ui.dash2.<interface>`, version 3). A layout saved before version 3 is migrated when it is read: the 配对 card is placed after the
host card, the person's order, hidden cards and sizes are kept, and a saved size the card no longer offers falls back to its default.

## Added in round 12: the journey, star and system tiles

| Card | Group | Shown | Source |
|---|---|---|---|
| `journey` | Get started | while no client is paired | the paired clients (`/api/clients/list`); its state is local (`foundation-ui.journey.<key>`) |
| `star` | Get started | once, after the first pairing or the first stream | local state (`foundation-ui.star.<key>`); the first stream is the product's `sessionSeen` |
| `net` (网卡) | Host | smart mode, or added | `GET /api/system/info` `nics` (type, `link_speed_mbps`, `ipv4`, `ipv6`, Wi-Fi `signal`, the OUI of `mac`, never the device part). Sizes 中, 大, 特大 (no 方形). The adapter shown is the person's choice on the tile (a menu at 中, the list of adapters at 大 and 特大, kept per host name in local storage; Auto removes it), else the rule of `src/vue/nicChoice.js`: the adapter that holds the host's `bind_address`, else the one on the network of the streaming client (`client_address` of `/api/runtime/sessions`, same /24 or /64), else a physical adapter with the default route (wired before wireless; VPN, tunnel, bridge, container and hypervisor adapters are recognised by `type` and by their name or description, even when the host calls them ethernet), else any other physical adapter, and a virtual one only when nothing else is up. 特大 adds the stream's measured bitrate (`measured_bitrate_kbps`) over time, only while the shown adapter is the one that carries the stream |
| `sys` (系统) | Host | smart mode, or added | `GET /api/system/info` `os` (name, version, build) and `host.name` |
| `public-address` (公网地址) | Host | smart mode, or added | the configuration key `external_endpoints` (the old `external_ip` when the list is empty) and the host's reachability check (`public.endpoints`: per endpoint the state, the tested HTTPS port, the latency, the scope); the verdict is `MReachVerdict`, the endpoint list editor `MPublicEndpoints`, the same components as the network page's status card |
| `cpu`, `gpu` (more lines) | Performance | as before | `GET /api/system/info`: `cpu.model`, `cores`/`threads`, the temperature where the product has one; `gpus[]`: name, `driver_version`, `vram_mb`, `is_streaming_adapter` |

`/api/system/info` is cached for 60 s on the host and read once a minute; a host without it (404) leaves 网卡 and 系统 unavailable and the CPU and GPU cards as they were.
The pinned tiles of settings and actions are described in the pin section of `docs/task-steps.md`.

## Smart and manual

The overview is **smart** by default (a chip 智能 in its header opens 为什么显示这些, one line per tile) and **manual** once the person edits it. Entering edit mode copies what
the smart plan shows into the saved layout, so nothing jumps; 恢复智能布局 gives the plan back. The pins (and a suggestion the person accepted) are always kept.

The plan is `smartPlan()` in `homeSmart.js`: one deterministic function, scores and a reason per tile, replaceable by a model later. Signals, all local: the paired client count,
streaming or not, startup problems and component issues, recent errors, the virtual display, microphone and gamepad state, the default network adapter (Wi-Fi, slow link), the
reachability verdict, a new setup, the counts of how often each tile was opened or used (`foundation-ui.usage.<key>`, counts only, never sent), the pins, the window size class.

| Scenario | The tiles that lead |
|---|---|
| a problem (startup problem or a component issue) | the problem card, then the components with an issue, then the host |
| streaming | the host or session, bitrate and frame rate, the application, encoder, gamepad and microphone controls, a stop tile, CPU and GPU; the network when the host is on Wi-Fi |
| no paired client | the connect journey (large), the guide, the host, the download tile |
| idle with clients | the host, the star card (once), the pairing tile (small or medium), apps, recent games, the virtual display |

Tiles that are used often rise, tiles that are never used and not relevant fall out of the visible set (they stay in the catalogue). The plan is made at the start of the app and when
something significant changes (the first pairing, a stream starts or stops, a problem appears or clears), never while the pointer is over the tiles.

## Smart stack (rotation group)

The smart tiles of the overview stay as they are. On top of them a **stack** holds 2 to 6 tiles of one size in the place of one tile and shows the one that matters. The model is Apple's Smart Stack
(sources in `authority/source-index.tsv`: WidgetKit "Increasing the visibility of widgets in Smart Stacks", `TimelineEntryRelevance`, "Keeping a widget up to date", the Widgets HIG, the iPhone guide).

- **What it shows** (`homeSmart.js relevanceOf`, `stackModel.js rotationPick`): the plan's own score of each member from the same signals (streaming, a problem, an update, a new host) plus the part of the day
  in the calm scenarios (evening: games and the last session, morning: the host and the update). A member needs 30 (the plan's line for a tile worth showing) and a lead of 10 over the one shown. Zero is not relevant, as in WidgetKit.
- **When it may change** (`stackRotation.js`): never while the page is in use. Only (1) when the page was away (hidden, window not focused, or another page of the app) for **15 minutes** and is shown again,
  then once, 1.2 s later when the host's signals are fresh; or (2) after **30 minutes without input**. 15 minutes is the short end of how often WidgetKit lets a viewed widget reload (40 to 70 refreshes a day,
  "roughly every 15 to 60 minutes"); a stack also changes at most once in 15 minutes, a turn by hand counted. A stack under the pointer or the keyboard focus, in the edit mode, pinned, or with rotation off never changes.
- **How it moves**: by hand a vertical swipe (spatial spring); by the host a 240 ms crossfade; with reduced motion no movement and no fade.
- **By hand**: vertical swipe, the wheel after the pointer rested on it, the page dots (buttons, always shown, faint), the keys (arrows, Home, End). The **pin** keeps the card shown and turns rotation off for that stack
  (the same flag as the sheet's switch 智能轮换 and the menu's item). **轮换：开/关** in the edit panel is the one switch for all stacks.
- **Edit mode**: drag a tile onto a tile of its size and hold, or 加入轮换组 in the size pill; 编辑轮换组 opens the sheet (reorder by the handle or the arrow keys, take out, add, dissolve).
- **Saved** locally per interface, apart from the layout: `foundation-ui.stacks.<key>` = `{ stacks, next, rotate }`. On by default; `?stacks=0` or `foundation.smartstack` = 0 turns the feature off.

## Layout: columns, caps, sections

- A tile of a size never grows past its cap: S about 460 px, M 780, L 1060 (the whole grid while it has nine columns or fewer). A wide window has more columns instead (`unitsFor`).
- `fitDash()` (`homeFit.js`) tries every number of columns the width allows (each tile boxed again for it), keeps the most columns that leave at most a tenth empty and no row more
  than a fifth empty, and in smart mode moves tiles one or two sizes up or down, then adds suggested tiles (ghosts marked 建议: 添加 or 不再建议) where a row is still short.
  What is still short is centred, never stretched.
- Up to about 1600 css px: one grid filling the page (the overview is not limited to the 1280 px column of the other pages). From 1600: more columns and tiles one size larger within their caps.
- Wider than 2560 css px, or wider than 2.1 : 1: sections side by side, each its own grid of at most 1000 px (at least 880), as many as fit; four purposes in smart mode (live and performance;
  controls and devices; clients, apps and downloads; system and announcements). In manual mode tiles are dragged between sections and sections are added or removed.
  Portrait and tall windows fit one or two sections across, the rest wrap below with the same caps.
- Checked by `tile-width-check.mjs` at 1440x900, 1920x1080, 2560x1440, 3440x1440, 3840x2160 (100 % and 150 %) and 5120x1440: no tile over its cap, no row more than 25 % empty, no text row over 900 px.
  A phone-width window keeps small tiles in pairs (about 160 px each): the 200 px minimum applies from 420 px.
