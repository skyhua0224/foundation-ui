// The installer's web pages (src/vue/installer): every page renders from the mock states of the bridge contract, the words are complete in both languages, a restart is never offered in prose,
// the done page's buttons are in order (the weak one beside the primary one, the primary at the right edge), the window has its own chrome, and the motion is CSS (no timer steps a progress indicator).
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { ACTION_TYPES, COMPONENT_IDS, createMockBridge, emptyView, validAction } from '../src/vue/installer/bridge.js'
import { INSTALLER_STATES, snapshotOf, staticBridge } from '../src/vue/installer/installerStates.js'
import { installProgress, pageDirection, pageModel, railItems, railStates, stepRows, componentSections, formatBytes, locationModel, splitPath, confirmModel, confirmLabel } from '../src/vue/installer/installerModel.js'
import { LOCALES, t, textKeys } from '../src/vue/installer/installerTexts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, 'src', p), 'utf8')
const ids = INSTALLER_STATES.map((s) => s[0])

let server, MInstaller
before(async () => {
  server = await createServer({
    root, configFile: false, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('md-') } } })],
  })
  MInstaller = (await server.ssrLoadModule('/src/vue/installer/MInstaller.vue')).default
})
after(async () => { await server?.close() })

const render = async (id, locale) => renderToString(createSSRApp(MInstaller, { bridge: staticBridge(snapshotOf(id)), locale }))
const buttons = (html, region) => {
  html = html.replace(/<!--.*?-->/g, '')
  const part = html.slice(html.indexOf(`m-inst__foot-${region}`))
  const end = region === 'start' ? part.indexOf('m-inst__foot-end') : part.indexOf('</footer>')
  return [...part.slice(0, end).matchAll(/<button[^>]*class="([^"]*)"[^>]*>(?:<span.*?<\/span>)?([^<]*)<\/button>/g)].map((m) => ({ cls: m[1], label: m[2].trim() }))
}

test('the words are the same set in zh and en, and a missing word throws', () => {
  assert.deepEqual(textKeys('zh').sort(), textKeys('en').sort())
  assert.throws(() => t('zh', 'nope'), /missing/)
  for (const l of LOCALES) for (const k of textKeys(l)) assert.ok(k.length)
})

test('every state of the mock builds a page, a rail of five and no empty word, in both languages', () => {
  for (const id of ids) for (const l of LOCALES) {
    const v = snapshotOf(id)
    const m = pageModel(v, l)
    assert.ok(m.title, `${id} ${l} title`)
    assert.equal(railItems(v, l).length, 5)
    assert.equal(railStates(v).length, 5)
    for (const b of [...m.start, ...m.end]) assert.ok(b.label, `${id} ${l} ${b.key}`)
    for (const f of m.facts) assert.ok(f.title && f.text, `${id} ${l} fact`)
    assert.ok(!/undefined|NaN|\[object/.test(JSON.stringify(m)), `${id} ${l} has a broken value`)
  }
})

test('every state renders to HTML, in zh and en, in light and with the window chrome', async () => {
  for (const id of ids) for (const l of LOCALES) {
    const html = await render(id, l)
    assert.match(html, /class="m-inst[ "]/, id)
    // the done page takes the whole window (no rail); every other page has the five steps
    assert.equal((html.match(/<li class="[^"]*\bm-inst__rs\b/g) || []).length, snapshotOf(id).page === 'done' ? 0 : 5, `${id} ${l} rail steps`)
    assert.match(html, new RegExp(`m-inst__page--${snapshotOf(id).page}`), id)
    assert.ok(!/undefined|NaN|\[object/.test(html.replace(/<svg.*?<\/svg>/g, '')), `${id} ${l} has a broken value`)
    // the chrome is in the page: a drag region, minimise and close, once each
    assert.match(html, /data-tauri-drag-region/)
    assert.equal((html.match(/aria-label="(最小化|Minimise)"/g) || []).length, 1, `${id} minimise`)
    assert.equal((html.match(/aria-label="(关闭|Close)"/g) || []).length, 1, `${id} close`)
    assert.equal((html.match(/<h1 /g) || []).length, 1, `${id} one title`)
  }
})

test('the welcome page has two facts (the permission and the components) and no word about a restart', async () => {
  for (const l of LOCALES) {
    const m = pageModel(snapshotOf('welcome'), l)
    assert.deepEqual(m.facts.map((f) => f.title), [t(l, 'fact.admin'), t(l, 'fact.components')])
    for (const id of ['welcome', 'welcome-upgrade', 'welcome-cancelled']) assert.ok(!/重启|restart/i.test(await render(id, l)), `${id} ${l}`)
  }
})

test('no page recommends a restart: the done page has none in prose, only the weak button when Windows asked for one', async () => {
  for (const l of LOCALES) {
    for (const id of ids) {
      const html = await render(id, l)
      const prose = html.replace(/<button.*?<\/button>/g, '')
      assert.ok(!/重启|restart/i.test(prose), `${id} ${l}: ${prose.match(/.{20}(重启|restart).{20}/i)?.[0]}`)
    }
    assert.ok(!/重启|restart/i.test(await render('done', l)), `done ${l}`)
    assert.ok(!/重启|restart/i.test(await render('done-opening', l)), `done-opening ${l}`)
    assert.equal((buttons(await render('done-restart', l), 'end').filter((b) => /重启|Restart/.test(b.label))).length, 1)
  }
})

