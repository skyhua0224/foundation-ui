<script setup>
import { computed, ref, reactive, watch } from 'vue'
import MPage from './MPage.vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import MChip from './MChip.vue'
import MProgress from './MProgress.vue'
import MDialog from './MDialog.vue'
import MDiagExport from './MDiagExport.vue'
import { createDoctor, sessionDoctor, shouldAutostart, repairGroups, countStatuses, doctorSnapshot, doctorText, sortItems, summarizeDoctor, readDoctorSummary, writeDoctorSummary, STATUS_LOOK, STATUSES } from '../doctor/model.js'
import { doctorTexts, fixButton, fillDoctorText, doctorAgo, doctorClock } from '../doctor/texts.js'
import { fillText } from './guideTexts.js'

// 体检: one button runs every check, from the panel's own checks (local: they answer when Sunshine is down) and Sunshine's (host); each
// group shows its progress as it runs and its source, then the results grouped by area with the problems first, each with its fix. A fix
// that leads somewhere (level 1) goes at once; a fix that acts (level 2: restart; level 3: administrator rights, repair a driver) first says
// what it will do, and warns when a stream is live. 导出报告 adds the result to the diagnostics bundle; 交给米塔 AI 分析 hands it to the AI.
//   sources: [{ id: 'local' | 'host', groups, fetch(group, lang) }] or request(path) alone for the host
//   repair(action): runs a level-3 fix (the panel); a product without it shows no repair button (the Web UI)
//   collect/save: the diagnostics bundle of the product (MDiagExport); the result is added as doctor.json
// Emits: go (target: 'page:<id>' | 'setting:<key>'), open (url), restart (after the person confirmed), ai ({ text, prompt, snapshot })
const props = defineProps({
  request: { type: Function, default: null },
  sources: { type: Array, default: null },
  repair: { type: Function, default: null },
  canRepair: { type: Function, default: null },
  collect: { type: Function, required: true },
  save: { type: Function, required: true },
  locale: { type: String, default: 'en' },
  texts: { type: Object, default: null },
  hostNames: { type: Array, default: () => [] },
  clientNames: { type: Array, default: () => [] },
  panel: { type: Boolean, default: false },
  closeLabel: { type: String, default: 'Close' },
  /** the product's name, written in the first line of the diagnostics bundle */
  product: { type: String, default: '' },
  /** start at once (the 「开始体检」 entries of help, search and the offline page open the page running). A number is the entry's own token: the same token again (Back) does not run again; `true` runs
   *  when there is no result yet or it is more than five minutes old */
  autostart: { type: [Boolean, Number], default: false },
  /** a stream is live (the product knows it even when Sunshine's own answer does not say) */
  streaming: { type: Boolean, default: false },
  /** requests at the same time */
  parallel: { type: Number, default: 3 },
  /** where the last result is kept for the first screen (localStorage key; '' keeps nothing) */
  storageKey: { type: String, default: 'foundation.doctor.last' },
  /** the storage of the last result (tests and the gallery pass their own) */
  storage: { type: Object, default: null },
})
const emit = defineEmits(['go', 'open', 'restart', 'ai'])
const T = computed(() => doctorTexts(props.locale, props.texts))
// The result belongs to the session, not to this page: following a fix to another page and coming back finds the last result (or the run that is still going on) and its time, with the button that runs it again.
const storageOf = () => props.storage || (typeof localStorage !== 'undefined' ? localStorage : null)
const options = { request: (p) => props.request?.(p), sources: props.sources, locale: () => props.locale, parallel: props.parallel, streaming: () => props.streaming }
const session = props.storageKey ? sessionDoctor(props.storageKey, { ...options, storage: storageOf(), storageKey: props.storageKey }) : null
const doctor = session ? session.doctor : createDoctor(options)
watch(() => props.streaming, () => doctor.restate())
const state = doctor.state

