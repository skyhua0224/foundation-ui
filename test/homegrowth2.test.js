import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import { FRAME_STAGES, GROWTH2_TEXTS, frameStages, growth2Catalogue, linkUse, streamNic } from "../src/vue/homeGrowth2.js"

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const T = { ...GROWTH2_TEXTS.en, __locale: "en" }
const nic = (o) => ({ up: true, is_default_route: false, type: "ethernet", link_speed_mbps: 1000, name: "eth", ...o })
const session = (o = {}) => ({ fps: 120, bitrate: 113000, client_name: "A real name", ...o })
const frames = (src, cap, sub, enc, rep = 0) => ({ enabled: true, ready: true, source_kind: "vdd_published", source: { fps: src }, capture: { fps: cap }, submitted: { fps: sub }, encoded: { fps: enc }, repeated: { fps: rep } })

test("the adapter of the stream is the default route among the real ones: never a mesh or virtual adapter, never one that is down or has no speed", () => {
  assert.equal(streamNic([nic({ name: "mesh", type: "mesh", is_default_route: true }), nic({ name: "a" })]).name, "a")
  assert.equal(streamNic([nic({ name: "wifi", type: "wifi" }), nic({ name: "eth", is_default_route: true })]).name, "eth")
  assert.equal(streamNic([nic({ name: "x", up: false }), nic({ name: "y", link_speed_mbps: 0 })]), null)
  assert.equal(streamNic(undefined), null)
})

test("the link use is the bitrate plus the FEC parity, and the tile is there only with a session, a bitrate and an adapter", () => {
  const u = linkUse(100000, 10)
  assert.deepEqual([u.stream, Math.round(u.fec * 10) / 10, Math.round(u.used * 10) / 10], [100, 10, 110])
  assert.deepEqual(linkUse(100000, null), { stream: 100, fec: 0, used: 100 })
  const x = { sysinfo: { nics: [nic({ link_speed_mbps: 1000, is_default_route: true })] }, config: { fec_percentage: "10" }, session: session() }
  const d = growth2Catalogue(x, T)["link-margin"]
  assert.equal(Math.round(d.used), 124); assert.equal(Math.round(d.free), 876); assert.ok(Math.abs(d.ratio - 0.1243) < 0.001)
  assert.equal(growth2Catalogue({ ...x, session: session({ measured_bitrate_kbps: 40000 }) }, T)["link-margin"].used, d.used, "the budget, not the measured rate: the headroom does not move with the picture")
  assert.equal(growth2Catalogue({ ...x, session: null }, T)["link-margin"], null, "no session, no tile")
  assert.equal(growth2Catalogue({ ...x, sysinfo: { nics: [] } }, T)["link-margin"], null)
  assert.equal(growth2Catalogue({ ...x, session: session({ bitrate: 2000000 }) }, T)["link-margin"].ratio, 1, "a stream over the link is the whole ring, not more")
})

test("the frame stages keep the order of the pipeline, drop a stage the host does not report, and mark the stage that loses frames", () => {
  assert.deepEqual(FRAME_STAGES, ["source", "capture", "submitted", "encoded"])
  const s = frameStages(frames(120, 119, 96, 95.8))
  assert.deepEqual(s.map((x) => [x.key, x.lost]), [["source", false], ["capture", false], ["submitted", true], ["encoded", false]])
  assert.ok(Math.abs(s[2].drop - 23) < 0.01); assert.equal(s[3].drop, 0)
  assert.deepEqual(frameStages(frames(3.9, 14.7, 16.6, 16.6)).map((x) => x.lost), [false, false, false, false], "a still desktop gains frames (repeats), it does not lose them")
  assert.deepEqual(frameStages(frames(10, 9.5, 9.2, 9)).map((x) => x.lost), [false, false, false, false], "a small difference is not a loss")
  assert.equal(frameStages({ enabled: false, source: { fps: 1 }, capture: { fps: 1 } }), null); assert.equal(frameStages({ ready: false, source: { fps: 1 }, capture: { fps: 1 } }), null)
  assert.equal(frameStages({ enabled: true, ready: true, encoded: { fps: 60 } }), null, "one stage is no flow")
  assert.deepEqual(frameStages({ enabled: true, ready: true, capture: { fps: 60 }, encoded: { fps: 59 } }).map((x) => x.key), ["capture", "encoded"])
  const d = growth2Catalogue({ session: session({ frameRates: frames(120, 119, 96, 95.8, 0.4) }) }, T)["frame-supply"]
  assert.equal(d.encoded, 95.8); assert.equal(d.target, 120); assert.equal(d.repeated, 0.4); assert.equal(d.kind, "vdd_published")
  assert.equal(growth2Catalogue({ session: session() }, T)["frame-supply"], null, "a product that does not pass frameRates has no tile")
  const partial = growth2Catalogue({ session: session({ frameRates: { enabled: true, ready: true, source: { fps: 120 }, capture: { fps: 100 } } }) }, T)["frame-supply"]
  assert.equal(partial.encoded, null, "the sent rate is the encoded stage: the last stage that is reported is not borrowed for it")
})

