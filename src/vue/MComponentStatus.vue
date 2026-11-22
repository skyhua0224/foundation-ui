<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import MPage from './MPage.vue'
import MIcon from './MIcon.vue'
import MChip from './MChip.vue'
import MButton from './MButton.vue'
import MRing from './MRing.vue'
import { COMPONENT_ICONS, EXTENSION_COMPONENTS } from '../status/model.js'
import { fillText } from './guideTexts.js'
import { stampClock } from '../stamp/index.js'

// 组件状态: one card per component, a single row of facts and buttons: state, version, a ring of the checks that passed, the time of the last
// check, the check button and the update or repair action. A component with no update path says so with a muted chip on the same card.
// Cards sit two to a row where the page is wide. The controller (createComponentStatus) holds the data; the page only draws it and calls it.
const props = defineProps({ status: { type: Object, required: true }, poll: { type: Number, default: 30000 } })
const T = computed(() => props.status.text())
const rows = computed(() => props.status.rows.value.filter((r) => r.id !== 'sparxie' || r.hasSource))
// the page's "updated" stamp: the latest check of any card; clicking it checks them all
const latest = computed(() => Math.max(0, ...rows.value.map((r) => Number(r.result?.at) || 0)))
const busy = computed(() => rows.value.some((r) => r.checking))
const TONE = { ok: 'ok', warn: 'warn', error: 'error', missing: 'warn', unknown: 'neutral' }
const STATE_ICON = { ok: 'check_circle', warn: 'warning', error: 'error', missing: 'warning', unknown: 'help' }
const RESULT_ICON = { ok: 'check_circle', warn: 'warning', error: 'error' }
const KINDS = [['install', 'download'], ['import', 'upload_file'], ['update', 'system_update_alt'], ['repair', 'build'], ['open', 'open_in_new'], ['remove', 'delete']]
const EXT = EXTENSION_COMPONENTS
// remove, and Sparxie's own open, only make sense once the component is there
const gone = (row, kind) => ['remove', 'open'].includes(kind) && (kind === 'remove' || row.id === 'sparxie') && ['missing', 'unknown'].includes(row.state)
const buttons = (row) => KINDS.filter(([kind]) => row.actions[kind] && !gone(row, kind)).map(([kind, icon]) => ({ kind, icon, label: typeof row.actions[kind].label === 'function' ? row.actions[kind].label(T.value, row) : row.actions[kind].label || T.value[kind] }))
const line = (row) => {
  if (!row.loaded && row.hasSource) return T.value.checking
  if (row.state === 'unknown') return row.note ? T.value[row.note] || T.value.unknownNote : T.value.unknownNote
  if (row.state === 'missing' && row.id === 'sparxie') return ''
  return row.version || row.note || T.value.noVersion
}
// an extension component has no update: it is imported again from a file; where the product cannot import (the Web UI) the card says where to
const hasUpdatePath = (row) => (row.id === 'sparxie' || EXT[row.id] ? !!row.actions.import : !!row.actions.update)
const pathNote = (row) => (EXT[row.id] ? T.value.ext.importInPanel : row.actions.note === 'viaPanel' ? T.value.viaPanel : T.value.noUpdatePath)
const fillDll = (text, id) => String(text).replace('{dll}', EXT[id].dll).replace('{other}', EXT[id].other)
// The ring is the checks that passed of the checks that ran (what the source reports now, or the last check): real numbers only
const counted = (row) => (row.result?.checks || row.checks).filter((c) => c.result !== 'skip')
const ring = (row) => { const list = counted(row); return list.length ? { total: list.length, passed: list.filter((c) => c.result === 'ok').length } : null }
const ringTone = (row) => (row.state === 'error' ? 'error' : row.state === 'ok' ? 'primary' : 'tertiary')
const summary = (r) => (!r.total ? T.value.summaryUnknown : r.failed.length ? fillText(T.value.summaryProblem, { n: r.failed.length, total: r.total }) : fillText(T.value.summaryOk, { n: r.passed }))
const timeOf = (r) => fillText(T.value.checked, { time: stampClock(r.at, props.status.locale?.() || 'en') })
const labelOf = (c) => (c.id.startsWith('driver:') ? c.value : T.value.checks[c.id] || c.id)
const valueOf = (c) => (c.id.startsWith('driver:') ? '' : String(c.value || '').startsWith('@') ? T.value.sparxie.issues?.[c.value.slice(1)] || '' : c.value || '')
onMounted(() => props.status.start(props.poll))
onBeforeUnmount(() => props.status.stop())
</script>