const settled = (g) => g.state === 'done' || g.state === 'error' || g.state === 'offline'
const started = computed(() => state.groups.some((g) => g.state !== 'idle'))
const finished = computed(() => started.value && !state.groups.some((g) => g.state === 'queued' || g.state === 'running'))
const doneCount = computed(() => state.groups.filter(settled).length)
const counts = computed(() => countStatuses(state.groups))
const seconds = computed(() => (state.finishedAt && state.startedAt ? Math.max(1, Math.round((state.finishedAt - state.startedAt) / 1000)) : 0))
const live = computed(() => props.streaming || state.streaming)
const sources = computed(() => [...new Set(state.groups.map((g) => g.source))])
const answered = computed(() => state.groups.filter((g) => g.state === 'done').length)
const silent = computed(() => state.groups.filter((g) => g.state === 'error' || g.state === 'offline').length)
// no group gave a result: neither good nor bad can be said
const nothing = computed(() => finished.value && answered.value === 0)
const RANK = { fail: 0, warn: 1, skip: 2, pass: 3 }
// while it runs the groups keep their places; once every answer is in, the groups with problems come first, the silent ones last
const shown = computed(() => {
  const list = state.groups.filter((g) => g.state !== 'idle')
  if (!finished.value) return list
  const rank = (g) => (g.state === 'error' ? 0.5 : g.state === 'offline' ? 4 : RANK[g.status])
  return list.map((g, i) => ({ g, i })).sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i).map((x) => x.g)
})
const titleOf = (g) => g.title || T.value.groups[g.id] || g.id
const itemsOf = (g) => sortItems(g.items)
const groupIcon = (g) => (g.state === 'done' ? STATUS_LOOK[g.status].icon : g.state === 'error' ? 'error' : g.state === 'offline' ? 'desktop_access_disabled' : g.state === 'queued' ? 'schedule' : g.icon)
const groupLine = (g) => {
  if (g.state === 'queued' || g.state === 'running' || g.state === 'offline') return T.value.states[g.state]
  if (g.state === 'error') return (T.value.errors[g.error] || T.value.errors.failed).why
  const c = countStatuses([g])
  return STATUSES.filter((s) => c[s]).map((s) => fillText(T.value.counts[s], { n: c[s] })).join(' · ')
}
const canRepair = (action) => !!props.repair && (props.canRepair ? props.canRepair(action) : true)
const buttonOf = (action) => fixButton(action, T.value, { canRepair })
// a row whose repair is another row's (one problem, one button): where to go
const fixAtLine = (at) => fillText(T.value.fixAt, { group: at.groupTitle || T.value.groups[at.group] || at.group, item: at.title })

// What the first screen says: the groups by source, and the last result when there is one
const last = ref(props.storageKey ? readDoctorSummary(storageOf(), props.storageKey) : null)
watch(finished, (done) => {
  if (!done || !state.finishedAt) return
  last.value = summarizeDoctor(state)
  if (props.storageKey) writeDoctorSummary(storageOf(), props.storageKey, last.value)
})
const planSources = computed(() => sources.value.map((id) => ({ id, groups: state.groups.filter((g) => g.source === id) })))
const lastOf = (g) => last.value?.groups?.[g.id] || ''
const lastIcon = (g) => ({ pass: 'check_circle', warn: 'warning', fail: 'error', skip: 'radio_button_unchecked', error: 'error', offline: 'desktop_access_disabled' }[lastOf(g)] || g.icon)
const lastLabel = (g) => (lastOf(g) ? T.value.status[lastOf(g)] || T.value.status.skip : '')
const countsLine = (c, order = ['fail', 'warn']) => order.filter((s) => c[s]).map((s) => fillText(T.value.counts[s], { n: c[s] })).join(' · ')
const hostCount = computed(() => state.groups.filter((g) => g.source === 'host').length)
const localCount = computed(() => state.groups.length - hostCount.value)

