<script>
export const tileIds = ['host-name', 'audio-out', 'host-ports', 'host-encryption', 'public-address']
</script>

<script setup>
// 主机名称, 端口, 加密 and 公网地址 in the calibrated calm language (round 31; REFERENCES.md: the canonical text-only layout and Pixel VIPs; Pixel Weather's number in a
// container and Home Assistant's sensor grid; Android 16's state tiles and Hue's On/Off tiles; Pixel Battery's row and the HIG Tips placeholder). 本主机 is B1's.
//   主机名称: the initial in a circle and the name in display type; 中 adds the platform.
//   端口: the base port as the numeral inside one tonal plate; 中 adds the family of ports Sunshine derives from it and UPnP.
//   加密: LAN and WAN as two state plates, the mode as the fill (强制 the primary container, 按需 the secondary, 关闭 quiet with the word in the error colour).
//   公网地址: one plate: the address and whether the check reached it (the globe too, from 中 up: the head has it at 方形). Every state names itself (checking, invalid, no public IPv4, check failed): a wildcard
//   address is never drawn as one, and the text wraps instead of being cut. Not set: the globe in a quiet circle, 未设置 and one action (detail).
import { computed } from 'vue'
import MIcon from '../MIcon.vue'
import MBreakText from '../MBreakText.vue'
import { OPEN, designProps } from './tileData.js'
import { sizeB2 } from './b2.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const id = computed(() => props.card.id)
const d = computed(() => props.card.data || {})
const size = computed(() => sizeB2(props.card))
const T = computed(() => props.texts || {})
// 端口: the family Sunshine derives from the base port (its configuration docs, "port")
const port = computed(() => Number(d.value.big) || 47989)
const family = computed(() => [['HTTPS', port.value - 5], ['Web UI', port.value + 1], ['RTSP', port.value + 21], ['UDP', `${port.value + 9}–${port.value + 11}`]])
const upnp = computed(() => d.value.rows?.[0])
// 加密
const rank = (v) => (v === T.value.encRequired ? 2 : v === T.value.encOptional ? 1 : 0)
const enc = computed(() => (d.value.rows || []).map((r) => ({ ...r, rank: rank(r.value) })))
// 中 says what each mode means for the path it guards
const note = (r) => [T.value.encOffNote, T.value.encOptionalNote, T.value.encRequiredNote][r] || ''
// 公网地址
const av = computed(() => d.value.view || { state: d.value.saved ? 'saved' : 'unset', value: d.value.saved, word: d.value.path?.word || '', tone: d.value.path?.tone === 'error' ? 'bad' : 'ok', address: !!d.value.saved })
// the plate has the size of its tile, so the figure is set for the text it holds: the width of the text in em (a CJK character 1, any other 0.58) against the em that fit the plate's line at that size
const weigh = (t) => [...String(t || '')].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 1 : 0.58), 0)
const pv = computed(() => {
  const w = weigh(av.value.value)
  if (size.value === 's') return w <= 5 ? 17 : w <= 6.2 ? 14 : w <= 7.2 ? 12 : 10
  if (size.value === 'm') return w <= 5.7 ? 24 : w <= 6.8 ? 20 : w <= 8.5 ? 16 : w <= 10.4 ? 13 : 11
  return w <= 10 ? 24 : w <= 16 ? 20 : 15
})
const plate = computed(() => ({ ok: 'is-on', bad: 'is-warn', quiet: 'is-quiet' }[av.value.tone] || 'is-quiet'))
// 音频输出 is 主机名称's square: the speaker's glyph in the circle and the device's name in display type
const name = computed(() => (id.value === 'audio-out' ? d.value.rows?.[0]?.value : d.value.big))
const kind = computed(() => ({ 'host-name': 'm-b2name', 'audio-out': 'm-b2name', 'host-ports': 'm-b2ports', 'host-encryption': 'm-b2enc', 'public-address': 'm-b2addr' }[id.value]))
</script>

<template>
  <section class="m-tile m-cal m-b2" :class="[`m-b2--${id}`, `is-${size}`, kind]" :data-size="size" data-accent="primary">
    <template v-if="empty">
      <header class="m-calm__head"><MIcon :name="empty.icon || d.icon" /><span class="m-calm__title">{{ empty.title || card.title }}</span></header>
      <div class="m-empty-basic"><b>{{ empty.value }}</b><button v-if="empty.action" type="button" class="m-b2__btn is-tonal" @click.stop="emit('act', empty.action)">{{ empty.action.label }}</button></div>
    </template>

    <template v-else-if="(id === 'host-name' || id === 'audio-out') && size === 's'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
      <span class="m-b2glyph"><MIcon :name="d.icon" /></span>
      <b class="m-b2__name">{{ name }}</b>
    </template>
    <template v-else-if="id === 'host-name'">
      <span class="m-b2glyph"><MIcon :name="d.icon" /></span>
      <div class="m-b2name__side"><header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header><b class="m-b2__name">{{ d.big }}</b><div v-if="d.rows?.[0]" class="m-b2__chips"><span><MIcon :name="d.rows[0].icon" />{{ d.rows[0].value }}</span></div></div>
    </template>

    <template v-else-if="id === 'host-ports'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="chevron && size !== 's'" type="button" class="m-calm__more" :aria-label="T.more || card.title" @click.stop="emit('act', OPEN)"><MIcon name="chevron_right" /></button></header>
      <div :class="size === 'm' ? 'm-b2ports__body' : ''" :style="size === 's' ? 'display: contents' : ''">
        <div class="m-b2plate" :class="{ 'is-on': upnp?.value === T.on }"><b class="m-dnum">{{ port }}</b><small>UPnP {{ upnp?.value }}</small></div>
        <dl v-if="size === 'm'" class="m-b2ports__family"><div v-for="[n, p] in family" :key="n"><dt>{{ n }}</dt><dd>{{ p }}</dd></div></dl>
      </div>
    </template>

    <template v-else-if="id === 'host-encryption'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
      <div class="m-b2enc__pair"><div v-for="r in enc" :key="r.title" class="m-b2plate" :class="{ 'is-on': r.rank === 2, 'is-quiet is-off': r.rank === 0 }"><MIcon :name="r.rank ? 'lock' : 'lock_open'" /><span><small>{{ r.title }}</small><b>{{ r.value }}</b><em v-if="size === 'm' && note(r.rank)" class="m-b2enc__note">{{ note(r.rank) }}</em></span></div></div>
    </template>

    <template v-else>
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="chevron && size !== 's'" type="button" class="m-calm__more" :aria-label="T.more || card.title" @click.stop="emit('act', OPEN)"><MIcon name="chevron_right" /></button></header>
      <div class="m-b2plate" :class="plate" :data-state="av.state"><span v-if="size !== 's'" class="m-b2glyph"><MIcon name="public" /></span><span class="m-b2addr__text"><b :data-redact="av.address ? 'address' : null" :style="{ '--pv': `${pv}px` }"><MBreakText :text="av.value" /></b><small v-if="av.word" class="is-reach">{{ av.word }}</small></span></div>
    </template>
  </section>
</template>