<template>
  <MPage :title="T.title" class="m-compstat" :updated="latest" :refreshing="busy" refreshable :locale="status.locale?.() || 'en'" @refresh="status.checkAll()">
    <template #actions><MButton variant="tonal" icon="monitor_heart" :loading="rows.some((r) => r.checking)" @click="status.checkAll()">{{ T.checkAll }}</MButton></template>
    <div class="m-comp-grid">
      <article v-for="row in rows" :key="row.id" class="m-comp" :class="`m-comp--${row.state}`" :data-component="row.id" :data-state="row.state">
        <header class="m-comp__head">
          <span class="m-comp__icon"><MIcon :name="COMPONENT_ICONS[row.id]" /></span>
          <div class="m-comp__id"><h3 class="m-comp__name">{{ T.names[row.id] }}<small v-if="EXT[row.id] || row.id === 'sparxie'" class="m-comp__ext">{{ T.ext.badge }}</small></h3><p class="m-comp__line">{{ line(row) }}</p></div>
          <MRing v-if="ring(row)" class="m-comp__ring" :size="44" :value="ring(row).passed / ring(row).total" :tone="ringTone(row)" :label="`${ring(row).passed}/${ring(row).total}`"><span class="m-comp__ringtext">{{ ring(row).passed }}/{{ ring(row).total }}</span></MRing>
        </header>
        <p v-if="row.id === 'sparxie' && row.state === 'missing'" class="m-comp__hint">{{ T.sparxie.bring }}</p>
        <p v-if="row.progress" class="m-comp__progress" data-progress="1">{{ row.progress.stage }}<b>{{ row.progress.percent }}%</b></p>
        <div class="m-comp__meta">
          <MChip :tone="TONE[row.state]" :icon="STATE_ICON[row.state]">{{ T.states[row.state] }}</MChip>
          <span v-if="!hasUpdatePath(row)" class="m-comp__nopath" :title="pathNote(row)"><MIcon name="info" />{{ pathNote(row) }}</span>
          <span v-if="row.result" class="m-comp__time">{{ timeOf(row.result) }}</span>
        </div>
        <details v-if="EXT[row.id]" class="m-comp__help">
          <summary><MIcon name="help" />{{ T.ext.helpTitle }}</summary>
          <p>{{ T.ext.help[row.id] }}</p>
          <p class="m-comp__warn"><MIcon name="warning" />{{ fillDll(T.ext.mixWarning, row.id) }}</p>
        </details>
        <ul v-if="row.result" class="m-comp__checks" :aria-label="summary(row.result)">
          <li v-for="c in row.result.checks.filter((x) => x.result !== 'skip')" :key="c.id" :class="`is-${c.result}`"><MIcon :name="RESULT_ICON[c.result]" /><span>{{ labelOf(c) }}</span><b v-if="valueOf(c)">{{ valueOf(c) }}</b></li>
        </ul>
        <footer class="m-comp__actions">
          <MButton size="sm" variant="tonal" icon="monitor_heart" :loading="row.checking" :disabled="!row.hasSource" @click="status.check(row.id)">{{ T.check }}</MButton>
          <MButton v-for="b in buttons(row)" :key="b.kind" size="sm" :variant="b.kind === 'repair' || b.kind === 'install' ? 'filled' : 'outlined'" :icon="b.icon" @click="row.actions[b.kind].run()">{{ b.label }}</MButton>
        </footer>
      </article>
    </div>
    <slot />
  </MPage>
</template>