// The hero: one card whose shape, colour, words and actions follow the state
const phase = computed(() => (!started.value ? 'idle' : !finished.value ? 'running' : 'done'))
const heroTone = computed(() => {
  if (phase.value !== 'done') return 'primary'
  return nothing.value || counts.value.fail ? 'fail' : counts.value.warn ? 'warn' : 'success'
})
const TONE_STATUS = { fail: 'fail', warn: 'warn', success: 'pass' }
const heroIcon = computed(() => {
  if (phase.value === 'running') return 'health_and_safety'
  if (phase.value === 'done' && nothing.value) return 'error'
  return phase.value === 'done' && TONE_STATUS[heroTone.value] ? STATUS_LOOK[TONE_STATUS[heroTone.value]].icon : 'health_and_safety'
})
const firstFailure = computed(() => state.groups.find((g) => g.state === 'error') || state.groups.find((g) => g.state === 'offline'))
const heroTitle = computed(() => {
  if (phase.value === 'idle') return last.value ? fillText(T.value.last.title, { ago: doctorAgo(last.value.at, T.value) }) : fillText(T.value.plan.title, { n: state.groups.length })
  if (phase.value === 'running') return fillText(T.value.progress, { done: doneCount.value, total: state.groups.length })
  if (nothing.value) return T.value.none.title
  return counts.value.fail || counts.value.warn ? countsLine(counts.value) : T.value.allGood
})
const heroText = computed(() => {
  if (phase.value === 'idle') return last.value ? [last.value.empty ? T.value.last.empty : '', fillText(T.value.plan.title, { n: state.groups.length }), last.value.s ? fillText(T.value.done, { s: last.value.s }) : ''].filter(Boolean).join(' · ') : fillText(T.value.plan.text, { local: localCount.value, host: hostCount.value })
  // while it runs the groups below say which are running (a spinner and 「检查中…」): naming them again here was the same words twice
  if (phase.value === 'running') return ''
  if (nothing.value) {
    const g = firstFailure.value
    const why = g ? (g.state === 'offline' ? T.value.states.offline : (T.value.errors[g.error] || T.value.errors.failed).why) : ''
    return `${fillText(T.value.none.text, { n: state.groups.length })} ${why ? fillText(T.value.none.reason, { why }) : ''}`.trim()
  }
  const parts = []
  if (counts.value.skip) parts.push(fillText(T.value.counts.skip, { n: counts.value.skip }))
  if (counts.value.pass) parts.push(fillText(T.value.counts.pass, { n: counts.value.pass }))
  if (seconds.value) parts.push(fillText(T.value.done, { s: seconds.value }))
  if (state.finishedAt) parts.push(fillText(T.value.checkedAt, { at: doctorClock(state.finishedAt), ago: doctorAgo(state.finishedAt, T.value) }))
  return parts.join(' · ')
})

// A group's details are open when it has something to look at; the groups that passed stay folded
const folded = reactive({})
const isOpen = (g) => (g.id in folded ? !folded[g.id] : (g.status !== 'pass' && g.status !== 'skip') || g.items.some((i) => i.limit))
const toggle = (g) => { folded[g.id] = isOpen(g) }
// The same failure in several groups is said once, with the groups it hit (a stand-in server or a stopped Sunshine fails them all alike)
const causeKey = (g) => `${g.state}|${g.source}|${g.error}|${g.errorStatus}|${g.errorDetail}`
const causes = computed(() => {
  const map = new Map()
  for (const g of state.groups) {
    if (g.state !== 'error' && g.state !== 'offline') continue
    const key = causeKey(g)
    if (!map.has(key)) map.set(key, { key, state: g.state, error: g.error, source: g.source, raw: g.state === 'error' ? failureDetail(g) : '', groups: [] })
    map.get(key).groups.push(g)
  }
  return [...map.values()].filter((c) => c.state === 'offline' || c.groups.length > 1 || nothing.value)
})
const sharedKeys = computed(() => new Set(causes.value.map((c) => c.key)))
// the checks a live stream limits: counted apart, and said on their rows
const limited = computed(() => state.groups.reduce((n, g) => n + g.items.filter((i) => i.limit).length, 0))
const limitLabel = (it) => T.value.stream.label[it.limit]
const limitWhy = (it) => T.value.stream.why[it.limit]
const failure = (g) => T.value.errors[g.error] || T.value.errors.failed
const failureDetail = (g) => [g.errorStatus ? fillText(T.value.failure.http, { status: g.errorStatus }) : '', g.errorDetail].filter(Boolean).join(' · ')

const run = () => { if (!state.running) doctor.run() }
if (shouldAutostart(session || { doctor, handled: null }, props.autostart)) run()

