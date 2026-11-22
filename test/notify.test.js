import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNotifyStore } from '../src/notify/store.js'
import { snackPlan } from '../src/notify/hostPlan.js'

test('snackbars come one at a time in the order they were asked for, an action runs and closes its own', () => {
  const n = createNotifyStore()
  let undone = 0
  const a = n.snack('已保存 2 项', { action: '撤销', onAction: () => { undone += 1 } })
  n.snack('第二条')
  assert.equal(n.current.value.message, '已保存 2 项')
  n.runSnackAction(a)
  assert.equal(undone, 1)
  assert.equal(n.current.value.message, '第二条')
})

test('a snackbar with an id replaces its own message instead of queueing a copy', () => {
  const n = createNotifyStore()
  n.snack('正在重启', { id: 'restart' })
  n.snack('已重启', { id: 'restart' })
  assert.equal(n.state.queue.length, 1)
  assert.equal(n.current.value.message, '已重启')
})

test('a banner belongs to one page and is gone when it is cleared', () => {
  const n = createNotifyStore()
  n.banner('microphone', { id: 'component', tone: 'warn', text: '缺少组件' })
  n.banner('microphone', { id: 'component', tone: 'warn', text: '缺少组件 usbip' })
  assert.equal(n.bannersOf('microphone').length, 1)
  assert.equal(n.bannersOf('microphone')[0].text, '缺少组件 usbip')
  assert.equal(n.bannersOf('display').length, 0)
  n.clearBanner('microphone', 'component')
  assert.equal(n.bannersOf('microphone').length, 0)
})

test('system states are ordered by severity and counted for the status button', () => {
  const n = createNotifyStore()
  n.system('update', { tone: 'info', title: '有新版本' })
  n.system('mic', { tone: 'warn', title: '麦克风组件缺失' })
  n.system('driver', { tone: 'error', title: '驱动未安装' })
  assert.deepEqual(n.systems.value.map((s) => s.id), ['driver', 'mic', 'update'])
  assert.equal(n.systemCount.value, 3)
  assert.equal(n.systemTone.value, 'error')
  n.clearSystem('driver')
  assert.equal(n.systemTone.value, 'warn')
})

test('a notice can be dismissed one by one or all together; it stays away until it changes or is solved; a status cannot be dismissed', () => {
  const n = createNotifyStore()
  n.system('driver', { tone: 'error', title: '驱动未安装' })
  n.system('update', { tone: 'info', title: '有新版本 1.2', dismissible: true, revision: '1.2' })
  n.system('tip', { tone: 'info', title: '提示', dismissible: true })
  assert.deepEqual(n.systemGroups.value.map((g) => [g.id, g.items.map((i) => i.id)]), [['status', ['driver']], ['notice', ['update', 'tip']]])
  assert.deepEqual(n.clearable.value.map((i) => i.id), ['update', 'tip'])
  n.dismissSystem('driver')
  assert.equal(n.systemCount.value, 3)
  n.dismissSystem('update')
  n.system('update', { tone: 'info', title: '有新版本 1.2', dismissible: true, revision: '1.2' })
  assert.equal(n.systemCount.value, 2)
  n.system('update', { tone: 'info', title: '有新版本 1.3', dismissible: true, revision: '1.3' })
  assert.equal(n.systemCount.value, 3)
  for (const item of [...n.clearable.value]) n.dismissSystem(item.id)
  assert.deepEqual(n.systemGroups.value.map((g) => g.id), ['status'])
})

test('the status button keeps its place while there is nothing to say: a slot of its width, so a notice that comes from the host later moves nothing (connect moved 52 px, the dpr gate)', async () => {
  const { readFileSync } = await import('node:fs')
  const vue = readFileSync(new URL('../src/vue/MStatusBell.vue', import.meta.url), 'utf8'); const css = readFileSync(new URL('../src/css/notify.css', import.meta.url), 'utf8')
  assert.ok(vue.includes('<span v-else class="m-statusbell m-statusbell--rest" aria-hidden="true" />'))
  assert.ok(css.includes('.m-statusbell { position: relative; display: inline-flex; flex: none; width: 48px; }') && css.includes('.m-statusbell--rest { height: 40px; }'), 'the bell and its empty slot are 48 px wide: the slot is as wide as the bell (the Web page measured 40 then 48: an 8 px move)')
})

test('the host draws a new message once and changes a replaced one in place, with a fresh timer', () => {
  const n = createNotifyStore()
  n.snack('正在检查更新…', { id: 'update-check', timeout: 0 })
  const first = snackPlan('', n.current.value)
  assert.deepEqual(first, { id: 'update-check', timeout: 0, show: true })
  n.snack('检查更新失败', { id: 'update-check', timeout: 8000 })
  const replaced = snackPlan(first.id, n.current.value)
  assert.deepEqual(replaced, { id: 'update-check', timeout: 8000, show: false })
  n.snack('另一件事', { timeout: 5000 })
  n.dismissSnack('update-check')
  const next = snackPlan(replaced.id, n.current.value)
  assert.equal(next.show, true)
  assert.equal(next.timeout, 5000)
  assert.deepEqual(snackPlan(next.id, null), { id: '', timeout: 0, show: false })
})

// The bar of the host is a popover whose entrance is the enter class and nothing else. The base rule of .m-snackbar (components.css) carries m-dialog-in; with the enter class
// gone at the end of the entrance that base animation started for the first time (transparent, 0.92 scale, from the side): the bar left and entered again about 430 ms in.
test('the snackbar of the host has no animation of its own: only the enter class animates it, so nothing starts when the class goes', () => {
  const read = (f) => readFileSync(new URL(`../src/css/${f}`, import.meta.url), 'utf8')
  const notify = read('notify.css')
  assert.match(read('components.css'), /\.m-snackbar \{[^}]*animation: m-dialog-in/, 'the base rule still animates the plain bar (MLinkActions copy toast)')
  assert.match(notify, /\.m-snackbar\[popover\] \{ animation: none; \}/)
  assert.match(notify, /\.m-snackbar\[popover\]\.m-snack-enter-active \{ animation: m-snack-in /)
  assert.doesNotMatch(notify, /\.m-snackbar\[popover\]\.m-snack-leave-active/, 'a leave rule of weight (0,3,0) would beat the reduced-motion rules that switch the transition off')
  // the no-animation rule must come after the base rule in the cascade of all.css, and carry more weight than it (class + attribute vs class)
  const all = read('all.css')
  assert.ok(all.indexOf("./components.css") < all.indexOf("./notify.css"))
})
