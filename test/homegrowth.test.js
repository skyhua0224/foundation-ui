import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import { GROWTH_TEXTS, growthCatalogue, mappingClients, parseFileMappings, portsSummary, shortPath } from "../src/vue/homeGrowth.js"

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const b64 = (v) => "base64:" + Buffer.from(JSON.stringify(v), "utf8").toString("base64")
const T = { ...GROWTH_TEXTS.en, __locale: "en" }

test("the file mappings of the host configuration are read from base64 JSON, UTF-8 names included", () => {
  assert.deepEqual(parseFileMappings(b64([{ name: "游戏存档", mode: "read" }])).map((m) => m.name), ["游戏存档"])
  assert.deepEqual(parseFileMappings(""), []); assert.deepEqual(parseFileMappings(undefined), []); assert.deepEqual(parseFileMappings("base64:!!"), []); assert.deepEqual(parseFileMappings(b64({ not: "a list" })), [])
  assert.equal(shortPath("C:\\Users\\a\\Saves\\"), "a/Saves")
})

test("a tile has data only where its source is there", () => {
  const none = growthCatalogue({}, T)
  for (const id of ["ports-check", "file-maps", "encode-budget", "web-access"]) assert.equal(none[id], null, id)
  const d = growthCatalogue({ config: { file_mappings: b64([{ id: "a", name: "Saves", path: "D:/x/Saves", mode: "read", clients: [] }, { name: "Clips", mode: "readwrite", clients: ["c1", "c2"] }]), file_mapping_port: "48020" } }, T)["file-maps"]
  assert.equal(d.count, 2); assert.equal(d.port, 48020); assert.deepEqual(d.rows.map((r) => [r.name, r.mode, r.clients]), [["Saves", "read", 0], ["Clips", "readwrite", 2]])
  assert.equal(growthCatalogue({ config: { file_mappings: b64([]) } }, T)["file-maps"].count, 0, "an empty list is still a tile: nothing shared")
  assert.equal(growthCatalogue({ config: {} }, T)["file-maps"], null)
})

test("the ports are counted as reachable when the host listens or opens them in a session and the firewall allows them", () => {
  const s = portsSummary([{ proto: "TCP", state: "listening", firewall: "allowed" }, { proto: "TCP", state: "listening", firewall: "blocked" }, { proto: "UDP", state: "on-session", firewall: "allowed" }, { proto: "UDP", state: "closed", firewall: "allowed" }])
  assert.deepEqual([s.total, s.ok, s.unknown, s.blocked, s.closed, s.tcpUp, s.tcp, s.udpReady, s.udp], [4, 2, 0, 1, 1, 2, 2, 1, 2])
})

test("a listening port whose firewall state is unknown is counted on its own and is not reachable", () => {
  const s = portsSummary([{ proto: "TCP", state: "listening", firewall: "allowed" }, { proto: "TCP", state: "listening", firewall: "unknown" }, { proto: "UDP", state: "on-session", firewall: "unknown" }, { proto: "UDP", state: "closed", firewall: "unknown" }])
  assert.deepEqual([s.total, s.ok, s.unknown, s.blocked, s.udpReady], [4, 1, 2, 0, 0], "a closed port with an unknown firewall is closed, not unknown")
  assert.deepEqual(s.rows.map((r) => [r.ok, r.unknownFw]), [[true, false], [false, true], [false, true], [false, false]])
  const vue = read("src/vue/tiles/TileGrowth.vue")
  assert.match(vue, /segments="portsSegs"/); assert.match(vue, /tone: 'warning'/, "the unknown share is its own warning arc")
  for (const lang of ["en", "zh"]) assert.ok(GROWTH_TEXTS[lang].pcUnknown && GROWTH_TEXTS[lang].pcUnknownShort, `${lang} names the unknown firewall state`)
})

test("a folder open to chosen clients names them: the paired names, two of them, then how many more", () => {
  const paired = [{ uuid: "AA-1", name: "Tablet" }, { uuid: "BB-2", name: "Phone" }, { uuid: "CC-3", name: "Deck" }]
  assert.deepEqual(mappingClients(["aa-1", "CC-3", "gone"], paired), { total: 3, names: ["Tablet", "Deck"], unnamed: 1 }, "a uuid matches whatever its case, a removed client has no name")
  assert.deepEqual(mappingClients([], paired), { total: 0, names: [], unnamed: 0 }); assert.deepEqual(mappingClients(undefined, undefined), { total: 0, names: [], unnamed: 0 })
  assert.deepEqual(mappingClients(["BB-2", "bb-2"], [{ uuid: "BB-2", name: "Phone" }]), { total: 1, names: ["Phone"], unnamed: 0 }, "one client once, whatever the case of its uuid")
  assert.deepEqual(mappingClients(["B1", "B2", "C3"], [{ uuid: "B1", name: "Phone" }, { uuid: "B2", name: "Phone" }, { uuid: "C3", name: "Deck" }]).names, ["Phone", "Phone", "Deck"], "two clients with one name are two entries")
  const d = growthCatalogue({ clients: paired, config: { file_mappings: b64([{ name: "Saves", mode: "read", clients: ["AA-1", "BB-2", "CC-3"] }, { name: "Clips", mode: "read", clients: [] }]) } }, T)["file-maps"]
  assert.deepEqual(d.rows.map((r) => r.who.names), [["Tablet", "Phone", "Deck"], []])
  const vue = read("src/vue/tiles/TileGrowth.vue"), css = read("src/css/tiles-growth.css")
  assert.match(vue, /const fmWho = /); assert.match(css, /data-rows="3"\] \.m-gr__txt > b \{ white-space: nowrap/, "with three folders the clients line stays")
})

test("文件映射 at 大: the count and its unit share a line, the folders are cards, and a chip is never laid out as a text column", () => {
  const vue = read("src/vue/tiles/TileGrowth.vue"), css = read("src/css/tiles-growth.css")
  assert.match(vue, /m-gr__hero/); assert.match(vue, /:unit="d\.count \? T\.fmCount/)
  assert.match(vue, /data-rows=/)
  assert.match(vue, /fmAll\.value\.slice\(0, size\.value === .l. \? \(fmMore\.value \? 2 : 3\) : 2\)/, "at most three lines, the last one counts the rest")
  assert.ok(!/li > span:not\(\.m-tshape\)/.test(css), "the chip of a row is a span: a rule on every span of the row stretched it and put its text at the top")
  assert.match(css, /\.m-gr--maps\.is-l\[data-rows="1"\]/); assert.match(css, /\.m-gr--maps\.is-l\[data-rows="3"\]|--gr-shape: 72px/)
  for (const lang of ["en", "zh"]) assert.ok(GROWTH_TEXTS[lang].fmMore.includes("{n}"), `${lang} says how many more`)
})
