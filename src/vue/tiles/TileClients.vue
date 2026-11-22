<script>
export const tileIds = ['clients-paired', 'pair']
</script>

<script setup>
// 已配对客户端 and 配对 in the calibrated calm language (round 31; REFERENCES.md "clients-paired", "pair"). 在线客户端 is B1's (TileOnlineCal).
//   已配对客户端 (the Pixel Battery widget's device rows, One UI's Direct Dial row): the count is the focal element and the devices are its members. 方形 the count and the
//     circles; 中 the count beside four circles with their names; 大 the count over rows: a 40 px tonal circle, the name, when it streamed last, a state chip; 特大 the rows in two
//     columns, each also with its streamed time in words. A device that streams comes first.
//   配对: a button requests a code on demand; the code replaces it until it expires, beside the PIN field.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MIcon from '../MIcon.vue'
import MTileChip from '../MTileChip.vue'
import MTileNumeral from '../MTileNumeral.vue'
import { OPEN, designProps } from './tileData.js'
import { sizeB2 } from './b2.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const id = computed(() => props.card.id)
const d = computed(() => props.card.data || {})
const size = computed(() => sizeB2(props.card))
const T = computed(() => props.texts || {})
const live = (c) => c.tone === 'ok'
const items = computed(() => { const v = d.value.items || []; return [...v.filter(live), ...v.filter((c) => !live(c))] })
const count = computed(() => d.value.count ?? items.value.length)
const chipTone = (c) => (live(c) ? 'ok' : c.tone === 'warn' ? 'warn' : '')

// A pairing window is opened only when the person asks for a QR code.
const pin = ref('')
const pinText = computed({ get: () => pin.value, set: (v) => { pin.value = String(v).replace(/\D/g, '').slice(0, 4) } })
const sendPin = () => { if (pin.value.length === 4) { emit('act', { type: 'pair-pin', value: { pin: pin.value } }); pin.value = '' } }
const qr = computed(() => (id.value === 'pair' ? d.value.qr : null))
const qrOpen = ref(false)
const qrAvailable = computed(() => !!qr.value && size.value !== 's' && !props.preview && !props.empty)
watch(qrAvailable, (available) => { if (!available) qrOpen.value = false })
const qrShown = computed(() => qrOpen.value && qrAvailable.value)
watch(qrShown, (on, was) => { if (on) emit('act', { type: 'pair-qr-begin' }); else if (was) emit('act', { type: 'pair-qr-stop' }) }, { immediate: true })
onBeforeUnmount(() => { if (qrShown.value) emit('act', { type: 'pair-qr-stop' }) })
</script>

