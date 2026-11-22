// Layout gate: the contrast of every word of every tile, measured on what is rendered.
//   node scripts/contrast-fit.mjs --panel URL --host-port N --out DIR [--ui DIR] [--sizes s,m,l,xl,strip] [--themes dark,light] [--states live,idle,off,empty] [--ids a,b] [--keep 1]
//   node scripts/contrast-fit.mjs --pages URL,URL --out DIR     the same for every text of the kit's gallery pages (the shared components)
// --panel is a Panel dev server over a host mock that answers /__mock/live?on=, /__mock/switches?off=, /__mock/reset (the harness of the overview gates); --ui is the foundation-ui tree it serves (default: this repo).
// Per combination (state x theme x size, every tile of the catalogue forced to that size) two screenshots are taken: the page as it is (A) and the same page with every text node hidden (B,
// `visibility: hidden` on a span around each text node, so the layout, the colours of the boxes and every translucent or clipped layer stay as they are). The pixels where A and B differ
// most are the core of the glyphs. The word's colour is its computed colour with its alpha and the opacity of its ancestors (a word painted as a background clipped to its glyphs, the rolling digits, is
// measured from A instead); what it is on is B under the glyphs. The ratio is the WCAG 2 contrast of the two, the worst tenth of the pixels (a gradient, a picture or a shape under a word counts).
// Body and status text must reach 4.5:1, large text (24 px, or 18.66 px and bold) 3:1. A word whose alpha with its ancestors' opacity is below 0.08 is not drawn and not measured. A word that A shows far
// less than its colour would change is covered or clipped: listed as unseen. A word of a disabled control (WCAG 2 1.4.3 exempts it) is listed apart.
// Exit 1 when a text is below its line. The list is written to DIR/contrast.json.
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
// playwright-core is resolved from PW_REQUIRE_FROM (a directory with node_modules) or from here, as scripts/measure-clock-ink.mjs does.
// QA_ENV: a module that exports chromium (a launcher that takes the shared browser lock); without it playwright-core is used directly.
const { chromium } = process.env.QA_ENV ? await import(process.env.QA_ENV) : createRequire(process.env.PW_REQUIRE_FROM ? path.join(process.env.PW_REQUIRE_FROM, 'x.js') : import.meta.url)('playwright-core')
const a = process.argv.slice(2); const one = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d }
const PANEL = one('--panel'), HP = one('--host-port'), UI = one('--ui', path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')), OUT = one('--out'); fs.mkdirSync(OUT, { recursive: true })
const PAGES = one('--pages', '') ? one('--pages', '').split(',') : null // gallery pages of the kit: every text of the page instead of the tiles of the overview
const ONLY = one('--ids', '') ? one('--ids', '').split(',') : null
const META = JSON.parse(execSync(`cd ${UI} && node --import ./scripts/register.mjs --import ./scripts/no-network.mjs -e "Promise.all([import('./src/vue/homeCards.js'), import('./src/vue/homeSizes.js')]).then(([c, z]) => console.log(JSON.stringify({ order: c.DEFAULT_ORDER, sizes: Object.fromEntries(Object.entries(z.SIZE_TABLE).map(([id, v]) => [id, Object.keys(v.sizes)])) })))"`, { encoding: 'utf8' }).trim().split('\n').pop())
// a tile is only drawn at a size it offers (a tile forced to one it does not declare shows a layout nobody can pick); a tile without a declaration is drawn at its own size in the m pass
const idsFor = (size) => META.order.filter((id) => (ONLY ? ONLY.includes(id) : true) && (META.sizes[id] ? META.sizes[id].includes(size) : size === 'm'))
const b = await chromium.launch({ args: ['--no-sandbox'] })
const finds = [], unseen = [], disabled = []; let texts = 0, combos = 0

// the analysis page: decodes the two screenshots, so no image library is needed
const lab = await b.newPage(); await lab.goto('about:blank')
const analyse = (A, B, C1, C2, list) => lab.evaluate(async ({ A, B, C1, C2, list }) => {
  const load = (u) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u })
  const [ia, ib, ic, id] = await Promise.all([A, B, C1, C2].map((x) => load('data:image/png;base64,' + x)))
  const W = ia.naturalWidth, H = ia.naturalHeight
  const cv = (img) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x }
  const xa = cv(ia), xb = cv(ib), xc = cv(ic), xd = cv(id)
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const out = []
  for (const t of list) {
    const [rx, ry, rw, rh] = t.rect; const cl = t.clip || [0, 0, 1e9, 1e9]
    const x0 = Math.max(Math.floor(rx), Math.floor(cl[0]), 0), y0 = Math.max(Math.floor(ry), Math.floor(cl[1]), 0)
    const x1 = Math.min(Math.ceil(rx + rw), Math.ceil(cl[2]), W), y1 = Math.min(Math.ceil(ry + rh), Math.ceil(cl[3]), H)
    if (x1 <= x0 || y1 <= y0) continue
    const da = xa.getImageData(x0, y0, x1 - x0, y1 - y0).data, db = xb.getImageData(x0, y0, x1 - x0, y1 - y0).data, dc = xc.getImageData(x0, y0, x1 - x0, y1 - y0).data, dd = xd.getImageData(x0, y0, x1 - x0, y1 - y0).data
    // the glyphs' own pixels: the word drawn in black and in white over the same background; a word that is nearly the colour of what is behind it (the failing case) still has its shape here
    const dm = new Uint8Array(da.length / 4); let maxm = 0
    for (let i = 0; i < dm.length; i++) { const m = Math.max(Math.abs(dc[i * 4] - db[i * 4]), Math.abs(dc[i * 4 + 1] - db[i * 4 + 1]), Math.abs(dc[i * 4 + 2] - db[i * 4 + 2]), Math.abs(dd[i * 4] - db[i * 4]), Math.abs(dd[i * 4 + 1] - db[i * 4 + 1]), Math.abs(dd[i * 4 + 2] - db[i * 4 + 2])); dm[i] = m; if (m > maxm) maxm = m }
    let maxd = 0; const ds = new Uint8Array(da.length / 4)
    for (let i = 0; i < ds.length; i++) { const d = Math.max(Math.abs(da[i * 4] - db[i * 4]), Math.abs(da[i * 4 + 1] - db[i * 4 + 1]), Math.abs(da[i * 4 + 2] - db[i * 4 + 2])); ds[i] = d; if (d > maxd) maxd = d }
    let bi = 0; for (let i = 0; i < ds.length; i++) if (ds[i] > ds[bi]) bi = i
    const ratioOf = (f, g) => { const p = lum(f[0], f[1], f[2]), q = lum(g[0], g[1], g[2]); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05) }
    let ratio, fgc = null, bgc = null
    // what the colour of the word would change on the background under its strongest pixel: if the screenshot shows far less, the word is not painted (covered by a picture, clipped by its tile)
    const e = !t.bgclip && t.fill ? Math.max(...[0, 1, 2].map((k) => Math.abs((t.fill[k] - db[bi * 4 + k]) * t.a))) : 0
    if (maxd < 6 || (e > 24 && maxd < e * 0.45)) ratio = 1
    else if (e > 24) {
      // the colour of the word is its computed colour with its alpha (opacity of the ancestors included); the background is what the screenshot without the word shows under the glyphs, the worst tenth of it
      const rs = []
      for (let i = 0; i < ds.length; i++) if (dm[i] >= maxm * 0.5) {
        const g = [db[i * 4], db[i * 4 + 1], db[i * 4 + 2]]; rs.push(ratioOf([0, 1, 2].map((k) => t.fill[k] * t.a + g[k] * (1 - t.a)), g))
      }
      rs.sort((u, v) => u - v); ratio = rs[Math.floor(rs.length * 0.1)]
      bgc = [db[bi * 4], db[bi * 4 + 1], db[bi * 4 + 2]]; fgc = [0, 1, 2].map((k) => Math.round(t.fill[k] * t.a + bgc[k] * (1 - t.a)))
    } else {
      // a word painted as a background clipped to its glyphs (rolling digits): its colour is what the screenshot shows
      const rs = []
      for (let i = 0; i < ds.length; i++) if (ds[i] >= maxd * 0.85) rs.push(ratioOf([da[i * 4], da[i * 4 + 1], da[i * 4 + 2]], [db[i * 4], db[i * 4 + 1], db[i * 4 + 2]]))
      rs.sort((u, v) => u - v); ratio = rs[Math.floor(rs.length * 0.1)]
      fgc = [...da.slice(bi * 4, bi * 4 + 3)]; bgc = [...db.slice(bi * 4, bi * 4 + 3)]
    }
    out.push({ ...t, ratio: Math.round(ratio * 100) / 100, fgc, bgc })
  }
  return out
}, { A, B, C1, C2, list })

