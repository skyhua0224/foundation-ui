import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// A dead button is a bug class (「点登录无效」): on the pages of the control panel, every button and every action row does something.
const FILES = ['MSecurityLogin', 'MAbout', 'MHostOffline', 'MSourceList']
const tags = (src, name) => [...src.matchAll(new RegExp(`<${name}\\b([^>]*?)(/?)>`, 'gs'))].map((m) => m[1])

for (const f of FILES) {
  test(`${f}: no MButton and no action row without a handler`, () => {
    const src = fs.readFileSync(new URL(`../src/vue/${f}.vue`, import.meta.url), 'utf8')
    const template = src.slice(src.indexOf('<template>'))
    const dead = []
    for (const attrs of tags(template, 'MButton')) if (!/@click|@click\.|:href|href=|type="submit"|v-bind="\$attrs"/.test(attrs)) dead.push(`MButton ${attrs.trim().slice(0, 80)}`)
    for (const attrs of tags(template, 'MItem')) if (/(^|\s)action(\s|$)/.test(attrs) && !/@click|href=|:href/.test(attrs)) dead.push(`MItem ${attrs.trim().slice(0, 80)}`)
    assert.deepEqual(dead, [])
  })
}
test('a MButton whose handler can be missing is drawn only when the handler exists (the sign-in button of the page)', () => {
  const page = fs.readFileSync(new URL('../src/vue/MSecurityLogin.vue', import.meta.url), 'utf8')
  assert.match(page, /<MButton v-if="signedOut" :icon="setupRequired \? 'person_add' : 'login'" @click="signedOut\(\)">/)
})
