import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRenderer, markRaw, ref, nextTick, h } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

// The real MSlider.vue is compiled and mounted on a small fake DOM, so the pointer, touch and keyboard paths run as they are written: press on the track, drag, release, arrow keys.
const here = path.dirname(fileURLToPath(import.meta.url))
const gen = fs.mkdtempSync(path.join(here, '.slider-'))
process.on('exit', () => fs.rmSync(gen, { recursive: true, force: true }))
const src = fs.readFileSync(path.join(here, '../src/vue/MSlider.vue'), 'utf8')
const { descriptor } = parse(src, { filename: 'MSlider.vue' })
const script = compileScript(descriptor, { id: 'mslider', inlineTemplate: false })
const tpl = compileTemplate({ source: descriptor.template.content, filename: 'MSlider.vue', id: 'mslider', compilerOptions: { bindingMetadata: script.bindings } })
let code = script.content.replace(/import MIcon from ['"]\.\/MIcon\.vue['"]/, 'const MIcon = { render: () => null }')
code = `${code.replace('export default', 'const __sfc__ =')}\n${tpl.code.replace('export function render', 'function render')}\n__sfc__.render = render\nexport default __sfc__\n`
const file = path.join(gen, 'MSlider.mjs')
fs.writeFileSync(file, code)
const MSlider = (await import(pathToFileURL(file).href)).default

// ---- fake DOM: elements with listeners and a focus holder; the track is 400 px wide, its left edge at x = 100 ----
let active = null
// markRaw: a template ref keeps the node in a ref, which would wrap it in a reactive proxy; a real DOM node is never proxied
const el = (tag) => markRaw({
  tag, children: [], parent: null, props: {}, on: {}, text: '',
  getBoundingClientRect() { return { left: 100, top: 0, width: 400, height: 44 } },
  get clientWidth() { return 400 },
  setPointerCapture() {}, releasePointerCapture() {},
  querySelectorAll(sel) {
    const out = []
    const walk = (n) => { for (const c of n.children) { if (sel === '[role=slider]' && c.props.role === 'slider') out.push(c); walk(c) } }
    walk(this)
    return out
  },
  focus() { if (active === this) return; const was = active; active = this; was?.on.blur?.forEach((f) => f({})); this.on.focus?.forEach((f) => f({})) },
})
const { createApp } = createRenderer({
  createElement: el,
  createText: (t) => ({ ...el('#text'), text: t }),
  createComment: () => el('#comment'),
  insert(child, parent, anchor) { if (child.parent) { const j = child.parent.children.indexOf(child); if (j >= 0) child.parent.children.splice(j, 1) } child.parent = parent; const i = anchor ? parent.children.indexOf(anchor) : -1; if (i < 0) parent.children.push(child); else parent.children.splice(i, 0, child) },
  remove(child) { const i = child.parent ? child.parent.children.indexOf(child) : -1; if (i >= 0) child.parent.children.splice(i, 1) },
  setElementText(n, t) { n.text = t }, setText(n, t) { n.text = t }, parentNode: (n) => n.parent,
  nextSibling: (n) => (n.parent ? n.parent.children[n.parent.children.indexOf(n) + 1] ?? null : null), querySelector: () => null,
  patchProp(n, key, prev, next) {
    const m = /^on([A-Z].*)$/.exec(key)
    if (m) { n.on[m[1].toLowerCase()] = next ? [].concat(next) : []; return }
    n.props[key] = next
  },
})

function mount(props = {}) {
  active = null
  const value = ref(props.modelValue ?? 20), commits = []
  const root = el('root')
  createApp({ render: () => h(MSlider, { min: 20, max: 100, step: 5, ...props, modelValue: value.value, 'onUpdate:modelValue': (v) => { value.value = v }, onCommit: (v) => commits.push(v) }) }).mount(root)
  const sliderEl = () => root.children.find((c) => c.tag === 'div')
  const handle = () => sliderEl().children.find((c) => c.props.role === 'slider')
  const fire = async (node, type, init = {}) => {
    const ev = { type, button: 0, pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 20, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, ...init }
    for (const f of node.on[type] || []) f(ev)
    await nextTick()
    return ev
  }
  // a pointer press is followed by the compatibility mousedown of the browser, which takes the focus away from a handle unless the press was cancelled
  const press = async (x, init = {}) => {
    const ev = await fire(sliderEl(), 'pointerdown', { clientX: 100 + 400 * x, ...init })
    if (!ev.defaultPrevented && active) { const was = active; active = null; was.on.blur?.forEach((f) => f({})) }
    return ev
  }
  const lift = (x, init = {}) => fire(sliderEl(), 'pointerup', { clientX: 100 + 400 * x, ...init })
  const move = (x, init = {}) => fire(sliderEl(), 'pointermove', { clientX: 100 + 400 * x, ...init })
  return { value, commits, handle, sliderEl, fire, press, lift, move, active: () => active }
}

test('a press on the track jumps the value there, the handle keeps the focus and the release writes it once', async () => {
  const s = mount()
  const down = await s.press(0.5)
  assert.equal(down.defaultPrevented, true, 'the browser does not move the focus to the page')
  assert.equal(s.value.value, 60)
  assert.equal(s.active(), s.handle(), 'the handle holds the focus after the press')
  assert.deepEqual(s.commits, [])
  await s.lift(0.5)
  assert.deepEqual(s.commits, [60])
})

test('after the press the pointer drags the value and the release writes the last one', async () => {
  const s = mount()
  await s.press(0.25)
  await s.move(0.5)
  await s.move(1.4)
  assert.equal(s.value.value, 100, 'clamped to the end')
  await s.lift(1.4)
  assert.deepEqual(s.commits, [100])
  await s.move(0.2)
  assert.equal(s.value.value, 100, 'no drag after the release')
})

test('a click anywhere on the track moves the value there, after a drag and after another click', async () => {
  const s = mount()
  for (const x of [0.5, 0.1, 0.9]) { await s.press(x); await s.lift(x) }
  assert.deepEqual(s.commits, [60, 30, 90])
  assert.equal(s.value.value, 90)
})

test('a surface that commits when the focus leaves keeps its value through a press on the track', async () => {
  const s = mount()
  s.handle().focus()
  let left = 0
  s.handle().on.blur = [...(s.handle().on.blur || []), () => { left++ }]
  await s.press(0.7)
  assert.equal(left, 0, 'the focus did not leave during the press')
  assert.equal(s.value.value, 75)
})

test('a touch tap on the track writes that value on lift; a swipe along the page leaves the slider alone', async () => {
  const s = mount()
  const down = await s.press(0.5, { pointerType: 'touch' })
  assert.equal(down.defaultPrevented, true)
  assert.equal(s.value.value, 20, 'a finger does not move the value on the press')
  await s.lift(0.5, { pointerType: 'touch' })
  assert.equal(s.value.value, 60)
  assert.equal(s.active(), s.handle(), 'a tap takes the focus to the handle, as a mouse press does')
  assert.deepEqual(s.commits, [60])
  await s.press(0.8, { pointerType: 'touch', clientY: 10 })
  await s.move(0.8, { pointerType: 'touch', clientX: 100 + 400 * 0.8 + 2, clientY: 60 })
  await s.lift(0.8, { pointerType: 'touch', clientY: 60 })
  assert.equal(s.value.value, 60)
  assert.deepEqual(s.commits, [60])
})

test('a finger that moves along the slider drags it and writes on lift', async () => {
  const s = mount()
  await s.press(0.25, { pointerType: 'touch' })
  await s.move(0.3, { pointerType: 'touch' })
  await s.move(0.75, { pointerType: 'touch' })
  assert.equal(s.value.value, 80)
  await s.lift(0.75, { pointerType: 'touch' })
  assert.deepEqual(s.commits, [80])
})

test('the arrow keys, Home and End move the value; one write follows the last key and leaving the handle writes at once', async () => {
  const s = mount({ modelValue: 60 })
  const hd = s.handle()
  hd.focus()
  await s.fire(hd, 'keydown', { key: 'ArrowRight' })
  await s.fire(hd, 'keydown', { key: 'ArrowRight' })
  assert.equal(s.value.value, 70)
  assert.deepEqual(s.commits, [], 'one write for a run of keys')
  await new Promise((r) => setTimeout(r, 520))
  assert.deepEqual(s.commits, [70])
  await s.fire(hd, 'keydown', { key: 'Home' })
  assert.equal(s.value.value, 20)
  active = null
  hd.on.blur.forEach((f) => f({}))
  assert.deepEqual(s.commits, [70, 20], 'blur writes the pending value at once')
  const s2 = mount({ modelValue: 60 })
  await s2.fire(s2.handle(), 'keydown', { key: 'End' })
  assert.equal(s2.value.value, 100)
  const tab = await s2.fire(s2.handle(), 'keydown', { key: 'Tab' })
  assert.equal(tab.defaultPrevented, false, 'Tab is left to the browser')
})

test('a disabled slider takes no press', async () => {
  const s = mount({ disabled: true })
  const down = await s.press(0.5)
  assert.equal(down.defaultPrevented, false)
  assert.equal(s.value.value, 20)
})
