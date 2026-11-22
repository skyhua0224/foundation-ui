import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DRAWER_MIN_WIDTH, contextLine, feedbackPlan, layoutFor, phaseOf, titleOf } from '../src/feedback/model.js'
import { FEEDBACK_LOCALES, feedbackTexts, fillText } from '../src/feedback/texts.js'
import { CONTACT_MAX, buildReport, cleanContact, reportToDocument, reportToEvent } from '../src/telemetry/index.js'
import { enqueue, flushQueueAuto, loadQueue, resetAutoFlush, submitReport } from '../src/telemetry/send.js'
import { userReportDocument } from '../src/devmode/userReport.js'
import { buildGroups } from '../src/contextmenu/builders.js'
import { contextTexts } from '../src/contextmenu/texts.js'
import { devReport, openFeedbackHere, currentPageName, closeDevReport, askDevReport, clearDevReportAsk, registerDevReport } from '../src/vue/devmode/devReport.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const memory = () => { const data = new Map(); return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)) }, removeItem: (k) => { data.delete(k) } } }

test('the panel is a drawer in a window of 720 px and wider and a bottom panel in a narrower one', () => {
  assert.equal(DRAWER_MIN_WIDTH, 720)
  assert.equal(layoutFor(1440), 'drawer'); assert.equal(layoutFor(720), 'drawer'); assert.equal(layoutFor(719), 'bottom'); assert.equal(layoutFor(390), 'bottom')
  assert.equal(layoutFor(0), 'drawer', 'an unknown width is the default')
})

test('the plan: the log row is always there, the screenshot row only when it can be sent, offline keeps the report', () => {
  assert.deepEqual(feedbackPlan(), { sendMode: 'send', shotRow: false, shot: '', logRow: true, banner: '' })
  assert.equal(feedbackPlan({ hasShot: true }).shotRow, false, 'a screenshot the product cannot send is not offered')
  assert.deepEqual([feedbackPlan({ canSendShot: true }).shotRow, feedbackPlan({ canSendShot: true }).shot], [true, 'empty'], 'the row is there with the ways to add a picture')
  assert.equal(feedbackPlan({ hasShot: true, canSendShot: true }).shot, 'attached')
  assert.deepEqual(feedbackPlan({ offline: true }), { sendMode: 'queue', shotRow: false, shot: '', logRow: true, banner: 'offline' })
})

test('the title is the first line of what the person wrote, cut at 80 characters; the context line names the page and the place, or the error', () => {
  assert.equal(titleOf('\n  网卡磁贴不对\n第二行'), '网卡磁贴不对')
  assert.equal(titleOf('x'.repeat(100)).length, 80)
  assert.equal(titleOf(''), '')
  const texts = feedbackTexts('zh')
  assert.equal(contextLine({ page: '概览', element: '公网地址', texts }), '概览 › 公网地址')
  assert.equal(contextLine({ page: '概览', texts }), '概览')
  assert.equal(contextLine({ page: '概览', element: '公网地址home.sky-hua.xyz已验证了很长的一段文字', texts }), '概览 › 公网地址home.sky-hua.xyz已验证…', 'what was under the pointer is cut at 24 characters')
  assert.equal(contextLine({ error: { code: 'ENC_INIT' }, texts }), '错误 ENC_INIT')
})

test('an answer to a send is a phase: sent and queued are done, limited stays, a refusal while error reports are off is told apart', () => {
  assert.deepEqual(phaseOf({ state: 'sent' }), { phase: 'done', kind: 'sent', again: false, shot: '' })
  assert.equal(phaseOf({ state: 'sent', again: true }).again, true)
  assert.deepEqual(phaseOf({ state: 'queued' }), { phase: 'done', kind: 'queued' })
  assert.deepEqual(phaseOf({ state: 'limited' }), { phase: 'edit', problem: 'limited' })
  assert.deepEqual(phaseOf({ state: 'rejected' }, { errorsOn: true }), { phase: 'edit', problem: 'rejected' })
  for (const reason of ['not-accepted', 'http-401', 'http-400', undefined]) assert.deepEqual(phaseOf({ state: 'rejected', reason }), { phase: 'edit', problem: 'rejected' }, `${reason}: one refusal, the panel does not guess a cause`)
})

test('the words: Chinese and English have the same keys, 反馈 is the one word, and nothing says the log is optional or names a vendor', () => {
  const zh = feedbackTexts('zh'), en = feedbackTexts('en')
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  assert.equal(feedbackTexts('de'), en, 'any other language reads the English')
  assert.equal(zh.errorButton, '反馈这个问题'); assert.equal(zh.here, '反馈此处的问题'); assert.equal(zh.card, '反馈问题或建议')
  assert.match(zh.logsText, /已脱敏的运行日志/); assert.match(zh.logsText, /点「发送」就是同意发送这些内容，与「问题自动上报」开关无关/)
  assert.match(zh.contactHint, /仅开发者可见，用于回复你/)
  for (const t of [zh, en]) for (const [k, v] of Object.entries(t)) { assert.ok(!/遥测|telemetry/i.test(v), k); assert.ok(String(v).trim(), k) }
  assert.equal(fillText(zh.cardLast, { state: zh.cardLastSent, ref: 'AB12CD34' }), '最近一次：已发送 #AB12CD34')
  assert.deepEqual(FEEDBACK_LOCALES, ['zh', 'en'])
})

