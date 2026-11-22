import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createDoctor, normalizeReport, countStatuses, summarizeDoctor, readDoctorSummary, writeDoctorSummary, errorKind, errorDetail, doctorSnapshot, hostSource, DOCTOR_GROUPS } from '../src/doctor/model.js'
import { doctorTexts, doctorAgo } from '../src/doctor/texts.js'
import { actionDocs, ACTION_DEFS } from '../src/search/texts.js'
import { NAMES } from '../src/icons/names.js'

const real = JSON.parse(fs.readFileSync(new URL('./fixtures/doctor-real.json', import.meta.url), 'utf8'))
const answerOf = (report) => async (path) => {
  const only = new URL(path, 'http://x').searchParams.get('only')
  const group = report.groups.find((g) => g.id === only)
  return { ok: true, status: 200, json: { ...report, groups: [group], items: report.items.filter((i) => group.items.includes(i.id)) } }
}

test('the answer a real Sunshine host gave (GET /api/doctor) is a report: every group, the counts of its own summary', async () => {
  const r = normalizeReport(real)
  assert.deepEqual(r.groups.map((g) => g.id), DOCTOR_GROUPS.map((g) => g.id))
  assert.deepEqual(countStatuses(r.groups), real.summary)
  const d = createDoctor({ request: answerOf(real) })
  await d.run()
  assert.ok(d.state.groups.every((g) => g.state === 'done'), d.state.groups.map((g) => `${g.id}:${g.state}`).join(' '))
  assert.deepEqual(countStatuses(d.state.groups), real.summary)
})

test('a failure says which kind it is and what the source said; a host that is down stays offline, not an error', async () => {
  assert.equal(errorKind({ status: 404 }), 'unsupported')
  assert.equal(errorKind({ status: 401 }), 'auth')
  assert.equal(errorKind({ status: 403 }), 'auth')
  assert.equal(errorKind({ ok: true, status: 200 }), 'invalid')
  assert.equal(errorKind({ ok: false, status: 500 }), 'failed')
  assert.equal(errorDetail({ json: { error: 'unknown command: doctor_local' } }), 'unknown command: doctor_local')
  assert.equal(errorDetail({ json: null }), '')
  assert.equal(errorDetail({ json: { status: true } }), '{"status":true}', 'a stand-in server that answers 200 {"status":true} to every path shows what it said')
  assert.ok(errorDetail({ json: { message: 'x'.repeat(500) } }).length <= 240)
  const local = { id: 'local', groups: [{ id: 'service', icon: 'x' }], fetch: async () => ({ ok: false, status: 500, json: { error: 'unknown command: doctor_local' } }) }
  const html = hostSource(async () => ({ ok: true, status: 200, json: { html: 1 } }))
  const d = createDoctor({ sources: [local, html] })
  await d.run()
  const service = d.state.groups.find((g) => g.id === 'service')
  assert.deepEqual([service.state, service.error, service.errorStatus, service.errorDetail], ['error', 'failed', 500, 'unknown command: doctor_local'])
  assert.equal(d.state.groups.find((g) => g.id === 'gpu').error, 'invalid')
  const snap = doctorSnapshot(d.state)
  assert.equal(snap.groups[0].error_detail, 'unknown command: doctor_local')
  assert.equal(snap.groups[0].error_status, 500)
  await d.rerun('service')
  assert.equal(d.state.groups.find((g) => g.id === 'service').errorDetail, 'unknown command: doctor_local')
  d.reset()
  assert.equal(d.state.groups[0].errorDetail, '')
})

