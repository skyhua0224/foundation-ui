<script setup>
import MBreakText from './MBreakText.vue'
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import { usePageStamp } from './usePageStamp.js'
import MButton from './MButton.vue'
import MIconButton from './MIconButton.vue'
import MBanner from './MBanner.vue'
import MEndpointList from './MEndpointList.vue'
import { firewallCommand, reachOverview, reachView } from '../settings/reachability.js'
import { failureWords, reachTexts } from '../settings/reachTexts.js'
import { failureOf } from '../settings/remoteFlow.js'
import { stepIcon, stepPhaseWord, stepTitle } from '../settings/networkCheck.js'

// The connection paths of 主机设置 › 网络 as one calm list: a line per path (公网, 组网, 局域网) with the host's verdict as a small icon and chip, the one fact behind it and the address
// a client should enter with a copy button; under a line, each thing the host said once (evidence, a reason with the action that fixes it, a note). Then the public endpoints as a
// compact list and the port table, closed. Colour is only the status icon and the verdict chip: the rows are plain neutral surfaces.
//   report: the normalized report (settings/reachability.js) or null; status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'; lan: lanView(...) or null
//   emits: recheck, fix(action, row) (upnp, forward, restart, mesh, origin are the product's to do; firewall and outside open here), save-address(value)
const props = defineProps({
  report: { type: Object, default: null },
  status: { type: String, default: 'idle' },
  /** the HTTP status of the answer that was no report (useReachability's `view.http`) and why a request failed (`view.cause`): they decide what the failure says */
  http: { type: Number, default: 0 },
  cause: { type: String, default: '' },
  locale: { type: String, default: 'en' },
  platform: { type: String, default: 'windows' },
  copy: { type: Function, default: null },
  lan: { type: Object, default: null },
  /** while a check runs: { done, total, text, steps: [{ key, id, subject, phase }] } (useReachability's `view.progress`) */
  progress: { type: Object, default: null },
  /** the public endpoints in the configuration as one string; the list is shown when `addressEditable` */
  endpoints: { type: String, default: '' },
  addressEditable: { type: Boolean, default: false },
  addressBusy: { type: Boolean, default: false },
  /** the accessible name of the section where a page lists it as a setting */
  label: { type: String, default: '' },
})
const emit = defineEmits(['recheck', 'fix', 'save-address'])
const T = computed(() => reachTexts(props.locale))
const fail = computed(() => failureWords(failureOf({ status: props.status, http: props.http, cause: props.cause }), props.locale))
const view = computed(() => reachView(props.report, props.locale))
const paths = computed(() => [...reachOverview(props.report, props.locale), ...(props.lan ? [{ ...props.lan, notes: [] }] : [])])
const publicPath = computed(() => view.value?.paths.find((p) => p.id === 'public') || null)
const loading = computed(() => props.status === 'loading')
const stamped = !!usePageStamp({ at: () => Date.parse(props.report?.checkedAt) || 0, refreshing: loading, refresh: () => emit('recheck'), locale: () => props.locale })
const list = ref(null)
const open = ref('')
const copied = ref('')
let timer = 0
async function copyText(text) {
  try {
    if (props.copy) await props.copy(text)
    else await globalThis.navigator?.clipboard?.writeText(text)
    copied.value = text; clearTimeout(timer); timer = setTimeout(() => { copied.value = '' }, 1600)
  } catch { /* the text stays visible */ }
}
function fix(path, row) {
  const key = `${path.id}:${row.code}`
  if (row.action === 'address') { list.value?.add(); return }
  if (row.action === 'use-wan') { const wan = props.report?.public?.router; list.value?.add(wan?.wanClass === 'public' && wan.wanIp ? wan.wanIp : ''); return }
  if (row.action === 'firewall' || row.action === 'outside') { open.value = open.value === key ? '' : key; return }
  emit('fix', row.action, row)
}
const running = computed(() => !!(loading.value && props.progress && props.progress.steps.length))
// what a screen reader hears while the check goes: the step that is going or the one that has just ended, with the count
const announce = computed(() => {
  const steps = props.progress?.steps || []
  const now = steps.find((s) => s.phase === 'running') || [...steps].reverse().find((s) => s.phase === 'done')
  return now ? `${stepTitle(now, props.locale)}: ${stepPhaseWord(now, props.locale)} (${props.progress.text})` : ''
})
const NOTE_ICON = { problem: 'warning', evidence: 'history', good: 'check_circle', note: 'info' }
const PATH_ICON = { public: 'public', mesh: 'hub', lan: 'lan' }
const command = computed(() => firewallCommand(props.report, props.platform === 'windows' ? 'windows' : 'linux'))
const base = computed(() => (props.report?.ports || []).find((p) => p.role === 'http')?.port || '')
</script>

