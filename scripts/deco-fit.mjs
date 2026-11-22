// Layout gate: no decoration over a word, no broken title, on every tile of the overview.
//   node scripts/deco-fit.mjs --panel URL --host-port N [--raw-host N] [--ui DIR] [--widths 1280,1440] [--themes dark,light] [--states idle,live] [--modes smart,manual-s,manual-m,manual-l,manual-xl] [--out file.json]
// --panel is a Panel dev server over a host mock that answers /__mock/live?on= (the harness of the overview gates, as for scripts/contrast-fit.mjs); --ui is the foundation-ui tree it serves (default: this repo).
// Kinds, per tile, read from the rendered page (reduced motion, so nothing is measured mid-transition):
//   deco-over-text  the box of a background decoration (`.m-tile__corner`, an image that bleeds off the tile) meets the box of a word of its tile (more than 12 px²; the line box is taken 20 % smaller top and bottom, the ink
//                   of a line is inside it). Charts (`.m-tchart`) are layers of their own and are checked by the tile-fit gate.
//   title-wrap      a title breaks into three lines, or leaves a line narrower than 2.4 em (one character, 「配对 / 客户」)
//   narrow-lines    the same for any other line of CJK text of three characters or more
// Exit 1 on any finding. One browser, from the shared launcher when QA_ENV is set (a module that exports chromium), else playwright-core (PW_REQUIRE_FROM names a directory with node_modules).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const { chromium } = process.env.QA_ENV ? await import(process.env.QA_ENV) : createRequire(process.env.PW_REQUIRE_FROM ? path.join(process.env.PW_REQUIRE_FROM, 'x.js') : import.meta.url)('playwright-core')
const args = process.argv.slice(2)
const one = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const PANEL = one('--panel'), HP = one('--host-port'), RAWHP = one('--raw-host', HP)
if (!PANEL || !HP) { console.error('usage: node scripts/deco-fit.mjs --panel URL --host-port N [--raw-host N] ...'); process.exit(2) }
const UI = one('--ui', path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'))
const WIDTHS = one('--widths', '1280,1440').split(',').map(Number), THEMES = one('--themes', 'dark,light').split(','), STATES = one('--states', 'idle,live').split(',')
const MODES = one('--modes', 'smart,manual-s,manual-m,manual-l,manual-xl').split(','), OUT = one('--out', '')
const HEIGHT_OF = (w) => (w < 1300 ? 800 : w < 1700 ? 900 : 1080)
const IDS = JSON.parse(execFileSync(process.execPath, ['--import', './scripts/register.mjs', '--import', './scripts/no-network.mjs', '-e', "import('./src/vue/homeCards.js').then((c) => console.log(JSON.stringify(c.DEFAULT_ORDER)))"], { cwd: UI, encoding: 'utf8' }).trim().split('\n').pop())
const manualOf = (k) => JSON.stringify({ v: 8, order: IDS, overrides: Object.fromEntries(IDS.map((id) => [id, true])), sizes: Object.fromEntries(IDS.map((id) => [id, k])), pins: {}, mode: 'manual' })

/** In the page: the faults of every tile. */
function read() {
  const out = []
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  for (const cell of document.querySelectorAll('.m-dash__cell')) {
    const tile = cell.querySelector(':scope > .m-dash__body > *') || cell
    const tr = tile.getBoundingClientRect(); if (!tr.width || !tr.height) continue
    const id = cell.dataset.card || (cell.dataset.ctx || '').replace(/^tile:/, '')
    const size = cell.dataset.size || tile.dataset.size || ''
    const decos = [...tile.querySelectorAll('.m-tile__corner, img[data-bleed], [data-tile-art]')].filter((e) => !e.closest('.m-tile__cover, .m-tchart'))
    const texts = []
    const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      if (!n.data.trim() || el.closest('svg, .m-visually-hidden, .m-icon, [aria-hidden="true"], .m-tile__corner')) continue
      let hidden = false
      for (let a = el; a && a !== tile.parentElement; a = a.parentElement) { const s = getComputedStyle(a); if (+s.opacity === 0 || s.display === 'none' || s.visibility === 'hidden') { hidden = true; break } }
      if (hidden) continue
      const range = document.createRange(); range.selectNodeContents(n)
      const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1); if (!rects.length) continue
      texts.push({ label: n.data.trim().slice(0, 24), el, rects })
    }
    for (const d of decos) {
      const dr = d.getBoundingClientRect(); if (!dr.width) continue
      const vis = { left: Math.max(dr.left, tr.left), right: Math.min(dr.right, tr.right), top: Math.max(dr.top, tr.top), bottom: Math.min(dr.bottom, tr.bottom) }
      if (vis.right <= vis.left || vis.bottom <= vis.top) continue
      for (const t of texts) for (const r of t.rects) { const a = inter(vis, { left: r.left, right: r.right, top: r.top + (r.bottom - r.top) * 0.2, bottom: r.bottom - (r.bottom - r.top) * 0.2 }); if (a > 12) { out.push({ id, size, kind: 'deco-over-text', text: t.label, area: Math.round(a) }); break } }
    }
    for (const t of texts) {
      const cls = String(t.el.className?.baseVal ?? t.el.className)
      const parentCls = String(t.el.parentElement?.className?.baseVal ?? t.el.parentElement?.className ?? '')
      const isTitle = /title|__head|thead|__text/.test(cls) || /__text/.test(parentCls) || t.el.closest('header')
      const rows = new Map(); for (const r of t.rects) { const k = Math.round(r.top / 4); rows.set(k, (rows.get(k) || 0) + r.width) }
      const lines = rows.size, fs = parseFloat(getComputedStyle(t.el).fontSize) || 14, minW = Math.min(...rows.values())
      const orphan = lines >= 2 && minW < 2.4 * fs && t.label.replace(/\s/g, '').length >= 3
      if (isTitle && !/peak|value|num/.test(cls) && (lines >= 3 || orphan)) out.push({ id, size, kind: 'title-wrap', text: t.label, lines })
      else if (orphan && /[一-鿿]/.test(t.label)) out.push({ id, size, kind: 'narrow-lines', text: t.label, lines })
    }
  }
  return out
}

