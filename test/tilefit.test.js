import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { starClientInUse } from '../src/vue/starCard.js'
import { anchorOf, untilNextSecond, useSessionClock, CLOCK_JITTER_MS } from '../src/vue/sessionClock.js'
import { buildHomeModel, TEXTS_ZH, homeTexts } from '../src/vue/homeModel.js'
import { nextTick, ref } from 'vue'

const css = (f) => fs.readFileSync(new URL(`../src/css/${f}`, import.meta.url), 'utf8')
const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')

// ---- the star banner follows the client of the session (a real host lists 31 paired clients with no family; the session carries `client_family`)
const paired = Array.from({ length: 31 }, (_, i) => ({ name: 'Named Zako', uuid: `U${i}`, last_seen: i }))
const macSession = { uuid: 'DF3B4175', name: 'Named Zako', family: 'moonlight-macos-enhanced', os: 'macos', official: true }
test('a Mac session of Moonlight macOS Enhanced asks for the star of Moonlight macOS Enhanced, whatever the paired list says', () => {
  const s = starClientInUse({ clients: paired, session: macSession, names: paired.map((c) => c.name) })
  assert.equal(s.id, 'macos-enhanced')
  assert.equal(s.name, 'Moonlight macOS Enhanced')
  assert.equal(s.url, 'https://github.com/skyhua0224/moonlight-macos-enhanced')
})
test('the family of the session counts before the paired record; clients that are not ours get no star of their own', () => {
  const pad = [{ name: 'Pixel', uuid: 'DF3B4175', family: 'moonlight-vplus-android', official: true, os: 'android' }]
  assert.equal(starClientInUse({ clients: pad, session: { uuid: 'DF3B4175', name: 'Pixel', family: 'moonlight-macos-enhanced' } }).id, 'macos-enhanced', 'the session is the source')
  assert.equal(starClientInUse({ clients: pad, session: { uuid: 'DF3B4175', name: 'Pixel' } }).id, 'vplus-android', 'no family on the session: the paired record')
  assert.equal(starClientInUse({ clients: paired, session: { uuid: 'x', name: 'Named Zako', family: 'moonlight-upstream', official: false } }), null)
  assert.equal(starClientInUse({ clients: paired, session: { uuid: 'x', name: 'Named Zako', family: 'voidlink', official: false } }), null)
  assert.equal(starClientInUse({ clients: [], session: { uuid: 'x', name: 'Named Zako', official: true, os: 'macos' } }).id, 'macos-enhanced', 'official, a Mac, no list: the Mac client')
})

// ---- the stream's running time ticks from the session's start
test('the clock keeps its start unless a poll differs by more than the jitter', () => {
  assert.equal(anchorOf(null, 87000, 1_000_000), 913000)
  assert.equal(anchorOf(913000, 90000, 1_003_200), 913000, '3 s later, 90 s: the same start, the clock does not step')
  assert.equal(anchorOf(913000, 90000, 1_003_200 + CLOCK_JITTER_MS + 10), 1_003_200 + CLOCK_JITTER_MS + 10 - 90000, 'a large difference is taken')
  assert.equal(anchorOf(913000, 80000, 1_003_200), 923200, 'a restart of the host session: the new start')
  assert.equal(anchorOf(913000, NaN, 1), 913000)
})
test('the next tick is at the next whole second of the session', () => {
  assert.ok(untilNextSecond(0, 1500) >= 500 && untilNextSecond(0, 1500) <= 510)
  assert.ok(untilNextSecond(0, 3000) >= 1000 && untilNextSecond(0, 3000) <= 1010)
  assert.ok(untilNextSecond(5000, 4000) >= 1)
})
test('useSessionClock changes once per second between polls and stops when the session ends', async () => {
  let t = 1_000_000
  const timers = []
  const live = ref(true), rep = ref({ uptimeMs: 87000, at: t })
  const clock = useSessionClock({ live: () => live.value, report: () => rep.value, now: () => t, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, clearTimer: () => {} })
  assert.equal(clock.uptimeMs.value, 87000)
  const seen = []
  for (let i = 0; i < 5; i++) { const x = timers.pop(); assert.ok(x.ms >= 1 && x.ms <= 1010, `delay ${x.ms}`); t += x.ms; x.fn(); seen.push(Math.floor(clock.uptimeMs.value / 1000)) }
  assert.deepEqual(seen, [88, 89, 90, 91, 92], 'one step per second with no poll at all')
  rep.value = { uptimeMs: 92300, at: t } // a poll that agrees within the jitter: no step back
  await nextTick()
  assert.equal(Math.floor(clock.uptimeMs.value / 1000), 92)
  live.value = false
  await nextTick()
  assert.equal(clock.uptimeMs.value, null)
})

