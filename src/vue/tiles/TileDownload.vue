<script>
export const tileIds = ['download']
</script>

<script setup>
// 下载客户端 in the calibrated calm language (round 31; REFERENCES.md "download": the iOS App Store widget and its rows: the app's icon, its name, one GET). The client's name is never cut.
// Everything the old tile did stays: the system the person last chose (read and written like the guide and the dialog), the recommended client with its
// official or partner tag and version, the download of its main file, copying and sharing its link, and the way to the downloads page.
//   方形: the name leads; the icon and the system's menu over it, 下载 under it.
//   中: the icon leads; beside it the system's menu and the name; under both, across the tile, the tag, the version and 下载.
//   The system's menu holds the systems, then copy, share and 打开下载页.
import { computed, ref, watch } from 'vue'
import MIcon from '../MIcon.vue'
import MMenuChip from '../MMenuChip.vue'
import MClientTag from '../MClientTag.vue'
import { CLIENT_OS, OS_ICON, osChipName } from '../../clients/catalogue.js'
import { readOs, writeOs } from '../../clients/osChoice.js'
import { clientUrl, connectTexts, recommendForOs } from '../../clients/recommend.js'
import { assetOsOf, releaseRows, shortVersion } from '../../clients/assets.js'
import { sizeB2 } from './b2.js'
import { designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const size = computed(() => sizeB2(props.card))
const locale = computed(() => d.value.locale || props.texts.__locale || 'zh')
const C = computed(() => connectTexts(locale.value))
const os = ref(readOs())
watch(os, (v) => writeOs(v))
const rec = computed(() => recommendForOs(os.value))
const rows = computed(() => (d.value.assetsOf ? releaseRows(d.value.assetsOf(rec.value.client), assetOsOf(rec.value.target), locale.value) : []))
const best = computed(() => rows.value.find((r) => r.recommended) || rows.value[0] || null)
// the version is read from the release data of the client, which `rows` asks for: without that read the tile showed no version until another card had loaded it
const version = computed(() => { void rows.value; return String(d.value.versionOf ? d.value.versionOf(rec.value.client) || '' : '').replace(/^v/i, '') })
// the version as the tile shows it (shortVersion: no build part, eleven characters at most; the full text is the tooltip), so the tag, the version and 下载 share one row at any length
const versionShown = computed(() => shortVersion(version.value))
const mainUrl = computed(() => best.value?.url || clientUrl(rec.value.client, locale.value))
const name = computed(() => rec.value.client.label || rec.value.client.name)
// the name is never cut: a long one (Moonlight macOS Enhanced) takes three lines on 方形 and the icon gives them the room, a short one (VoidLink) is set larger
const fit = computed(() => (name.value.length > 20 ? 'is-long' : name.value.length < 10 ? 'is-short' : ''))
const download = () => emit('act', { type: 'open-url', value: mainUrl.value })
const copied = ref(false)
async function copy() { try { await navigator.clipboard.writeText(mainUrl.value); copied.value = true; setTimeout(() => { copied.value = false }, 1600) } catch { /* no clipboard: the link stays on the download button */ } }
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const share = () => { if (canShare) navigator.share({ title: name.value, url: mainUrl.value }).catch(() => {}); else copy() }
const menu = computed(() => [...CLIENT_OS.map((o) => ({ id: `os:${o}`, label: osChipName(o, locale.value), checked: o === os.value })), { id: 'line', divider: true },
  { id: 'copy', label: copied.value ? C.value.copied : C.value.copyLink, icon: copied.value ? 'check' : 'link' }, { id: 'share', label: C.value.share, icon: 'share' }, { id: 'open', label: d.value.texts?.openDownloads, icon: 'open_in_new' }])
function pick(item) {
  if (item.startsWith('os:')) os.value = item.slice(3)
  else if (item === 'copy') copy()
  else if (item === 'share') share()
  else emit('act', { type: 'open', value: 'downloads' })
}
</script>

<template>
  <section class="m-tile m-cal m-b2 m-b2dl" :class="[`is-${size}`, fit]" :data-size="size" data-accent="primary">
    <template v-if="size === 's'">
      <header class="m-b2dl__top"><span class="m-b2dl__icon"><MIcon :name="rec.client.icon" /></span><MMenuChip class="m-b2dl__os" :label="osChipName(os, locale).split(' / ')[0]" :aria-label="C.osChoice" :items="menu" @click.stop @select="pick" /></header>
      <b class="m-b2dl__name">{{ name }}</b>
      <button type="button" class="m-b2__btn m-b2dl__go" @click.stop="download"><MIcon name="download" />{{ C.download }}</button>
    </template>
    <template v-else>
      <div class="m-b2dl__main">
        <span class="m-b2dl__icon"><MIcon :name="rec.client.icon" /></span>
        <div class="m-b2dl__side">
          <MMenuChip class="m-b2dl__os" :label="osChipName(os, locale)" :aria-label="C.osChoice" :icon="OS_ICON[os]" :items="menu" @click.stop @select="pick" />
          <b class="m-b2dl__name">{{ name }}</b>
        </div>
      </div>
      <div class="m-b2dl__foot"><small :title="version ? `v${version}` : undefined"><MClientTag :official="rec.official" :locale="locale" /><template v-if="version"> v{{ versionShown }}</template></small><button type="button" class="m-b2__btn" @click.stop="download"><MIcon name="download" />{{ C.download }}</button></div>
    </template>
  </section>
</template>
