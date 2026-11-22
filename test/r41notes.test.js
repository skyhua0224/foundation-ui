import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildCatalogue } from '../src/vue/homeCatalogue.js'
import { homeTexts } from '../src/vue/homeModel.js'
import { padApplies } from '../src/vue/homeCards.js'
import { b3Texts } from '../src/vue/tiles/b3Texts.js'
import { createHistory } from '../src/vue/homeHistory.js'

// when a setting applies (the audit of the host source): a save restarts nothing and does not call apply_config, so the default is restart;
// fps, max_bitrate (and the resolutions and codecs) are the client's to decide, the host value changes at the start; gamepad is the next virtual controller on Windows only
const read = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')
const T = { ...homeTexts('zh'), __locale: 'zh' }
const mem = () => createHistory({ getItem: () => null, setItem() {} }, 't')
const cat = (config) => buildCatalogue({ config: { sunshine_name: 'Host', max_bitrate: 0, fps: '[30,60]', ...config }, now: 0, history: mem() }, T).data

test('the words: 重启后生效 for what is read at the start, 由客户端决定 for what the client chooses', () => {
  assert.equal(b3Texts({ __locale: 'zh' }).restartNote, '重启后生效')
  assert.equal(b3Texts({ __locale: 'zh' }).clientNote, '由客户端决定 · 重启后生效')
  assert.equal(b3Texts({ __locale: 'en' }).clientNote, 'Set by the client · after a restart')
  assert.equal(T.clientNote, '由客户端决定 · 重启后生效')
})

test('手柄类型: the next virtual controller on a Windows host, after a restart on Linux, macOS and when the platform is not known', () => {
  assert.equal(padApplies(cat({ platform: 'windows' })), 'next')
  assert.equal(padApplies(cat({ platform: 'linux' })), 'restart')
  assert.equal(padApplies(cat({ platform: 'macos' })), 'restart')
  assert.equal(padApplies(cat({})), 'restart')
  assert.equal(padApplies({}), 'restart')
})

test('the tiles carry the note of their class', () => {
  // 码率上限: the client decides, the cap after a restart
  assert.equal(cat({ platform: 'windows' })['ctl-bitrate'].note, T.clientNote)
  assert.equal(cat({ platform: 'windows' })['ctl-encoder'].note, T.restartNote)
  const toggle = read('vue/tiles/TileToggleB3.vue')
  assert.match(toggle, /<small class="m-b3a__note">\{\{ d\.runtime \? L\.liveNote : L\.restartNote \}\}<\/small>/, '手柄输入, 键盘输入, 鼠标输入, 显示光标, 串流音频: read at the start; 主机音频 acts on the running stream')
  const setting = read('vue/tiles/TileSettingB3.vue')
  assert.match(setting, /id\.value === 'ctl-encoder' \? L\.value\.restartNote : id\.value === 'ctl-fps' \|\| id\.value === 'ctl-bitrate' \? L\.value\.clientNote : ''/, '编码器, 码率上限 and 帧率预设 on the strip')
  assert.match(setting, /\{\{ L\.restartNote \}\}<\/span>\n    <\/div><\/div>\n    <MPickSheet v-if="encChoices\.more"/, '编码器 at 方形')
  const devices = read('vue/tiles/TileDevices.vue')
  assert.match(devices, /padNote = computed\(\(\) => padNoteOf\(d\.value, L\.value\)\)/, 'the live note of the strip comes first, then the applies note')
  assert.match(devices, /\{\{ \[d\.sub, L\.restartNote\]\.filter\(Boolean\)\.join\(' · '\) \}\}/, '麦克风开关 on the strip')
  assert.match(devices, /class="m-b2__cap m-b2mic__note">\{\{ L\.restartNote \}\}/, '麦克风开关 at 方形')
  assert.match(devices, /<small>\{\{ padNote \}\}<\/small>/, '手柄类型 on the strip')
})

test('the gamepad note is not the Windows one anywhere but on Windows', () => {
  const devices = read('vue/tiles/TileDevices.vue')
  assert.doesNotMatch(devices, /\{\{ L\.padNote \}\}/, 'no tile prints the Windows wording unconditionally')
  assert.match(read('vue/homeCards.js'), /applies: padApplies\(ctx\.catalogue \|\| \{\}\)/)
})