// ---- the bitrate the host reports is the session's configured budget (audit api-exposure-20261107, 5), never a measurement
test('the bitrate tile is the target bitrate: no line, no lowest / mean / highest, whatever the series does', () => {
  const base = { host: { name: 'PC', version: '1', uptimeMs: 1, running: true }, clients: [], apps: [], sys: null }
  for (const series of [[113000, 113000, 113000, 113000], [113000, 104000, 98000]]) {
    const m = buildHomeModel({ ...base, session: { client_name: 'Moonlight macOS Enhanced', width: 3840, height: 2160, fps: 120, bitrate: 113000, codec: 'hevc' }, series: { bitrate: series } }, TEXTS_ZH)
    const c = m.curves.find((x) => x.id === 'bitrate')
    assert.equal(c.configured, true); assert.deepEqual(c.points, []); assert.equal(c.peak, ''); assert.equal(c.title, '目标码率'); assert.equal(c.value, '113.0')
  }
  const en = buildHomeModel({ ...base, session: { client_name: 'M', width: 3840, height: 2160, fps: 120, bitrate: 113000, codec: 'hevc' } })
  assert.equal(en.curves.find((x) => x.id === 'bitrate').title, 'Target bitrate')
})

// ---- the fit rules are in place (the browser gate is the browser check)
test('tilefit.css is part of all.css and lifts the ellipsis of the names of a tile, scales numerals and lets 快捷操作 scroll', () => {
  assert.match(css('all.css'), /tilefit\.css/)
  const f = css('tilefit.css')
  for (const cls of ['.m-calh__line', '.m-caln__sub', '.m-daddr__value b', '.m-dsmall__value > span', '.m-rc__text b', '.m-calm__title']) assert.ok(f.includes(cls), cls)
  assert.match(f, /text-overflow: clip !important/); assert.match(f, /overflow-wrap: anywhere/)
  assert.match(f, /--tn-k/); assert.match(f, /@container m-calq/); assert.match(f, /overflow-x: auto/)
  assert.match(src('vue/MTileNumeral.vue'), /--tn-k/)
})
test('every ring is the one Material 3 circular progress indicator (MProgressRing): the old hand-made arcs are gone and the wrappers only delegate', () => {
  for (const f of ['MTileRing', 'MRing', 'MArcGauge', 'MGauge']) {
    const v = src(`vue/${f}.vue`)
    assert.match(v, /<MProgressRing\b/, f); assert.doesNotMatch(v, /<circle\b|stroke-dasharray|<path\b/, `${f} draws no arc of its own`)
  }
  const k = css('tilekit.css'), c = css('charts.css'), e = css('expressive.css')
  assert.doesNotMatch(k, /m-tring/); assert.doesNotMatch(c, /m-agauge__(zone|fill|tick)/); assert.doesNotMatch(e, /\.m-ring__arc/)
  const p = css('progressring.css')
  assert.match(p, /\.m-pring__track, \.m-pring__arc \{ fill: none; stroke-linecap: round;/, 'round caps')
  assert.match(p, /--mpr-track: var\(--md-sys-color-secondary-container\)/, 'the track is secondaryContainer')
  assert.match(p, /\.m-pring \{[^}]*container-type: size/, 'a numeral is set in the ring\'s own units')
})

import { fitScale, FIT_MIN, FIT_SELECTOR } from "../src/vue/fitText.js"
test("fitScale: a value that fits is left alone, one a little too wide shrinks, one far too wide wraps", () => {
  assert.equal(fitScale(80, 100), 1)
  assert.equal(fitScale(100, 100), 1, "half a pixel of slack")
  const k = fitScale(130, 100); assert.ok(k < 1 && k >= FIT_MIN, String(k))
  assert.ok(Math.abs(130 * k - 99.5) < 0.01, "the scaled text is as wide as the room")
  assert.equal(fitScale(300, 100), null, "below 60 %: the wrap takes over")
  assert.equal(fitScale(300, 0), 1, "no room measured (a hidden tile): nothing to do")
})
test("the values of the tiles are fitted: the selector covers the real-length culprits and the css wraps only after the fit gave up", () => {
  for (const c of [".m-dsmall__value > span", ".m-daddr__value b", ".m-b2plate b", ".m-calh__line", ".m-caln__sub"]) assert.ok(FIT_SELECTOR.includes(c), c)
  const f = fs.readFileSync(new URL("../src/css/tilefit.css", import.meta.url), "utf8")
  assert.match(f, /\)\[data-fit-wrap\] \{ white-space: normal !important; overflow-wrap: anywhere; \}/)
  assert.match(fs.readFileSync(new URL("../src/vue/MHomeDash.vue", import.meta.url), "utf8"), /useFitText\(root\)/)
})

