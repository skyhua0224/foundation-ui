<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { installModality } from '../../a11y/modality.js'
import { afterFirstPaint } from '../afterFirstPaint.js'
import MButton from '../MButton.vue'
import MIcon from '../MIcon.vue'
import MProgress from '../MProgress.vue'
import InstallerRail from './InstallerRail.vue'
import InstallerComponents from './InstallerComponents.vue'
import InstallerSteps from './InstallerSteps.vue'
import InstallerLocation from './InstallerLocation.vue'
import InstallerDirConfirm from './InstallerDirConfirm.vue'
import { createBridge, emptyView } from './bridge.js'
import { confirmModel, locationModel, pageDirection, pageModel } from './installerModel.js'
import { t } from './installerTexts.js'

// The installer always runs with full motion and does not follow the system reduce-motion setting
// (data-motion="full" is the switch every m3e motion rule and helper already honours).
if (typeof document !== 'undefined') document.documentElement.dataset.motion = 'full'

/**
 * The installer window of Foundation Sunshine: the chrome (drag region, minimise, close), the step rail and the page of the moment, drawn from the latest InstallerView of the bridge (bridge.js).
 * It keeps no install state: a button sends an action, the host answers with a new snapshot, the page changes with a shared-axis slide.
 * `bridge` is the host's (Tauri) or a mock; without one the page makes its own (createBridge: `?scenario=` and `?page=` pick the mock).
 * `locale` follows the snapshot (the Windows language) unless given.
 */
const props = defineProps({
  bridge: { type: Object, default: null },
  locale: { type: String, default: '' },
  /** the page is the whole window of a transparent host (installer-ui): it draws the window's rounded surface and its shadow itself */
  windowed: { type: Boolean, default: false },
})
const emit = defineEmits(['view', 'action'])

const bridge = props.bridge || createBridge()
const view = shallowRef(emptyView())
const L = computed(() => props.locale || view.value.locale || 'zh')
const model = computed(() => pageModel(view.value, L.value))
const location = computed(() => (view.value.page === 'welcome' || view.value.page === 'maintenance' ? locationModel(view.value, L.value) : null))
// the question about a folder that only has a warning: open while the host says so, on whichever page the install was pressed
const dirConfirm = computed(() => (view.value.page === 'welcome' || view.value.page === 'components' ? confirmModel(view.value, L.value) : null))
// the folder picker is the system's and stays open as long as the person wants: the Change button shows busy until the host answers (it always does, a cancelled picker included)
const choosing = ref(false)
const copied = ref(false)
let copiedTimer = null

const direction = ref('fwd')
watch(() => view.value.page, (next, prev) => { direction.value = pageDirection(prev, next) }, { flush: 'sync' })
watch(() => view.value.page, () => { copied.value = false })

// Every press answers at once: the pressed button shows its busy state until the host sends the next snapshot. A host
// that does not answer within STALL_MS, or an action the bridge could not deliver, shows an error instead of silence.
const STALL_MS = 4000
const WAITS = ['install', 'retry', 'customize', 'back', 'open-panel', 'uninstall']
const pendingKey = ref('')
const stalled = ref('')
let stallTimer = null
function settle() { pendingKey.value = ''; stalled.value = ''; choosing.value = false; clearTimeout(stallTimer) }
// the first snapshot is taken in setup (a mock answers at once), so the first frame already is the page the host is on; until a host has answered, only the window is drawn
const got = ref(false)
const off = bridge.subscribe((v) => { view.value = v; got.value = true; emit('view', v); settle() })
// 'ready' goes out once the first frame is painted: the host keeps its window hidden until then (bridge.js, "Page root"), and a host that has not answered yet only gets the window drawn
let cancelReady = () => {}
// Esc: back from the components page, otherwise the window's close (the host minimises instead while the worker runs)
function onKey(e) {
  if (e.key !== 'Escape' || e.defaultPrevented || !got.value) return
  e.preventDefault()
  // Esc answers the question about a folder warning first (as Cancel): it never closes the window under it
  if (dirConfirm.value) { act({ type: 'cancel-dir-risk' }); return }
  act(view.value.page === 'components' ? { type: 'back' } : { type: 'exit' })
}
onMounted(() => {
  installModality(document)
  document.addEventListener('keydown', onKey)
  cancelReady = afterFirstPaint(() => bridge.send({ type: 'ready' }))
})
onBeforeUnmount(() => { off(); cancelReady(); clearTimeout(copiedTimer); clearTimeout(stallTimer); document.removeEventListener('keydown', onKey) })

function act(a, key = '') {
  if (!a) return
  emit('action', a)
  if (a.type === 'choose-dir') choosing.value = true
  if (WAITS.includes(a.type)) {
    pendingKey.value = key || a.type
    clearTimeout(stallTimer)
    stallTimer = setTimeout(() => { pendingKey.value = ''; stalled.value = t(L.value, 'err.noAnswer') }, STALL_MS)
  }
  Promise.resolve(bridge.send(a)).catch((e) => { clearTimeout(stallTimer); pendingKey.value = ''; choosing.value = false; stalled.value = t(L.value, 'err.notSent') + ' ' + String(e?.message || e).slice(0, 120) })
  if (a.type === 'copy-details') { copied.value = true; clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copied.value = false }, 2400) }
}
// a window narrower than 600 px takes the short label of a button that has one (the footer stays one row)
const root = ref(null)
const narrow = ref(false)
let sizeWatch = null
onMounted(() => { if (typeof ResizeObserver !== 'undefined' && root.value) { sizeWatch = new ResizeObserver(([e]) => { narrow.value = e.contentRect.width < 600 }); sizeWatch.observe(root.value) } })
onBeforeUnmount(() => sizeWatch?.disconnect())
const label = (b) => (b.key === 'copy' && copied.value ? t(L.value, 'fail.copied') : narrow.value && b.short ? b.short : b.label)

