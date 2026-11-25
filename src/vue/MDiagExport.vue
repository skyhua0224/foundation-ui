<script setup>
import { computed, ref, watch } from 'vue'
import MSheet from './MSheet.vue'
import MGroup from './MGroup.vue'
import MItem from './MItem.vue'
import MIconButton from './MIconButton.vue'
import MSwitchItem from './MSwitchItem.vue'
import MButton from './MButton.vue'
import MBanner from './MBanner.vue'
import MIcon from './MIcon.vue'
import MProgress from './MProgress.vue'
import { diagnosticsTexts } from '../diagnostics/texts.js'
import { finalizeBundle, prepareBundle } from '../diagnostics/bundle.js'
import { fillText } from './guideTexts.js'

// 导出诊断包: shows exactly what the bundle holds before anything is written. Every part is redacted in code first; the person can look at
// each one (the redacted text) and untick it, and choose whether IP addresses and machine names stay masked (they do by default).
// The product collects the material (`collect`) and writes the file (`save`); nothing leaves the machine unless the person shares the file.
const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  /** async () => { log, config, versions, os, gpu, displays, devices, sessions, crash } (parts a source cannot give are left out and shown as not available) */
  collect: { type: Function, required: true },
  /** async (name, bytes) => string | void : writes the file; a returned string (the path) is shown */
  save: { type: Function, required: true },
  hostNames: { type: Array, default: () => [] },
  clientNames: { type: Array, default: () => [] },
  locale: { type: String, default: 'en' },
  texts: { type: Object, default: null },
  product: { type: String, default: '' },
  /** the control panel adds its own log file next to the host log */
  panel: { type: Boolean, default: false },
  closeLabel: { type: String, default: 'Close' },
})
const T = computed(() => diagnosticsTexts(props.locale, props.texts))
const collected = ref(null)
const loading = ref(false)
const network = ref(true) // true = masked
const picked = ref(new Set())
const previewId = ref('')
const state = ref('') // '' | saving | saved | error
const where = ref('')

const entries = computed(() => (collected.value ? prepareBundle(collected.value, { network: network.value, hostNames: props.hostNames, clientNames: props.clientNames, panel: props.panel }) : []))
const chosen = computed(() => entries.value.filter((e) => e.available && picked.value.has(e.id)))
const total = computed(() => chosen.value.reduce((n, e) => n + e.size, 0))
const size = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)
const previewOf = (e) => (e.text.length > 4000 ? `${e.text.slice(0, 4000)}\n…` : e.text)
const line = (e) => [size(e.size), e.counts.secrets ? fillText(T.value.redactions, { secrets: e.counts.secrets }) : '', e.counts.ips + e.counts.names ? fillText(T.value.masked, { n: e.counts.ips + e.counts.names }) : ''].filter(Boolean).join(' · ')

watch(open, async (isOpen) => {
  if (!isOpen) return
  state.value = ''; where.value = ''; previewId.value = ''; loading.value = true
  try { collected.value = (await props.collect()) || {} } catch { collected.value = {} } finally { loading.value = false }
  picked.value = new Set(prepareBundle(collected.value, { network: true, panel: props.panel }).filter((e) => e.available && e.included).map((e) => e.id))
})
function toggle(id, on) { const next = new Set(picked.value); if (on) next.add(id); else next.delete(id); picked.value = next }
async function save() {
  if (!chosen.value.length) return
  state.value = 'saving'
  try {
    const out = finalizeBundle(entries.value, [...picked.value], { network: network.value, product: props.product })
    const result = await props.save(out.name, out.bytes)
    where.value = typeof result === 'string' ? result : ''
    state.value = 'saved'
  } catch (e) { state.value = e?.message === 'cancelled' ? '' : 'error' }
}
</script>

<template>
  <MSheet v-model="open" :title="T.export" side="end" :close-label="closeLabel" :persistent="state === 'saving'">
    <p class="m-diagx__lead">{{ T.exportLead }}</p>
    <div v-if="loading" class="m-diagx__loading"><span>{{ T.collecting }}</span><MProgress :label="T.collecting" /></div>
    <template v-else>
      <MGroup>
        <MSwitchItem :model-value="!network" icon="visibility" :title="T.includeNetwork" :text="network ? T.networkOn : T.networkOff" @update:model-value="(v) => { network = !v }" />
      </MGroup>
      <MGroup class="m-diagx__list">
        <template v-for="e in entries" :key="e.id">
          <MSwitchItem v-if="e.available" :model-value="picked.has(e.id)" :title="T.parts[e.id]" :text="line(e)" :icon="e.binary ? 'warning' : 'folder_zip'" @update:model-value="(v) => toggle(e.id, v)">
            <template #extra><MIconButton :icon="previewId === e.id ? 'visibility_off' : 'visibility'" :label="previewId === e.id ? T.hidePreview : T.preview" @click="previewId = previewId === e.id ? '' : e.id" /></template>
          </MSwitchItem>
          <MItem v-else :title="T.parts[e.id]" :text="T.notAvailable" icon="remove" class="is-off" />
          <MItem v-if="e.available && previewId === e.id" plain :title="''" class="m-diagx__previewrow">
            <template #control><pre class="m-diagx__pre">{{ previewOf(e) }}</pre></template>
          </MItem>
        </template>
      </MGroup>
      <MBanner v-if="entries.some((e) => e.unredacted && picked.has(e.id))" tone="warn" icon="warning">{{ T.crashWarn }}</MBanner>
      <MBanner v-if="state === 'saved'" tone="info" icon="check_circle">{{ T.saved }}{{ where ? `: ${where}` : '' }}</MBanner>
      <MBanner v-if="state === 'error'" tone="error" icon="error">{{ T.export }}: error</MBanner>
      <div class="m-diagx__foot">
        <span>{{ chosen.length ? fillText(T.total, { size: size(total) }) : T.nothing }}</span>
        <MButton icon="folder_zip" :loading="state === 'saving'" :disabled="!chosen.length" @click="save">{{ state === 'saving' ? T.saving : T.save }}</MButton>
      </div>
      <MProgress v-if="state === 'saving'" class="m-diagx__saving" :label="T.saving" />
    </template>
  </MSheet>
</template>
