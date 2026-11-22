// The secondary text colour (on-surface-variant: captions, units, labels, the small words of a tile) is guarded by the theme: on every surface of every colour style it is SECONDARY_MIN : 1.
// The tiles' text rules are held to the same by the layout gate (contrast-fit.mjs), which measures the rendered words; this test is the part of it that does not need a browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { schemeColors, COLOR_STYLES, DEFAULT_VARIANTS, BRAND_SEEDS, SECONDARY_MIN } from '../src/tokens/theme.js'
import { argbFromHex } from '@material/material-color-utilities'

const lum = (hex) => { const n = argbFromHex(hex); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const SURFACES = ['surface', 'surfaceDim', 'surfaceBright', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest', 'surfaceVariant']
const SEEDS = [BRAND_SEEDS.light, BRAND_SEEDS.dark, '#d93025', '#f9ab00', '#188038', '#8e24aa', '#00796b', '#ff6d00', '#3949ab']

test('on-surface-variant holds SECONDARY_MIN : 1 on every surface, in every colour style, variant and seed, light and dark', () => {
  for (const seed of SEEDS) for (const style of COLOR_STYLES) for (const dark of [false, true]) for (const variant of ['tonalSpot', DEFAULT_VARIANTS[dark ? 'dark' : 'light']]) for (const black of dark ? [false, true] : [false]) {
    const c = schemeColors(seed, { dark, variant, style, black })
    for (const s of SURFACES) assert.ok(ratio(c.onSurfaceVariant, c[s]) >= SECONDARY_MIN - 0.02, `${seed} ${style} ${variant} ${dark ? 'dark' : 'light'}${black ? ' black' : ''}: on-surface-variant on ${s} is ${ratio(c.onSurfaceVariant, c[s]).toFixed(2)}`)
  }
})

test('tokens.css carries the guarded secondary colour of the default schemes', () => {
  const css = read('src/tokens/tokens.css')
  for (const [seed, dark] of [[BRAND_SEEDS.light, false], [BRAND_SEEDS.dark, true]]) {
    const c = schemeColors(seed, { dark, variant: DEFAULT_VARIANTS[dark ? 'dark' : 'light'] })
    assert.ok(css.includes(`--md-sys-color-on-surface-variant: ${c.onSurfaceVariant};`), `${dark ? 'dark' : 'light'} ${c.onSurfaceVariant}`)
  }
})

test('the words of a tile are never see-through: no opacity under 1 or alpha mix on a tile text role, the roles are defined once', () => {
  const kit = read('src/css/tilekit.css'), text = read('src/css/tiles-text.css')
  assert.match(kit, /--tile-text-2: color-mix\(in srgb, var\(--md-sys-color-on-surface-variant\) 30%, var\(--md-sys-color-on-surface\)\)/)
  assert.match(kit, /\.m-tile--tonal \{[^}]*--tile-text-2: color-mix\(in srgb, var\(--on-tk-c\) 90%, var\(--tk-c\)\)/)
  assert.match(kit, /--tile-err-text:/)
  assert.match(read('src/css/all.css'), /@import '\.\/tiles-text\.css';/)
  assert.match(text, /--tile-deco-ink/)
  for (const f of ['tilekit', 'tiles-b2', 'tiles-b3', 'tiles-cal', 'tiles-metrics', 'tiles-prerelease', 'tiles-recent']) {
    assert.doesNotMatch(read(`src/css/${f}.css`), /(?<![-\w])color: color-mix\(in srgb, var\(--on-tk-c\) \d+%, transparent\)/, `${f}: a tonal tile's text colour is the opaque role`)
  }
})

test('no small word of the kit is see-through: a caption, note, hint, unit or sub-line carries its colour at full strength', () => {
  const dir = new URL('../src/css/', import.meta.url)
  const bad = []
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.css'))) {
    const css = fs.readFileSync(new URL(f, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim(), body = m[2]
      if (!/opacity:\s*0?\.[3-9]\d*/.test(body) || /transition|animation/.test(sel)) continue
      if (/disabled|is-off|is-busy|is-dragging|:hover|:active|::|\[disabled\]|__mark|__stand|__decor|__dot|ghost|\bpath\b|\.m-icon|\bsvg\b|stylehero|shot__bar|route__link|ctl__cap/.test(sel)) continue
      if (/(?:^|[\s>+~])(?:small|dt|em|i)\s*$|__(?:sub|foot|desc|note|meta|hint|cap|unit|caption|label)\s*$/.test(sel.split(',').pop().trim())) bad.push(`${f}: ${sel.slice(0, 80)}`)
    }
  }
  assert.deepEqual(bad, [], `see-through text: ${bad.join('; ')}`)
})
