import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRenderer, markRaw, ref, nextTick, h } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

// The real MSearchResults.vue is compiled and mounted on a small fake DOM: a result that cannot be used shows its reason under the path, a locked one offers the way to the setting that unlocks it.
const here = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(here, '../src')
const gen = fs.mkdtempSync(path.join(here, '.results-'))
process.on('exit', () => fs.rmSync(gen, { recursive: true, force: true }))
const source = fs.readFileSync(path.join(src, 'vue/MSearchResults.vue'), 'utf8')
const { descriptor } = parse(source, { filename: 'MSearchResults.vue' })
const script = compileScript(descriptor, { id: 'msr', inlineTemplate: false })
const tpl = compileTemplate({ source: descriptor.template.content, filename: 'MSearchResults.vue', id: 'msr', compilerOptions: { bindingMetadata: script.bindings } })
let code = script.content
  .replace(/import MIcon from ['"]\.\/MIcon\.vue['"]/, 'const MIcon = { props: ["name"], render() { return null } }')
  .replace(/from ['"]\.\.\/search\/index\.js['"]/, `from ${JSON.stringify(pathToFileURL(path.join(src, 'search/index.js')).href)}`)
code = `${code.replace('export default', 'const __sfc__ =')}\n${tpl.code.replace('export function render', 'function render')}\n__sfc__.render = render\nexport default __sfc__\n`
const file = path.join(gen, 'MSearchResults.mjs')
fs.writeFileSync(file, code)
const MSearchResults = (await import(pathToFileURL(file).href)).default

const el = (tag) => markRaw({ tag, children: [], parent: null, props: {}, on: {}, text: '' })
const { createApp } = createRenderer({
  createElement: el,
  createText: (t) => ({ ...el('#text'), text: t }),
  createComment: () => el('#comment'),
  insert(child, parent, anchor) { if (child.parent) { const j = child.parent.children.indexOf(child); if (j >= 0) child.parent.children.splice(j, 1) } child.parent = parent; const i = anchor ? parent.children.indexOf(anchor) : -1; if (i < 0) parent.children.push(child); else parent.children.splice(i, 0, child) },
  remove(child) { const i = child.parent ? child.parent.children.indexOf(child) : -1; if (i >= 0) child.parent.children.splice(i, 1) },
  setElementText(n, t) { n.text = t }, setText(n, t) { n.text = t }, parentNode: (n) => n.parent,
  nextSibling: (n) => (n.parent ? n.parent.children[n.parent.children.indexOf(n) + 1] ?? null : null), querySelector: () => null,
  patchProp(n, key, prev, next) { const m = /^on([A-Z].*)$/.exec(key); if (m) { n.on[m[1].toLowerCase()] = next ? [].concat(next) : []; return } n.props[key] = next },
})
const walk = (n, out = []) => { out.push(n); for (const c of n.children) walk(c, out); return out }
const textOf = (n) => walk(n).map((x) => x.text || '').join('')
const byClass = (root, cls) => walk(root).filter((x) => String(x.props.class || '').split(/\s+/).includes(cls))

const TEXTS = { types: { setting: '设置' }, more: '还有 {n} 项', openSetting: '去设置', noResults: '无', noResultsHint: '', open: '搜索', quickActions: '', recentSearches: '', recentSettings: '', clearAll: '', noneYet: '', addToHome: '', pin: '', pinned: '', remove: '' }
function mount(docs) {
  const chosen = []
  const search = {
    idle: ref(false), query: ref('x'), active: ref(0), quick: ref([]), recentQueries: ref([]), recentSettings: ref([]),
    result: ref({ total: docs.length, groups: [{ type: 'setting', items: docs.map((doc) => ({ doc, ranges: [] })), more: 0 }] }),
    choose: (row) => chosen.push(row), pinned: () => false, pin() {}, forget() {}, forgetAll() {},
  }
  const root = el('root')
  createApp({ render: () => h(MSearchResults, { search, texts: TEXTS }) }).mount(root)
  return { root, chosen }
}
const doc = (id, title, availability) => ({ id, type: 'setting', title, path: '输入 › 手柄', route: 'config', params: { focus: id }, ...(availability ? { availability } : {}) })

test('a usable result is a plain row; one that cannot be used shows why under its path and stays a row that opens its place', async () => {
  const { root, chosen } = mount([
    doc('a', '触觉增益'),
    doc('b', '体感上报频率上限', { state: 'unavailable', code: 'client', reason: '需要客户端支持', icon: 'devices' }),
  ])
  await nextTick()
  const rows = byClass(root, 'm-usearch__row')
  assert.equal(rows.length, 2)
  assert.ok(!String(rows[0].props.class).includes('is-unavailable'))
  assert.ok(String(rows[1].props.class).includes('is-unavailable'))
  assert.equal(byClass(rows[0], 'm-usearch__why').length, 0)
  const why = byClass(rows[1], 'm-usearch__why')
  assert.equal(why.length, 1)
  assert.equal(textOf(why[0]), '需要客户端支持')
  assert.equal(rows[1].props['aria-description'], '需要客户端支持')
  assert.equal(rows[0].props['aria-description'], undefined)
  assert.equal(byClass(rows[1], 'm-usearch__unlock').length, 0, 'no way to unlock a setting that is not locked')
  for (const f of rows[1].on.click) f({})
  assert.equal(chosen.length, 1)
  assert.equal(chosen[0].doc.id, 'b', 'the row opens its place like any other')
})

test('a locked result offers the way to the setting that unlocks it, and that is what choosing it does', async () => {
  const blocker = { id: 'setting:ds5.rumble.enabled', title: '启用震动', route: 'config', params: { tab: 'input', focus: 'ds5:ds5.rumble.enabled' } }
  const { root, chosen } = mount([doc('c', '震动强度', { state: 'locked', code: 'setting', reason: '需先开启「启用震动」', icon: 'lock', blockedBy: blocker })])
  await nextTick()
  const row = byClass(root, 'm-usearch__row')[0]
  assert.equal(textOf(byClass(row, 'm-usearch__why')[0]), '需先开启「启用震动」')
  const button = byClass(row, 'm-usearch__unlock')[0]
  assert.equal(textOf(button), '去设置')
  let stopped = false
  for (const f of button.on.click) f({ stopPropagation() { stopped = true } })
  assert.equal(stopped, true, 'the press on the button is not a press on the row')
  assert.deepEqual(chosen, [{ kind: 'doc', doc: { type: 'setting', ...blocker } }])
})
