import { feedbackTexts } from '../src/feedback/texts.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { CONSENT_STATES, answeredConsent, storedConsent, ERROR_REPORTS_DEFAULT, USAGE_STATS_DEFAULT, ERRORS_KEY, CONSENT_KEY, errorsNoticeSeen, markErrorsNoticeSeen, mayCollect, mayReportErrors, normalizeConsent, normalizeErrors, readConsent, readErrors, writeConsent, writeErrors } from '../src/telemetry/consent.js'
import { usageExample } from '../src/telemetry/example.js'
import { errorTexts } from '../src/vue/errorTexts.js'
import { createAutoReporter } from '../src/telemetry/auto.js'
import { TEXT_MODULES } from '../src/locale/texts/index.js'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m } }

test('error reports and usage statistics are both on by default and only an explicit off turns either off; each default is one constant', () => {
  assert.equal(ERROR_REPORTS_DEFAULT, 'on'); assert.equal(USAGE_STATS_DEFAULT, 'on', 'usage statistics are on by default')
  const s = memory()
  assert.equal(readErrors(s), 'on'); assert.equal(readConsent(s), 'on'); assert.equal(storedConsent(s), null, 'the default is not an answer')
  assert.equal(normalizeErrors(undefined), 'on'); assert.equal(normalizeErrors('garbage'), 'on'); assert.equal(normalizeErrors('off'), 'off'); assert.equal(normalizeErrors(false), 'off')
  writeErrors('off', s); assert.equal(readErrors(s), 'off'); assert.equal(readConsent(s), 'on', 'the two are separate')
  writeConsent('off', s); writeErrors('on', s); assert.equal(readErrors(s), 'on', 'and neither moves the other'); assert.equal(readConsent(s), 'off')
  assert.equal(normalizeConsent('garbage'), USAGE_STATS_DEFAULT)
})

test('an explicit off of usage statistics stays off, an explicit on stays on, and the retired ask reads as the default without being kept as an answer', () => {
  const off = memory(); off.setItem(CONSENT_KEY, 'off'); assert.equal(readConsent(off), 'off'); assert.equal(storedConsent(off), 'off'); assert.equal(mayCollect(readConsent(off)), false)
  const on = memory(); on.setItem(CONSENT_KEY, 'on'); assert.equal(readConsent(on), 'on'); assert.equal(storedConsent(on), 'on')
  const ask = memory(); ask.setItem(CONSENT_KEY, 'ask'); assert.equal(readConsent(ask), 'on'); assert.equal(storedConsent(ask), null)
  assert.ok(CONSENT_STATES.includes('ask'), "'ask' is still a value an older version may have stored")
  assert.equal(answeredConsent('ask'), null); assert.equal(answeredConsent('off'), 'off'); assert.equal(answeredConsent(''), null); assert.equal(answeredConsent(undefined), null)
})

test('a person who said no to the old single question stays at no for error reports; one who said yes keeps usage statistics on', () => {
  const no = memory(); no.setItem(CONSENT_KEY, 'off'); assert.equal(readErrors(no), 'off'); assert.equal(readConsent(no), 'off')
  const yes = memory(); yes.setItem(CONSENT_KEY, 'on'); assert.equal(readErrors(yes), 'on'); assert.equal(readConsent(yes), 'on')
  no.setItem(ERRORS_KEY, 'on'); assert.equal(readErrors(no), 'on', 'turning error reports on later wins over the old answer')
})

test('what may leave the computer: error reports only on `on`, usage statistics on `on` (the default) and not on `off`', () => {
  assert.equal(mayReportErrors('on'), true); assert.equal(mayReportErrors('off'), false); assert.equal(mayReportErrors('ask'), false)
  assert.equal(mayCollect('on'), true); assert.equal(mayCollect('off'), false); assert.equal(mayCollect('ask'), true, 'the retired value reads as the default, which is on')
})

