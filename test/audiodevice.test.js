import test from 'node:test'
import assert from 'node:assert/strict'
import { audioDeviceName, looksLikeEndpointId } from '../src/settings/audioDevice.js'
import { rowLine, rowLines } from '../src/settings/rowLines.js'

const CABLE_ID = '{0.0.0.00000000}.{172f61d5-5aff-4b19-9233-e02c0003996f}'
const STEAM_ID = '{0.0.0.00000000}.{32805c76-6b36-4e36-9c06-833720385d20}'
const DEVICES = [
  { id: STEAM_ID, name: '扬声器 (Steam Streaming Speakers)', description: '扬声器', adapter: 'Steam Streaming Speakers' },
  { id: CABLE_ID, name: 'CABLE Input (VB-Audio Virtual Cable)', description: 'CABLE Input', adapter: 'VB-Audio Virtual Cable' },
]

test('an endpoint id is told from a device name in any language', () => {
  assert.equal(looksLikeEndpointId(CABLE_ID), true)
  assert.equal(looksLikeEndpointId(` ${STEAM_ID.toUpperCase()} `), true)
  for (const name of ['CABLE Input (VB-Audio Virtual Cable)', '扬声器 (Steam Streaming Speakers)', '耳机 (USB Audio)', 'ϵͳ', '', null, undefined, '{0.0.0.00000000}', '{speakers}']) assert.equal(looksLikeEndpointId(name), false, String(name))
})

test('the device is shown by its name: found by id, name, description or adapter like the host does', () => {
  assert.equal(audioDeviceName(CABLE_ID, DEVICES, 'Selected device'), 'CABLE Input (VB-Audio Virtual Cable)')
  assert.equal(audioDeviceName(STEAM_ID, DEVICES, 'Selected device'), '扬声器 (Steam Streaming Speakers)')
  assert.equal(audioDeviceName('cable input', DEVICES, 'Selected device'), 'CABLE Input (VB-Audio Virtual Cable)')
  assert.equal(audioDeviceName('Steam Streaming Speakers', DEVICES, 'Selected device'), '扬声器 (Steam Streaming Speakers)')
})

test('an id nothing matches is never shown: the stand-in words are, whether the list is missing or only lacks the device', () => {
  const lost = '{0.0.0.00000000}.{6f1a52f6-2c0d-4dd0-a2a0-0c3f7e9b8a11}'
  assert.equal(audioDeviceName(lost, DEVICES, '所选设备'), '所选设备')
  assert.equal(audioDeviceName(CABLE_ID, null, '所选设备'), '所选设备')
  assert.equal(audioDeviceName(CABLE_ID, undefined, '所选设备'), '所选设备')
  assert.equal(audioDeviceName(CABLE_ID, [], '所选设备'), '所选设备')
})

test('a name someone typed stays as typed, an empty value stays empty', () => {
  assert.equal(audioDeviceName('耳机 (USB Audio)', DEVICES, '所选设备'), '耳机 (USB Audio)')
  assert.equal(audioDeviceName('', DEVICES, '所选设备'), '')
  assert.equal(audioDeviceName(undefined, DEVICES, '所选设备'), '')
  // GBK 系统 read as UTF-8 is Greek: still a name
  assert.equal(audioDeviceName('ϵͳ', DEVICES, '所选设备'), 'ϵͳ')
})

test('the audio row of the settings list names the chosen device and never prints its id', () => {
  const config = { stream_audio: 'enabled', audio_sink: CABLE_ID }
  assert.equal(rowLine('audio-output', { config, audio: DEVICES }, 'zh'), '音频串流 开 · CABLE Input (VB-Audio Virtual Cable)')
  assert.equal(rowLine('audio-output', { config, audio: DEVICES }, 'en'), 'Audio streaming on · CABLE Input (VB-Audio Virtual Cable)')
  for (const locale of ['zh', 'en']) {
    // no list of devices (the Panel before it loads one): the words stand in, the id is gone
    const line = rowLine('audio-output', { config }, locale)
    assert.ok(!line.includes('{0.0.0.00000000}'), line)
    assert.match(line, locale === 'zh' ? /所选设备/ : /Selected device/)
    assert.ok(!rowLines({ locale, config })['audio-output'].includes('172f61d5'))
  }
  // automatic and a typed name are untouched
  assert.equal(rowLine('audio-output', { config: { stream_audio: 'enabled', audio_sink: '' } }, 'zh'), '音频串流 开')
  assert.equal(rowLine('audio-output', { config: { stream_audio: 'disabled', audio_sink: '耳机 (USB Audio)' } }, 'zh'), '音频串流 关 · 耳机 (USB Audio)')
})