const mock = async (path) => { const r = await fetch(`${new URL(PANEL).protocol}//${new URL(PANEL).hostname}:${RAWHP}${path}`); if (!r.ok) throw new Error(`the host mock answered ${r.status} to ${path}`) }
await mock('/__mock/measured?on=1')
const b = await chromium.launch({ args: ['--no-sandbox'] })
const findings = []
try {
  for (const w of WIDTHS) for (const theme of THEMES) for (const state of STATES) for (const mode of MODES) {
    await mock(`/__mock/live?on=${state === 'live' ? 1 : 0}`)
    const ctx = await b.newContext({ viewport: { width: w, height: HEIGHT_OF(w) }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.addInitScript('window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ || { unregisterListener() {} }')
    await page.addInitScript(`sessionStorage.setItem('foundation.guide.dismissed','1'); localStorage.setItem('foundation-ui.telemetry.consent','off'); localStorage.setItem('language','zh'); localStorage.setItem('foundation-ui.appearance', JSON.stringify({ background: 'solid', mode: '${theme}', dark: 'tinted', overview: 'grid', motion: 'reduced', smartTiles: ${mode === 'smart'} }))${mode === 'smart' ? '' : `; localStorage.setItem('foundation-ui.dash2.panel-home', ${JSON.stringify(manualOf(mode.split('-')[1]))})`}`)
    await page.goto(`${PANEL}/guide.html?theme=${theme}&route=home&proxy=${HP}`)
    await page.waitForSelector('.m-dash__cell', { state: 'attached', timeout: 30000 })
    await page.waitForTimeout(state === 'live' ? 4500 : 2800)
    for (const f of await page.evaluate(read)) findings.push({ w, theme, state, mode, ...f })
    await ctx.close()
  }
} finally { await b.close() }
const key = (f) => `${f.kind} ${f.id} ${f.size} "${f.text}"`
const uniq = new Map(); for (const f of findings) { const k = key(f); if (!uniq.has(k)) uniq.set(k, { ...f, n: 0 }); uniq.get(k).n++ }
if (OUT) fs.writeFileSync(OUT, JSON.stringify(findings))
for (const [k, f] of [...uniq].sort()) console.log(`${k}  x${f.n}`)
console.log(`deco-fit: ${findings.length} findings, ${uniq.size} distinct`)
process.exit(findings.length ? 1 : 0)
