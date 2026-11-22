import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  FIELD_CLASS, SEVERITY_NUMBER, classifyKey, createLogByteDecoder, createRecord, decodeLogBytes, decodeLogLine,
  filterRows, findRecordSessions, findSessions, groupRepeats, parseLog, parseRecords, redactRecords, recordsToRows,
  parsePanelLogs, registerAdapter, prepareBundle, recordsToText,
} from '../src/diagnostics/index.js'

const ascii = (text) => [...text].map((character) => character.charCodeAt(0))
// Real GBK bytes of Chinese system messages (verified with Python's gbk codec):
// "系统找不到指定的文件。" and "无法".
const GBK_FILE_NOT_FOUND = [0xcf, 0xb5, 0xcd, 0xb3, 0xd5, 0xd2, 0xb2, 0xbb, 0xb5, 0xbd, 0xd6, 0xb8, 0xb6, 0xa8, 0xb5, 0xc4, 0xce, 0xc4, 0xbc, 0xfe, 0xa1, 0xa3]
const GBK_CANNOT = [0xce, 0xde, 0xb7, 0xa8]
const gbkLine = Uint8Array.from([...ascii('[2026-11-02 10:00:00.000]: Error: '), ...GBK_FILE_NOT_FOUND])
const gbkOpenLine = Uint8Array.from([...ascii('[2026-11-02 10:00:01.000]: Warning: '), ...GBK_CANNOT])

test('decode: a valid UTF-8 line is kept byte for byte', () => {
  const line = '[2026-11-02 10:00:00.000]: Info: 无法打开文件'
  assert.equal(decodeLogBytes(new TextEncoder().encode(line)), line)
  assert.equal(decodeLogLine(new TextEncoder().encode(line)), line)
})

test('decode: lines from an old GBK log become the original Chinese', () => {
  assert.equal(decodeLogLine(gbkLine), '[2026-11-02 10:00:00.000]: Error: 系统找不到指定的文件。')
  const mixed = new Uint8Array([...new TextEncoder().encode('[2026-11-02 10:00:02.000]: Info: ok'), 0x0a, ...gbkLine, 0x0a, ...gbkOpenLine])
  assert.equal(
    decodeLogBytes(mixed),
    '[2026-11-02 10:00:02.000]: Info: ok\n[2026-11-02 10:00:00.000]: Error: 系统找不到指定的文件。\n[2026-11-02 10:00:01.000]: Warning: 无法',
  )
})

test('decode: BOM and CRLF are stripped or preserved without changing the text', () => {
  const line = '[2026-11-02 10:00:00.000]: Info: 无法\r\n'
  assert.equal(decodeLogBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(line)])), line)
  assert.equal(decodeLogBytes(new Uint8Array(0)), '')
})

test('decode: incremental reads keep a split multibyte sequence', () => {
  const bytes = new TextEncoder().encode('[2026-11-02 10:00:00.000]: Info: 无法\n')
  const split = bytes.indexOf(0xe6) + 1
  const decoder = createLogByteDecoder()
  assert.equal(decoder.push(bytes.subarray(0, split)), '')
  assert.equal(decoder.push(bytes.subarray(split)), '[2026-11-02 10:00:00.000]: Info: 无法\n')
  assert.equal(decoder.push(new TextEncoder().encode('tail'), { final: true }), 'tail')
})

test('records: a host line has every Platform field and a continuation stays in the same body', () => {
  const text = '[2026-11-02 10:00:00.123]: Warning: first line\n continued\n[2026-11-02 10:00:01.000]: Error: second'
  const records = parseRecords(text, { now: 1760000000000 })
  assert.equal(records.length, 2)
  const first = records[0]
  // The host line carries no zone, so it is read in the machine's zone; derive the expectation the same way.
  assert.equal(first.timeUnixNs, String(BigInt(new Date(2026, 10, 2, 10, 0, 0, 123).getTime()) * 1000000n))
  assert.equal(first.observedNs, '1760000000000000000')
  assert.equal(first.severity, SEVERITY_NUMBER.WARN)
  assert.equal(first.severityText, 'Warning')
  assert.equal(first.domain, 'platform')
  assert.equal(first.event, 'host.log.warning')
  assert.deepEqual(first.source, { layer: 'product', id: 'host-text' })
  assert.equal(first.outcome, 'degraded')
  assert.equal(first.attributes['host.level'], 'Warning')
  assert.equal(first.body, 'first line\n continued')
  assert.equal(records[1].severity, SEVERITY_NUMBER.ERROR)
  assert.equal(records[1].errorCode, '')
})