test('the automatic reporter is gated by the error-report switch, not by usage statistics', async () => {
  const stamp = []
  const off = createAutoReporter({ storage: memory(), getConsent: () => 'off', context: () => ({ page: 'home' }), send: { create: async () => { stamp.push('create'); return { ok: true } }, bump: async () => ({ ok: true }) } })
  const refused = await off.handle(new TypeError('x'), { kind: 'error' })
  assert.equal(refused.action, 'local'); assert.equal(refused.reason, 'no-consent'); assert.deepEqual(stamp, [])
  const src = read('src/telemetry/auto.js')
  assert.match(src, /getConsent = \(\) => readErrors\(\)/); assert.match(src, /!mayReportErrors\(getConsent\(\)\)/)
  assert.match(read('src/vue/useAutoReport.js'), /getConsent: \(\) => readErrors\(\)/)
})

test('the one-time notice about what is sent remembers that it was shown; the earlier notice named error reports only and does not count', () => {
  const s = memory(); assert.equal(errorsNoticeSeen(s), false); markErrorsNoticeSeen(s); assert.equal(errorsNoticeSeen(s), true)
  const older = memory(); older.setItem('foundation-ui.telemetry.errors-notice', '1'); assert.equal(errorsNoticeSeen(older), false)
})

test('nobody is asked about usage statistics: the dialog, its words and the quiet-moment prompt are gone from the library and from both products', async () => {
  assert.ok(!fs.existsSync(new URL('../src/vue/MTelemetryConsent.vue', import.meta.url)))
  assert.doesNotMatch(read('src/vue/index.js'), /MTelemetryConsent/)
  assert.doesNotMatch(read('src/vue/useTelemetryConsent.js'), /askWhenQuiet|asked:/)
  for (const key of ['usageTitle', 'usageLead', 'usageSee', 'usageNever', 'usageChange', 'usageYes', 'usageNo', 'usageAskText']) { assert.equal(errorTexts('zh')[key], undefined, key); assert.equal(errorTexts('en')[key], undefined, key) }
  const example = usageExample({ version: '2026.1110.004928', os: 'Windows 11' })
  assert.deepEqual(Object.keys(example), ['event', 'page', 'time_to_content_ms', 'app_version', 'os', 'channel'], 'the page change as the Web UI and the control panel send it, with the version, system and channel that split the numbers')
})

test('the error-report notice and the two privacy rows have words; the queue sentence names no vendor', () => {
  const zh = errorTexts('zh'), en = errorTexts('en')
  assert.equal(zh.errorsNotice, '为了更快修复问题、决定先改进什么，软件会把错误记录和使用统计（串流质量按分钟统计）发送到开发者自己的服务器（api.alkaidlab.com）；崩溃报告、反馈或严重的串流问题时，还会附上日志行，先在这台电脑上做匿名处理（去除名称、文件夹和地址）。不会发送屏幕内容、名称、路径和地址。可在「{link}」查看发送的内容，或关闭「错误报告」「使用统计」。')
  assert.equal(en.errorsNotice, 'To fix problems faster and decide what to improve, the software sends error records and usage statistics (stream quality is counted per minute) to the developers\' own server, api.alkaidlab.com. With a crash report, a feedback message or after a serious stream problem it also sends log lines, made anonymous on this computer first (names, folders and addresses removed). No screen content, names, paths or addresses are sent. In {link} you can see what is sent and turn off “Error reports” or “Usage statistics”.')
  for (const text of [zh.errorsNotice, en.errorsNotice]) assert.equal(text.split('{link}').length, 2, 'one sentence plus the one link')
  assert.ok(!/[?？]/.test(zh.errorsNotice + en.errorsNotice), 'the notice asks nothing')
  assert.equal(zh.usageRowText, '让我们知道哪些功能有人用、串流是否流畅，从而决定先改进什么。只发送次数和性能数字；串流质量按分钟统计（例如发送延迟、丢帧）。')
  assert.equal(en.usageRowText, 'Shows us which features are used and whether streams run smoothly, so we know what to improve first. Only counts and performance numbers are sent; stream quality is counted per minute (for example send delay and dropped frames).')
  assert.equal(zh.errorsRowText, '帮助我们更快发现并修复崩溃和错误。出错或崩溃时发送一条去除个人信息的记录；崩溃报告或反馈还会带上这次运行的日志，严重的串流问题会带上主机日志的最后几行，都先在这台电脑上做匿名处理（去除名称、文件夹和地址）。')
  assert.equal(zh.errorsRow, '错误报告'); assert.equal(zh.usageRow, '使用统计')
  assert.match(zh.queued, /^无法连接报告服务器/); assert.match(en.queued, /^The report server is unreachable/)
  for (const locale of ['zh', 'en', 'de', 'fr', 'ja', 'ru']) assert.ok(!/firebase/i.test(JSON.stringify(errorTexts(locale))), `no vendor in ${locale}`)
})

