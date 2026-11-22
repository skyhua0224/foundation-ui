import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build, topLevelRules } from '../scripts/gen-touch-pressed.mjs'
import { installTouchPress, pressTarget } from '../src/a11y/touchPress.js'

const css = (name) => readFileSync(new URL(`../src/css/${name}`, import.meta.url), 'utf8')

// ---- a node and a document, just enough for the helper ----
function node(attrs = {}, parent = null, matches = {}) {
  const el = {
    attrs: { ...attrs }, parent, disabled: !!attrs.disabled,
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null },
    setAttribute(n, v) { this.attrs[n] = v },
    removeAttribute(n) { delete this.attrs[n] },
    closest(sel) {
      // `button, a[href], ...` or `.m-tray, .m-tray-host`: the fake knows the two selectors by a flag
      for (let n = this; n; n = n.parent) {
        if (sel.startsWith('button') && n.pressable) return n
        if (sel.startsWith('.m-tray') && n.tray) return n
      }
      return null
    },
  }
  return Object.assign(el, matches)
}
function fakeDoc() {
  const listeners = {}
  return { listeners, addEventListener(t, f) { (listeners[t] ||= []).push(f) }, defaultView: { addEventListener() {} }, fire(t, ev) { (listeners[t] || []).forEach((f) => f(ev)) } }
}

test('a press lands on the nearest pressable control; a disabled one and the tray (its own layer) do not take it', () => {
  const btn = node({}, null, { pressable: true })
  const inner = node({}, btn)
  assert.equal(pressTarget(inner), btn)
  assert.equal(pressTarget(node({}, null, {})), null)
  assert.equal(pressTarget(node({ disabled: true }, null, { pressable: true, disabled: true })), null)
  assert.equal(pressTarget(node({ 'aria-disabled': 'true' }, null, { pressable: true })), null)
  const inTray = node({}, node({}, null, { tray: true }), { pressable: true })
  assert.equal(pressTarget(inTray), null)
  assert.equal(pressTarget(null), null)
})

test('a finger sets data-pressed on the frame of pointerdown and takes it off at pointerup or pointercancel; a mouse never sets it', () => {
  const doc = fakeDoc()
  installTouchPress(doc)
  const a = node({}, null, { pressable: true }), b = node({}, null, { pressable: true })
  doc.fire('pointerdown', { pointerType: 'mouse', target: a })
  assert.equal(a.getAttribute('data-pressed'), null)
  doc.fire('pointerdown', { pointerType: 'touch', target: a })
  assert.equal(a.getAttribute('data-pressed'), '')
  doc.fire('pointercancel', {})
  assert.equal(a.getAttribute('data-pressed'), null, 'a scroll that starts cancels the pointer')
  doc.fire('pointerdown', { pointerType: 'pen', target: a })
  doc.fire('pointerdown', { pointerType: 'touch', target: b })
  assert.equal(a.getAttribute('data-pressed'), null, 'one press at a time')
  assert.equal(b.getAttribute('data-pressed'), '')
  doc.fire('pointerup', {})
  assert.equal(b.getAttribute('data-pressed'), null)
})

test('installing twice adds no second listener', () => {
  const doc = fakeDoc()
  installTouchPress(doc)
  const n = doc.listeners.pointerdown.length
  installTouchPress(doc)
  assert.equal(doc.listeners.pointerdown.length, n)
})

test('touch-pressed.css is the generated twin of every :active rule (node scripts/gen-touch-pressed.mjs)', () => {
  assert.equal(css('touch-pressed.css'), build(), 'stale: run node scripts/gen-touch-pressed.mjs')
  const twins = css('touch-pressed.css')
  assert.match(twins, /\.m-btn\[data-pressed\]::before/)
  assert.match(twins, /\.m-icon-btn\[data-pressed\]::before/)
  assert.doesNotMatch(twins.replace(/\/\*[\s\S]*?\*\//g, ''), /:active/)
})

test('the generator reads top-level rules only and keeps every selector of a list that has :active', () => {
  const rules = topLevelRules('/* c */ .a:active, .b:hover { color: red; } @media (x) { .c:active { color: blue } } .d { margin: 0 }')
  assert.deepEqual(rules.map((r) => r.selector), ['.a:active, .b:hover', '.d'])
})

test('touch.css changes nothing for a mouse: every rule sits inside a coarse-pointer or no-hover media query', () => {
  const text = css('touch.css').replace(/\/\*[\s\S]*?\*\//g, '')
  let depth = 0, head = '', outside = ''
  const heads = []
  for (const ch of text) {
    if (ch === '{') { if (depth === 0) heads.push(head.trim()); depth++; head = ''; continue }
    if (ch === '}') { depth--; head = ''; continue }
    if (depth === 0) { head += ch; outside += ch }
  }
  assert.ok(heads.length >= 3)
  for (const h of heads) assert.match(h, /^@media \((any-pointer: coarse|pointer: coarse|hover: none)\)$/, `a rule outside a touch media query: ${h}`)
  assert.equal(outside.replace(/@media \((any-pointer: coarse|pointer: coarse|hover: none)\)/g, '').trim(), '')
})

test('the hit slop never stands on the mouse path: no rule of touch.css is written for :hover, and the slop is transparent', () => {
  const text = css('touch.css')
  assert.doesNotMatch(text.replace(/\/\*[\s\S]*?\*\//g, ''), /:hover/)
  assert.match(text, /--m-hit: 48px/)
  const slop = text.slice(text.indexOf('.m-btn, .m-icon-btn'), text.indexOf('.m-scene__handle::before'))
  assert.doesNotMatch(slop.replace(/\/\*[\s\S]*?\*\//g, ''), /background|border|box-shadow|outline/, 'the slop draws nothing')
})

test('tile buttons anchor the touch expansion to the button rather than its card', () => {
  const text = css('touch.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const anchors = [...text.matchAll(/:is\(([\s\S]*?)\)\s*\{\s*position:\s*relative;/g)]
  assert.ok(anchors.some((match) => match[1].split(',').some((selector) => selector.trim() === '.m-b2__btn')))
  const slops = [...text.matchAll(/:is\(([^()]*)\)::after\s*\{[^}]*position:\s*absolute/g)]
  assert.ok(slops.some((match) => match[1].split(',').some((selector) => selector.trim() === '.m-b2__btn')))
  assert.match(text, /\.m-b2dl\s+\.m-b2__btn::after\s*\{\s*content:\s*none;/)
})

test('all.css loads the touch layers last, and the old ::after tooltip is gone so a [data-tip] control can carry a slop', () => {
  const all = css('all.css').trim().split('\n')
  assert.deepEqual(all.slice(-2), ["@import './touch-pressed.css';", "@import './touch.css';"])
  for (const f of ['expressive.css', 'controls.css']) assert.doesNotMatch(css(f), /\[data-tip\][^{]*::after/)
})
