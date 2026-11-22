<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MItem from './MItem.vue'
import MGroup from './MGroup.vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import MBreakText from './MBreakText.vue'
import MGuidePort from './MGuidePort.vue'
import { addressPlan } from './guideEntry.js'
import { DEFAULT_BASE_PORT, isDefaultPort } from './hostAddress.js'
import { fillText } from './guideTexts.js'

// 在已安装的客户端与此设备配对, for an ordinary person, in three layers:
//   1 the client lists this computer by itself: click it (most people on one network stop here);
//   2 「没出现？」: ONE recommended address, large, with copy and the pairing QR code, the usual causes and the port when it is not the default;
//   3 「其他连接方式」: the addresses of other adapters (ZeroTier, Tailscale, EasyTier …), each named by its own adapter, never classified by the person.
// No command line: the host lists its addresses; with none, 「重新检测」 and the diagnostics page. The public address belongs to the remote access step.
//   callbacks: loadNetwork(), refreshAddresses(), setPort(port) -> { ok, error? }, restartHost(), checkPorts()? (the host's 体检 of the network group: { ok, items, worst, unsupported? }), openDiagnostics()?
//   addresses: the host's listener answer (null: unknown), hostName: the name clients list, network: { port (saved), activePort (the host listens on it now) }
//   pairQr: the view of usePairQr (image, address, state, seconds); qr-begin / qr-stop: the code is asked for only while the second layer is open
const props = defineProps({
  T: { type: Object, required: true },
  addresses: { type: Array, default: null },
  hostName: { type: String, default: '' },
  network: { type: Object, default: () => ({}) },
  copied: { type: String, default: '' },
  pairQr: { type: Object, default: null },
  callbacks: { type: Object, default: () => ({}) },
  /** the second layer starts open (the gallery and a search result) */
  open: { type: Boolean, default: false },
  /** 'listed': only the client finds this computer by itself; 'trouble': only what to do when it does not (the pair step shows the two apart); '' both */
  only: { type: String, default: '' },
})
const emit = defineEmits(['copy', 'qr-begin', 'qr-stop'])
const A = computed(() => props.T.address)
// the port the host listens on now is the one a client types; a saved port that is not in use yet is in the port row's restart note
const port = computed(() => Number(props.network.activePort) || Number(props.network.port) || DEFAULT_BASE_PORT)
const plan = computed(() => addressPlan(props.addresses, port.value))
const listed = computed(() => (props.hostName ? fillText(A.value.listed, { name: props.hostName }) : A.value.listedNoName))
const miss = ref(props.open)
const others = ref(false)
const checking = ref(false)
const copyLabel = (text) => (props.copied === text ? props.T.copied : props.T.copy)
const kindLabel = (a) => A.value.kinds[a.kind] || A.value.kinds.other
// what names an other address: how a client reaches it, and the adapter's own name unless that says the same
const lineOf = (a) => { const way = kindLabel(a); return !a.name || a.name.toLowerCase().includes(way.toLowerCase()) ? (a.name || way) : `${way} · ${a.name}` }
const iconOf = (a) => (a.kind === 'lan' ? 'lan' : a.kind === 'public' ? 'public' : 'hub')
const qrShown = computed(() => !!props.pairQr && props.pairQr.state === 'ready' && props.pairQr.image && props.pairQr.image.d)
watch(miss, (on) => { if (props.pairQr) emit(on ? 'qr-begin' : 'qr-stop') }, { immediate: true })
onBeforeUnmount(() => { if (miss.value && props.pairQr) emit('qr-stop') })
async function recheck() { checking.value = true; try { await Promise.all([props.callbacks.loadNetwork?.(), props.callbacks.refreshAddresses?.()]) } finally { checking.value = false } }
// the port row saves through the product's config route (setPort) and offers the restart
const portCallbacks = { savePort: (port) => (props.callbacks.setPort ? props.callbacks.setPort(port) : Promise.resolve({ ok: false })), restartHost: () => (props.callbacks.restartHost ? props.callbacks.restartHost() : Promise.resolve({ ok: false })), reload: () => props.callbacks.loadNetwork?.(), ...(props.callbacks.checkPorts ? { checkPorts: () => props.callbacks.checkPorts() } : {}), ...(props.callbacks.openDiagnostics ? { openDiagnostics: () => props.callbacks.openDiagnostics() } : {}) }
</script>

