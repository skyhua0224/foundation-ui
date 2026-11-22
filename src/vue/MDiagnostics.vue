<script setup>
import { computed, nextTick, provide, ref } from 'vue'
import MPage from './MPage.vue'
import MSection from './MSection.vue'
import MGroup from './MGroup.vue'
import MItem from './MItem.vue'
import MIcon from './MIcon.vue'
import MSeg from './MSeg.vue'
import MNotice from './MNotice.vue'
import MLogViewer from './MLogViewer.vue'
import MErrorCentre from './MErrorCentre.vue'
import MDiagExport from './MDiagExport.vue'
import MDiagAi from './MDiagAi.vue'
import { diagnosticsTexts } from '../diagnostics/texts.js'
import { problemSummary } from '../diagnostics/summary.js'
import { isError } from '../diagnostics/logs.js'
import { useErrors } from './useErrors.js'

// 诊断与日志, one page for both products. Restart sits above the tabs. Every other row is shown only when the product
// passes a function for it: that is what this product can do, not a second copy of the page. `panel` and `records` are
// the same kind of fact (this product has a panel log). The product owns the data and the actions.
//   commands  { restart, resetDisplay, resetSettings (opens 恢复默认设置), ai, diagnose, downloadLogs, copyLogs, copyConfig, guide, coach, remote, startCard, wizard, forceClose, boom, logout }
//   labels    optional { [id]: { title, text } } when the product has a more specific name
//   notes     { [id]: string | { text, tone } }    disabled  { [id]: boolean }
//   ai        the diagnosis sheet, or null when this product has no assistant for the log
const props = defineProps({
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  records: { type: Array, default: null },
  panel: { type: Boolean, default: false },
  live: { type: Boolean, default: false },
  facts: { type: Object, default: () => ({}) },
  collect: { type: Function, required: true },
  save: { type: Function, required: true },
  statsFor: { type: Function, default: null },
  hostNames: { type: Array, default: () => [] },
  clientNames: { type: Array, default: () => [] },
  locale: { type: String, default: 'en' },
  texts: { type: Object, default: null },
  closeLabel: { type: String, default: 'Close' },
  commands: { type: Object, default: () => ({}) },
  labels: { type: Object, default: () => ({}) },
  notes: { type: Object, default: () => ({}) },
  disabled: { type: Object, default: () => ({}) },
  ai: { type: Object, default: null },
  /** the log was asked for and is not there yet: the log tab draws its lines as a skeleton */
  logLoading: { type: Boolean, default: false },
})
const emit = defineEmits(['update:live', 'open', 'go', 'copied'])
const T = computed(() => diagnosticsTexts(props.locale, props.texts))
const rows = ref([])
// when the log was last read: the page's "updated" stamp
const readAt = ref(0)
const viewer = ref(null)
const exportOpen = ref(false)
const tab = ref('overview')
const tabs = computed(() => [{ value: 'overview', label: T.value.tabOverview, icon: 'stethoscope' }, { value: 'log', label: T.value.tabLog, icon: 'terminal' }])
const copied = ref(false)
const has = (id) => typeof props.commands?.[id] === 'function'
const call = (id) => { if (props.disabled?.[id]) return; const fn = props.commands?.[id]; if (typeof fn === 'function') fn() }
// what a line of the log offers in its context menu (MLogViewer): the same two controls the overview's rows are
provide('m-diag-actions', { get ai() { return has('ai') && !props.disabled?.ai ? () => call('ai') : null }, exportDiag: () => { exportOpen.value = true } })
const ORDER = [
  ['resetDisplay', 'restart_alt'], ['resetSettings', 'tune'], ['ai', 'smart_toy'], ['downloadLogs', 'download'], ['copyLogs', 'content_paste'], ['copyConfig', 'content_copy'],
  ['guide', 'rocket_launch'], ['coach', 'lightbulb'], ['remote', 'public'], ['startCard', 'checklist'], ['wizard', 'wand_stars'],
  ['forceClose', 'cancel'], ['boom', 'warning'], ['logout', 'logout'],
]
const extraRows = computed(() => ORDER.filter(([id]) => has(id)).map(([id, icon]) => ({ id, icon })))
const rowTitle = (id) => props.labels?.[id]?.title || T.value[id] || id
const rowText = (id) => props.labels?.[id]?.text || T.value[id + 'Text'] || ''
function noteOf(id) {
  const n = props.notes?.[id]
  if (!n) return null
  return typeof n === 'string' ? { text: n, tone: 'info' } : (n.text ? n : null)
}

