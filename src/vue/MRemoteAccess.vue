<script setup>
import { computed, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import MBanner from './MBanner.vue'
import MSeg from './MSeg.vue'
import MChoiceCards from './MChoiceCards.vue'
import MReachCard from './MReachCard.vue'
import MRemotePublic from './MRemotePublic.vue'
import { MESH_COMMANDS, MESH_LINKS, REMOTE_MODES } from './guideModel.js'
import { remoteTexts } from './remoteTexts.js'

// How a client reaches this computer from outside the network, as a tutorial: only this network (nothing to do), over the internet (UPnP first, then a port forward by hand,
// with the risks), or over a mesh network (Tailscale, ZeroTier or EasyTier). One component for both products and for the three places
// it is shown: the optional step of the first-run flow, 主机设置 › 网络 and 帮助.
//   state:     { network: { port, upnpActive, upnpSaved, loaded }, host: { platform, addresses }, reach: { report, status } (the host's own reachability check, see MReachCard) }
//   callbacks: loadNetwork(), setUpnp(on) -> { ok, error? }, setPublicEndpoints(value) -> { ok, error? }, restartHost() -> { ok }, probeHost() -> { ok, startedAt? }, checkReach(force, { test }), openSetting(key), openLink(url), copy(text)
// The check runs after UPnP is turned on, on demand after the port-forward guide, and when the mesh choice is opened; a host without the check keeps the plain listener check.
const props = defineProps({
  locale: { type: String, default: 'en' },
  state: { type: Object, default: () => ({}) },
  callbacks: { type: Object, default: () => ({}) },
  /** open on this choice (the tutorial opened from a fix: 'public' or 'mesh') */
  initialMode: { type: String, default: '' },
  /** the mode is chosen outside (the done page of the guide): the three cards are not shown */
  hideChoice: { type: Boolean, default: false },
  /** the page around it shows the host's check itself: the mesh path does not repeat it */
  hideReach: { type: Boolean, default: false },
})
const T = computed(() => remoteTexts(props.locale))

const mode = ref(props.initialMode || 'lan')
const modeOptions = computed(() => REMOTE_MODES.map((value) => ({ value, label: T.value.modes[value], text: T.value.modeText[value], icon: { lan: 'lan', public: 'public', mesh: 'hub' }[value] })))

/* ---------- the check, for the mesh choice (the internet choice runs its own flow: MRemotePublic) ---------- */
const reach = computed(() => props.state.reach || { report: null, status: 'idle', http: 0, cause: '' })
const runReach = (force = true) => props.callbacks.checkReach?.(force)
watch(mode, (value) => { if (value === 'mesh' || value === 'public') void runReach(true) }, { immediate: true })
function onFix(action) {
  if (action === 'mesh') mode.value = 'mesh'
  else if (action === 'restart') void props.callbacks.restartHost?.()
  else if (action === 'origin') props.callbacks.openSetting?.('origin_web_ui_allowed')
}

/* ---------- mesh ---------- */
const other = ref('tailscale')
const copied = ref('')
let timer = 0
async function copyText(text) {
  try {
    if (props.callbacks.copy) await props.callbacks.copy(text)
    else await globalThis.navigator?.clipboard?.writeText(text)
    copied.value = text; clearTimeout(timer); timer = setTimeout(() => { copied.value = '' }, 1600)
  } catch { /* the text stays visible */ }
}
const openLink = (url) => (props.callbacks.openLink ? props.callbacks.openLink(url) : globalThis.open?.(url, '_blank', 'noopener,noreferrer'))
</script>

<template>
  <div class="m-remote">
    <MChoiceCards v-if="!hideChoice" v-model="mode" :options="modeOptions" :label="T.mode" :columns="3" />

    <!-- only this network -->
    <MBanner v-if="mode === 'lan'" tone="info" icon="check_circle">{{ T.lanDone }}</MBanner>

    <!-- over the internet -->
    <MRemotePublic v-else-if="mode === 'public'" :locale="locale" :state="state" :callbacks="callbacks" @mesh="mode = 'mesh'" />

    <!-- mesh network -->
    <template v-else>
      <h3 class="m-remote__h">{{ T.meshTitle }}</h3>
      <MSeg v-model="other" block :label="T.meshTitle" :options="['tailscale', 'zerotier', 'easytier'].map((value) => ({ value, label: T.tools[value] }))" />
      <ol class="m-remote__steps">
        <li><b>1</b><span>{{ T.steps.install }}</span><MButton variant="text" size="sm" icon="open_in_new" @click="openLink(MESH_LINKS[other])">{{ T.tools[other] }}</MButton></li>
        <li><b>2</b><span>{{ T.toolText[other] }}</span></li>
        <li><b>3</b><span>{{ T.steps.add }}</span></li>
      </ol>
      <div class="m-remote__field"><span>{{ T.join }}</span><code>{{ MESH_COMMANDS[other].join }}</code><MButton variant="tonal" size="sm" :icon="copied === MESH_COMMANDS[other].join ? 'check' : 'content_copy'" @click="copyText(MESH_COMMANDS[other].join)">{{ copied === MESH_COMMANDS[other].join ? T.copied : T.serverCopy }}</MButton></div>
      <MReachCard v-if="!hideReach && reach.status !== 'idle' && reach.status !== 'unavailable'" only="mesh" :report="reach.report" :status="reach.status" :http="reach.http || 0" :cause="reach.cause || ''" :locale="locale" :platform="state.host?.platform || 'windows'" :copy="callbacks.copy" @recheck="runReach(true)" @fix="onFix" />
      <div class="m-remote__field"><span>{{ T.address }}</span><code>{{ MESH_COMMANDS[other].address }}</code><MButton variant="tonal" size="sm" :icon="copied === MESH_COMMANDS[other].address ? 'check' : 'content_copy'" @click="copyText(MESH_COMMANDS[other].address)">{{ copied === MESH_COMMANDS[other].address ? T.copied : T.serverCopy }}</MButton></div>
    </template>

  </div>
</template>