<template>
  <figure v-if="only !== 'trouble'" class="m-guide__listed" data-layer="listed">
    <span class="m-guide__listart" aria-hidden="true">
      <span class="m-guide__listrow"><MIcon name="desktop_windows" fill /><b data-redact="host">{{ hostName || T.address.kinds.lan }}</b></span>
      <MIcon class="m-guide__listtap" name="touch_app" fill />
    </span>
    <figcaption class="m-guide__text">{{ listed }}</figcaption>
  </figure>

  <template v-if="only !== 'listed'">
  <MGroup>
    <MItem action icon="help" :title="A.notShowing" :aria-expanded="miss" @click="miss = !miss">
      <template #trail><MIcon :name="miss ? 'keyboard_arrow_up' : 'keyboard_arrow_down'" /></template>
    </MItem>
  </MGroup>
  <section v-if="miss" class="m-guide__miss" data-layer="address" :aria-label="A.notShowing">
    <template v-if="plan.main">
      <p class="m-guide__text">{{ A.typeThis }}</p>
      <div class="m-guide__big" role="status">
        <code class="m-guide__bigaddr" data-redact="address"><MBreakText :text="plan.main.text" /></code>
        <MButton variant="tonal" :icon="copied === plan.main.text ? 'check' : 'content_copy'" @click="emit('copy', plan.main.text)">{{ copyLabel(plan.main.text) }}</MButton>
      </div>
      <p v-if="!isDefaultPort(port)" class="m-guide__note"><MIcon name="info" />{{ fillText(A.portKept, { port }) }}</p>
      <figure v-if="qrShown" class="m-guide__qr m-guide__qr--address" data-redact="pin">
        <svg :viewBox="`0 0 ${pairQr.image.size} ${pairQr.image.size}`" shape-rendering="crispEdges" role="img" :aria-label="A.scan"><rect :width="pairQr.image.size" :height="pairQr.image.size" fill="#fff" /><path :d="pairQr.image.d" fill="#000" /></svg>
        <figcaption>{{ A.scan }}<template v-if="pairQr.address"> · {{ pairQr.address }}</template></figcaption>
      </figure>
      <p class="m-guide__note"><MIcon name="wifi" />{{ A.usual }}</p>
    </template>
    <template v-else>
      <p class="m-guide__note" role="status"><MIcon name="info" />{{ A.none }}</p>
      <div class="m-guide__recheck">
        <MButton variant="tonal" icon="refresh" :loading="checking" @click="recheck">{{ checking ? A.checking : A.recheck }}</MButton>
        <MButton v-if="callbacks.openDiagnostics" variant="text" icon="health_and_safety" @click="callbacks.openDiagnostics()">{{ A.diagnostics }}</MButton>
      </div>
    </template>
  </section>

  <MGroup v-if="plan.others.length">
    <MItem action icon="hub" :title="A.others" :aria-expanded="others" @click="others = !others">
      <template #trail><MIcon :name="others ? 'keyboard_arrow_up' : 'keyboard_arrow_down'" /></template>
    </MItem>
    <template v-if="others">
      <MItem v-for="a in plan.others" :key="a.address" :icon="iconOf(a)" :text="lineOf(a)">
        <template #title><MBreakText :text="a.text" /></template>
        <template #trail><MButton variant="tonal" size="sm" :icon="copied === a.text ? 'check' : 'content_copy'" @click="emit('copy', a.text)">{{ copyLabel(a.text) }}</MButton></template>
      </MItem>
    </template>
  </MGroup>

  <MGuidePort v-if="miss" :T="T" :port="Number(network.port) || DEFAULT_BASE_PORT" :active="Number(network.activePort) || 0" :address="plan.main?.address || ''" :callbacks="portCallbacks" />
  </template>
</template>