test('the done page: the primary button is last (right edge), the weak one beside it on its left', async () => {
  for (const l of LOCALES) {
    for (const id of ['done', 'done-restart', 'done-panel-failed', 'done-upgrade']) {
      const m = pageModel(snapshotOf(id), l)
      assert.equal(m.start.length, 0)
      assert.equal(m.end.length, 2, id)
      assert.equal(m.end[1].act.type, 'open-panel', `${id} the primary opens the Panel and is last`)
      assert.equal(m.end[1].variant, 'filled')
      assert.equal(m.end[0].variant, 'text', `${id} the weak one is a text button`)
      assert.equal(m.end[0].act.type, id === 'done-restart' ? 'restart-pc' : 'exit')
      const b = buttons(await render(id, l), 'end')
      assert.equal(b.length, 2, `${id} ${l}: ${JSON.stringify(b)}`)
      assert.match(b[0].cls, /m-btn--text/); assert.doesNotMatch(b[1].cls, /m-btn--/)
    }
    assert.equal(pageModel(snapshotOf('done'), l).end[1].label, t(l, 'done.journey'))
    assert.equal(pageModel(snapshotOf('done-upgrade'), l).end[1].label, t(l, 'done.panel'))
    assert.equal(pageModel(snapshotOf('done-opening'), l).end[1].label, t(l, 'done.opening'))
    assert.equal(pageModel(snapshotOf('done-opening'), l).end[1].loading, true)
  }
  assert.equal(pageModel(snapshotOf('done'), 'zh').end[1].label, '开启串流旅程')
  assert.equal(pageModel(snapshotOf('done-restart'), 'zh').end[0].label, '重启电脑')
})

test('the footers: the dismissive button at the left, the primary one the last at the right, on every page', () => {
  for (const id of ids) {
    const m = pageModel(snapshotOf(id), 'zh')
    if (m.page === 'installing') continue
    const last = m.end[m.end.length - 1]
    assert.ok(last, id)
    if (m.page !== 'uac') assert.equal(last.variant, 'filled', `${id}: the primary one is last`)
    for (const b of m.start) assert.equal(b.variant, 'text', `${id}: the left one is a text button`)
  }
  assert.deepEqual(pageModel(snapshotOf('failed-driver'), 'zh').end.map((b) => b.act.type), ['copy-details', 'retry'])
  assert.equal(pageModel(snapshotOf('failed-generic'), 'zh').end[1].label, '重试')
  assert.equal(pageModel(snapshotOf('failed-driver'), 'zh').end[1].label, '修复安装')
  assert.deepEqual(pageModel(snapshotOf('maintenance'), 'zh').end.map((b) => b.act.type), ['customize', 'install'])
})

test('maintenance: the update, same-version and downgrade pages say which, the button names the version', () => {
  const up = pageModel(snapshotOf('maintenance'), 'zh'), same = pageModel(snapshotOf('maintenance-same'), 'zh'), down = pageModel(snapshotOf('maintenance-downgrade'), 'zh')
  assert.equal(up.note, null); assert.equal(up.facts.length, 2, "two facts: a third did not fit the window with the location row above it"); assert.equal(up.end[1].label, '更新到 2026.1109.0')
  assert.equal(same.note.tone, 'secondary'); assert.equal(same.end[1].label, '重新安装 2026.1109.0'); assert.equal(same.facts.length, 2)
  assert.equal(down.note.tone, 'warning'); assert.equal(down.end[1].label, '降级到 2026.1109.0')
  assert.match(up.lead, /2026\.1101\.0.*2026\.1109\.0/)
  const noUninstall = snapshotOf('maintenance'); noUninstall.maintenance.hasUninstaller = false
  assert.equal(pageModel(noUninstall, 'en').start[0].disabled, true)
})

test('components: grouped list (recommended + optional), the current components pre-ticked in maintenance, select-all says what it does', async () => {
  const fresh = componentSections(snapshotOf('components'), 'zh')
  assert.deepEqual(fresh.map((s) => s.id), ['recommended', 'optional'])
  assert.equal(fresh.flatMap((s) => s.items).length, COMPONENT_IDS.length)
  assert.ok(fresh.flatMap((s) => s.items).every((i) => i.on))
  const maint = componentSections(snapshotOf('components-maintenance'), 'zh').flatMap((s) => s.items)
  assert.deepEqual(maint.filter((i) => !i.on).map((i) => i.id), ['usbip', 'desktopicon'])
  const html = await render('components-maintenance', 'zh')
  assert.equal((html.match(/aria-checked="true"/g) || []).length, 6)
  assert.equal((html.match(/aria-checked="false"/g) || []).length, 2)
  assert.match(html, /全选/); assert.doesNotMatch(html, /取消全选/)
  assert.match(await render('components', 'en'), /Clear all/)
  assert.match(await render('components', 'zh'), /推荐安装/)
})

test('the components page answers a toggle and select-all through the bridge', async () => {
  const b = staticBridge(snapshotOf('components'))
  let last
  b.subscribe((v) => { last = v })
  await b.send({ type: 'toggle-component', id: 'usbip' })
  assert.equal(last.components.usbip, false); assert.equal(last.allSelected, false)
  await b.send({ type: 'select-all' })
  assert.ok(COMPONENT_IDS.every((id) => last.components[id])); assert.equal(last.allSelected, true)
  await b.send({ type: 'select-all' })
  assert.ok(COMPONENT_IDS.every((id) => !last.components[id]))
})

