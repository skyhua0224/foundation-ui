import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { shortVersion } from "../src/clients/assets.js"
import { fitElement } from "../src/vue/fitText.js"

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8")

test("shortVersion drops the build part and cuts a long version to eleven characters", () => {
  assert.equal(shortVersion("v6.5.6"), "v6.5.6")
  assert.equal(shortVersion("1.3.9-rc.9"), "1.3.9-rc.9")
  assert.equal(shortVersion("12.15.17-beta.20261118.rc.3+build.4567"), "12.15.17-b…")
  assert.equal(shortVersion("1.0.0+abc"), "1.0.0")
  assert.equal(shortVersion(undefined), "")
  assert.ok(shortVersion("x".repeat(40)).length <= 11)
})

test("the download tile at 中 puts the tag, the version and 下载 on a row across the tile, not beside the icon", () => {
  const vue = read("vue/tiles/TileDownload.vue")
  const [, medium] = vue.split("<template v-else>")
  assert.match(medium, /class="m-b2dl__main"[\s\S]*<\/div>\s*<div class="m-b2dl__foot">/)
  assert.ok(!/m-b2dl__side[\s\S]*m-b2dl__foot[\s\S]*<\/div>\s*<\/div>\s*<div class="m-b2dl__main"/.test(medium))
  // the foot is not inside the side column any more
  const side = medium.slice(medium.indexOf('class="m-b2dl__side"'), medium.indexOf('class="m-b2dl__foot"'))
  assert.ok(!side.includes("m-b2dl__foot"))
  assert.match(medium, /v\{\{ versionShown \}\}/)
  const css = read("css/tilefit-4tb.css")
  assert.match(css, /\.m-b2dl\.is-m \{[^}]*flex-direction: column/)
})

test("the action of an empty state is at most as wide as its tile and wraps its label", () => {
  const css = read("css/tiles-b2.css")
  const rule = /\.m-empty-basic \.m-b2__btn \{([^}]*)\}/.exec(css)
  assert.ok(rule, "rule exists")
  assert.match(rule[1], /max-width: 100%/)
  assert.match(rule[1], /white-space: normal/)
  assert.match(rule[1], /min-width: 0/)
})

test("the labels of the growth tiles wrap instead of ending in an ellipsis", () => {
  const css = read("css/tiles-growth.css")
  for (const sel of [".m-gr__seg button > span", ".m-gr__ports li > span", ".m-gr__facts li > small"]) {
    const i = css.indexOf(sel + " {"); assert.ok(i >= 0, sel)
    const rule = css.slice(i, css.indexOf("}", i))
    assert.ok(!/text-overflow: ellipsis/.test(rule), `${sel} has no ellipsis`)
    assert.ok(!/white-space: nowrap/.test(rule), `${sel} wraps`)
  }
})

test("a switch at 方形 has the state beside the glyph and the note under the name", () => {
  const css = read("css/tilefit-real.css")
  assert.match(css, /\.m-b3t\[data-size='s'\] \{[^}]*display: grid/)
  assert.match(css, /\.m-b3t\[data-size='s'\] \.m-b3a__text \{ display: contents; \}/)
})

test("the three sub-tiles of the 设备 tile at 中 keep their names on one line", () => {
  const css = read("css/tilefit-real.css")
  const rule = /\.m-b2dev \.m-calo__tiles span b \{([^}]*)\}/.exec(css)
  assert.ok(rule)
  assert.match(rule[1], /white-space: nowrap/)
  assert.match(rule[1], /overflow-wrap: normal/)
})

test("fitElement shrinks the text of a padded value only: the padding stays outside what is measured", () => {
  const props = { display: "block", visibility: "visible", fontSize: "14px", paddingLeft: "16px", paddingRight: "16px", paddingTop: "0px", paddingBottom: "0px", borderLeftWidth: "0px", borderRightWidth: "0px" }
  const old = globalThis.getComputedStyle
  globalThis.getComputedStyle = () => props
  try {
    const style = { removeProperty() {}, fontSize: "" }
    const tile = { getBoundingClientRect: () => ({ left: 0, right: 150 }) }
    const el = { style, clientWidth: 131, scrollWidth: 131, removeAttribute() {}, setAttribute() { this.wrapped = true }, closest: () => tile, getBoundingClientRect: () => ({ left: 18, right: 149 }) }
    // the stub's tile pads 16 px as well: the room is 150 - 16 - 18 = 116 px, 32 of them the button's padding, so the text (99 px) has 84 px; scaling the whole 131 px by 116/131 would leave 119 px (the old measure)
    fitElement(el)
    assert.ok(el.style.fontSize || el.wrapped, "it shrinks or wraps")
    if (el.style.fontSize) {
      const k = parseFloat(el.style.fontSize) / 14
      assert.ok(99 * k + 32 <= 116 + 0.5, `the shrunk label (${99 * k + 32} px with its padding) fits the room`)
    }
  } finally { globalThis.getComputedStyle = old }
})