<template>
  <section class="m-reacho" :aria-busy="loading && !running" :aria-label="label || T.overview.label">
    <div class="m-reacho__bar">
      <small v-if="!stamped">{{ view?.checkedAt ? T.checkedAt.replace('{time}', view.checkedAt) : T.notChecked }}</small>
      <MButton variant="tonal" size="sm" icon="refresh" :loading="loading" @click="emit('recheck')">{{ loading ? (progress ? `${T.checking} ${progress.text}` : T.checking) : T.recheck }}</MButton>
    </div>
    <ol v-if="running" class="m-reacho__run">
      <li v-for="s in progress.steps" :key="s.key" :class="[`is-${s.phase}`, s.phase === 'done' && s.state !== 'running' ? `is-${s.state}` : '']"><MIcon :name="stepIcon(s)" :fill="s.phase === 'done'" /><span>{{ stepTitle(s, locale) }}</span><small class="m-reacho__sr">{{ stepPhaseWord(s, locale) }}</small></li>
    </ol>
    <span v-if="running" class="m-reacho__sr" role="status" aria-live="polite">{{ announce }}</span>
    <MBanner v-if="status === 'unavailable' || status === 'error'" class="m-reach__fail" :tone="status === 'error' ? 'error' : 'info'" :icon="status === 'error' ? 'error' : 'info'">
      <b>{{ fail.title }}</b> {{ fail.why }} <span v-if="fail.next">{{ fail.next }}</span>
      <template v-if="status === 'error'" #actions><MButton variant="text" size="sm" icon="refresh" @click="emit('recheck')">{{ T.recheck }}</MButton></template>
    </MBanner>

    <ul v-if="paths.length" class="m-reacho__paths" role="list">
      <li v-for="path in paths" :key="path.id" class="m-reacho__path" :class="`is-${path.tone}`" :data-path="path.id" :data-verdict="path.verdict">
        <div class="m-reacho__row">
          <span class="m-reacho__ico" :title="path.word"><MIcon :name="PATH_ICON[path.id]" /><MIcon class="m-reacho__badge" :name="path.icon" fill /></span>
          <div class="m-reacho__main">
            <div class="m-reacho__title"><b>{{ path.title }}</b><span class="m-reacho__word">{{ path.word }}</span></div>
            <p v-if="path.fact" class="m-reacho__fact">{{ path.fact }}</p>
          </div>
          <div class="m-reacho__addr" :aria-label="path.addressLabel">
            <template v-if="path.address">
              <code><MBreakText :text="path.address" /></code>
              <MIconButton :icon="copied === path.address ? 'check' : 'content_copy'" :label="copied === path.address ? T.copied : T.overview.copyLabel.replace('{address}', path.address)" @click="copyText(path.address)" />
            </template>
            <small v-else-if="path.verdict !== 'loading'">{{ T.noAddress }}</small>
          </div>
        </div>
        <ul v-if="path.notes.length" class="m-reacho__notes" role="list">
          <li v-for="(row, i) in path.notes" :key="row.code || `${row.kind}${i}`" :class="`is-${row.kind}`" :data-code="row.code || undefined">
            <MIcon :name="row.kind === 'adapter' ? (row.up ? 'link' : 'link_off') : NOTE_ICON[row.kind]" />
            <span class="m-reacho__note">{{ row.text }}</span>
            <MButton v-if="row.action" variant="text" size="sm" @click="fix(path, row)">{{ row.actionLabel }}</MButton>
            <div v-if="open === `${path.id}:${row.code}`" class="m-reacho__fix">
              <template v-if="row.action === 'firewall'">
                <p>{{ platform === 'windows' ? T.fixFirewall : T.fixFirewallLinux }}</p>
                <div v-if="command" class="m-reach__cmd"><code>{{ command }}</code><MButton variant="tonal" size="sm" :icon="copied === command ? 'check' : 'content_copy'" @click="copyText(command)">{{ copied === command ? T.copied : T.copy }}</MButton></div>
              </template>
              <p v-else>{{ T.fixOutside }}</p>
            </div>
          </li>
        </ul>
      </li>
    </ul>

    <MEndpointList v-if="addressEditable && status !== 'unavailable'" ref="list" :saved="endpoints" :results="publicPath?.endpoints || []" :locale="locale" :busy="addressBusy" :checking="loading" @save="(v) => emit('save-address', v)" />

    <details v-if="view?.portRows.length" class="m-reach__ports">
      <summary><MIcon name="keyboard_arrow_down" />{{ T.overview.details }}<small v-if="base">{{ T.portsHint.replace('{base}', base) }}</small></summary>
      <table>
        <thead><tr><th>{{ T.colRole }}</th><th>{{ T.colProto }}</th><th>{{ T.colInternal }}</th><th>{{ T.colListen }}</th><th>{{ T.colFirewall }}</th></tr></thead>
        <tbody>
          <tr v-for="p in view.portRows" :key="`${p.proto}${p.port}`" :data-role="p.role">
            <td>{{ p.name }}<small v-if="p.note"> · {{ p.note }}</small></td><td>{{ p.proto }}</td><td>{{ p.port }}</td>
            <td :class="`is-${p.state}`">{{ p.stateWord }}</td>
            <td :class="`is-${p.firewall}`">{{ p.firewallWord }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </section>
</template>