async function measure(page, SEL, NAME, tag, state, theme) {
  // a span round every text node: it changes neither the layout nor the cascade, and can be hidden alone
  await page.evaluate((sel) => {
    for (const cell of document.querySelectorAll(sel)) {
      const w = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT); const ns = []
      for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent.trim() && n.parentElement && !n.parentElement.closest('script, style')) ns.push(n)
      for (const n of ns) { const sp = document.createElement('span'); sp.className = '__tc'; sp.style.display = 'inline'; n.replaceWith(sp); sp.appendChild(n) }
    }
  }, SEL)
  await page.waitForTimeout(500)
  if ((await page.evaluate(() => document.documentElement.scrollHeight)) > page.viewportSize().height) console.log('warning: the page is taller than its viewport', state, theme, tag)
  const shotA = (await page.screenshot()).toString('base64')
  const list = await page.evaluate(([SEL, NAME]) => {
    const out = []
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const c2 = cv.getContext('2d', { willReadFrequently: true })
    const parse = (s) => { if (!s) return null; c2.clearRect(0, 0, 1, 1); c2.fillStyle = '#000'; c2.fillStyle = s; c2.fillRect(0, 0, 1, 1); const d = c2.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
    for (const cell of document.querySelectorAll(SEL)) {
      for (const sp of cell.querySelectorAll('span.__tc')) {
        const t = sp.textContent.trim(); if (!t) continue
        const el = sp.parentElement; if (!el || el.closest('[aria-hidden="true"], .m-visually-hidden')) continue
        const cs = getComputedStyle(sp); if (cs.visibility === 'hidden' || cs.display === 'none') continue
        const rs = [...sp.getClientRects()].filter((r) => r.width > 1 && r.height > 1); if (!rs.length) continue
        let alpha = 1, bgclip = false
        for (let e = sp; e && e !== document.documentElement; e = e.parentElement) { const g = getComputedStyle(e); const o = parseFloat(g.opacity); if (Number.isFinite(o)) alpha *= o; if ((g.backgroundClip || g.webkitBackgroundClip) === 'text') bgclip = true }
        const fill = parse(cs.color); if (!fill) continue
        if (fill[3] * alpha < 0.08 && !bgclip) continue
        if (alpha < 0.08) continue
        const tile = cell.querySelector('.m-tile')?.getBoundingClientRect()
        const r = rs.reduce((u, q) => ({ left: Math.min(u.left, q.left), top: Math.min(u.top, q.top), right: Math.max(u.right, q.right), bottom: Math.max(u.bottom, q.bottom) }), { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 })
        out.push({ disabled: !!sp.closest(':disabled, [disabled], [aria-disabled="true"], .is-disabled, .m-trayed__text.is-off'), fill, a: fill[3] * alpha, bgclip, id: cell.dataset.card || NAME, size: cell.dataset.size || '-', text: t.slice(0, 24), css: cs.color, cls: String(el.className?.baseVal ?? el.className).slice(0, 70), pcls: String(el.parentElement?.className?.baseVal ?? el.parentElement?.className ?? '').slice(0, 50), px: parseFloat(cs.fontSize), weight: +cs.fontWeight || 400, rect: [r.left + scrollX, r.top + scrollY, r.right - r.left, r.bottom - r.top], clip: tile ? [tile.left + scrollX, tile.top + scrollY, tile.right + scrollX, tile.bottom + scrollY] : null })
      }
    }
    return out
  }, [SEL, NAME])
  await page.addStyleTag({ content: '.__tc { visibility: hidden !important }' }); await page.waitForTimeout(120)
  const shotB = (await page.screenshot()).toString('base64')
  await page.addStyleTag({ content: '.__tc { visibility: visible !important; color: #000 !important; -webkit-text-fill-color: #000 !important; opacity: 1 !important }' }); await page.waitForTimeout(120)
  const shotC1 = (await page.screenshot()).toString('base64')
  await page.addStyleTag({ content: '.__tc { color: #fff !important; -webkit-text-fill-color: #fff !important }' }); await page.waitForTimeout(120)
  const shotC2 = (await page.screenshot()).toString('base64')
  const res = await analyse(shotA, shotB, shotC1, shotC2, list)
  combos++; texts += res.length
  for (const t of res) {
    const big = t.px >= 24 || (t.px >= 18.66 && t.weight >= 700); const need = big ? 3 : 4.5
    if (t.ratio < 1.08) unseen.push({ state, theme, combo: tag, ...t, need }) // not painted at all: covered by a picture, or clipped by its tile; listed, not counted as low contrast
    else if (t.ratio < need && t.disabled) disabled.push({ state, theme, combo: tag, ...t, need }) // WCAG 2 1.4.3 exempts inactive controls: listed, so each is a decision and not a surprise
    else if (t.ratio < need) finds.push({ state, theme, combo: tag, ...t, need })
  }
  if (one('--keep')) { fs.writeFileSync(`${OUT}/c-${state}-${theme}-${tag}.A.png`, Buffer.from(shotA, 'base64')); fs.writeFileSync(`${OUT}/c-${state}-${theme}-${tag}.B.png`, Buffer.from(shotB, 'base64')) }
}

