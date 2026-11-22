<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import MProgress from './MProgress.vue'
import MPinEntry from './MPinEntry.vue'
import MOsChips from './MOsChips.vue'
import MClientAssets from './MClientAssets.vue'
import MClientTag from './MClientTag.vue'
import MLinkActions from './MLinkActions.vue'
import { qrPath } from './guideModel.js'
import { QR_INSTALL_OS, clientUrl, connectTexts, othersTitle, readsPairQr, recommendForOs, whyOf } from '../clients/recommend.js'
import { assetOsOf, mirrorName, releaseRows } from '../clients/assets.js'

/**
 * The content of 连接设备: the system of the device, then what is needed for it. `view` 'install' is the recommended client of the system (one card: the name, why, a QR code
 * of the download for a phone or a tablet) with the files of the client for that system (every architecture, the best marked, CNB first for Chinese) and the other clients
 * behind 其他客户端; `view` 'pair' leads with the QR the host makes (only for a client that reads it) and has the PIN as the other way (the only way for the others).
 * Used by the dialog (two tabs) and by the journey card of the overview (two of its steps). The product gives the QR drawing (`qr(text)` -> a module matrix), the pairing
 * QR of the host (`pairQr`, see usePairQr), the release assets of the clients (`assetsOf`, see useReleaseAssets) and the paired clients.
 */
const os = defineModel('os', { type: String, default: 'android' })
const props = defineProps({
  view: { type: String, default: 'install' }, // install | pair
  locale: { type: String, default: 'en' },
  qr: { type: Function, default: null },
  pairQr: { type: Object, default: null },
  canPin: { type: Boolean, default: true },
  count: { type: Number, default: 0 },
  latest: { type: String, default: '' },
  hideChoice: { type: Boolean, default: false },
  /** the pair view asks the host for a code only while it is shown and active */
  active: { type: Boolean, default: true },
  /** inside a flow that must not be left (the first-run guide): no button that opens the download page */
  noDownloadsLink: { type: Boolean, default: false },
  assetsOf: { type: Function, default: null },
  versionOf: { type: Function, default: null },
  /** the first-run guide: one recommended download (the fast source for the language), everything else under 更多下载方式 */
  lean: { type: Boolean, default: false },
})
const emit = defineEmits(['pair-pin', 'pair-qr-begin', 'pair-qr-stop', 'open-url', 'open-downloads'])
const T = computed(() => connectTexts(props.locale))
// the name the pairing gives the client (the host's /api/pin name), as the old 设备 page asked for it; empty sends the default name
const deviceName = ref('')
const sendPin = (pin) => { emit('pair-pin', { pin, name: deviceName.value.trim() }); deviceName.value = '' }
const rec = computed(() => recommendForOs(os.value))
const rows = computed(() => (props.assetsOf ? releaseRows(props.assetsOf(rec.value.client), assetOsOf(rec.value.target), props.locale) : []))
const version = computed(() => (props.versionOf ? props.versionOf(rec.value.client) : ''))
const hasProduct = computed(() => !!rec.value.client.product)
const pageUrl = computed(() => clientUrl(rec.value.client, props.locale))
// a phone or a tablet installs from the code: the CNB link of the file where there is one (the fast one in China), else the store or project page
// the source follows the language, as the download page does (CNB for Chinese, GitHub for the others; the other one when the file has only one), and the line under the button names the host that is really used
const installTarget = computed(() => rows.value[0]?.url || pageUrl.value)
const installHost = computed(() => (rows.value[0] && rows.value[0].url === rows.value[0].cnbUrl ? 'CNB' : 'GitHub'))
const installQr = computed(() => { if (!QR_INSTALL_OS.includes(os.value) || !props.qr) return null; try { const q = qrPath(props.qr(installTarget.value)); return q && q.d ? q : null } catch { return null } })
const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
const name = (c) => c.label || c.name
const by = computed(() => (rec.value.official ? T.value.maintained : ''))

// the host's pairing code is asked for only while the pair view shows it for a client that reads it
const wantsQr = computed(() => props.view === 'pair' && props.active && !!props.pairQr && readsPairQr(rec.value.client))
watch(wantsQr, (on, was) => { if (on) emit('pair-qr-begin'); else if (was) emit('pair-qr-stop') }, { immediate: true })
onBeforeUnmount(() => { if (wantsQr.value) emit('pair-qr-stop') })
const clock = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
</script>