test('the contact: cleaned to one line of at most 200 characters, kept out of the scrubbing, in the one event and nowhere else', () => {
  assert.equal(cleanContact('  a@b.org \n QQ 12345 '), 'a@b.org QQ 12345')
  assert.equal(cleanContact('x'.repeat(300)).length, CONTACT_MAX)
  assert.equal(cleanContact(null), '')
  const doc = userReportDocument({ title: 't', description: 'd', type: 'bug', product: 'panel', page: 'home', contact: 'me@example.org' })
  assert.equal(doc.contact, 'me@example.org', 'an address the person gave is not scrubbed')
  assert.ok(!doc.message.includes('example.org'), 'the contact is not in the message')
  const props = reportToEvent(doc).props
  assert.equal(props.contact, 'me@example.org'); assert.equal(props.page, 'home')
  assert.ok(!props.message.includes('example.org'))
  const none = reportToEvent(userReportDocument({ title: 't', description: 'd', product: 'web' })).props
  assert.ok(!('contact' in none), 'no contact, no field')
  assert.ok(!('contact' in reportToDocument(buildReport(new Error('x'), { kind: 'manual', context: {} }), { title: 't', description: 'd' })))
})

test('a report the person pressed 发送 for is kept for the automatic retry even with error reports off; anything else waits', async () => {
  const storage = memory()
  const doc = userReportDocument({ title: 't', description: 'd', product: 'web' })
  const other = userReportDocument({ title: 'u', description: 'e', product: 'web' })
  const offline = await submitReport(doc, { storage, online: false, explicit: true, id: 'a' })
  assert.equal(offline.state, 'queued')
  enqueue(other, storage, Date.now(), { id: 'b' })
  assert.deepEqual(loadQueue(storage).map((e) => [e.id, !!e.explicit]), [['a', true], ['b', false]])
  resetAutoFlush()
  const sent = []
  const run = await flushQueueAuto({ consent: 'off', storage, send: async (d) => { sent.push(d.title); return { state: 'sent' } } })
  assert.deepEqual(sent, ['t'], 'only the report the person sent goes out by itself')
  assert.equal(run.sent, 1)
  assert.deepEqual(loadQueue(storage).map((e) => e.id), ['b'], 'the other stays until the person presses Retry')
  resetAutoFlush()
  assert.equal(await flushQueueAuto({ consent: 'off', storage, send: async () => ({ state: 'sent' }) }), null, 'nothing explicit is left, nothing runs')
})

test('the context menu: 反馈此处的问题 is the first entry of the page group, for every user', () => {
  const el = { nodeType: 1, tagName: 'DIV', closest: () => null, parentElement: null, isContentEditable: false, getAttribute: () => null, hasAttribute: () => false, matches: () => false, classList: { contains: () => false }, dataset: {}, textContent: '' }
  const ctx = { T: contextTexts('zh'), cb: { reportHere: () => {} }, caps: { product: 'panel' }, platform: 'Win32', mode: 'system' }
  const groups = buildGroups({ kind: 'page', el, owners: [], link: '', image: '', selection: '', editable: false }, ctx)
  const page = groups.find((g) => g.page)
  assert.equal(page[0].id, 'dev-report'); assert.equal(page[0].label, '反馈此处的问题'); assert.equal(page[0].icon, 'feedback')
})

test('the global state: the context it was opened from, and the short decision before the panel', async () => {
  registerDevReport({ capture: async () => null, logs: () => '', env: () => '' })
  closeDevReport()
  await openFeedbackHere({ page: '概览', place: 'tile:net', text: '网卡' })
  assert.equal(devReport.open, true); assert.deepEqual(devReport.context, { page: '概览', place: 'tile:net', element: '网卡' })
  closeDevReport()
  assert.equal(currentPageName(), '', 'no page in the window: no name')
  askDevReport('crash', { page: '概览' })
  assert.equal(devReport.decision, 'crash'); assert.equal(devReport.context.page, '概览')
  clearDevReportAsk(); assert.equal(devReport.decision, '')
})

test('the panel, the decision dialog and the entries read the one set of words and keep the rules of the flow', () => {
  const panel = read('src/vue/feedback/MFeedbackPanel.vue'), decision = read('src/vue/feedback/MFeedbackDecision.vue')
  assert.match(panel, /layoutFor\(width\.value\)/); assert.match(panel, /side="end"/)
  assert.match(panel, /@click="send"/); assert.match(panel, /data-fb="contact"/); assert.match(panel, /F\.contactHint/)
  assert.match(panel, /data-fb="preview-toggle"/, 'what will be sent can be looked at before it goes')
  assert.match(decision, /MDialog/); assert.match(decision, /openDevReport\(\{ kind: 'feedback', context \}\)/, 'the dialog only decides; the panel is the drawer')
  assert.match(read('src/vue/MErrorHost.vue'), /reportSheet \? F\.errorButton : T\.report/)
  assert.match(read('src/vue/MFeedbackRow.vue'), /feedbackTexts/)
  assert.match(read('src/vue/feedback/MFeedbackButton.vue'), /openFeedbackHere\(\{ page: props.page \}\)/)
})

