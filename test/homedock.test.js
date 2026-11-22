import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { appearanceTexts } from '../src/vue/appearanceTexts.js'
import { EDIT_TEXTS } from '../src/vue/homeEditTexts.js'
import { readDash } from './dashSource.js'

const source = readDash()

test('the dock lays the tiles as the grid\'s standard squares, wrapped into its columns (never a row that scrolls), and editing shows the grid', () => {
  assert.match(source, /const dockOn = computed\(\(\) => dockLayout\.value && !edit\.value\)/)
  assert.match(source, /class="m-dock__grid"/)
  assert.ok(!/m-dock__row|m-dock__more|dockScroll|DOCK_TILE/.test(source), 'no scrolling row, no arrows, no tile size of its own')
  // the columns and the unit are the grid's (columnsOf at the pane's width): one unit square for every tile
  assert.match(source, /const dockGrid = computed\(\(\) => gridOf\(width\.value\)\)/)
  assert.match(source, /gridTemplateColumns: `repeat\(\$\{g\.columns\}, \$\{g\.unit\}px\)`, gridAutoRows: `\$\{g\.unit\}px`/)
  // only small tiles: every tile is S in the dock whatever its size in the smart layout, and the chooser offers S only (edit mode and the picker too)
  assert.match(source, /const dockBox = \(c, u\) => \(\{ \.\.\.c, \.\.\.boxIn\(c, 's', u\), size: 's', sizeKey: 's', sizeKeys: \['s'\]/)
  assert.match(source, /if \(dockLayout\.value\) return dockBox\(c, u\)/)
  assert.match(source, /const sheetBox = \(card\) => \{[^\n]*if \(dockLayout\.value\) return dockBox\(c, units\.value\)/)
  // a switch beside the smart layout in the edit sheet
  assert.match(source, /setOverview\('dock'\)/)
})

test('the dock and its switch have words in both languages', () => {
  for (const lang of ['en', 'zh']) {
    for (const key of ['overviewGrid', 'overviewDock', 'dockStreaming', 'dockIdle', 'dockPaired']) assert.ok(EDIT_TEXTS[lang][key], `${lang} ${key}`)
    for (const key of ['overview', 'overviewGrid', 'overviewDock']) assert.ok(appearanceTexts(lang)[key], `${lang} ${key}`)
  }
  assert.equal(appearanceTexts('zh').overviewDock, '时钟模式')
})

test('the dock keeps its clock: the head takes what is left above one row of tiles (measured), and the last row is completed from the catalogue', () => {
  assert.match(source, /const measureDockHead = \(\) => \{/)
  assert.match(source, /:style="dockHeadMin \? \{ minHeight: `\$\{dockHeadMin\}px` \} : undefined"/)
  assert.match(source, /const need = missingInRow\(list\.length, dockGrid\.value\.columns\)/)
  assert.match(source, /fillCards\.value\.slice\(0, need\)/)
  // a short window gives the clock block up to 84 px so that a whole row stays on the first screen, and the card that asks for a star goes under the tiles
  assert.match(source, /H < 480/)
  const css = readFileSync(new URL('../src/css/clock.css', import.meta.url), 'utf8')
  assert.match(css, /\.m-dash:has\(> \.m-dock\) > \.m-sprompt \{ order: 2; \}/)
})

test('in the dock a short window takes the smaller density so that a whole row of tiles stays on the first screen', () => {
  assert.match(source, /return d === 'standard' && tall\.value < 480 && appearance\.state\.overview === 'dock' \? 'smaller' : d/)
})
