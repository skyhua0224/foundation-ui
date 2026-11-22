import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { MIRRORCHYAN_CDK_URL, cdkDaysLeft, cdkView, downloadOrder, updateSourceTexts } from '../src/update/index.js'
import { GUIDE_STEP_IDS, buildGuideSteps } from '../src/vue/guideModel.js'
import { guideTexts } from '../src/vue/guideTexts.js'

const zh = updateSourceTexts('zh')
const en = updateSourceTexts('en')
const DAY = 86400000
const NOW = Date.parse('2026-11-10T12:00:00Z')

test("the Mirror酱 sentences are MAA's own (zh-cn.xaml / en-us.xaml), the product name aside", () => {
  assert.equal(zh.mirrorTip, undefined, 'the team took this sentence out')
  assert.equal(zh.verified, undefined, 'the team took this sentence out')
  assert.equal(zh.errors['cdk-expired'], 'CDK 已过期，请使用新的 CDK 进行授权。')
  assert.equal(zh.errors['cdk-invalid'], 'CDK 无效，请检查输入是否正确。')
  assert.equal(zh.errors['cdk-limit'], 'CDK 今日下载次数已达上限，请明日再试。')
  assert.equal(zh.errors['cdk-type'], 'CDK 类型与待下载的资源不匹配，请检查 CDK 适用范围。')
  assert.equal(zh.errors['cdk-banned'], 'CDK 已被封禁，可能由于退款或非正常使用。')
  assert.equal(zh.remainingDays, 'CDK 还剩 {0} 天到期。')
  assert.equal(zh.fetchFailed, '获取 CDK 信息失败，已显示上次成功查询的结果。')
  assert.equal(zh.cdkOptional, 'Mirror酱 CDK（可选）')
  assert.equal(zh.getCdk, '获取 CDK')
  assert.equal(en.errors['cdk-expired'], 'The CDK has expired. Please use a new CDK for authorization.')
  assert.equal(en.errors['cdk-invalid'], 'The CDK is invalid. Please check if the input is correct.')
  assert.equal(en.errors['cdk-limit'], 'The CDK has reached the maximum download limit for today. Please try again tomorrow.')
  assert.equal(en.errors['cdk-type'], "The CDK type does not match the resource to be downloaded. Please check the CDK's applicable scope.")
  assert.equal(en.errors['cdk-banned'], 'The CDK has been blocked, possibly due to a refund or abnormal usage.')
  assert.equal(en.remainingDays, 'CDK expires in {0} days.')
  assert.equal(en.fetchFailed, 'Failed to retrieve CDK information. Showing the result from the last successful query.')
})

test('the description of Mirror酱 is plain: what it is and who it pays, no price, no offer, no exclamation ()', () => {
  for (const text of [zh.mirrorAbout, en.mirrorAbout, zh.supportLine, en.supportLine, zh.freeNotice, en.freeNotice]) {
    assert.ok(!/[!！]/.test(text) && !/[¥$€]|\d/.test(text), text)
    for (const word of ['限时', '优惠', '折扣', '立减', 'limited time', 'discount', 'offer', 'cheap']) assert.ok(!text.toLowerCase().includes(word), `${word} in ${text}`)
  }
  assert.match(zh.mirrorAbout, /开发者赞助计划/); assert.match(zh.mirrorAbout, /订阅收入会按订阅情况分给/); assert.match(zh.mirrorAbout, /不填时从 CNB 或 GitHub 下载/)
  assert.match(en.mirrorAbout, /revenue is shared with the developers/); assert.match(en.mirrorAbout, /without one, updates download from CNB or GitHub/)
})

test('the link to get a CDK is the project page of Mirror酱', () => {
  assert.equal(MIRRORCHYAN_CDK_URL, 'https://mirrorchyan.com/zh/projects?rid=foundation-sunshine')
})

test('days left count a started day and never go below zero', () => {
  assert.equal(cdkDaysLeft(NOW + 12 * DAY, NOW), 12)
  assert.equal(cdkDaysLeft(NOW + 12 * DAY - 1, NOW), 12)
  assert.equal(cdkDaysLeft(NOW + 1, NOW), 1)
  assert.equal(cdkDaysLeft(NOW - DAY, NOW), 0)
  assert.equal(cdkDaysLeft(null, NOW), null)
  assert.equal(cdkDaysLeft(0, NOW), null)
})