// A fix: level 1 goes at once; level 2 and 3 say what they do (the effect the source wrote, else its fix text) and wait for a yes
const pending = ref(null)
const confirmOpen = computed({ get: () => !!pending.value, set: (v) => { if (!v) pending.value = null } })
const outcome = ref({})
function act(item) {
  const action = item.fix.action
  if (!action) return
  if (action.level >= 2) {
    const label = buttonOf(action)?.label || ''
    const title = action.kind === 'repair' && action.target.startsWith('driver:') ? fillDoctorText(T.value.confirm.titleOf, { label, item: item.title }) : fillDoctorText(T.value.confirm.title, { label })
    pending.value = { item, action, label, title }
    return
  }
  if (action.kind === 'rerun') doctor.rerun(action.target || item.group)
  else if (action.kind === 'link') emit('open', action.target)
  else if (action.kind === 'open') emit('go', action.target)
}
async function confirmFix() {
  const { item, action } = pending.value
  pending.value = null
  if (action.kind === 'restart') { emit('restart'); return }
  if (action.kind !== 'repair' || !props.repair) return
  outcome.value = { ...outcome.value, [item.id]: { busy: true } }
  try {
    await props.repair(action)
    outcome.value = { ...outcome.value, [item.id]: { text: T.value.repairDone } }
    // every group that asked for this repair (the rows that point to it too), not only the one whose button was pressed
    for (const id of new Set([item.group, ...repairGroups(state.groups, action)])) await doctor.rerun(id)
  }
  catch (e) {
    outcome.value = { ...outcome.value, [item.id]: { error: fillDoctorText(T.value.repairFailed, { error: String(e?.message || e) }) } }
  }
}

const exportOpen = ref(false)
const collectWithDoctor = async () => ({ ...(await props.collect()), doctor: doctorSnapshot(state) })
function askAi() {
  const text = doctorText(state, { titleOf: (g) => `${titleOf(g)} (${T.value.sources[g.source] || g.source})`, offlineText: T.value.aiOffline, limitText: (limit) => T.value.stream.label[limit], fixAtText: fixAtLine })
  emit('ai', { text, prompt: `${T.value.aiPrompt}\n\n${text}`, snapshot: doctorSnapshot(state) })
}
defineExpose({ run, state })
</script>