<template>
  <section class="m-tile m-cal m-b2" :class="[`m-b2--${id}`, `is-${size}`, id === 'pair' ? 'm-b2pair' : 'm-b2paired']" :data-size="size" data-accent="primary">
    <template v-if="empty">
      <header class="m-calm__head"><MIcon :name="empty.icon || d.icon || 'devices'" /><span class="m-calm__title">{{ empty.title || card.title }}</span></header>
      <div class="m-empty-basic"><b>{{ empty.value }}</b><button v-if="empty.action" type="button" class="m-b2__btn is-tonal" @click.stop="emit('act', empty.action)">{{ empty.action.label }}</button></div>
    </template>

    <!-- 已配对客户端 -->
    <template v-else-if="id === 'clients-paired'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="chevron && size !== 's'" type="button" class="m-calm__more" :aria-label="T.more || card.title" @click.stop="emit('act', OPEN)"><MIcon name="chevron_right" /></button></header>
      <template v-if="size === 's'">
        <MTileNumeral class="m-b2paired__count" :value="String(count)" size="m" />
        <ul class="m-calo__rings"><li v-for="c in items.slice(0, 3)" :key="c.name" :class="{ 'is-live': live(c) }"><MIcon :name="c.icon" /></li><li v-if="count > 3" class="is-more">+{{ count - 3 }}</li></ul>
      </template>
      <div v-else-if="size === 'm'" class="m-b2paired__dial">
        <MTileNumeral class="m-b2paired__count" :value="String(count)" size="l" />
        <div class="m-b2paired__people" :style="{ '--n': Math.min(items.length, 4) }">
          <ul aria-hidden="true"><li v-for="c in items.slice(0, 4)" :key="c.name" class="m-b2glyph" :class="{ 'is-on': live(c), 'is-off': c.tone === 'warn' }"><MIcon :name="c.icon" /></li></ul>
          <ul data-redact="client"><li v-for="c in items.slice(0, 4)" :key="c.name">{{ c.name }}</li></ul>
        </div>
      </div>
      <template v-else>
        <MTileNumeral class="m-b2paired__count" :value="String(count)" :size="size" />
        <ol class="m-b2list" data-redact="client"><li v-for="c in items.slice(0, size === 'xl' ? 8 : 4)" :key="c.name" class="m-b2item"><span class="m-b2glyph" :class="{ 'is-on': live(c), 'is-off': c.tone === 'warn' }"><MIcon :name="c.icon" /></span><span><b>{{ c.name }}</b><small>{{ c.last }}<template v-if="size === 'xl' && c.time !== '–'"> · {{ d.labels?.time }} {{ c.time }}</template></small></span><MTileChip :label="c.state" :tone="chipTone(c)" /></li></ol>
      </template>
    </template>

    <!-- 配对 -->
    <template v-else-if="size === 's'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
      <MTileNumeral class="m-b2paired__count" :value="String(count)" size="m" :unit="T.pairedCount" />
      <button type="button" class="m-b2__btn m-b2pair__go" @click.stop="emit('act', { type: 'pair-qr' })"><MIcon name="qr_code_scanner" />{{ T.pairGetQr || T.pairQr }}</button>
    </template>
    <template v-else>
      <div class="m-b2pair__qr" :class="{ 'is-wait': !qrOpen || !qr?.image }" data-redact="pin">
        <button v-if="!qrOpen" type="button" class="m-b2pair__action" :disabled="preview || !qr" @click.stop="qrOpen = true"><MIcon name="qr_code_scanner" /><span>{{ T.pairGetQr || T.pairQr }}</span></button>
        <img v-else-if="qr?.state === 'ready' && qr.image" :src="qr.image" :alt="T.pairQr" decoding="async">
        <div v-else-if="qr?.state === 'loading' || qr?.state === 'idle'" class="m-b2pair__state" role="status"><MIcon name="hourglass_empty" /><span>{{ T.pairQr }}</span></div>
        <div v-else-if="qr?.state === 'paired'" class="m-b2pair__state" role="status"><MIcon name="check_circle" /><span>{{ T.pairDone }}</span><button type="button" class="m-b2pair__retry" @click.stop="emit('act', { type: 'pair-qr-begin', value: true })">{{ T.pairGetQr || T.pairQr }}</button></div>
        <button v-else type="button" class="m-b2pair__action" @click.stop="emit('act', { type: 'pair-qr-begin', value: true })"><MIcon name="refresh" /><span>{{ T.pairRefresh }}</span></button>
      </div>
      <div class="m-b2pair__side">
        <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
        <small class="m-b2pair__count m-dnum">{{ count }} {{ T.pairedCount }}</small>
        <div class="m-b2pair__row">
          <input v-model="pinText" class="m-b2__field m-b2pair__pin" type="text" inputmode="numeric" maxlength="4" autocomplete="one-time-code" :placeholder="T.pairPin" :aria-label="T.pairPin" :disabled="!d.canPin" @click.stop @keydown.enter="sendPin">
          <button type="button" class="m-b2__btn is-tonal m-b2pair__go" :disabled="pin.length < 4 || !d.canPin" @click.stop="sendPin"><MIcon name="check" />{{ T.pairGo }}</button>
        </div>
      </div>
    </template>
  </section>
</template>
