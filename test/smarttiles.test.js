// 智能磁贴: two layouts (全屏磁贴模式, 时钟模式) and a switch of its own, on by default, scenario-driven in both
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalize, DEFAULTS } from '../src/appearance/appearance.js'
import { smartPlan, scenarioOf } from '../src/vue/homeSmart.js'
import { appearanceTexts } from '../src/vue/appearanceTexts.js'
import { readDash } from './dashSource.js'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const cards = ['hero', 'pair', 'apps', 'recent-games', 'vdd', 'quick', 'download', 'encoder', 'public-address', 'cpu', 'gpu', 'memory', 'bitrate', 'fps', 'current-app', 'clients-online', 'logs', 'act-diagnostics', 'update', 'journey', 'act-stop'].map((id) => ({ id, available: true, sizes: ['s', 'm', 'l'] }))

test('the switch is on by default, for everyone: a stored appearance without it (the smart grid, the dock) reads as on; the layout is the other setting', () => {
  assert.equal(DEFAULTS.smartTiles, true)
  assert.equal(normalize({}).smartTiles, true)
  assert.equal(normalize({ overview: 'dock' }).smartTiles, true); assert.equal(normalize({ overview: 'dock' }).overview, 'dock')
  assert.equal(normalize({ overview: 'grid', smartTiles: false }).smartTiles, false)
  assert.equal(normalize({ smartTiles: 'no' }).smartTiles, true, 'only a false turns it off')
})

test('the two layouts and the switch have their names; the smart tiles are not a layout any more', () => {
  const zh = appearanceTexts('zh'), en = appearanceTexts('en')
  assert.equal(zh.overviewGrid, '全屏磁贴模式'); assert.equal(zh.overviewDock, '时钟模式'); assert.equal(zh.smartTiles, '智能磁贴')
  assert.equal(en.overviewGrid, 'Full-screen tiles'); assert.equal(en.overviewDock, 'Clock mode')
  assert.ok(zh.smartTilesNote.length < 30 && en.smartTilesNote)
  assert.match(read('src/vue/MAppearance.vue'), /<MSwitchItem :model-value="s\.smartTiles" :title="T\.smartTiles" :text="T\.smartTilesNote"/)
})

test('the scenarios: a problem, a stream, a new host, an update, idle, in that order of priority', () => {
  assert.equal(scenarioOf({ problems: 1, streaming: true, updateAvailable: true }), 'problem')
  assert.equal(scenarioOf({ streaming: true, pairedCount: 0, updateAvailable: true }), 'live')
  assert.equal(scenarioOf({ pairedCount: 0, updateAvailable: true }), 'new')
  assert.equal(scenarioOf({ pairedCount: 2, updateAvailable: true }), 'update')
  assert.equal(scenarioOf({ pairedCount: 2 }), 'idle')
})

test('each scenario brings its tiles forward', () => {
  const rank = (signals, id) => smartPlan({ signals, cards, capacity: 60 }).visible.indexOf(id)
  assert.ok(rank({ pairedCount: 2, streaming: true }, 'bitrate') >= 0 && rank({ pairedCount: 2, streaming: true }, 'bitrate') < rank({ pairedCount: 2 }, 'bitrate') + 99)
  const live = smartPlan({ signals: { pairedCount: 2, streaming: true }, cards, capacity: 60 }).visible
  for (const id of ['bitrate', 'fps', 'current-app', 'clients-online']) assert.ok(live.indexOf(id) >= 0 && live.indexOf(id) < 8, `${id} is among the first of a stream`)
  const problem = smartPlan({ signals: { pairedCount: 2, problems: 2 }, cards, capacity: 60 }).visible
  assert.ok(problem.indexOf('logs') >= 0 && problem.indexOf('logs') < 4 && problem.indexOf('act-diagnostics') >= 0 && problem.indexOf('act-diagnostics') < 5)
  const update = smartPlan({ signals: { pairedCount: 2, updateAvailable: true }, cards, capacity: 60 }).visible
  assert.equal(update.indexOf('update'), 1, 'the update tile stands next to the host card'); assert.ok(!smartPlan({ signals: { pairedCount: 2 }, cards, capacity: 60 }).visible.slice(0, 2).includes('update'))
  const fresh = smartPlan({ signals: { pairedCount: 0 }, cards, capacity: 60 }).visible
  assert.ok(fresh.indexOf('pair') >= 0 && fresh.indexOf('pair') < 4 && fresh.indexOf('download') >= 0 && fresh.indexOf('download') < 6)
})

test('the overview: the switch decides, hysteresis holds a change back, a new plan slides, editing is the own layout', () => {
  const d = readDash()
  assert.match(d, /const smart = computed\(\(\) => appearance\.state\.smartTiles && !edit\.value\)/)
  assert.match(d, /const HYSTERESIS_MS = 3000/); assert.match(d, /hysteresisTimer = setTimeout\(replan, ms\)/)
  assert.match(d, /g\.updateAvailable \? 1 : 0/)
  assert.match(d, /planMoving\.value = true/)
  assert.match(d, /if \(appearance\.state\.smartTiles && layoutKey\(\) !== editSnap\) \{ appearance\.set\(\{ smartTiles: false \}\); return \}/)
  // editing begins from what was on the screen, and leaving it unchanged puts the saved layout back as it was
  assert.match(d, /layout\.freeze\(withFill\(D\.seenPlan && Date\.now\(\) - D\.flushedAt < 1500 \? D\.seenPlan : plan\.value\)\)/)
  assert.match(d, /Object\.assign\(layout\.state, JSON\.parse\(editRaw\)\)/)
  assert.match(d, /const restoreSmart = \(\) => \{ appearance\.set\(\{ smartTiles: true \}\)/)
  assert.doesNotMatch(d, /layout\.state\.mode === 'manual'/, 'the sections follow the switch, not the stored mode')
})

test('while the page starts the plan follows the data at once and does not slide; the hysteresis and the slide are for what happens after', () => {
  const d = readDash()
  assert.match(d, /const STARTUP_MS = 8000/)
  assert.match(d, /if \(Date\.now\(\) - mountedAt < startup\) \{ replan\(false\); return \}/)
  assert.match(d, /const replan = \(animate = true\) => /)
})
