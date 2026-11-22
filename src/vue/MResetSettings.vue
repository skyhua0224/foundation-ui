<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MPage from './MPage.vue'
import MSection from './MSection.vue'
import MGroup from './MGroup.vue'
import MItem from './MItem.vue'
import MNotice from './MNotice.vue'
import MResetConfirm from './MResetConfirm.vue'
import { backupTime, backupView, createLatest, failureText, latestBackup } from '../reset/model.js'
import { resetTexts } from '../reset/texts.js'

// 恢复默认设置, one page for both products. The product passes what it can reset:
//   host   the client of the host's reset calls (createResetClient), or null where the host cannot be reached
//   panel  { reset: async () => void } for the preferences of the control panel, or null in the browser (there is no panel there)
// Each reset asks first (MResetConfirm: what is reset, what stays, a button that counts down); the host's restores the last backup from the same place.
const props = defineProps({
  locale: { type: String, default: 'en' },
  host: { type: Object, default: null },
  panel: { type: Object, default: null },
  streaming: { type: Boolean, default: false },
  back: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
const emit = defineEmits(['back', 'done'])
const T = computed(() => resetTexts(props.locale))
const backups = ref([])
// how the last read of the backups went: loading, ok, error (the row offers to read again) or stale (a reset worked: read again when the host is back)
const state = ref('loading')
const latest = computed(() => latestBackup({ backups: backups.value }))
const when = computed(() => backupTime(latest.value?.created_ms, props.locale))
const view = computed(() => backupView({ state: state.value, backups: backups.value }, T.value, props.locale))
const asking = ref('')
const busy = ref(false)
const note = ref(null)
let refresh = 0

// an answer to a read that was started before a reset worked, or before a newer read, is dropped
const reads = createLatest()
async function load() {
  if (!props.host) return
  const token = reads.next()
  const answer = await props.host.status()
  if (!reads.isCurrent(token)) return
  if (answer.ok) { backups.value = Array.isArray(answer.data?.backups) ? answer.data.backups : []; state.value = 'ok' } else state.value = 'error'
}
onMounted(load)
// a page that was mounted before the host was known reads the backups once it is
watch(() => props.host, (host) => { if (host) load() })
onBeforeUnmount(() => clearTimeout(refresh))

function ask(kind) { note.value = null; asking.value = kind }
const open = computed({ get: () => !!asking.value, set: (value) => { if (!value && !busy.value) asking.value = '' } })

async function confirm(choice) {
  const kind = asking.value
  busy.value = true
  let answer
  try {
    if (kind === 'host') answer = await props.host.reset(choice?.clearApps)
    else if (kind === 'restore') answer = await props.host.restore()
    else { await props.panel.reset(); answer = { ok: true } }
  } catch { answer = { ok: false, code: kind === 'panel' ? 'panel_failed' : 'failed' } }
  busy.value = false
  asking.value = ''
  if (answer.ok) {
    note.value = { tone: 'info', icon: 'check_circle', text: kind === 'host' ? T.value.doneHost : kind === 'restore' ? T.value.doneRestore : T.value.donePanel }
    emit('done', kind)
    // the host restarts: the backup that was newest is not the newest any more, so the row offers none until the list is read again once the host is back
    if (kind !== 'panel') { reads.invalidate(); state.value = 'stale'; clearTimeout(refresh); refresh = setTimeout(load, 9000) }
  } else {
    note.value = { tone: 'error', icon: 'error', text: failureText(T.value, answer.code) }
  }
}
</script>

<template>
  <MPage :title="title || T.title" :back="back" :locale="locale" @back="emit('back')">
    <MNotice v-if="note" :tone="note.tone" :icon="note.icon" class="m-reset__note">{{ note.text }}</MNotice>
    <MSection v-if="host" :title="T.hostTitle">
      <MGroup>
        <MItem action icon="restart_alt" :title="T.hostRow" :text="T.hostRowText" data-reset="host" @click="ask('host')" />
        <MItem action icon="history" :title="T.restoreRow" :text="view.text" :disabled="!view.enabled" data-reset="restore" @click="view.retry ? load() : ask('restore')" />
      </MGroup>
    </MSection>
    <MSection v-if="panel" :title="T.panelTitle">
      <MGroup>
        <MItem action icon="tune" :title="T.panelRow" :text="T.panelRowText" data-reset="panel" @click="ask('panel')" />
      </MGroup>
    </MSection>
    <MResetConfirm v-model="open" :kind="asking || 'host'" :locale="locale" :time="when" :has-apps="!!latest?.has_apps" :streaming="streaming" :busy="busy" @confirm="confirm" />
  </MPage>
</template>