test("the one check is shown as a label and MAA's sentences", () => {
  const ok = cdkView({ state: 'valid', expiresAt: NOW + 30 * DAY }, zh, { now: NOW })
  assert.deepEqual(ok, { label: 'CDK 有效', tone: 'ok', lines: ['CDK 还剩 30 天到期。'] })
  assert.deepEqual(cdkView({ state: 'valid', expiresAt: null }, zh, { now: NOW }).lines, [])
  const bad = cdkView({ state: 'invalid', kind: 'cdk-invalid' }, zh)
  assert.deepEqual([bad.label, bad.tone, bad.lines], ['CDK 无效', 'error', ['CDK 无效，请检查输入是否正确。']])
  assert.equal(cdkView({ state: 'banned', kind: 'cdk-banned' }, en).lines[0], 'The CDK has been blocked, possibly due to a refund or abnormal usage.')
  assert.equal(cdkView({ state: 'none' }, zh).tone, 'neutral')
  assert.deepEqual(cdkView({ state: 'none' }, zh).lines, [])
})

test('when the service cannot be reached the last valid result is shown with the sentence about it', () => {
  const v = cdkView({ state: 'offline', kind: 'network' }, zh, { now: NOW, lastValid: { expiresAt: NOW + 5 * DAY } })
  assert.deepEqual(v.lines, [zh.errors.network, '获取 CDK 信息失败，已显示上次成功查询的结果。', 'CDK 还剩 5 天到期。'])
  assert.deepEqual(cdkView({ state: 'offline', kind: 'network' }, zh, { now: NOW }).lines, [zh.errors.network])
})

test('the update source, automatic by default, and Mirror酱 are on the update channel step, the third step of the flow', () => {
  const ids = buildGuideSteps().map((s) => s.id)
  assert.deepEqual(ids.slice(0, 4), ['intro', 'account', 'channel', 'install'], 'language, account, update channel, then the client')
  assert.equal(buildGuideSteps().find((s) => s.id === 'channel').source, true)
  assert.equal(buildGuideSteps({ skip: ['update'] }).find((s) => s.id === 'channel').source, false, 'a product without an update source has the channel alone')
  assert.ok(!buildGuideSteps().at(-1).optional.includes('update'), 'the CDK is not on the done page')
  const channel = readFileSync(new URL('../src/vue/MGuideChannel.vue', import.meta.url), 'utf8')
  assert.match(channel, /<MGuideUpdate :locale="locale" :state="state" :callbacks="callbacks"/)
  assert.equal(guideTexts('zh').titles.update, '更新方式')
  assert.equal(guideTexts('en').titles.update, 'Update method')
  assert.deepEqual(downloadOrder('auto', { hasCdk: true, locale: 'zh' }), ['cnb', 'github'], 'automatic in Chinese is CNB first, GitHub when that fails')
  assert.deepEqual(downloadOrder('auto', { hasCdk: true, locale: 'en' }), ['github', 'cnb'], 'and GitHub first in the other languages')
  assert.equal(zh.autoHint, undefined, 'no sentence tells which host is tried first')
  assert.equal(updateSourceTexts('en').autoHint, undefined)
})

test('Mirror酱 in the first-run update step: an option with two quiet labels, its own description, and the CDK field only once it is chosen', () => {
  const zh = updateSourceTexts('zh-CN'); const en = updateSourceTexts('en')
  assert.equal(zh.tagDomestic, '国内高速'); assert.equal(zh.tagPaid, '付费'); assert.ok(en.tagDomestic && en.tagPaid)
  assert.ok(zh.mirrorAbout.startsWith('Mirror酱 是面向开源项目的下载加速服务，也是一项开发者赞助计划。'))
  assert.ok(en.mirrorAbout.startsWith('MirrorChyan is a download acceleration service for open-source projects'))
  const flow = readFileSync(new URL('../src/vue/MGuideUpdate.vue', import.meta.url), 'utf8')
  const list = readFileSync(new URL('../src/vue/MSourceList.vue', import.meta.url), 'utf8')
  // the same rows in the guide and in 软件更新; the labels are the shared MChip, neutral (quiet), and the description is the row's own line
  assert.match(flow, /<MSourceList :texts="U" :source="update\.source" :mirror="offerMirror" @pick="pickSource" \/>/)
  assert.match(list, /<MChip>\{\{ texts\.tagDomestic \}\}<\/MChip><MChip>\{\{ texts\.tagPaid \}\}<\/MChip>/)
  assert.match(list, /text: value === 'mirror' \? props\.texts\.mirrorAbout : ''/)
  assert.match(flow, /const offerMirror = computed\(\(\) => showCdk\.value \|\| update\.value\.source === 'mirror'\)/, 'offered whenever a Chinese interface can hold a CDK')
  assert.match(flow, /<template v-if="mirrorChosen">[\s\S]*?v-model="cdkDraft"/, 'the CDK field sits inside the chosen-Mirror block')
  assert.ok(!/<template v-if="showCdk">/.test(flow) && !flow.includes('U.mirrorTip'))
  assert.match(flow, /const mirrorChosen = computed\(\(\) => showCdk\.value && update\.value\.source === 'mirror'\)/)
})