import { buildCards } from "../src/vue/homeCards.js"
test("the bitrate card's own title says it is the target", () => {
  const T = TEXTS_ZH
  const model = buildHomeModel({ host: { name: "PC", version: "1", uptimeMs: 1, running: true }, clients: [], apps: [], sys: null, session: { client_name: "Moonlight macOS Enhanced", width: 3840, height: 2160, fps: 120, bitrate: 113000, codec: "hevc" }, series: { bitrate: [113000, 113000, 113000] } }, T)
  const cards = buildCards(model, { texts: T, catalogue: {} })
  assert.equal(cards.find((c) => c?.id === "bitrate").title, "目标码率")
})

test("the empty state at 方形 follows the tile and the words stay clear of its glyph; 公告 without a banner has its shape; 版本 caps its numeral by the tile's height", () => {
  const f = fs.readFileSync(new URL("../src/css/tilefit.css", import.meta.url), "utf8")
  assert.match(f, /\.m-tile:has\(> \.m-tempty--s\) \{ container: m-te \/ size; \}/)
  assert.match(f, /\.m-tempty--s \{ --te-shape: clamp\(52px, 44cqw, 132px\)/)
  assert.match(f, /\.m-b3n__gen \{ overflow: hidden; \}/)
  const info = fs.readFileSync(new URL("../src/vue/tiles/TileInfoB3.vue", import.meta.url), "utf8")
  assert.match(info, /<span v-else-if="gen" class="m-b3n__pic m-b3n__gen m-b3n__plate"/)
  assert.match(f, /\.m-b3n__plate \{ container-type: size;/) // the plate: the glyph of what the post is in a shape, not a random gradient
  assert.doesNotMatch(info, /announcementHeroStyle/)
  assert.match(fs.readFileSync(new URL("../src/css/tiles-prerelease.css", import.meta.url), "utf8"), /--vh: clamp\(13px, min\(calc\(100cqw \/ \(var\(--chars, 5\) \* 0\.6\)\), calc\(\(100cqh - /) // the numeral follows the width of its widest line and the height the other lines leave
})
test("realSession is exported for the panel and the Web UI", async () => {
  assert.match(fs.readFileSync(new URL("../src/vue/index.js", import.meta.url), "utf8"), /export \{ realSession, isSessionClient, onlineClients \} from "\.\/clientsLive\.js"/)
  const m = await import("../src/vue/clientsLive.js")
  assert.equal(m.realSession({ client_name: "Named Zako", client_family: "moonlight-macos-enhanced" }, []).client_name, "Moonlight macOS Enhanced")
  assert.equal(m.realSession({ client_name: "Studio MacBook" }, []).client_name, "Studio MacBook")
})

test("the 大 host card's chips wrap and give up what does not fit (data-fit-rows), a button may shrink, the ring's centre stays above the wave, the vivi art is a declared bleed", () => {
  const f = fs.readFileSync(new URL("../src/css/tilefit.css", import.meta.url), "utf8")
  assert.doesNotMatch(f, /\.m-calh__fchips \{[^}]*(overflow-x: auto|max-height: 28px)/)
  assert.match(fs.readFileSync(new URL("../src/vue/tiles/cal/CalHero.vue", import.meta.url), "utf8"), /class="m-calh__fchips" data-fit-rows/)
  assert.match(f, /\.m-b2__btn \{ flex: 0 1 36px; min-height: 26px; \}/)
  assert.match(css('progressring.css'), /\.m-pring__centre \{[^}]*z-index: 1;/)
  assert.match(fs.readFileSync(new URL("../src/vue/tiles/TileInfoB3.vue", import.meta.url), "utf8"), /<img data-bleed class="m-b3vi__img"/)
})

test("the overview shows no mode label: no 手动 / 恢复智能布局 chip; 恢复智能布局 stays in the layout edit sheet", () => {
  const dash = fs.readFileSync(new URL("../src/vue/MHomeDash.vue", import.meta.url), "utf8")
  assert.doesNotMatch(dash, /m-dash__smart|m-dash__bar|manualChip/)
  assert.match(dash, /<button type="button" class="m-dpill"[^>]*@click="restoreSmart"><MIcon name="wand_stars" \/><span class="m-dpill__t">\{\{ T\.restoreSmart \}\}<\/span><\/button>/)
  assert.doesNotMatch(fs.readFileSync(new URL("../src/css/dash.css", import.meta.url), "utf8"), /\.m-dash__smart|\.m-dash__bar/)
  assert.doesNotMatch(fs.readFileSync(new URL("../src/vue/homeCatalogueTextsMore.js", import.meta.url), "utf8"), /manualChip/)
})

import { announcementHero, announcementHeroStyle } from "../src/announcements/hero.js"
import { offeredOf } from "../src/vue/homeSizes.js"
test("an announcement without a banner gets a stable generated hero from its id", () => {
  const a = announcementHero("post-1"), b = announcementHero("post-1"), c = announcementHero("post-2")
  assert.deepEqual(a, b, "the same id, the same hero")
  assert.ok(a.a.includes("var(--md-sys-color-") && a.b.includes("var(--md-sys-color-") && a.a !== a.b && a.c !== a.d, "theme colours turned in OKLCH: it follows light, dark and the seed; two or more hues")
  const seen = new Set(Array.from({ length: 40 }, (_, i) => announcementHero(`p${i}`).a + announcementHero(`p${i}`).b)); assert.ok(seen.size >= 5, "different posts, different colours")
  assert.ok(announcementHero("p3").angle >= 120 && announcementHero("p3").angle <= 270)
  assert.match(announcementHeroStyle("x").background, /^radial-gradient\(circle at \d+% \d+%, oklch\(from var\(--md-sys-color-.*linear-gradient\(\d+deg, oklch/)
  assert.ok(c)
})
test("the 资讯 tile with one post offers the large size (its hero fills it); an empty list stays small", () => {
  const meta = (items, quiet = false) => ({ id: "announcements", kind: "widget", data: { type: "news", quiet, items } })
  assert.deepEqual(offeredOf("announcements", meta([{ id: "a", title: "T" }]), "large"), ["s", "m", "l", "xl"], "the extra-large size is offered, the hero and the list fill it")
  assert.deepEqual(offeredOf("announcements", meta([]), "large"), ["s"])
})

test("资讯 at 特大 is drawn: the hero with its post and the list beside it", () => {
  const info = fs.readFileSync(new URL("../src/vue/tiles/TileInfoB3.vue", import.meta.url), "utf8")
  assert.match(info, /\(size === 'l' \|\| size === 'xl'\) && rest\.length/)
  assert.match(info, /size\.value === 'xl' \? 6 : 3/)
  const f = fs.readFileSync(new URL("../src/css/tilefit.css", import.meta.url), "utf8")
  assert.match(f, /\.m-b3n\.is-xl \{ flex-direction: row; \}/); assert.match(f, /\.m-b3n\.is-xl:not\(:has\(\.m-b3n__rest\)\) \.m-b3n__lead \{ flex: 1 1 100%; \}/)
})

import { buildCatalogue } from "../src/vue/homeCatalogue.js"
test("measured_bitrate_kbps (mock data: the real host does not send it yet) is the bitrate; without it the budget is titled 目标码率 and draws no line", () => {
  const base = { host: { name: "PC", version: "1", uptimeMs: 1, running: true }, clients: [], apps: [], sys: null }
  const session = { client_name: "Moonlight macOS Enhanced", width: 3840, height: 2160, fps: 120, bitrate: 113000, codec: "hevc" }
  const measured = buildHomeModel({ ...base, session: { ...session, measured_bitrate_kbps: 96400 }, series: { bitrate: [91000, 96400, 99800] } }, TEXTS_ZH)
  const c = measured.curves.find((x) => x.id === "bitrate")
  assert.equal(c.title, "码率"); assert.equal(c.value, "96.4"); assert.deepEqual(c.points, [91, 96.4, 99.8]); assert.equal(c.configured, undefined)
  const budget = buildHomeModel({ ...base, session, series: { bitrate: [113000, 113000, 113000] } }, TEXTS_ZH)
  const b = budget.curves.find((x) => x.id === "bitrate")
  assert.equal(b.title, "目标码率"); assert.equal(b.value, "113.0"); assert.deepEqual(b.points, []); assert.equal(b.configured, true)
  // the hero band says which one it shows
  const cardsOf = (m) => buildCards(m, { texts: TEXTS_ZH, catalogue: {} }).find((x) => x?.id === "hero")?.data?.now
  assert.equal(cardsOf(measured)?.bitrate ?? "96.4", "96.4")
  // the stream-bitrate tile of the catalogue: measured value and title 码率, or the budget titled 目标码率
  const cat = (sess) => buildCatalogue({ session: sess, history: { samples: { bitrate: [91000, 96400] }, days: {}, sessions: [] }, config: { max_bitrate: 0 } }, homeTexts("zh")).data["stream-bitrate"]
  const cm = cat({ ...session, measured_bitrate_kbps: 96400 })
  assert.equal(cm.title, "码率"); assert.match(cm.big || cm.rows?.[0]?.value || JSON.stringify(cm), /96\.4/)
  const cb = cat(session)
  assert.equal(cb.title, "目标码率"); assert.deepEqual(cb.points, [])
})

test("integration round 2026-11-11: 上次串流 at 中 is compact with or without art, the empty-state button fits its label, 已配对 at 方形 keeps +N inside, 内存变化's chart stays under its numeral, the square hero name may take 20 px", async () => {
  const real = fs.readFileSync(new URL("../src/css/tilefit-real.css", import.meta.url), "utf8")
  assert.match(real, /\.m-b2last\.is-m \.m-tnum \{ --tn: 40px/, "no `has-art`: a session without art has the same numeral")
  assert.match(real, /\.m-b2paired\.is-s \.m-calo__rings:has\(\.is-more\) li:nth-child\(3\) \{ display: none; \}/)
  assert.match(real, /\.m-tmem--trend\.is-m \{ --tile-bleed: min\(60%, calc\(100% - 108px\)\); \}/)
  const f = fs.readFileSync(new URL("../src/css/tilefit.css", import.meta.url), "utf8")
  const { FIT_SELECTOR } = await import("../src/vue/fitText.js")
  assert.ok(FIT_SELECTOR.includes(".m-b2empty .m-b2__btn"))
  assert.equal(f.split(".m-dash__cell :is(.m-calm__title, .m-b2empty .m-b2__btn,").length - 1, 2, "nowrap and the wrap fallback both list it")
  assert.match(fs.readFileSync(new URL("../src/css/tiles-cal.css", import.meta.url), "utf8"), /\.m-calh--sq \.m-calh__name \{ font-size: min\(var\(--hn, 28px\), max\(20px, 17\.5cqw\)\); \}/)
})
test('every background shape of a tile is one rule, in the free corner: 60 px at one and two cells, 88 px at 大, never under a word', () => {
  const c = css('tiles-prerelease.css')
  assert.match(c, /\.m-tile \.m-tile__corner \{ top: -6px; right: -6px; translate: none; width: 60px; height: 60px; opacity: 1; \}/)
  assert.match(c, /\.m-tile \.m-tile__corner > \.m-icon \{ font-size: 28px; \}/)
  assert.match(c, /\.m-tile\[data-size='l'\] \.m-tile__corner[^}]*\{ width: 88px; height: 88px; \}/)
  assert.match(c, /\.m-tile:has\(\.m-tile__corner\) > :is\(\.m-tile__head, \.m-calm__head\) \{ padding-inline-end: 44px; \}/, 'the head keeps clear of the corner')
  for (const f of ['tilefit-real.css', 'tiles-metrics.css']) assert.doesNotMatch(css(f), /\.m-(tenc--encoder|tnet)(__corner)?[^{]*\.m-tile__corner|\.m-tnet__corner \{/, `${f}: no rule of its own for a shape`)
  assert.doesNotMatch(css('tiles-text.css'), /\.m-tile\[data-size='s'\] \.m-tile__corner \{ translate/, 'no push-out of the shape: it is in the corner already')
})
test('the overview draws its fill in the first plan: no timer holds the tiles back, only ctx.pending does', () => {
  const d = fs.readFileSync(new URL('../src/vue/dash/dashDock.js', import.meta.url), 'utf8')
  assert.match(d, /const fillReady = computed\(\(\) => !props\.ctx\.pending\)/)
  assert.doesNotMatch(d, /fillTimer|setTimeout\(\(\) => \{ fillReady/)
})
test('配对 at two cells: one input and one tonal button in the tile\'s own type, a count under the name, a QR plate that follows the theme', () => {
  const v = fs.readFileSync(new URL('../src/vue/tiles/TileClients.vue', import.meta.url), 'utf8')
  assert.match(v, /class="m-b2__field m-b2pair__pin"/)
  assert.match(v, /m-b2__btn is-tonal m-b2pair__go/)
  assert.match(v, /m-b2pair__count/)
  assert.doesNotMatch(v, /MField/)
  const c = css('tiles-prerelease.css')
  assert.match(c, /\.m-b2pair__qr \{ background: var\(--md-sys-color-surface-container-lowest\); \}/)
  assert.doesNotMatch(c, /\.m-b2pair__qr \{[^}]*#fff/)
})

test('the accents of the tiles come from one family: tertiary only where a tile asks for attention, green only where something is a state worth a colour', () => {
  const t = (f) => fs.readFileSync(new URL(`../src/vue/tiles/${f}`, import.meta.url), 'utf8')
  assert.match(t('TileFacts.vue'), /hdr: hdrOn\.value \? 'primary' : 'secondary', 'stream-vdd': hdrOn\.value \? 'primary' : 'secondary', display: 'secondary', 'stream-resolution': 'secondary'/)
  assert.match(t('TileGauge.vue'), /zone === 'ok' \? 'primary' : zone/, 'a gauge in its normal zone is calm, only a warning or an error has a colour of its own')
  assert.match(t('TileStream.vue'), /\? 'primary' : 'secondary'\)\)/)
  assert.doesNotMatch(t('TileEncoder.vue'), /'codecs' \? 'tertiary'/)
})
test('停止串流 is an error action on the calm card: the error role for the glyph, the surface for the words, no tertiary fill', () => {
  const v = fs.readFileSync(new URL('../src/vue/tiles/TileActionB3.vue', import.meta.url), 'utf8')
  assert.match(v, /glyph: 'stop', alert: true, quiet: true/)
  assert.doesNotMatch(v, /accent: 'tertiary', glyph: 'stop'/)
  assert.match(v, /'is-quiet': card\.quiet \|\| view\.quiet/)
  const c = css('tiles-prerelease.css')
  assert.match(c, /\.m-b3a\.is-alert\.is-quiet \{ background: color-mix\(in srgb, var\(--md-sys-color-error\) 9%, var\(--m-card\)\); \}/)
  assert.match(css('tiles-b3.css'), /\.m-b3a\.is-alert \.m-cala__glyph \{ background: var\(--md-sys-color-error\); color: var\(--md-sys-color-on-error\); \}/)
})
test('虚拟显示器 and 串流分辨率: the name of the resolution (4K, 2K, 1080p) is the hero in the type of the name of 编码器, on the tile\'s own surface', async () => {
  const { resNameOf } = await import('../src/vue/tiles/b2.js')
  assert.equal(resNameOf(3840, 2160), '4K'); assert.equal(resNameOf(4096, 2160), '4K'); assert.equal(resNameOf(0, 2160), '4K')
  assert.equal(resNameOf(2560, 1440), '2K'); assert.equal(resNameOf(0, 1440), '2K'); assert.equal(resNameOf(7680, 4320), '8K')
  assert.equal(resNameOf(1920, 1080), '1080p'); assert.equal(resNameOf(1280, 720), '720p')
  assert.equal(resNameOf(3440, 1440), '1440p', 'a size that is not a standard one keeps its height')
  assert.equal(resNameOf(0, 0), '')
  const v = fs.readFileSync(new URL('../src/vue/tiles/TileDevices.vue', import.meta.url), 'utf8')
  assert.match(v, /<b class="m-b2res__name">\{\{ vddName \}\}<\/b>/)
  assert.doesNotMatch(v, /MTileShape|MTileNumeral|m-b2plate" :class="vddOn|m-tile--tonal/)
  const f = fs.readFileSync(new URL('../src/vue/tiles/TileFacts.vue', import.meta.url), 'utf8')
  assert.match(f, /<b class="m-b2res__name">\{\{ resName \}\}<\/b>/)
  assert.doesNotMatch(f, /m-tfacts__screen[^>]*><MTileNumeral :value="resLabel"/, 'the drawn frame of the stream resolution is gone')
  const c = css('tiles-prerelease.css')
  assert.match(c, /\.m-b2res__name \{ font: 600 28px\/32px var\(--m-font-display\);/)
  assert.match(c, /\.m-tfacts\.is-m \.m-b2res__name, \.m-b2vdd\.is-m \.m-b2res__name \{ font-size: 36px;/)
})
test('开关 and 使用虚拟显示器 at one cell: the word of the state and its shape have their own places, nothing else is drawn behind them', () => {
  const f = fs.readFileSync(new URL('../src/vue/tiles/TileFacts.vue', import.meta.url), 'utf8')
  const i = f.indexOf("id === 'hdr' || id === 'stream-vdd'\">")
  const block = f.slice(i, f.indexOf("id === 'display'", i))
  assert.match(block, /m-tfacts__word/); assert.match(block, /<MTileShape class="m-tfacts__shape"/)
  assert.doesNotMatch(block, /m-tile__corner|m-tfacts__badge|m-tfacts__bigicon/)
  assert.doesNotMatch(f, /variantOf|stateVariant|m-tile--tonal/, 'one design, no switch between two')
  assert.doesNotMatch(css('tiles-prerelease.css'), /m-tfacts__bigicon/)
})
test('MTileHead breaks a Chinese title between its words, not inside one', () => {
  const v = fs.readFileSync(new URL('../src/vue/MTileHead.vue', import.meta.url), 'utf8')
  assert.match(v, /Intl\.Segmenter/); assert.match(v, /class="m-tile__word"/)
  assert.match(css('tiles-prerelease.css'), /\.m-tile__word \{ white-space: nowrap; \}/)
  const parts = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment('使用基地虚拟显示器')].map((x) => x.segment)
  assert.ok(parts.length > 1 && parts.every((x) => x.length >= 1))
})

test('the note under a toggle tile balances its lines, so the last line is never a single character', () => {
  assert.match(css('tilefit.css'), /\.m-dash__cell \.m-b3a__note \{ text-wrap: balance; \}/)
})

test('a numeral whose unit does not shrink with it is stepped down again until its row fits the room', () => {
  const v = fs.readFileSync(new URL('../src/vue/MTileNumeral.vue', import.meta.url), 'utf8')
  assert.match(v, /for \(let i = 0; i < 4 && k > 0\.5 && row\.scrollWidth > room \+ 0\.5; i\+\+\)/)
})

test('a numeral measures its row again when a font has loaded', () => {
  const v = fs.readFileSync(new URL('../src/vue/MTileNumeral.vue', import.meta.url), 'utf8')
  assert.match(v, /document\.fonts\.addEventListener\?\.\('loadingdone', onFonts\)/); assert.match(v, /removeEventListener\?\.\('loadingdone', onFonts\)/)
})

test('the client and the stream line of 正在玩 wrap with the other names of a tile instead of ending in an ellipsis', () => {
  assert.match(css('tilefit.css'), /\.m-caln__sub > span,/)
})

test('the interface list of the network tile has one column that may shrink, so a long adapter name cannot make the list wider than the tile', () => {
  const m = css('tiles-metrics.css')
  assert.match(m, /\.m-tnet__list \{[^}]*grid-template-columns: minmax\(0, 1fr\);/)
})