test('records: session and client ids are attributes and select the session view', () => {
  const text = [
    '[2026-11-02 10:00:00.000]: Info: CLIENT CONNECTED',
    '[2026-11-02 10:00:01.000]: Info: client name: Pixel 9',
    '[2026-11-02 10:00:02.000]: Error: failed for [0x80070005]',
    '[2026-11-02 10:00:03.000]: Info: CLIENT DISCONNECTED',
  ].join('\n')
  const records = parseRecords(text)
  const sessions = findRecordSessions(records)
  assert.equal(sessions.length, 1)
  assert.equal(records[2].attributes['session.id'], 0)
  assert.equal(records[1].attributes['client.id'], 'Pixel')
  assert.equal(records[2].attributes['session.client_id'], 'Pixel')
  assert.equal(records[2].errorCode, '0x80070005')
  const rows = recordsToRows(records)
  findSessions(rows)
  assert.equal(rows[2].session, 0)
  assert.equal(filterRows(rows, { session: 0 }).rows.length, 4)
})

test('filters: severity number and domain work on records and on compatibility rows', () => {
  const records = [
    createRecord({ timeUnixNs: '1', severity: 9, domain: 'platform', body: 'one', event: 'host.log.info' }),
    createRecord({ timeUnixNs: '2', severity: 17, domain: 'ux', body: 'two', event: 'ux.dialog.error' }),
    createRecord({ timeUnixNs: '3', severity: 21, domain: 'audit', body: 'three', event: 'audit.policy.deny' }),
  ]
  assert.equal(filterRows(records, { severity: [17, 21] }).rows.length, 2)
  assert.equal(filterRows(records, { domains: ['ux'] }).rows.length, 1)
  assert.equal(filterRows(recordsToRows(records), { severity: [21], domains: ['audit'] }).rows.length, 1)
  assert.equal(filterRows(records, { severity: [17], domains: ['platform'] }).rows.length, 0)
})

test('adapters: the host text adapter is registered and another adapter can be selected later', () => {
  const id = 'test-platform-v1'
  registerAdapter({
    id,
    name: 'test platform adapter',
    parse: () => [createRecord({ severity: 9, domain: 'audit', body: 'from another dialect', event: 'audit.store.open' })],
  })
  const records = parseRecords('', { adapter: id })
  assert.deepEqual([records.length, records[0].domain, records[0].body], [1, 'audit', 'from another dialect'])
  assert.equal(parseRecords('', { adapter: 'missing-adapter' }).length, 0)
})

test('redaction: classes from the diagnostics document decide what leaves', () => {
  assert.equal(classifyKey('peer.id'), FIELD_CLASS.SENSITIVE)
  assert.equal(classifyKey('session.id'), FIELD_CLASS.SENSITIVE)
  assert.equal(classifyKey('api.token'), FIELD_CLASS.SECRET)
  assert.equal(classifyKey('host.level'), FIELD_CLASS.PUBLIC)
  assert.equal(classifyKey('duration_ms'), FIELD_CLASS.PUBLIC)
  assert.equal(classifyKey('nobody_classified_this'), FIELD_CLASS.SENSITIVE)
  const record = createRecord({
    severity: 17,
    body: 'from 192.168.1.9 password=abc',
    attributes: { 'session.id': 7, 'api.token': 'abc', 'host.level': 'Error' },
  })
  const red = redactRecords([record], { network: true, salt: [1, 2] })
  assert.equal(red.records[0].attributes['api.token'], undefined)
  assert.match(red.records[0].attributes['session.id'], /^h:[0-9a-f]{16}$/)
  assert.equal(red.records[0].attributes['host.level'], 'Error')
  assert.doesNotMatch(red.records[0].body, /192\.168|abc/)
  assert.ok(red.counts.secrets >= 2)
  const open = redactRecords([record], { network: false, salt: [1, 2] })
  assert.equal(open.records[0].attributes['session.id'], 7)
  assert.equal(open.records[0].attributes['api.token'], undefined)
})