const compact = computed(() => view.value.page === 'components' || view.value.page === 'installing')
const done = computed(() => view.value.page === 'done')
</script>

<template>
  <div ref="root" class="m-inst" :class="{ 'm-inst--window': windowed, 'is-done': done }" :lang="L === 'zh' ? 'zh-CN' : 'en'" data-tauri-drag-region>
    <InstallerRail v-if="!done" :view="view" :locale="L" />
    <header class="m-inst__caption" data-tauri-drag-region>
      <!-- the Panel main window's caption buttons (SidebarMenu.vue .panel-caption__btn): 46 x 48, an 18 px glyph, 9 % / 14 % state layers, Windows red close -->
      <button type="button" class="m-inst__wc" :aria-label="t(L, 'minimise')" :data-tip="t(L, 'minimise')" @click="act({ type: 'minimise' })"><MIcon name="remove" /></button>
      <button type="button" class="m-inst__wc m-inst__wc--close" :aria-label="t(L, 'close')" :data-tip="t(L, 'close')" @click="act({ type: 'exit' })"><MIcon name="close" /></button>
    </header>
    <main class="m-inst__pane">
      <Transition :name="`m-inst-${direction}`">
        <section v-if="got" :key="view.page" class="m-inst__page" :class="[`m-inst__page--${view.page}`, { 'is-compact': compact }]" :aria-labelledby="`m-inst-title-${view.page}`">
          <template v-if="done">
            <div class="m-inst__hero">
              <span class="m-inst__seal" :class="{ 'is-opening': view.opening }">
                <!-- the emblem: the ring of the finished work closes, fills into the shape, and the check draws itself -->
                <svg class="m-inst__seal-art" viewBox="0 0 112 112" aria-hidden="true">
                  <circle class="m-inst__seal-ring" cx="56" cy="56" r="52" pathLength="1" />
                  <path class="m-inst__seal-tick" d="M34 58 L50 74 L80 42" pathLength="1" />
                </svg>
                <MProgress v-if="view.opening" circular class="m-inst__seal-spin" :label="t(L, 'done.opening')" />
              </span>
              <h1 :id="`m-inst-title-${view.page}`" class="m-inst__title m-inst__title--hero">{{ model.title }}</h1>
              <p v-if="model.lead" class="m-inst__lead m-inst__lead--hero" role="status">{{ model.lead }}</p>
            </div>
          </template>
          <template v-else>
            <div class="m-inst__head">
              <span v-if="!compact || view.page === 'installing'" class="m-inst__glyph" :class="`m-inst__glyph--${model.glyph.tone}`">
                <MProgress v-if="model.glyph.busy" circular class="m-inst__glyph-spin" :label="t(L, 'ins.progress')" />
                <MIcon v-else :name="model.glyph.icon" />
              </span>
              <div class="m-inst__headtext">
                <h1 :id="`m-inst-title-${view.page}`" class="m-inst__title">{{ model.title }}</h1>
                <p class="m-inst__lead">{{ model.lead }}</p>
              </div>
            </div>
            <div v-if="model.note && view.page !== 'installing'" class="m-inst__note" :class="[`m-inst__note--${model.note.tone}`, { 'm-selectable': view.page === 'failed' }]" role="note">
              <MIcon :name="model.note.icon" fill /><span>{{ model.note.text }}</span>
            </div>
            <InstallerLocation v-if="location" :model="location" :busy="choosing" @action="act" />
            <!-- the free-software notice and the support line, on the first page, as quiet body text -->
            <div v-if="view.page === 'welcome'" class="m-inst__legal" data-inst-notes><p>{{ t(L, 'welcome.free') }}</p><p>{{ t(L, 'welcome.support') }}</p></div>
            <InstallerComponents v-if="view.page === 'components'" :view="view" :locale="L" @action="act" />
            <InstallerSteps v-else-if="view.page === 'installing'" :view="view" :locale="L" :note="model.note" />
            <ul v-else-if="model.facts.length" class="m-inst__facts">
              <li v-for="f in model.facts" :key="f.title" class="m-inst__fact">
                <span class="m-inst__fact-icon" :class="`m-inst__glyph--${f.tone}`"><MIcon :name="f.icon" /></span>
                <span class="m-inst__fact-text"><b>{{ f.title }}</b><span>{{ f.text }}</span></span>
              </li>
            </ul>
          </template>
          <InstallerDirConfirm v-if="dirConfirm" :model="dirConfirm" :locale="L" @action="act" />
          <p v-if="stalled" class="m-inst__stall" role="alert"><MIcon name="error" fill /><span>{{ stalled }}</span></p>
          <footer class="m-inst__foot">
            <div class="m-inst__foot-start">
              <MButton v-for="b in model.start" :key="b.key" class="m-inst__btn m-inst__btn--start" :variant="b.variant" :disabled="b.disabled || !!pendingKey" :loading="b.loading || pendingKey === b.key" @click="act(b.act, b.key)">{{ label(b) }}</MButton>
            </div>
            <div class="m-inst__foot-end">
              <MButton v-for="b in model.end" :key="b.key" class="m-inst__btn" :variant="b.variant" :disabled="b.disabled || (!!pendingKey && pendingKey !== b.key)" :loading="b.loading || pendingKey === b.key" @click="act(b.act, b.key)">{{ label(b) }}</MButton>
            </div>
          </footer>
        </section>
      </Transition>
    </main>
  </div>
</template>