test('installing: the steps of the running group, real progress that only grows, no restart step, a rail that never asks for one', () => {
  const v = snapshotOf('installing-drivers')
  const rows = stepRows(v, 'zh')
  assert.deepEqual(rows.map((r) => r.state), ['done', 'running', 'pending', 'pending'])
  assert.equal(rows[1].label, '正在安装虚拟手柄 (ViGEmBus)')
  const g = snapshotOf('installing-drivers'); g.components.usbip = false
  assert.equal(stepRows(g, 'zh').length, 3, 'a driver that is not ticked has no row')
  const items = railItems(v, 'zh')
  assert.deepEqual(items.map((i) => i.state), ['done', 'done', 'running', 'pending', 'pending'])
  assert.equal(items[2].sub, '正在安装虚拟手柄 (ViGEmBus)')
  // along a whole scripted run the overall value never goes down, ends at 1, and the rail has no state beyond the four
  for (const scenario of ['fresh', 'needs-reboot', 'upgrade']) {
    const mock = createMockBridge({ scenario, speed: 0 })
    let view
    mock.subscribe((x) => { view = x })
    mock.send({ type: 'install' })
    let prev = -1, seen = 0
    for (let i = 0; i < 80; i++) {
      if (view.page === 'installing') {
        const p = installProgress(view)
        assert.ok(p.value >= prev - 1e-9, `${scenario}: ${p.value} after ${prev}`)
        assert.ok(p.value >= 0 && p.value <= 1)
        for (const s of railStates(view)) assert.ok(['pending', 'running', 'done', 'failed'].includes(s), s)
        for (const r of stepRows(view, 'en')) assert.ok(r.label && r.state !== 'reboot')
        prev = p.value; seen++
      }
      if (!mock.step()) break
    }
    assert.ok(seen > 5, `${scenario} installing frames ${seen}`)
    assert.equal(view.page, 'done')
    assert.equal(installProgress(view).value, 1)
  }
})

test('the page slide goes forward for a new step and back when a step is left', () => {
  assert.equal(pageDirection('welcome', 'components'), 'fwd')
  assert.equal(pageDirection('components', 'welcome'), 'bck')
  assert.equal(pageDirection('components', 'maintenance'), 'bck')
  assert.equal(pageDirection('components', 'uac'), 'fwd')
  assert.equal(pageDirection('uac', 'welcome'), 'bck', 'a cancelled permission goes back')
  assert.equal(pageDirection('failed', 'uac'), 'fwd', 'a retry is a new run')
  assert.equal(pageDirection('installing', 'done'), 'fwd')
  assert.equal(pageDirection(undefined, 'welcome'), 'fwd')
})

test('failed: driver, service and generic each have their own words, the error code and the repair or retry button', () => {
  for (const l of LOCALES) {
    const titles = new Set()
    for (const id of ['failed-driver', 'failed-service', 'failed-generic']) {
      const m = pageModel(snapshotOf(id), l)
      titles.add(m.title)
      assert.match(m.note.text, /\d/); assert.equal(m.note.tone, 'error')
      assert.deepEqual(m.start.map((b) => b.act.type), ['open-log-folder'])
      assert.ok(m.end.some((b) => b.act.type === 'copy-details'))
      assert.equal(m.facts.length, 2)
    }
    assert.equal(titles.size, 3)
  }
  assert.match(pageModel(snapshotOf('failed-driver'), 'zh').note.text, /错误码 3/)
  assert.match(pageModel(snapshotOf('failed-service'), 'en').note.text, /Error 4/)
})

test('the window: one drag region strip with minimise and close, the radii are concentric (the inner radius is the outer minus the inset)', () => {
  const css = read('css/installer.css'), app = read('vue/installer/MInstaller.vue')
  assert.match(css, /--inst-r: 0px; --inst-shell: 28px; --inst-inset: 8px; --inst-pane-r: calc\(var\(--inst-shell\) - var\(--inst-inset\)\)/)
  assert.match(css, /\.m-inst \{[^}]*border-radius: var\(--inst-r\)/, 'the page draws no outer radius of its own')
  assert.doesNotMatch(css, /\.m-inst \{[^}]*(box-shadow|border:)/, 'no outline or shadow of the window')
  assert.match(css, /\.m-inst__row-icon \{[^}]*border-radius: calc\(var\(--inst-row-r\) - var\(--inst-row-pad\)\)/)
  assert.match(css, /\.m-inst__step \{[^}]*border-radius: calc\(var\(--inst-row-r\) - var\(--inst-steps-pad\)\)/)
  assert.match(css, /\.m-inst__rail \{[^}]*border-radius: var\(--inst-pane-r\)/)
  assert.match(css, /\.m-inst__pane \{[^}]*border-radius: var\(--inst-pane-r\)/)
  assert.match(css, /\.m-inst__caption \{[^}]*-webkit-app-region: drag/)
  assert.match(css, /\.m-inst__wc \{[^}]*-webkit-app-region: no-drag/)
  assert.match(app, /type: 'minimise'/); assert.match(app, /type: 'exit'/)
  assert.match(app, /<header class="m-inst__caption" data-tauri-drag-region>/)
  assert.match(app, /afterFirstPaint\(\(\) => bridge\.send\(\{ type: 'ready' \}\)\)/, 'ready goes out after the first painted frame')
})