test('the last result is kept as a small summary, and nothing that is not ours is read back', async () => {
  const d = createDoctor({ request: answerOf(real) })
  await d.run()
  const sum = summarizeDoctor(d.state)
  assert.equal(sum.empty, false)
  assert.equal(sum.groups.network, 'warn')
  assert.equal(sum.groups.gpu, 'pass')
  const store = new Map()
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
  assert.equal(readDoctorSummary(storage, 'k'), null)
  writeDoctorSummary(storage, 'k', sum)
  assert.deepEqual(readDoctorSummary(storage, 'k'), sum)
  store.set('k', '{"v":2}'); assert.equal(readDoctorSummary(storage, 'k'), null)
  store.set('k', 'not json'); assert.equal(readDoctorSummary(storage, 'k'), null)
  assert.doesNotThrow(() => writeDoctorSummary({ setItem() { throw new Error('quota') } }, 'k', sum))
  assert.equal(readDoctorSummary({ getItem() { throw new Error('blocked') } }, 'k'), null)
  // a check in which nothing answered is remembered as that
  const dead = createDoctor({ request: async () => ({ ok: false, status: 500, json: null }) })
  await dead.run()
  assert.equal(summarizeDoctor(dead.state).empty, true)
})

test('the texts of the first screen say what every group checks, in both languages, and how long ago', () => {
  for (const lang of ['zh', 'en']) {
    const T = doctorTexts(lang)
    for (const g of DOCTOR_GROUPS) assert.ok(T.what[g.id].length > 4, `${lang} ${g.id}`)
    for (const id of ['service', 'install', 'process', 'drivers']) assert.ok(T.what[id], `${lang} ${id}`)
    for (const k of ['unsupported', 'auth', 'invalid', 'failed']) assert.ok(T.errors[k].why && T.errors[k].next, `${lang} ${k}`)
  }
  const T = doctorTexts('zh')
  const now = Date.UTC(2026, 10, 7, 12)
  assert.equal(doctorAgo(now - 5e3, T, now), '刚刚')
  assert.equal(doctorAgo(now - 20 * 60e3, T, now), '20 分钟前')
  assert.equal(doctorAgo(now - 3 * 3600e3, T, now), '3 小时前')
  assert.equal(doctorAgo(now - 50 * 3600e3, T, now), '2 天前')
  assert.equal(doctorAgo(now - 20 * 60e3, doctorTexts('en'), now), '20 min ago')
})

test('the page: a hero with a shape, the groups with their icons, the failure with why, what came back and what to do; nothing is centred', () => {
  const src = fs.readFileSync(new URL('../src/vue/MDoctor.vue', import.meta.url), 'utf8')
  assert.match(src, /class="m-hero m-doctor__hero"/)
  assert.match(src, /m-hero__shape/)
  assert.match(src, /m-doctor__tiles/)
  assert.match(src, /T\.failure\.why/)
  assert.match(src, /T\.failure\.detail/)
  assert.match(src, /T\.failure\.next/)
  assert.match(src, /causes/)
  const css = fs.readFileSync(new URL('../src/css/doctor.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /text-align:\s*center|justify-content:\s*center|margin-inline:\s*auto/)
  for (const icon of ['keyboard_arrow_up', 'keyboard_arrow_down', 'desktop_access_disabled', 'send']) assert.ok(NAMES.includes(icon), icon)
})

test('反馈 has a row in 帮助与关于 and is found by 反馈 and feedback in search', () => {
  assert.ok(ACTION_DEFS.some((a) => a.id === 'feedback'))
  const zh = actionDocs('zh', { feedback: () => {} })
  assert.equal(zh.length, 1)
  assert.equal(zh[0].title, '反馈问题或建议')
  assert.match(zh[0].keywords, /反馈/)
  assert.match(zh[0].keywords, /feedback/)
  assert.equal(actionDocs('en', { feedback: () => {} })[0].title, 'Send feedback')
  assert.match(actionDocs('en', { feedback: () => {} })[0].keywords, /反馈/)
  assert.equal(actionDocs('zh', {}).length, 0)
  const row = fs.readFileSync(new URL('../src/vue/MFeedbackRow.vue', import.meta.url), 'utf8')
  assert.match(row, /v-if="available"/)
  assert.match(row, /state\.hosted > 0/)
  assert.match(row, /reportFeedback\(\{ logs \}\)/)
  const index = fs.readFileSync(new URL('../src/vue/index.js', import.meta.url), 'utf8')
  assert.match(index, /MFeedbackRow/)
})