test('the message of a report written without an error is what the person wrote, once: the first line is not repeated as a title and no placeholder error is added', () => {
  const doc = userReportDocument({ title: titleOf('网卡磁贴不对\n在主机设置里改了绑定地址'), description: '网卡磁贴不对\n在主机设置里改了绑定地址', type: 'bug', product: 'panel', page: 'home' })
  const message = reportToEvent(doc).props.message
  assert.equal(message, '网卡磁贴不对\n在主机设置里改了绑定地址')
  assert.ok(!message.includes('Error:'))
  const withError = userReportDocument({ error: { name: 'TypeError', message: 'x is not a function', code: 'ui.x' }, title: 'TypeError: x', description: '点了保存', product: 'web' })
  assert.match(reportToEvent(withError).props.message, /^TypeError: x\n\n点了保存[\s\S]*Error: TypeError: x is not a function/)
})

test('the run log is added by the host, not by the page: the event the page sends has no log, and a log_ref the page names is not a field of the document', () => {
  const doc = userReportDocument({ title: 't', description: 'd', product: 'panel', page: 'home', contact: 'q' })
  assert.ok(!('logs' in doc) || !doc.logs, 'the document built from the panel has no log lines')
  const props = reportToEvent(doc).props
  assert.deepEqual(Object.keys(props).sort(), ['category', 'component', 'contact', 'message', 'page'].sort())
  assert.ok(!('log_ref' in props) && !('logs' in props))
  assert.match(read('src/devmode/userReport.js'), /the host adds it[\s\S]*log_ref/, 'the path is written next to the code')
  assert.match(read('docs/telemetry.md'), /added by the host, not by the page/)
})

test('a refusal is one thing, whatever the reason; the explicit mark survives a second press, and the history follows the real delivery', async () => {
  assert.ok(!/rejectedOld|turn-on/.test(read('src/vue/feedback/MFeedbackPanel.vue') + read('src/feedback/texts.js')), 'no state that blames the switch: the host answers only how many events it kept')
  const storage = memory()
  const doc = userReportDocument({ title: 't', description: 'd', product: 'web' })
  enqueue(doc, storage, Date.now(), { id: 'a' })   // an automatic copy first
  await submitReport(doc, { storage, online: false, explicit: true, id: 'a' })
  assert.equal(loadQueue(storage)[0].explicit, true, 'a press after an automatic entry keeps the consent of the press')
  const failing = async () => { throw new Error('network') }
  const other = userReportDocument({ title: 'u', description: 'e', product: 'web' })
  enqueue(other, storage, Date.now(), { id: 'b' })
  await submitReport(other, { storage, online: true, explicit: true, id: 'b', transport: failing })
  assert.equal(loadQueue(storage).find((e) => e.id === 'b').explicit, true, 'the online failure path keeps it too')
  // the history: a queued record becomes sent when the automatic flush sends the report, and a record keeps its reference
  const { addMine, listMine, mineState } = await import('../src/devmode/mine.js')
  const hist = memory()
  addMine({ id: 'c', title: 'x', status: 'queued', ref: 'AB12CD34' }, hist)
  assert.equal(listMine(hist)[0].status, 'queued'); assert.equal(listMine(hist)[0].ref, 'AB12CD34')
  const before = mineState.v
  resetAutoFlush()
  enqueue(userReportDocument({ title: 'z', description: 'z', product: 'web' }), hist, Date.now(), { id: 'c', explicit: true })
  await flushQueueAuto({ consent: 'off', storage: hist, send: async () => ({ state: 'sent' }) })
  assert.ok(mineState.v > before, 'the history is told when a queued report goes out')
  assert.equal(listMine(hist)[0].status, 'sent')
  const old = memory(); old.setItem('foundation-ui.devmode.mine', JSON.stringify([{ id: '0123456789abcdef0123456789abcdef', status: 'sent', title: 'old' }]))
  assert.equal(listMine(old)[0].ref, '01234567'.toUpperCase(), 'a record from before ref existed gets it from its id')
})

test('the short labels of the tray have the feedback entry in English and Japanese, and the model has it for every language the host has', async () => {
  const { trayTexts } = await import('../src/tray/trayTexts.js')
  for (const l of ['en', 'ja']) assert.ok(trayTexts(l).short.feedback, l)
  assert.equal(trayTexts('en').short.feedback, 'Feedback')
})

test('the preview says what happens when the log cannot be read, in both languages, and the main line of the panel stays plain', () => {
  assert.match(feedbackTexts('zh').previewLogsNote, /日志读取失败时只发送文字内容/)
  assert.match(feedbackTexts('en').previewLogsNote, /If the log cannot be read, only the text is sent/)
  assert.ok(!/可能|尽量|maybe|might/i.test(feedbackTexts('zh').logsText + feedbackTexts('en').logsText), 'the line about the log has no hedge words')
})