<template>
  <MPage :title="T.title" class="m-doctor" :data-state="phase" :updated="state.finishedAt || 0" :refreshing="state.running" :refreshable="finished" :locale="locale" @refresh="run">
    <template v-if="finished" #actions><MButton variant="tonal" icon="refresh" @click="run">{{ T.again }}</MButton></template>

    <section class="m-hero m-doctor__hero" :class="[`is-${heroTone}`, { 'is-idle': phase === 'idle' }]" :data-tone="heroTone" :aria-label="T.title">
      <div class="m-hero__shape"><MIcon :name="heroIcon" fill /></div>
      <div class="m-hero__body">
        <h2 class="m-hero__title" aria-live="polite">{{ heroTitle }}</h2>
        <p v-if="heroText" class="m-hero__text">{{ heroText }}</p>
        <p v-if="phase === 'done' && limited && !nothing" class="m-hero__text m-doctor__streamnote">{{ fillText(T.stream.live, { n: limited }) }}</p>
        <MProgress v-if="phase === 'running'" :value="doneCount / state.groups.length" :label="heroTitle" class="m-doctor__bar" />
        <div v-if="phase === 'idle' && last && !last.empty" class="m-hero__chips"><template v-for="s in ['fail', 'warn']" :key="s"><MChip v-if="last.counts[s]" :tone="STATUS_LOOK[s].tone" :icon="STATUS_LOOK[s].icon">{{ fillText(T.counts[s], { n: last.counts[s] }) }}</MChip></template><MChip v-if="!last.counts.fail && !last.counts.warn" tone="ok" icon="check_circle">{{ T.allGood }}</MChip></div>
        <div v-else-if="phase === 'done'" class="m-hero__chips">
          <MChip v-if="silent && !nothing" tone="neutral" icon="error">{{ fillText(T.counts.silent, { n: silent }) }}</MChip>
          <span v-if="state.hostOffline && !nothing" class="m-doctor__offline"><MIcon name="desktop_access_disabled" />{{ T.hostOffline }}</span>
        </div>
      </div>
      <div v-if="phase !== 'running'" class="m-hero__action m-doctor__heroact">
        <MButton v-if="phase === 'idle'" size="lg" icon="health_and_safety" class="m-doctor__start" @click="run">{{ T.start }}</MButton>
        <template v-else>
          <MButton variant="tonal" icon="folder_zip" @click="exportOpen = true">{{ T.export }}</MButton>
          <MButton v-if="!nothing" variant="tonal" icon="smart_toy" @click="askAi">{{ T.ai }}</MButton>
        </template>
      </div>
    </section>

    <template v-if="phase === 'idle'">
      <section v-for="s in planSources" :key="s.id" class="m-doctor__plan" :data-source="s.id">
        <header class="m-doctor__phead"><h3>{{ T.sections[s.id] || s.id }}</h3><p>{{ T.sourceTip[s.id] }}</p></header>
        <ul class="m-doctor__tiles">
          <li v-for="g in s.groups" :key="g.id" class="m-doctor__tile" :class="lastOf(g) && `is-${lastOf(g)}`" :data-group="g.id" :data-last="lastOf(g) || undefined">
            <span class="m-doctor__gicon"><MIcon :name="lastIcon(g)" /></span>
            <div class="m-doctor__ttext"><h4>{{ T.groups[g.id] || g.id }}</h4><p>{{ T.what[g.id] }}</p></div>
            <span v-if="lastOf(g)" class="m-doctor__tstat">{{ lastLabel(g) }}</span>
          </li>
        </ul>
      </section>
    </template>

    <section v-for="c in causes" :key="c.key" class="m-doctor__group m-doctor__cause is-error" :data-error="c.error || 'offline'">
      <header class="m-doctor__ghead">
        <span class="m-doctor__gicon"><MIcon :name="c.state === 'offline' ? 'desktop_access_disabled' : 'error'" /></span>
        <div class="m-doctor__gtext"><h3>{{ c.state === 'offline' ? fillText(T.offlineTitle, { n: c.groups.length }) : failure(c).why }}<span class="m-doctor__src" :class="`is-${c.source}`">{{ T.sources[c.source] || c.source }}</span></h3><p>{{ fillText(T.failure.hit, { n: c.groups.length, names: c.groups.map(titleOf).join('、') }) }}</p></div>
      </header>
      <div class="m-doctor__fail">
        <p v-if="c.raw" class="m-doctor__raw" data-redact="path"><b>{{ T.failure.detail }}</b><code>{{ c.raw }}</code></p>
        <p class="m-doctor__next"><b>{{ T.failure.next }}</b>{{ c.state === 'offline' ? T.offlineNext : failure(c).next }}</p>
        <div class="m-doctor__failact"><MButton size="sm" variant="tonal" icon="refresh" @click="run">{{ T.again }}</MButton><MButton variant="text" size="sm" icon="folder_zip" @click="exportOpen = true">{{ T.export }}</MButton></div>
      </div>
    </section>

    <section v-for="g in (nothing ? [] : shown)" :key="g.id" class="m-doctor__group" :class="`is-${g.state === 'done' ? g.status : g.state}`" :data-group="g.id" :data-source="g.source" :data-state="g.state" :data-status="g.status" :data-open="isOpen(g)">
      <header class="m-doctor__ghead">
        <span class="m-doctor__gicon"><MProgress v-if="g.state === 'running'" circular :label="T.states.running" class="m-doctor__spin" /><MIcon v-else :name="groupIcon(g)" /></span>
        <div class="m-doctor__gtext"><h3>{{ titleOf(g) }}<span v-if="sources.length > 1" class="m-doctor__src" :class="`is-${g.source}`" :title="T.sourceTip[g.source]">{{ T.sources[g.source] || g.source }}</span></h3><p>{{ groupLine(g) }}</p></div>
        <MButton v-if="settled(g)" size="sm" variant="text" icon="refresh" :aria-label="T.rerunGroup" :title="T.rerunGroup" class="m-doctor__rerun" @click="doctor.rerun(g.id)" />
        <MButton v-if="g.items.length" size="sm" variant="text" :icon="isOpen(g) ? 'keyboard_arrow_up' : 'keyboard_arrow_down'" :aria-expanded="isOpen(g)" :aria-label="titleOf(g)" class="m-doctor__fold" @click="toggle(g)" />
      </header>
      <div v-if="g.state === 'error' && !sharedKeys.has(causeKey(g))" class="m-doctor__fail" :data-error="g.error">
        <p class="m-doctor__why"><b>{{ T.failure.why }}</b>{{ failure(g).why }}</p>
        <p v-if="failureDetail(g)" class="m-doctor__raw" data-redact="path"><b>{{ T.failure.detail }}</b><code>{{ failureDetail(g) }}</code></p>
        <p class="m-doctor__next"><b>{{ T.failure.next }}</b>{{ failure(g).next }}</p>
        <div class="m-doctor__failact"><MButton size="sm" variant="tonal" icon="refresh" @click="doctor.rerun(g.id)">{{ T.rerunGroup }}</MButton><MButton size="sm" variant="text" icon="folder_zip" @click="exportOpen = true">{{ T.export }}</MButton></div>
      </div>
      <ul v-if="g.items.length && isOpen(g)" class="m-doctor__items">
        <li v-for="it in itemsOf(g)" :key="it.id" class="m-doctor__item" :class="`is-${it.status}`" :data-item="it.id" :data-status="it.status" :data-limit="it.limit || undefined" :data-source="it.source || g.source">
          <MIcon class="m-doctor__sicon" :name="it.limit ? 'pause_circle' : STATUS_LOOK[it.status].icon" :aria-label="it.limit ? limitLabel(it) : T.status[it.status]" />
          <div class="m-doctor__body">
            <p class="m-doctor__ititle">{{ it.title }}</p>
            <p v-if="it.limit" class="m-doctor__limit" :data-limit="it.limit"><b>{{ limitLabel(it) }}</b>{{ limitWhy(it) }}</p>
            <p v-if="it.detail && it.limit !== 'skipped'" class="m-doctor__detail">{{ it.limit ? fillText(T.stream.read, { detail: it.detail }) : it.detail }}</p>
            <p v-if="it.status !== 'pass' && it.fix.text" class="m-doctor__fix">{{ it.fix.text }}</p>
            <p v-else-if="it.status !== 'pass' && it.fix.at" class="m-doctor__fix m-doctor__fixat" :data-at="it.fix.at.item">{{ fixAtLine(it.fix.at) }}</p>
            <p v-if="outcome[it.id]?.text || outcome[it.id]?.error" class="m-doctor__outcome" :class="{ 'is-error': outcome[it.id].error }" role="status">{{ outcome[it.id].error || outcome[it.id].text }}</p>
          </div>
          <MButton v-if="it.status !== 'pass' && buttonOf(it.fix.action)" size="sm" :variant="it.status === 'fail' ? 'filled' : 'tonal'" :icon="buttonOf(it.fix.action).icon" :loading="!!outcome[it.id]?.busy" :title="it.fix.action.effect || undefined" class="m-doctor__fixbtn" :data-level="it.fix.action.level" @click="act(it)">{{ buttonOf(it.fix.action).label }}</MButton>
        </li>
      </ul>
    </section>

    <MDialog v-model="confirmOpen" :title="pending?.title || ''" :icon="pending?.action.level === 3 ? 'shield' : 'restart_alt'" tone="warning" class="m-doctor__confirm">
      <template v-if="pending">
        <p class="m-doctor__will"><b>{{ T.confirm.will }}</b>{{ pending.action.effect || pending.item.fix.text }}</p>
        <p v-if="pending.action.level === 3" class="m-doctor__admin"><MIcon name="shield" />{{ T.confirm.admin }}</p>
        <p v-if="live" class="m-doctor__live" role="alert"><MIcon name="warning" />{{ T.confirm.live }}</p>
      </template>
      <template #actions>
        <MButton variant="text" @click="pending = null">{{ T.confirm.cancel }}</MButton>
        <MButton variant="warning" :icon="pending?.action.level === 3 ? 'shield' : 'restart_alt'" @click="confirmFix">{{ pending?.label || T.confirm.run }}</MButton>
      </template>
    </MDialog>
    <MDiagExport v-model="exportOpen" :collect="collectWithDoctor" :save="save" :host-names="hostNames" :client-names="clientNames" :locale="locale" :close-label="closeLabel" :panel="panel" :product="product" />
  </MPage>
</template>