test('every locale has the new words, and none keeps the old consent question', () => {
  assert.ok(TEXT_MODULES.includes('error'))
  const NEW = ['queued', 'queuedHeld', 'errorsRow', 'errorsRowText', 'usageRow', 'usageRowText', 'errorsNotice', 'errorsNoticeLink']
  const OLD = ['usageAskText', 'usageTitle', 'usageLead', 'usageSee', 'usageNever', 'usageChange', 'usageYes', 'usageNo', 'consentTitle', 'consentLead', 'consentSends', 'consentOff', 'consentYes', 'consentNo', 'consentRow', 'consentRowText', 'consentAskText']
  const en = errorTexts('en')
  for (const loc of fs.readdirSync(new URL('../src/locale/texts/', import.meta.url)).filter((f) => !f.includes('.'))) {
    const body = read(`src/locale/texts/${loc}/error.js`)
    for (const k of NEW) assert.ok(body.includes(`"${k}"`), `${loc} lacks ${k}`)
    for (const k of OLD) assert.ok(!body.includes(`"${k}"`), `${loc} still has ${k}`)
    assert.ok(!/firebase/i.test(body), `${loc} names a vendor`)
    assert.ok(JSON.parse(body.replace(/^export default\s*/, '')).errorsNotice.includes('{link}'), `${loc} errorsNotice keeps {link}`)
  }
})

test('the feedback panel names the log and the consent in one line, and does not offer to change the switch', () => {
  const sheet = read('src/vue/feedback/MFeedbackPanel.vue')
  assert.ok(!/ERRORS_REQUEST_EVENT/.test(sheet), 'a report does not wait for the switch, so the panel has nothing to ask of it')
  assert.match(feedbackTexts('zh').logsText, /点「发送」就是同意发送这些内容，与「问题自动上报」开关无关/)
  assert.match(read('src/vue/useTelemetryConsent.js'), /addEventListener\(ERRORS_REQUEST_EVENT/)
})

test('关于 shows the free-software notice and the support line; the second links to the update-source setting where the product allows it', () => {
  const about = read('src/vue/MAbout.vue')
  assert.match(about, /<div class="m-about__notes" data-about-notes>[\s\S]*S\.freeNotice[\s\S]*v-if="supportLink"[\s\S]*emit\('open-update-source'\)/)
  assert.match(about, /supportLink: \{ type: Boolean, default: false \}/)
  assert.match(read('src/css/guideintro.css'), /\.m-about__notes \{[^}]*font: var\(--m-body-small\)/)
})

test('the installer\'s first page carries the free-software notice and the support line, in both of its languages', async () => {
  const { t } = await import('../src/vue/installer/installerTexts.js')
  assert.equal(t('zh', 'welcome.free'), '本程序是免费、开源的自由软件。如果你通过任何渠道付费购买了本程序，请立即申请退款。')
  assert.equal(t('zh', 'welcome.support'), '如果想支持项目开发，可以订阅 Mirror酱：下载更快，同时直接赞助开发者。')
  assert.equal(t('en', 'welcome.free'), 'This program is free and open-source software. If you paid for it through any channel, ask for a refund right away.')
  assert.equal(t('en', 'welcome.support'), 'To support development, subscribe to MirrorChyan: faster downloads that sponsor the developers directly.')
  assert.match(read('src/vue/installer/MInstaller.vue'), /<div v-if="view\.page === 'welcome'" class="m-inst__legal" data-inst-notes>/)
})