<template>
  <div class="m-conn">
    <MOsChips v-if="!hideChoice" v-model="os" :locale="locale" :label="T.osChoice" />

    <template v-if="view === 'install'">
      <article class="m-conn__rec">
        <div class="m-conn__recmain">
          <MClientTag :official="rec.official" :locale="locale" />
          <h3>{{ name(rec.client) }}<small v-if="version">{{ version }}</small></h3>
          <p v-if="whyOf(rec.client, locale)" class="m-conn__why">{{ whyOf(rec.client, locale) }}</p>
          <p v-if="by" class="m-conn__by">{{ by }}</p>
          <div v-if="lean && rows.length" class="m-conn__actions">
            <button type="button" class="m-dpill m-dpill--fill m-conn__go" @click="emit('open-url', installTarget)"><MIcon name="download" />{{ T.download }}<small v-if="rows[0].sizeLabel" class="m-dnum">{{ rows[0].sizeLabel }}</small></button>
            <span class="m-conn__by">{{ fill(T.fromMirror, { host: installHost }) }}</span>
          </div>
          <div v-else class="m-conn__actions">
            <template v-if="!rows.length"><button type="button" class="m-dpill m-dpill--fill m-conn__go" @click="emit('open-url', pageUrl)"><MIcon :name="hasProduct ? 'download' : 'open_in_new'" />{{ hasProduct ? T.download : T.openPage }}</button><MLinkActions :url="pageUrl" :title="name(rec.client)" :qr="qr" :texts="T" /></template>
            <button type="button" class="m-conn__link" @click="emit('open-url', rec.client.links.project)"><MIcon name="code" />{{ T.github }}</button>
            <button type="button" class="m-conn__link" @click="emit('open-url', rec.client.links.releases)"><MIcon name="history" />{{ T.releasesPage }}</button>
          </div>
          <p v-if="hasProduct && !rows.length" class="m-conn__by">{{ T.loadingFiles }}</p>
        </div>
        <figure v-if="installQr" class="m-conn__qr">
          <svg :viewBox="`0 0 ${installQr.size} ${installQr.size}`" shape-rendering="crispEdges" role="img" :aria-label="T.scanInstall"><rect :width="installQr.size" :height="installQr.size" fill="#fff" /><path :d="installQr.d" fill="#000" /></svg>
          <figcaption>{{ T.scanInstall }}</figcaption>
        </figure>
      </article>
      <details v-if="lean" class="m-conn__others m-conn__more">
        <summary>{{ T.moreDownloads }}<MIcon class="m-conn__chev" name="keyboard_arrow_down" /></summary>
        <MClientAssets v-if="rows.length" :rows="rows" :texts="T" :qr="qr" :mirror="mirrorName(locale)" @open-url="(u) => emit('open-url', u)" />
        <ul v-if="rec.others.length" class="m-conn__clients">
          <li v-for="x in rec.others" :key="x.client.id + x.target.platform"><MIcon :name="x.client.icon" /><span class="m-conn__oname">{{ name(x.client) }}</span><MClientTag :official="x.client.group === 'first'" :locale="locale" /><button type="button" class="m-conn__link" @click="emit('open-url', clientUrl(x.client, locale))"><MIcon name="open_in_new" />{{ T.download }}</button><MLinkActions :url="clientUrl(x.client, locale)" :title="name(x.client)" :qr="qr" :texts="T" /></li>
        </ul>
      </details>
      <MClientAssets v-if="!lean && rows.length" :rows="rows" :texts="T" :qr="qr" :mirror="mirrorName(locale)" @open-url="(u) => emit('open-url', u)" />
      <details v-if="!lean && rec.others.length" class="m-conn__others">
        <summary>{{ othersTitle(rec.others, T) }}<small>{{ rec.others.length }}</small><MIcon class="m-conn__chev" name="keyboard_arrow_down" /></summary>
        <ul class="m-conn__clients">
          <li v-for="x in rec.others" :key="x.client.id + x.target.platform"><MIcon :name="x.client.icon" /><span class="m-conn__oname">{{ name(x.client) }}</span><MClientTag :official="x.client.group === 'first'" :locale="locale" /><button type="button" class="m-conn__link" @click="emit('open-url', clientUrl(x.client, locale))"><MIcon name="open_in_new" />{{ T.download }}</button><MLinkActions :url="clientUrl(x.client, locale)" :title="name(x.client)" :qr="qr" :texts="T" /></li>
        </ul>
        <button v-if="!noDownloadsLink" type="button" class="m-conn__link m-conn__all" @click="emit('open-downloads')"><MIcon name="arrow_forward" />{{ T.moreOthers }}</button>
      </details>
    </template>

    <template v-else>
      <div class="m-conn__pair" :class="{ 'has-qr': readsPairQr(rec.client) && !!pairQr }">
        <div v-if="readsPairQr(rec.client) && pairQr" class="m-conn__pairqr">
          <div class="m-dpair__code">
            <img v-if="pairQr.image" :src="pairQr.image" :alt="T.scanPair">
            <span v-if="pairQr.state === 'loading' || pairQr.state === 'idle'" class="m-dpair__wait m-dpair__wait--ring"><MProgress circular :label="T.scanPair" /></span>
            <button v-else-if="pairQr.state === 'expired' || pairQr.state === 'error'" type="button" class="m-dpair__renew" @click="emit('pair-qr-begin')"><MIcon name="refresh" /><span>{{ pairQr.state === 'error' ? T.expired : T.refresh }}</span></button>
            <span v-else-if="pairQr.state === 'paired'" class="m-dpair__done"><MIcon name="check_circle" /><span>{{ T.done }}</span></span>
          </div>
          <b>{{ T.scanPair }}</b><small v-if="pairQr.state === 'ready'" class="m-dnum">{{ clock(pairQr.seconds) }}</small><code v-if="pairQr.state === 'ready' && pairQr.address" class="m-conn__qraddr m-dnum">{{ pairQr.address }}</code>
        </div>
        <div class="m-conn__pin">
          <p class="m-conn__pinline">{{ readsPairQr(rec.client) && pairQr ? T.pinLine : T.pinLead }}</p>
          <p v-if="!readsPairQr(rec.client) && !['windows', 'macos', 'linux'].includes(os)" class="m-conn__pinonly"><MIcon name="info" />{{ T.pinOnly }}</p>
          <input v-model="deviceName" class="m-conn__name m-input" type="text" maxlength="64" autocomplete="off" :aria-label="T.deviceName" :placeholder="T.deviceNameHint" :disabled="!canPin">
          <MPinEntry :label="T.pinLabel" :go="T.pairGo" :disabled="!canPin" @submit="sendPin" />
          <p class="m-conn__facts"><MIcon name="devices" /><b class="m-dnum">{{ count }}</b><span>{{ fill(T.paired, { n: '' }).trim() }}</span><i v-if="latest" aria-hidden="true">·</i><span v-if="latest">{{ fill(T.latest, { name: latest }) }}</span></p>
        </div>
      </div>
    </template>
  </div>
</template>
