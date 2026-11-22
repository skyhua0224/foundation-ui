import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SHEET_TYPES, userReportDocument } from '../src/devmode/userReport.js'
import { reportToEvent } from '../src/telemetry/index.js'
import { devmodeTexts } from '../src/devmode/texts.js'
import { DEVMODE_LOCALES } from '../src/devmode/locales.js'
import { errorTexts } from '../src/vue/errorTexts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const error = { name: 'TypeError', message: 'x is undefined at C:\\Users\\Eve\\a.js', code: 'type-error', page: 'Display Modes', stack: 'TypeError: x\n    at a (https://h/a.js:1:2)' }

test('the four types of the sheet are the four categories: 问题/崩溃 bug, 功能建议 suggestion, 体验改进 performance, 其他 other', () => {
  assert.deepEqual(SHEET_TYPES, ['bug', 'suggestion', 'performance', 'other'])
  const zh = devmodeTexts('zh')
  assert.deepEqual([zh.typeBug, zh.typeSuggestion, zh.typeImprove, zh.typeOther], ['问题/崩溃', '功能建议', '体验改进', '其他'])
  for (const type of SHEET_TYPES) assert.equal(reportToEvent(userReportDocument({ title: 't', description: 'd', type })).props.category, type)
  assert.equal(reportToEvent(userReportDocument({ title: 't', description: 'd', type: 'nonsense' })).props.category, 'other', 'feedback without a type')
  assert.equal(reportToEvent(userReportDocument({ error, title: 't', description: 'd', type: '' })).props.category, 'bug', 'an error is a bug unless the person says otherwise')
})

test('the document of an error: component, page and code as tokens, the error summarised in the message, nothing typed leaks', () => {
  const event = reportToEvent(userReportDocument({ error, title: 'It broke', description: 'when I pressed save', type: 'bug', product: 'panel' }))
  assert.equal(event.kind, 'error'); assert.equal(event.name, 'user_report')
  assert.deepEqual([event.props.component, event.props.page, event.props.error_code], ['panel', 'display-modes', 'ui.type-error'])
  assert.match(event.props.message, /^It broke\n\nwhen I pressed save\n\nError: TypeError: x is undefined/)
  assert.ok(!/Eve/.test(event.props.message) && event.props.message.length <= 2000)
  assert.equal(userReportDocument({ title: '', description: 'd' }), null, 'the title and the description are required')
})

test('every language has the words of the type choice and of the two ways out, and none of them names GitHub or a public issue', () => {
  const keys = ['typeLabel', 'typeBug', 'typeSuggestion', 'typeImprove', 'typeOther', 'destOurs', 'destOursSub', 'destSaveZip', 'destSaveZipSub', 'sendSaveZip', 'sentOurs', 'sentLocal2', 'savedTitle', 'errorsOff', 'attachLocalOnly']
  const locales = ['en', 'zh', ...Object.keys(DEVMODE_LOCALES)]
  assert.ok(locales.length >= 18)
  for (const l of locales) {
    const t = devmodeTexts(l)
    for (const k of keys) { assert.ok(t[k], `${l}.${k}`); assert.ok(!/github/i.test(t[k]), `${l}.${k} names GitHub`) }
    if (l !== 'en') for (const k of ['typeBug', 'destOurs']) if (l !== 'zh') assert.notEqual(t[k], devmodeTexts('en')[k], `${l}.${k} is translated`)
  }
})

test('the error dialog and the diagnostics page have no way to a public repository, in any language', () => {
  for (const f of ['src/vue/MErrorHost.vue', 'src/vue/MDiagnostics.vue']) assert.doesNotMatch(read(f), /issueUrl|crashIssueUrl|reportIssueUrl|newIssueUrl|issues\/new|T\.issue\b/, f)
  // the panel has one quiet link to the plain new-issue page: nothing the person wrote or any report content is put into the address
  const panel = read('src/vue/feedback/MFeedbackPanel.vue')
  assert.match(panel, /REPO_ISSUES_URL/); assert.doesNotMatch(panel, /issueUrl\(|searchParams|reportIssueUrl|newIssueUrl/)
  for (const l of ['en', 'zh', 'de', 'fr', 'es', 'it', 'ja', 'ko', 'ru', 'pt', 'pt_BR', 'pl', 'cs', 'sv', 'tr', 'uk', 'bg', 'zh_TW', 'en_GB']) {
    const t = errorTexts(l)
    for (const k of ['queued', 'rejected', 'limited', 'queuedOffline', 'queuedHeld', 'stopNoServer', 'stopSave', 'stopSentFail', 'whatSentLead']) assert.ok(!/github/i.test(t[k]), `${l}.${k}`)
    assert.ok(!('issue' in t), `${l}: the open-an-issue button has no words left`)
  }
})
