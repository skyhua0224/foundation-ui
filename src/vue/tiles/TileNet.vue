<script>
export const tileIds = ['net']
</script>

<script setup>
// 网卡 (REFERENCES.md "net"): the adapter that carries the stream, its link speed, its address; the person can choose another on the tile, or go back to Auto (card nic-tile-1120).
//   Which adapter Auto means is nicChoice.js (the bound address, the client's network, the default route, a physical adapter before a virtual one); the choice is kept per host.
//   The link speed is the hero (Pixel "Internet" tile, iStat's network numbers): the speed in display type, the adapter's shape cut by the corner.
//     中:   the speed and the shape · the adapter, its kind and IPv4 · the chooser chip in the header (Auto or the adapter, a menu of the adapters)
//     大:   + the adapters as a list that chooses (Auto first), the reason Auto picked this one
//     特大: two columns: the adapter (speed, kind, IPv4, IPv6, the default route, the reason) and the adapters that choose; under the adapter the stream's rate and its curve, the curve bleeding to the tile's left and bottom edge
// No 方形: the adapter needs a name, a speed and a way to change it. A saved 方形 is drawn as 中 (sizeKeyOf, homeRanges.js).
import { computed } from 'vue'
import MIcon from '../MIcon.vue'
import MMenuChip from '../MMenuChip.vue'
import MTileHead from '../MTileHead.vue'
import MTileNumeral from '../MTileNumeral.vue'
import MTileShape from '../MTileShape.vue'
import MTileChip from '../MTileChip.vue'
import MTileChart from '../MTileChart.vue'
import MTileEmpty from '../MTileEmpty.vue'
import { setNicChoice } from '../nicChoice.js'
import { OPEN, designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const p = computed(() => d.value.primary || {})
const L = computed(() => d.value.labels || {})
const choice = computed(() => d.value.choice || { options: [] })
const usage = computed(() => d.value.usage || {})
// 中, 大, 特大: the ladder above 中 is drawn at its own size; a size below 中 is not offered (the preference is clamped before it gets here)
const size = computed(() => ({ m: 'm', l: 'l', xl: 'xl' }[props.card?.size] || 'm'))
// '2.5 Gbps' -> the number and its unit; an adapter without a speed shows its kind
const speed = computed(() => { const m = /^([\d.]+)\s*(\S+)$/.exec(p.value.speed || ''); return m ? { v: m[1], u: m[2] } : { v: '', u: '' } })
const options = computed(() => choice.value.options || [])
// the kind after the name, unless the name already says it (Ethernet Ethernet), and the network name of a wireless adapter
const sub = computed(() => [p.value.kind && p.value.kind !== p.value.name ? p.value.kind : '', p.value.ssid].filter(Boolean).join(' · '))
const chipLabel = computed(() => (choice.value.manual ? p.value.name : L.value.auto))
const menu = computed(() => [...(L.value.gone ? [{ id: '__gone', label: L.value.gone, icon: 'info' }, { id: 'line0', divider: true }] : []), { id: '', label: `${L.value.auto}${choice.value.auto ? ` · ${choice.value.auto}` : ''}`, icon: 'sync', checked: !choice.value.manual }, { id: 'line', divider: true }, ...options.value.map((o) => ({ id: `nic:${o.id}`, label: `${o.title}${o.up ? '' : ` · ${L.value.down}`}`, icon: o.icon, checked: choice.value.manual && o.current }))])
// What the preview of a tile in edit mode and a tile of a host without the API must not do: write the choice
const live = computed(() => !props.preview)
function pick(id) {
  if (!live.value || id === '__gone') return
  const v = String(id || '')
  setNicChoice(choice.value.host, v.startsWith('nic:') ? v.slice(4) : '')
}
const choose = (value) => { if (live.value) setNicChoice(choice.value.host, value) }
// the list is a radio group: the arrow keys move the choice (and the focus) along it, Home and End go to its ends, only the chosen row is in the Tab order
function onKey(e) {
  const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
  const rows = [...e.currentTarget.querySelectorAll('[role="radio"]')]
  const at = rows.indexOf(e.target.closest('[role="radio"]'))
  if (at < 0 || !(e.key in keys || e.key === 'Home' || e.key === 'End')) return
  e.preventDefault()
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : (at + keys[e.key] + rows.length) % rows.length
  choose(to === 0 ? '' : options.value[to - 1]?.id || '')
  rows[to]?.focus()
}
const sent = computed(() => (usage.value.series || []).filter(Number.isFinite))
const sentNow = computed(() => (usage.value.now === null || usage.value.now === undefined ? '' : usage.value.now >= 100 ? Math.round(usage.value.now) : +usage.value.now.toFixed(1)))
const share = computed(() => (usage.value.ratio === null || usage.value.ratio === undefined ? '' : `${usage.value.ratio < 0.01 && usage.value.ratio > 0 ? '<1' : Math.round(usage.value.ratio * 100)} %`))
</script>

<template>
  <section class="m-tile m-tnet" :class="`is-${size}`" data-accent="primary" :data-size="size">
    <MTileEmpty v-if="empty || !d.primary" :icon="empty?.icon || 'lan'" :title="empty?.title || card.title" :text="empty?.value || d.empty || ''" :action="empty?.action" :size="size === 'xl' ? 'l' : size" @act="(a) => emit('act', a)" />
    <template v-else>
      <MTileShape class="m-tile__corner m-tnet__corner" :icon="p.icon" shape="cookie" size="60px" tone="tonal" />
      <MTileHead :icon="d.icon" :title="card.title" :chevron="chevron" @open="emit('act', OPEN)">
        <MMenuChip v-if="size === 'm'" class="m-tnet__chip" :label="chipLabel" :aria-label="`${L.adapter}: ${chipLabel}`" :active="choice.manual" :items="menu" @click.stop @select="pick" />
      </MTileHead>
      <div class="m-tnet__cols">
        <div class="m-tnet__info">
          <div class="m-tnet__main">
            <MTileNumeral :value="speed.v || p.kind" :unit="speed.u" :size="size === 'xl' ? 'l' : 'm'" />
            <b class="m-tnet__name" :title="p.description || p.name">{{ p.name }} <small v-if="sub">{{ sub }}</small></b>
            <span class="m-tnet__ip m-dnum" data-redact="address">{{ p.ipv4 }}</span>
          </div>
          <template v-if="size === 'xl'">
            <div class="m-tnet__chips">
              <MTileChip v-if="L.why" :label="L.why" :tone="choice.manual ? 'accent' : ''" :icon="choice.manual ? 'check' : 'sync'" />
              <MTileChip v-if="p.isDefault" :label="L.default" icon="check" />
              <MTileChip v-if="p.wifi && p.signal !== null" :label="`${L.signal} ${p.signal} %`" />
              <MTileChip v-if="p.virtual" :label="p.kind" tone="" />
            </div>
            <dl class="m-tnet__facts"><div v-for="f in (d.facts || []).filter((x) => x.label === 'IPv6')" :key="f.label"><dt>{{ f.label }}</dt><dd class="m-dnum" data-redact="address">{{ f.value }}</dd></div></dl>
            <div v-if="sent.length > 1" class="m-tnet__trend">
              <div class="m-tnet__rate">
                <span>{{ L.sent }}</span>
                <b class="m-dnum">{{ sentNow }} <small>{{ L.mbps }}</small></b>
                <span v-if="share">{{ share }} {{ L.headroom }}</span>
              </div>
              <MTileChart class="m-tnet__history" :points="sent" kind="area" :dot="true" :window="40" />
            </div>
          </template>
        </div>
        <div v-if="size !== 'm'" class="m-tnet__pick">
          <p v-if="L.gone" class="m-tnet__note">{{ L.gone }}</p>
          <ul class="m-tnet__list" role="radiogroup" :aria-label="L.adapter" @keydown="onKey">
            <li>
              <button type="button" class="m-tnet__opt" role="radio" :aria-checked="!choice.manual" :tabindex="!choice.manual ? 0 : -1" :class="{ 'is-on': !choice.manual }" @click.stop="choose('')">
                <MTileShape icon="sync" shape="circle" size="34px" :tone="choice.manual ? 'container' : 'solid'" />
                <span class="m-tnet__txt"><b>{{ L.auto }}</b><small>{{ choice.auto || '–' }}</small></span>
                <MIcon :name="choice.manual ? 'radio_button_unchecked' : 'radio_button_checked'" />
              </button>
            </li>
            <li v-for="o in options" :key="o.id">
              <button type="button" class="m-tnet__opt" role="radio" :aria-checked="choice.manual && o.current" :tabindex="choice.manual && o.current ? 0 : -1" :class="{ 'is-on': choice.manual && o.current, 'is-down': !o.up }" @click.stop="choose(o.id)">
                <MTileShape :icon="o.icon" shape="circle" size="34px" :tone="choice.manual && o.current ? 'solid' : 'container'" />
                <span class="m-tnet__txt"><b>{{ o.title }}</b><small data-redact="address">{{ o.sub }}</small></span>
                <MIcon :name="choice.manual && o.current ? 'radio_button_checked' : 'radio_button_unchecked'" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