test('motion is CSS: springs for the slide, real wave indicators, nothing steps a progress with a timer, reduced motion respected', () => {
  const css = read('css/installer.css')
  const dir = join(root, 'src/vue/installer')
  const src = readdirSync(dir).filter((f) => /\.(vue|js)$/.test(f) && !['bridge.js', 'bridgeMock.js'].includes(f)).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
  assert.doesNotMatch(src, /setInterval|requestAnimationFrame/)
  assert.equal((src.match(/setTimeout/g) || []).length, 4, 'the only timers: the "copied" label, the no-answer watchdog of a press, the switch of the bar to its slow creep (a CSS transition moves it), the moment after the last key before a typed path is checked')
  assert.match(css, /\.m-inst-fwd-enter-active[^}]*var\(--m-spring-default-spatial\)/)
  assert.match(css, /\.m-inst-fwd-leave-active[^}]*var\(--m-spring-fast-spatial\)/)
  assert.match(css, /translateX\(30px\)/)
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.m-inst \*/)
  assert.match(css, /html\[data-motion='reduced'\] \.m-inst/)
  assert.match(css, /m-rm-busy/)
  const steps = read('vue/installer/InstallerSteps.vue'), rail = read('vue/installer/InstallerRail.vue')
  assert.match(steps, /<MProgress :value="shown"/, 'the overall bar is determinate and eased')
  assert.match(steps, /<MProgress v-else-if="r\.state === 'running'" circular/, 'a running step is the indeterminate wave')
  assert.match(rail, /<MProgress v-else-if="s\.state === 'running'" circular/)
})