test("the microphone tile reads the status, and the path chosen is the configuration key (it answers a save at once)", () => {
  const status = { configured_backend: "usbip_experimental", active_backend: "", component_available: true, state: "idle", underruns: 2, dropped_frames: 1, submit_errors: 0 }
  const d = growth2Catalogue({ mic: status, config: {} }, T)["mic-health"]
  assert.deepEqual([d.backend, d.state, d.counters, d.canSave], ["usbip_experimental", "waiting", { underruns: 2, dropped: 1, errors: 0 }, true])
  assert.equal(growth2Catalogue({ mic: status, config: { microphone_redirect_backend: "vb_cable" } }, T)["mic-health"].backend, "vb_cable")
  const live = growth2Catalogue({ mic: { ...status, configured_backend: "vb_cable", active_backend: "vb_cable" }, config: { microphone_redirect_backend: "disabled" } }, T)["mic-health"]
  assert.deepEqual([live.backend, live.state], ["disabled", "active"], "the control shows the saved choice, the state is what the running host does")
  assert.equal(growth2Catalogue({ mic: status, config: { microphone_redirect_backend: "nonsense" } }, T)["mic-health"].backend, "usbip_experimental")
  assert.equal(growth2Catalogue({ mic: status, config: {}, saveSetting: false }, T)["mic-health"].canSave, false)
  assert.equal(growth2Catalogue({ mic: status }, T)["mic-health"].canSave, false, "without the configuration there is nothing to save to")
  assert.equal(growth2Catalogue({ mic: {} }, T)["mic-health"], null); assert.equal(growth2Catalogue({}, T)["mic-health"], null)
  const o = growth2Catalogue({ mic: { ...status, component_available: false }, config: {} }, T)["mic-health"].options
  assert.deepEqual(o.map((x) => [x.value, x.disabled]), [["auto", false], ["vb_cable", false], ["usbip_experimental", true], ["disabled", false]])
})

test("the capture method is a Windows setting with the choices of the host, AMD only on an AMD streaming adapter", () => {
  const x = { config: { platform: "windows", capture: "vdd" }, session: session({ perfCapture: "vdd" }) }
  const d = growth2Catalogue(x, T)["capture-method"]
  assert.deepEqual(d.options.map((o) => o.value), ["", "ddx", "wgc", "vdd"]); assert.equal(d.value, "vdd"); assert.equal(d.live, "vdd"); assert.equal(d.key, "capture")
  const amd = growth2Catalogue({ ...x, sysinfo: { gpus: [{ is_streaming_adapter: true, vendor: "amd" }] } }, T)["capture-method"]
  assert.deepEqual(amd.options.map((o) => o.value), ["", "ddx", "wgc", "vdd", "amd"])
  assert.equal(growth2Catalogue({ config: { platform: "linux", capture: "" } }, T)["capture-method"], null)
  assert.equal(growth2Catalogue({ ...x, saveSetting: false }, T)["capture-method"], null); assert.equal(growth2Catalogue({ config: { platform: "windows" } }, T)["capture-method"], null)
  assert.equal(growth2Catalogue({ config: { platform: "windows", capture: "" } }, T)["capture-method"].value, "", "auto is the empty value")
})

test("the microphone tile is in the device group and the capture method says when it applies", async () => {
  const { GROWTH2_META } = await import("../src/vue/homeGrowth2.js"), { GROUPS } = await import("../src/vue/homeCards.js")
  for (const id of Object.keys(GROWTH2_META)) assert.ok(GROUPS.includes(GROWTH2_META[id][0]), `${id} is in a group the picker lists`)
  assert.equal(GROWTH2_TEXTS.zh.cmNext, "重启后生效"); assert.equal(GROWTH2_TEXTS.en.cmNext, "After a restart")
})

test("the four tiles are registered with their sizes, texts in both languages and a style sheet", () => {
  const vue = read("src/vue/tiles/TileGrowth2.vue"), css = read("src/css/all.css")
  for (const id of ["link-margin", "frame-supply", "mic-health", "capture-method"]) { assert.match(vue, new RegExp(`'${id}'`)); assert.match(read("src/vue/homeRanges.js"), new RegExp(`'${id}'`)) }
  assert.match(css, /tiles-growth2\.css/)
  const keys = (l) => Object.keys(GROWTH2_TEXTS[l]).sort()
  assert.deepEqual(keys("en"), keys("zh"), "every text in both languages")
  for (const lang of ["en", "zh"]) for (const id of ["link-margin", "frame-supply", "mic-health", "capture-method"]) assert.ok(GROWTH2_TEXTS[lang][`c_${id}`], `${lang} names ${id}`)
})

test("the stage bars grow by a clip, not by their width: a rate that changes every second must not lay the tile out again", () => {
  const css = read("src/css/tiles-growth2.css"), vue = read("src/vue/tiles/TileGrowth2.vue")
  assert.match(css, /\.m-fs__track > i \{[^}]*clip-path: inset\(0 calc\(100% - var\(--w\)\)/); assert.ok(!/\.m-fs__track > i \{[^}]*transition: width/.test(css))
  assert.match(vue, /'--w': pct\(st\.fps\)/)
})

test("the stage bars are one flat colour, thin, and the numbers are light: no gradient on the frame supply tile", () => {
  const css = read("src/css/tiles-growth2.css")
  const fs = css.slice(css.indexOf("/* 帧率来源"))
  assert.ok(!/gradient/.test(fs), "no gradient in the frame supply rules")
  assert.match(fs, /\.m-fs\.is-l \.m-fs__track \{ height: 12px/); assert.match(fs, /\.m-fs__track > i \{[^}]*background: var\(--tk\)/)
  assert.match(read("src/vue/tiles/TileGrowth2.vue"), /:weight="500"/)
})