for (const state of PAGES ? [] : one('--states', 'live,idle').split(',')) {
  // 'empty': no paired client and no session (the mock is restarted afterwards to get them back)
  await fetch(`http://127.0.0.1:${HP}/__mock/switches?off=${state === 'off' ? 1 : 0}`).catch(() => {}) // 'off': every boolean setting of the host answered as off (the switches of the tiles in their off state), idle
  if (state === 'empty') await fetch(`http://127.0.0.1:${HP}/__mock/reset`).catch(() => {})
  else await fetch(`http://127.0.0.1:${HP}/__mock/live?on=${state === 'live' ? 1 : 0}`).catch(() => {})
  await fetch(`http://127.0.0.1:${HP}/__mock/measured?on=1`).catch(() => {})
  for (const theme of one('--themes', 'dark,light').split(',')) for (const size of one('--sizes', 's,m,l,xl,strip').split(',')) {
    const IDS = idsFor(size); if (!IDS.length) continue
    const manual = JSON.stringify({ v: 8, order: IDS, overrides: Object.fromEntries(IDS.map((id) => [id, true])), sizes: Object.fromEntries(IDS.map((id) => [id, size])), pins: {}, mode: 'manual' })
    const ctx = await b.newContext({ viewport: { width: 1920, height: 5200 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    await page.addInitScript("window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ || { unregisterListener() {} }")
    await page.addInitScript(`sessionStorage.setItem('foundation.guide.dismissed','1'); localStorage.setItem('foundation-ui.telemetry.consent','off'); localStorage.setItem('language','zh'); localStorage.setItem('foundation-ui.history.panel-home', JSON.stringify({ sessions: [['Xbox Game',6,5400000],['Desktop',0.5,1500000]].map(([app, h, ms]) => ({ start: Date.now() - h * 3600000 - ms, end: Date.now() - h * 3600000, ms, client: 'Moonlight macOS Enhanced', app, bitrate: 98, fps: 118, p95: 6.2, dropped: 2, loss: 0.1 })), days: {} })); localStorage.setItem('foundation-ui.appearance', JSON.stringify({ background: 'solid', mode: '${theme}', dark: 'tinted', overview: 'grid', motion: 'reduced', smartTiles: false })); localStorage.setItem('foundation-ui.dash2.panel-home', ${JSON.stringify(manual)})`)
    await page.goto(`${PANEL}/guide.html?theme=${theme}&route=home&proxy=${HP}`); await page.waitForSelector('.m-dash__cell', { state: 'attached', timeout: 90000 }); await page.waitForTimeout(11000)
    await measure(page, '.m-dash__grid > .m-dash__cell', '-', size, state, theme)
    await ctx.close()
  }
}

for (const theme of PAGES ? one('--themes', 'dark,light').split(',') : []) for (const url of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  await page.addInitScript(`localStorage.setItem('foundation-ui.appearance', JSON.stringify({ background: 'solid', mode: '${theme}', dark: 'tinted', motion: 'reduced' })); localStorage.setItem('language','zh')`)
  await page.goto(url + (url.includes('?') ? '&' : '?') + `theme=${theme}`); await page.waitForTimeout(6000)
  const h = Math.min(16000, await page.evaluate(() => document.documentElement.scrollHeight)); await page.setViewportSize({ width: 1280, height: h }); await page.waitForTimeout(800)
  await measure(page, 'body', new URL(url).pathname.replace(/^\/|\.html$/g, '') || 'index', new URL(url).pathname.replace(/^\/|\.html$/g, '') || 'index', 'page', theme)
  await ctx.close()
}
await b.close()
const by = {}; for (const f of finds) (by[f.id] ||= []).push(f)
console.log(`contrast-fit: ${combos} combinations, ${texts} texts, ${finds.length} below the line in ${Object.keys(by).length} tiles`)
for (const [k, v] of Object.entries(by).sort((p, q) => q[1].length - p[1].length)) {
  const w = v.reduce((m, x) => (x.ratio < m.ratio ? x : m)); console.log(`  ${k}: ${v.length}  worst ${w.ratio}:1 (needs ${w.need}) 「${w.text}」 ${w.theme} ${w.state} ${w.size}  ${[...new Set(v.map((x) => x.text))].slice(0, 4).join(' | ')}  [${w.cls || w.pcls}]`)
}
if (disabled.length) { const u = {}; for (const x of disabled) (u[x.id] ||= new Set()).add(x.text); console.log(`disabled, exempt (WCAG 2 1.4.3), below the line: ${Object.entries(u).map(([k, v]) => `${k}[${[...v].slice(0, 3).join('|')}]`).join(' ')}`) }
if (unseen.length) { const u = {}; for (const x of unseen) (u[x.id] ||= new Set()).add(x.text); console.log(`unseen (in the DOM, not painted): ${Object.entries(u).map(([k, v]) => `${k}[${[...v].slice(0, 3).join('|')}]`).join(' ')}`) }
fs.writeFileSync(`${OUT}/contrast.json`, JSON.stringify(finds, null, 1)); fs.writeFileSync(`${OUT}/unseen.json`, JSON.stringify(unseen, null, 1)); fs.writeFileSync(`${OUT}/disabled.json`, JSON.stringify(disabled, null, 1))
process.exit(finds.length ? 1 : 0)