const lastError = computed(() => [...rows.value].reverse().find(isError) || null)
const options = computed(() => ({ network: true, hostNames: props.hostNames, clientNames: props.clientNames }))
const factsNow = computed(() => ({ ...props.facts, lastError: lastError.value?.message || '', at: lastError.value?.stamp || '', logTail: rows.value.slice(-30).map((r) => (r.stamp ? '[' + r.stamp + ']: ' + r.level + ': ' + r.message : r.message)).join('\n') }))

async function copySummary() {
  const text = problemSummary(factsNow.value, options.value)
  try { await navigator.clipboard.writeText(text); copied.value = true; setTimeout(() => { copied.value = false }, 1800); emit('copied', text) } catch { /* the clipboard is not available */ }
}
// the report form of the error surface (MErrorHost), opened with the last log lines; the row shows only where that surface is mounted in this window
const { state: errorState, reportFeedback } = useErrors()
const canFeedback = computed(() => errorState.hosted > 0)
function feedback() { reportFeedback({ logs: factsNow.value.logTail }) }
function showRow(id) { tab.value = 'log'; nextTick(() => viewer.value?.jumpTo(id)) }
</script>

<template>
  <MPage :title="title || T.title" class="m-diag" :class="{ 'is-log': tab === 'log' }" :updated="readAt" :locale="locale">
    <MGroup v-if="has('restart')">
      <MItem action icon="refresh" :title="rowTitle('restart')" :text="rowText('restart')" :disabled="!!disabled.restart" @click="call('restart')">
        <template v-if="noteOf('restart')" #control><MNotice :tone="noteOf('restart').tone" icon="check_circle">{{ noteOf('restart').text }}</MNotice></template>
      </MItem>
    </MGroup>

    <div class="m-diag__tabs"><MSeg block :model-value="tab" :options="tabs" :label="T.title" @update:model-value="tab = $event" /></div>

    <div v-show="tab === 'overview'" class="m-diag__overview">
      <MSection v-if="extraRows.length">
        <MGroup>
          <MItem v-for="row in extraRows" :key="row.id" action :icon="row.icon" :title="rowTitle(row.id)" :text="rowText(row.id)" :disabled="!!disabled[row.id]" @click="call(row.id)">
            <template v-if="noteOf(row.id)" #control><MNotice :tone="noteOf(row.id).tone || 'info'" :icon="noteOf(row.id).tone === 'error' ? 'error' : 'check_circle'">{{ noteOf(row.id).text }}</MNotice></template>
          </MItem>
        </MGroup>
      </MSection>
      <slot name="actions" />
      <MSection>
        <MGroup>
          <MItem action :icon="copied ? 'check_circle' : 'content_paste'" :title="copied ? T.copied : T.summary" :text="T.summaryHint" @click="copySummary" />
          <MItem v-if="canFeedback" action icon="send" :title="T.feedback" :text="T.feedbackHint" @click="feedback" />
          <MItem action icon="folder_zip" :title="T.exportRow" @click="exportOpen = true" />
        </MGroup>
      </MSection>
      <MSection :title="T.errors"><MErrorCentre :rows="rows" :locale="locale" :texts="texts" @show="showRow" @go="(p) => emit('go', p)" @open="(u) => emit('open', u)" /></MSection>
    </div>

    <div v-show="tab === 'log'" class="m-diag__log"><MLogViewer ref="viewer" fill :text="text" :records="records" :live="live" :locale="locale" :texts="texts" :stats-for="statsFor" :loading="logLoading" @update:live="(v) => emit('update:live', v)" @rows="(r) => { rows = r; readAt = Date.now() }" /></div>
    <slot name="tools" />

    <MDiagExport v-model="exportOpen" :collect="collect" :save="save" :host-names="hostNames" :client-names="clientNames" :locale="locale" :texts="texts" :close-label="closeLabel" :panel="panel" />
    <MDiagAi v-if="ai" :show="!!ai.show" :config="ai.config" :is-config-loading="!!ai.isConfigLoading" :is-saving-config="!!ai.isSavingConfig" :is-loading="!!ai.isLoading" :result="ai.result || ''" :error="ai.error || ''" :local-findings="ai.localFindings || []" :local-suggestions="ai.localSuggestions || []" :locale="locale" :texts="texts" @close="ai.onClose && ai.onClose()" @diagnose="call('diagnose')" />
  </MPage>
</template>