test('a selected row is a fill and a check; the focus frame is for the keyboard only', () => {
  const css = read('css/installer.css')
  assert.match(css, /\.m-inst__row\.is-on \{ background: var\(--m-sel-fill\)/)
  assert.match(css, /\.m-inst__row\.is-on \.m-inst__tick \{ background: var\(--md-sys-color-primary\)/)
  assert.match(css, /\.m-inst :focus-visible \{ outline: 3px solid var\(--md-sys-color-secondary\); outline-offset: 2px; \}/)
  assert.doesNotMatch(css, /\.m-inst__row[^{]*:focus\s*[,{]/, 'no focus (only focus-visible) ring')
  assert.match(css, /\.m-inst__row:hover::before \{ opacity: \.08; \} \.m-inst__row:active::before \{ opacity: \.12; \}/, 'state layers')
  assert.match(read('vue/installer/InstallerComponents.vue'), /role="checkbox"/)
})

test('the gallery page lists every state and the switcher moves one window between them', () => {
  const g = readFileSync(join(root, 'gallery/InstallerGallery.vue'), 'utf8')
  assert.match(g, /INSTALLER_STATES/); assert.match(g, /stat\.set\(snapshotOf\(id\)\)/)
  assert.ok(new Set(ids).size === ids.length)
  for (const page of ['welcome', 'maintenance', 'components', 'uac', 'installing', 'done', 'failed']) assert.ok(INSTALLER_STATES.some((s) => s[1] === page), page)
  assert.ok(INSTALLER_STATES.length >= 20)
})

test('a language without installer words falls back to English, a Chinese tag to Chinese', () => {
  for (const l of ['de', 'ru', 'ja', 'fr-FR', 'en-US']) assert.equal(t(l, 'fail.retry'), t('en', 'fail.retry'))
  for (const l of ['zh-CN', 'zh-TW', 'zh']) assert.equal(t(l, 'fail.retry'), t('zh', 'fail.retry'))
})

test('a press answers at once and never silently: busy until the next snapshot, an error after 4 s or on a failed send', () => {
  const app = readFileSync(join(root, 'src/vue/installer/MInstaller.vue'), 'utf8')
  assert.match(app, /:loading="b\.loading \|\| pendingKey === b\.key"/, 'the pressed footer button shows its busy state')
  assert.match(app, /settle\(\) \}\)/, 'the next snapshot ends the busy state')
  assert.match(app, /STALL_MS = 4000/)
  assert.match(app, /\.catch\(\(e\) =>/, 'a send that fails shows an error')
  assert.match(app, /role="alert"/)
  for (const l of LOCALES) assert.ok(t(l, 'err.noAnswer') && t(l, 'err.notSent'))
})

test('a component this Windows cannot run is off, disabled and says which Windows version it needs', () => {
  for (const l of LOCALES) {
    const v = { ...emptyView(), page: 'components', unsupported: { usbip: 'Windows 10 1903', vdd: 'Windows 10 1803' } }
    const rows = componentSections(v, l).flatMap((s) => s.items)
    const usbip = rows.find((r) => r.id === 'usbip'), vdd = rows.find((r) => r.id === 'vdd'), pad = rows.find((r) => r.id === 'gamepad')
    assert.equal(usbip.disabled, true); assert.equal(usbip.on, false); assert.match(usbip.text, /1903/)
    assert.equal(vdd.disabled, true); assert.match(vdd.text, /1803/)
    assert.equal(pad.disabled, false); assert.equal(pad.on, true)
  }
  assert.equal(t('zh', 'comp.needs', 'Windows 10 1903'), '需要 Windows 10 1903 或更高')
})

test('the overall bar counts the running step fraction, never jumps back, and creeps no further than the next step', () => {
  const base = snapshotOf('installing-files')
  const a = installProgress(base).value
  const b = installProgress({ ...base, progress: { ...base.progress, fraction: { [base.progress.lastStep]: 0.5 } } }).value
  assert.ok(b >= a)
  const css = read('css/installer.css')
  assert.match(read('vue/installer/InstallerSteps.vue'), /:glide="creeping \? 14000 : 480" :glide-ease="creeping \? 'creep' : 'standard'"/, 'the overall bar eases its value itself: 480 ms, 14 s while it creeps')
  const steps = read('vue/installer/InstallerSteps.vue')
  assert.match(steps, /\(t\.done \+ 1\) \/ t\.total\) - 0\.004/, 'the creep stops just before the next step')
})

test('the done emblem: the ring closes, fills into the shape and the check draws itself', () => {
  const app = readFileSync(join(root, 'src/vue/installer/MInstaller.vue'), 'utf8'), css = read('css/installer.css')
  assert.match(app, /m-inst__seal-ring[\s\S]*m-inst__seal-tick/)
  for (const k of ['m-inst-seal-ring', 'm-inst-seal-fill', 'm-inst-seal-shape', 'm-inst-seal-tick']) assert.match(css, new RegExp('@keyframes ' + k))
  assert.match(css, /\.m-inst__seal \{[^}]*width: 112px/)
})

// ---------------------------------------------------------------- the install location

// a problem refuses the folder; a warning (parent, user) only asks once
const DIR_ERRORS = ['invalid', 'chars', 'not-fixed', 'fs', 'root', 'system', 'synced', 'not-empty', 'too-long', 'no-space', 'no-access']
const DIR_WARNINGS = ['parent', 'user']
const withDir = (over, page = 'welcome') => ({ ...snapshotOf(page), installDir: { ...snapshotOf(page).installDir, ...over } })
const strip = (html) => html.replace(/<!--.*?-->/g, '')
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;')

test('the first page shows where the program goes, with the free space, a field to type in and a Change button; the maintenance page shows the place without them', async () => {
  for (const l of LOCALES) {
    const welcome = strip(await render('welcome-dir-custom', l))
    assert.match(welcome, /data-inst-location/)
    assert.ok(welcome.includes(t(l, 'dir.label')), `${l} label`)
    assert.ok(welcome.includes('Foundation Sunshine'), `${l} the folder`)
    assert.ok(welcome.includes(t(l, 'dir.free', '412 GB')), `${l} free space`)
    assert.equal((welcome.match(/m-inst__loc-change/g) || []).length, 1, `${l} one Change button`)
    assert.ok(welcome.includes(`>${t(l, 'dir.change')}</`), `${l} Change label`)
    assert.match(welcome, /<input[^>]*data-inst-path/, `${l} the path is a field`)
    assert.ok(welcome.includes(`aria-label="${t(l, 'dir.field')}"`), `${l} the field has a name`)
    assert.ok(welcome.includes(escapeHtml('D:\\Games\\安装\\Foundation Sunshine')), `${l} the field holds the folder as typed`)
    for (const id of ['welcome-upgrade']) assert.ok(!/m-inst__loc-change|data-inst-path/.test(await render(id, l)), `${id} ${l} an upgrade keeps its place`)
    for (const id of ['maintenance', 'maintenance-same', 'maintenance-downgrade']) {
      const html = await render(id, l)
      assert.match(html, /data-inst-location/, `${id} ${l}`)
      assert.ok(!/m-inst__loc-change|data-inst-path/.test(html), `${id} ${l} an installed copy cannot be moved or edited`)
    }
    // the other pages have no such row
    for (const id of ['components', 'uac', 'installing-files', 'done', 'failed-generic']) assert.ok(!/data-inst-location/.test(await render(id, l)), id)
  }
})

test('a refused folder says why under the row and keeps Install and Customize off, in both languages', async () => {
  for (const code of DIR_ERRORS) for (const l of LOCALES) {
    const v = withDir({ error: code, maxLength: 85, neededBytes: 1.5 * 2 ** 30 })
    const loc = locationModel(v, l)
    assert.ok(loc.error.text.length > 8, `${code} ${l}`)
    assert.ok(!/undefined|NaN|\[object/.test(JSON.stringify(loc)), `${code} ${l}`)
    if (code === 'too-long') assert.match(loc.error.text, /85/)
    if (code === 'no-space') assert.match(loc.error.text, /1\.5 GB/)
    const m = pageModel(v, l)
    assert.deepEqual(m.end.map((b) => [b.key, !!b.disabled]), [['customize', true], ['install', true]], `${code} ${l}`)
    const html = renderToString(createSSRApp(MInstaller, { bridge: staticBridge(v), locale: l }))
    assert.match(await html, new RegExp(`data-code="${code}"`), `${code} ${l}`)
    assert.ok((await html).includes(escapeHtml(loc.error.text)), `${code} ${l} the reason is on the page`)
  }
  // a usable folder leaves both on
  for (const l of LOCALES) assert.deepEqual(pageModel(snapshotOf('welcome-dir-custom'), l).end.map((b) => !!b.disabled), [false, false])
  // the components page cannot start an install with a refused folder either
  assert.equal(pageModel(withDir({ error: 'fs' }, 'components'), 'zh').end.find((b) => b.key === 'install').disabled, true)
})

test('a warning is not a refusal: Install stays on, the risk and the safe place show under the row, in both languages', async () => {
  for (const code of DIR_WARNINGS) for (const l of LOCALES) {
    const v = withDir({ path: 'D:\\Games\\Foundation Sunshine', warning: code, safePath: 'D:\\Foundation Sunshine', pickedPath: null })
    const loc = locationModel(v, l)
    assert.equal(loc.error, null)
    assert.equal(loc.warning.code, code)
    assert.ok(loc.warning.text.length > 20 && /SYSTEM|系统/.test(loc.warning.text), `${code} ${l} the risk is named: the service runs it as SYSTEM`)
    assert.deepEqual(loc.safe, { label: t(l, 'dir.safe'), path: 'D:\\Foundation Sunshine' })
    assert.deepEqual(pageModel(v, l).end.map((b) => !!b.disabled), [false, false], `${code} ${l} the buttons stay on`)
    const html = strip(await renderToString(createSSRApp(MInstaller, { bridge: staticBridge(v), locale: l })))
    assert.match(html, new RegExp(`data-warning="${code}"`), `${code} ${l}`)
    assert.ok(html.includes(escapeHtml(loc.warning.text)), `${code} ${l} the risk is on the page`)
    assert.match(html, /data-inst-safe/, `${code} ${l} the safe place is one press away`)
    assert.ok(!/data-code=/.test(html), `${code} ${l} it is not drawn as a refusal`)
  }
  // a refusal wins over a warning (the host sends only one, and the page shows only the reason)
  const both = locationModel(withDir({ error: 'fs', warning: 'parent', safePath: 'D:\\x' }), 'en')
  assert.equal(both.warning, null); assert.equal(both.safe, null)
  // a copy that is installed has no safe place to offer
  assert.equal(locationModel(withDir({ editable: false, warning: 'parent', safePath: 'D:\\x' }), 'en').safe, null)
})

test('"use the selected folder itself" shows only while the path is the picked one with the product name added; a folder with files says so', async () => {
  for (const l of LOCALES) {
    const picked = locationModel(snapshotOf('welcome-dir-picked'), l)
    assert.equal(picked.useSelected, t(l, 'dir.useSelected'))
    assert.match(strip(await render('welcome-dir-picked', l)), /data-inst-use-selected/)
    assert.equal(locationModel(snapshotOf('welcome-dir-custom'), l).useSelected, '', `${l} a typed folder has no pick to go back to`)
    assert.ok(!/data-inst-use-selected/.test(await render('welcome-dir-custom', l)))
    assert.equal(locationModel(snapshotOf('welcome-dir-picked'), l).note, '')
    const redirected = locationModel(snapshotOf('welcome-dir-redirected'), l)
    assert.equal(redirected.note, t(l, 'dir.note.redirected'))
    assert.ok(strip(await render('welcome-dir-redirected', l)).includes(escapeHtml(t(l, 'dir.note.redirected'))))
    // the pick that is refused can still be used as it is, and then the rule about files in it answers
    assert.equal(locationModel(snapshotOf('welcome-dir-not-empty'), l).useSelected, t(l, 'dir.useSelected'))
  }
})

test('the question about a warning: its words, the countdown label, the safe place as the primary choice, in both languages', async () => {
  assert.equal(confirmModel(snapshotOf('welcome-dir-warning-parent'), 'en'), null, 'closed until the host opens it')
  assert.equal(confirmModel(withDir({ confirm: true, warning: null }), 'en'), null, 'no warning, no question')
  for (const l of LOCALES) {
    const m = confirmModel(snapshotOf('welcome-dir-confirm'), l)
    assert.equal(m.title, t(l, 'dir.confirm.title'))
    assert.equal(m.text, t(l, 'dir.warn.parent'))
    assert.equal(m.path, 'D:\\Games\\Foundation Sunshine'); assert.equal(m.safePath, 'D:\\Foundation Sunshine')
    assert.equal(m.seconds, 5)
    assert.equal(confirmLabel(l, m, 5), l === 'zh' ? '仍然安装（5 秒）' : 'Install anyway (5 s)')
    assert.equal(confirmLabel(l, m, 1), l === 'zh' ? '仍然安装（1 秒）' : 'Install anyway (1 s)')
    assert.equal(confirmLabel(l, m, 0), m.install, 'the plain label once it can be pressed')
    const html = strip(await render('welcome-dir-confirm', l))
    assert.match(html, /data-inst-confirm/, `${l} the dialog is on the page`)
    assert.ok(html.includes(escapeHtml(m.title)) && html.includes(escapeHtml(m.text)), `${l} its words`)
    assert.ok(/data-inst-confirm-install[^>]*>/.test(html) && /data-inst-confirm-safe/.test(html), `${l} both ways on`)
    // the question is not on the pages that have no folder to ask about
    assert.ok(!/data-inst-confirm/.test(await render('welcome-dir-warning-parent', l)), `${l} closed question`)
  }
  assert.equal(confirmModel({ ...snapshotOf('welcome-dir-confirm'), installDir: { ...snapshotOf('welcome-dir-confirm').installDir, confirmSeconds: 0 } }, 'en').seconds, 5, 'a host without the number gets the same five seconds')
  // the countdown is the one of the other risky questions, and Esc answers the question before it can close the window
  const app = read('vue/installer/MInstaller.vue')
  assert.match(app, /if \(dirConfirm\.value\) \{ act\(\{ type: 'cancel-dir-risk' \}\); return \}/)
  assert.match(read('vue/installer/InstallerDirConfirm.vue'), /useCountdown\(props\.model\.seconds\)/, 'every question counts the seconds the host named for it')
  assert.match(app, /<InstallerDirConfirm v-if="dirConfirm"/, 'it is mounted with the question, not before')
})

test('the location texts: every error and warning has its words in zh and en, sizes and paths are cut for the row', () => {
  assert.equal(formatBytes(0), '0 B'); assert.equal(formatBytes(1536), '2 KB'); assert.equal(formatBytes(5.5 * 2 ** 30), '5.5 GB'); assert.equal(formatBytes(412 * 2 ** 30), '412 GB'); assert.equal(formatBytes(2 * 2 ** 40), '2 TB')
  assert.deepEqual(splitPath('C:\\Program Files\\Sunshine'), { head: 'C:', tail: '\\Program Files\\Sunshine' }, 'a short last folder takes its parent with it')
  assert.deepEqual(splitPath('D:\\Games\\Foundation Sunshine'), { head: 'D:\\Games', tail: '\\Foundation Sunshine' })
  assert.deepEqual(splitPath('D:\\A\\B\\C'), { head: 'D:', tail: '\\A\\B\\C' })
  assert.deepEqual(splitPath('C:\\' + 'A'.repeat(100) + '\\bin'), { head: 'C:\\' + 'A'.repeat(100), tail: '\\bin' }, 'a long parent stays in the head, which is the part that gets cut')
  assert.deepEqual(splitPath('D:\\Games\\安装\\Foundation Sunshine'), { head: 'D:\\Games\\安装', tail: '\\Foundation Sunshine' })
  assert.equal(locationModel({ ...emptyView(), installDir: undefined }, 'zh'), null)
  assert.notEqual(locationModel({ ...emptyView(), installDir: { ...emptyView().installDir, path: '' } }, 'zh'), null, 'an empty field is still the field, with the reason under it')
  for (const l of LOCALES) for (const code of DIR_ERRORS) assert.doesNotThrow(() => t(l, `dir.err.${code}`, 5), `${l} ${code}`)
  for (const l of LOCALES) for (const code of DIR_WARNINGS) assert.doesNotThrow(() => t(l, `dir.warn.${code}`), `${l} ${code}`)
  for (const l of LOCALES) assert.ok(!/遥测|telemetry/i.test(textKeys(l).map((k) => { try { return String(t(l, k, 1, 2)) } catch { return '' } }).join(' ')))
})

test('the actions of the location: typing, the picker, the picked folder, the safe place and the question are all valid and carry what they need', () => {
  for (const type of ['choose-dir', 'set-dir', 'use-picked-dir', 'use-safe-dir', 'confirm-dir-risk', 'cancel-dir-risk']) assert.ok(ACTION_TYPES.includes(type), type)
  assert.equal(validAction({ type: 'set-dir', path: 'D:\\串流基地' }), true)
  assert.equal(validAction({ type: 'set-dir', path: '' }), true, 'an empty field is sent too (the host answers with the reason)')
  assert.equal(validAction({ type: 'set-dir' }), false)
  assert.equal(validAction({ type: 'set-dir', path: 5 }), false)
  assert.equal(validAction({ type: 'set-dir', path: 'x'.repeat(5000) }), false)
  const field = read('vue/installer/InstallerLocation.vue')
  assert.match(field, /type: 'set-dir', path: draft\.value/, 'the field sends what was typed')
  assert.match(field, /@keydown\.enter="enter"/); assert.match(field, /@blur="leave"/)
  assert.match(field, /event\.isComposing \|\| event\.keyCode === 229\) return\n  event\.preventDefault\(\)/, 'the Enter that picks a candidate in an input method is the input method\'s: it neither commits nor is stopped')
  assert.match(field, /document\.activeElement !== input\.value\) draft\.value = model\.path/, 'what the host sends does not overwrite a field that is being typed in')
})

test('Change sends choose-dir, shows busy until the host answers, and the mock host adds the product folder to a pick, takes typed paths as they are and refuses a refused folder', async () => {
  assert.equal(validAction({ type: 'choose-dir' }), true)
  const app = read('vue/installer/MInstaller.vue')
  assert.match(app, /a\.type === 'choose-dir'\) choosing\.value = true/, 'the button shows busy while the system picker is open')
  assert.ok(!/WAITS = \[[^\]]*choose-dir/.test(app), 'the picker may stay open: no no-answer watchdog')
  assert.ok(!/WAITS = \[[^\]]*set-dir/.test(app), 'typing has no no-answer watchdog either')
  const clock = { t: 1_000_000 }  // the question about a warning counts its seconds on this clock
  const mock = createMockBridge({ speed: 0, now: () => clock.t })
  const dir = () => mock.state().installDir
  assert.equal(dir().editable, true)
  // pick 1: D:\Games has files and a parent that others can replace: the product folder is added, the pick is kept, the note says why, and the warning follows
  await mock.send({ type: 'choose-dir' })
  assert.equal(dir().path, 'D:\\Games\\Foundation Sunshine'); assert.equal(dir().pickedPath, 'D:\\Games'); assert.equal(dir().note, 'redirected'); assert.equal(dir().warning, 'parent'); assert.equal(dir().error, null)
  assert.equal(dir().safePath, 'D:\\Foundation Sunshine')
  // use the selected folder itself: a folder with files in it is refused, the rule that protects the person's files
  await mock.send({ type: 'use-picked-dir' })
  assert.equal(dir().path, 'D:\\Games'); assert.equal(dir().error, 'not-empty'); assert.equal(dir().pickedPath, null)
  await mock.send({ type: 'install' })
  assert.equal(mock.state().page, 'welcome', 'no install into a refused folder')
  // pick 2: a disk root gets the product folder, no warning (directly on the drive)
  await mock.send({ type: 'choose-dir' })
  assert.equal(dir().path, 'D:\\Foundation Sunshine'); assert.equal(dir().warning, null); assert.equal(dir().error, null); assert.equal(dir().pickedPath, 'D:\\')
  // typing: taken as typed, no product folder added, the pick is gone
  await mock.send({ type: 'set-dir', path: 'D:\\串流基地' })
  assert.equal(dir().path, 'D:\\串流基地'); assert.equal(dir().pickedPath, null); assert.equal(dir().error, null)
  await mock.send({ type: 'set-dir', path: 'D:\\' })
  assert.equal(dir().error, 'root', 'a typed root is not turned into a folder: the reason shows')
  await mock.send({ type: 'set-dir', path: 'D:\\a!b' })
  assert.equal(dir().error, 'chars')
  await mock.send({ type: 'set-dir', path: '' })
  assert.equal(dir().error, 'invalid')
  // pick 3: FAT32
  await mock.send({ type: 'choose-dir' })
  assert.equal(dir().error, 'fs')
  // pick 4: a user folder is a warning; the safe place is the default folder on the system drive
  await mock.send({ type: 'choose-dir' })
  assert.equal(dir().warning, 'user'); assert.equal(dir().safePath, 'C:\\Program Files\\Sunshine')
  // the first press of Install opens the question, and nothing starts; the answer is taken only while it is open and after its five seconds
  await mock.send({ type: 'confirm-dir-risk' })
  assert.equal(mock.state().page, 'welcome', 'no answer to a question nobody asked')
  await mock.send({ type: 'install' })
  assert.equal(mock.state().page, 'welcome'); assert.equal(dir().confirm, true)
  await mock.send({ type: 'cancel-dir-risk' })
  assert.equal(dir().confirm, false)
  await mock.send({ type: 'install' }); assert.equal(dir().confirm, true)
  await mock.send({ type: 'confirm-dir-risk' })
  assert.equal(mock.state().page, 'welcome', 'an answer that comes early is not taken'); assert.equal(dir().confirm, true, 'and the question stays open')
  clock.t += 4999
  await mock.send({ type: 'confirm-dir-risk' })
  assert.equal(mock.state().page, 'welcome', 'one millisecond short')
  clock.t += 1
  await mock.send({ type: 'confirm-dir-risk' })
  assert.equal(mock.state().page, 'uac', 'after the five seconds: the install starts')
  // cancelling and asking again starts the count again
  const timed = createMockBridge({ speed: 0, now: () => clock.t })
  await timed.send({ type: 'choose-dir' }); await timed.send({ type: 'install' })
  clock.t += 6000
  await timed.send({ type: 'cancel-dir-risk' }); await timed.send({ type: 'install' })
  await timed.send({ type: 'confirm-dir-risk' })
  assert.equal(timed.state().page, 'welcome', 'the count began again with the second question')
  // the safe place: one press, no question, and it is the default folder
  const again = createMockBridge({ speed: 0 })
  await again.send({ type: 'choose-dir' })
  await again.send({ type: 'use-safe-dir' })
  assert.equal(again.state().installDir.path, 'D:\\Foundation Sunshine'); assert.equal(again.state().installDir.warning, null); assert.equal(again.state().installDir.confirm, false)
  await again.send({ type: 'install' })
  assert.equal(again.state().page, 'uac', 'a folder without a warning installs at once')
  // the default folder again (pick 6), and an installed copy stays where it is
  const upgrade = createMockBridge({ scenario: 'upgrade', speed: 0 })
  assert.equal(upgrade.state().installDir.editable, false)
  await upgrade.send({ type: 'choose-dir' }); await upgrade.send({ type: 'set-dir', path: 'D:\\x' })
  assert.equal(upgrade.state().installDir.path, 'D:\\Programs\\Foundation Sunshine', 'an installed copy stays where it is')
  // the host sends every key of emptyView().installDir
  assert.deepEqual(Object.keys(emptyView().installDir).sort(), ['confirm', 'confirmSeconds', 'editable', 'error', 'freeBytes', 'maxLength', 'neededBytes', 'note', 'path', 'pickedPath', 'safePath', 'warning'])
})