test('bundle: the log part is built from records, redacted by class, and keeps its Chinese', () => {
  const records = parseRecords([
    '[2026-11-02 10:00:00.000]: Info: 无法打开文件',
    '[2026-11-02 10:00:01.000]: Error: client name: Pixel, password=abc, 10.0.0.7',
  ].join('\n'))
  const entries = prepareBundle({ records }, { network: true })
  const log = entries.find((entry) => entry.id === 'log')
  assert.equal(log.available, true)
  assert.match(log.text, /无法打开文件/)
  assert.doesNotMatch(log.text, /password=abc|10\.0\.0\.7/)
  assert.ok(log.counts.secrets >= 1)
  assert.equal(recordsToText(records).split('\n').length, 2)
})

test('samples: a real host log parses with levels, times and domains', () => {
  const bytes = readFileSync(new URL('./fixtures/host-log-2026-11-02.log', import.meta.url))
  const text = decodeLogBytes(new Uint8Array(bytes))
  const records = parseRecords(text)
  assert.ok(records.length >= 10)
  assert.ok(records.every((record) => record.domain === 'platform'))
  assert.ok(records.some((record) => record.severity === SEVERITY_NUMBER.INFO))
  assert.ok(records.some((record) => record.body.includes('Windows 11 Pro')))
})

test('repeats: identical consecutive records stay separate in the model and group in the view', () => {
  const text = '[2026-11-02 10:00:00.000]: Info: same\n[2026-11-02 10:00:01.000]: Info: same'
  const records = parseRecords(text)
  assert.equal(records.filter((record) => record.body === 'same').length, 2)
  const items = groupRepeats(parseLog(text))
  assert.deepEqual([items.length, items[0].count], [1, 2])
})

test('panel logs: the panel entry fields become the same records with a panel source', () => {
  const records = parsePanelLogs([
    {
      source: 'panel',
      timestamp: '2026-11-02 10:00:00.123',
      level: 'error',
      message: '系统找不到指定的文件。',
      target: 'sunshine_gui::logger',
      file: 'logger.rs',
      line: 42,
    },
    { timestamp: 'not a time', level: 'unknown', message: 'plain' },
  ], { now: 1760000000000 })
  assert.equal(records.length, 2)
  assert.equal(records[0].severity, SEVERITY_NUMBER.ERROR)
  assert.equal(records[0].domain, 'ux')
  assert.equal(records[0].event, 'panel.log.error')
  assert.deepEqual(records[0].source, { layer: 'product', id: 'panel' })
  assert.equal(records[0].attributes['panel.target'], 'sunshine_gui::logger')
  assert.equal(records[0].attributes['panel.file'], 'logger.rs')
  assert.equal(records[0].attributes['panel.line'], 42)
  assert.equal(records[0].body, '系统找不到指定的文件。')
  assert.equal(records[1].severity, 0)
  assert.equal(records[1].event, 'panel.log.message')
})

test('sources: host and panel records are filterable and the panel JSON adapter reads an export', () => {
  const host = parseRecords('[2026-11-02 10:00:00.000]: Info: host line')
  const panel = parsePanelLogs([{ timestamp: '2026-11-02 10:00:01.000', level: 'warn', message: 'panel line' }])
  const all = [...host, ...panel]
  assert.equal(filterRows(all, { sources: ['panel'] }).rows.length, 1)
  assert.equal(filterRows(all, { sources: ['host-text'] }).rows.length, 1)
  const json = parseRecords(JSON.stringify([{ timestamp: '2026-11-02 10:00:02.000', level: 'info', message: 'from json' }]), { adapter: 'panel-json' })
  assert.equal(json.length, 1)
  assert.equal(json[0].source.id, 'panel')
})

test('bundle: the panel part is added only for the panel and is redacted by record class', () => {
  const panelRecords = [{ timestamp: '2026-11-02 10:00:00.000', level: 'error', message: 'password=abc from 10.0.0.7' }]
  const without = prepareBundle({ log: '[2026-11-02 10:00:00.000]: Info: host' })
  assert.equal(without.some((entry) => entry.id === 'panel'), false)
  const withPanel = prepareBundle({ log: '[2026-11-02 10:00:00.000]: Info: host', panelRecords }, { panel: true })
  const part = withPanel.find((entry) => entry.id === 'panel')
  assert.equal(part.available, true)
  assert.match(part.text, /panel\.log|password|10\.0\.0\.7/)
  assert.doesNotMatch(part.text, /password=abc|10\.0\.0\.7/)
})
