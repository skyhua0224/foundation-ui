import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { createRenderer, createSSRApp, h, nextTick, reactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import { catalogueTexts } from '../src/vue/homeCatalogueTexts.js'
import { TEXT_CODES } from '../src/locale/texts/index.js'

let TileClients
before(async () => {
  const file = new URL('../src/vue/tiles/TileClients.vue', import.meta.url)
  const descriptor = parse(readFileSync(file, 'utf8')).descriptor
  const source = `import { h as __testH } from '${import.meta.resolve('vue')}'\n` + compileScript(descriptor, { id: 'pair-tile-test', inlineTemplate: true }).content
    .replace(/import (\w+) from ['"]([^'"]+\.vue)['"]/g, "const $1 = { props: ['name'], render() { return __testH('i', { 'data-icon': this.name }) } }")
    .replace(/from ['"](\.\.?\/[^'"]+)['"]/g, (_all, path) => `from '${new URL(path, file).href}'`)
    .replace(/from ['"]vue['"]/g, `from '${import.meta.resolve('vue')}'`)
  TileClients = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default
})

test('the pairing tile starts hidden without requesting or displaying a code', async () => {
  for (const size of ['s', 'm']) {
    const actions = []
    const app = createSSRApp({ render: () => h(TileClients, {
      card: { id: 'pair', size, title: 'Pair', data: { icon: 'person_add', qr: { state: 'ready', image: 'data:image/png;base64,c2VjcmV0' }, canPin: true } },
      texts: { pairQr: 'QR code', pairGetQr: 'Get QR code', pairRefresh: 'Refresh' },
      onAct: (action) => actions.push(action),
    }) })
    const html = await renderToString(app)
    assert.deepEqual(actions, [])
    assert.doesNotMatch(html, /data:image\/png/)
    assert.match(html, /Get QR code/)
    assert.match(html, /data-icon="qr_code_scanner"/)
  }
})

test('the pairing actions have clear Chinese and English labels', () => {
  assert.equal(catalogueTexts('zh').pairGetQr, '获取二维码')
  assert.equal(catalogueTexts('zh').pairRefresh, '刷新二维码')
  assert.equal(catalogueTexts('en').pairGetQr, 'Get QR code')
  for (const locale of TEXT_CODES) assert.ok(catalogueTexts(locale).pairGetQr, locale)
})

test('the button requests a code once, then the expired code is replaced by refresh', async () => {
  const makeNode = (type, text = '') => ({ type, text, props: {}, children: [], parent: null, addEventListener() {}, removeEventListener() {}, tagName: type.toUpperCase() })
  const renderer = createRenderer({
    createElement: (type) => makeNode(type), createText: (text) => makeNode('#text', text), createComment: (text) => makeNode('#comment', text),
    setText: (node, text) => { node.text = text }, setElementText: (node, text) => { node.text = text; node.children = [] },
    patchProp: (node, key, _old, value) => { node.props[key] = value },
    insert: (node, parent, anchor) => { if (node.parent) { const i = node.parent.children.indexOf(node); if (i >= 0) node.parent.children.splice(i, 1) } node.parent = parent; const i = parent.children.indexOf(anchor); parent.children.splice(i < 0 ? parent.children.length : i, 0, node) },
    remove: (node) => { if (node.parent) { const i = node.parent.children.indexOf(node); if (i >= 0) node.parent.children.splice(i, 1); node.parent = null } },
    parentNode: (node) => node.parent, nextSibling: (node) => node.parent?.children[node.parent.children.indexOf(node) + 1] || null,
  })
  const actions = []
  const qr = reactive({ state: 'idle', image: '' })
  const root = makeNode('root')
  const app = renderer.createApp({ render: () => h(TileClients, {
    card: { id: 'pair', size: 'm', title: 'Pair', data: { icon: 'person_add', qr, canPin: true } },
    texts: { pairQr: 'QR code', pairGetQr: 'Get QR code', pairRefresh: 'Refresh', pairDone: 'Paired' },
    onAct: (action) => actions.push(action),
  }) })
  const find = (node, test) => test(node) ? node : node.children.map((child) => find(child, test)).find(Boolean)
  app.mount(root)
  try {
    assert.deepEqual(actions, [])
    find(root, (node) => node.type === 'button' && node.props.class === 'm-b2pair__action').props.onClick({ stopPropagation() {} })
    await nextTick()
    assert.deepEqual(actions, [{ type: 'pair-qr-begin' }])
    qr.state = 'ready'; qr.image = 'data:image/png;base64,c2VjcmV0'
    await nextTick()
    assert.ok(find(root, (node) => node.type === 'img' && node.props.src === qr.image))
    assert.equal(find(root, (node) => node.type === 'button' && node.props.class === 'm-b2pair__action'), undefined)
    qr.state = 'expired'; qr.image = ''
    await nextTick()
    find(root, (node) => node.type === 'button' && node.props.class === 'm-b2pair__action').props.onClick({ stopPropagation() {} })
    assert.deepEqual(actions.at(-1), { type: 'pair-qr-begin', value: true })
  } finally {
    app.unmount()
  }
  assert.deepEqual(actions.at(-1), { type: 'pair-qr-stop' })
})
