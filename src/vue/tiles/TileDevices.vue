<script>
export const tileIds = ['devices', 'usb-devices', 'gamepad-status', 'gamepad-type', 'vdd', 'stream-mic', 'sw:mic']
</script>

<script setup>
// 手柄 · 麦克风 · USB, USB 设备, 手柄状态, 手柄类型, 虚拟显示器, 串流麦克风 and 麦克风开关 in the calibrated calm language (round 31; REFERENCES.md: Google Home Favorites' state tiles,
// iOS 17 Home, Hue's On/Off tiles; Pixel Weather's number; the HIG control anatomy; Android 16's toggle tiles).
//   设备: three tonal tiles (the calibrated CalOnline tiles): glyph, name, state; the ready ones filled.
//   USB 设备: the count as the numeral inside one plate.  虚拟显示器: the resolution as the numeral inside one plate; 中 adds the refresh rate and the chips.
//   手柄状态 / 手柄类型: the drawn controller of the kind inside one plate, its name and state; the strip of 手柄类型 is a connected button group, the chosen one filled.
//   串流麦克风 / 麦克风开关: the mic in a circle inside one plate; on: the plate filled and the circle morphs to a rounded square (default spatial spring; none under 减少).
//     麦克风开关's whole tile is the switch, at the strip too (the Quick Settings tile: filled when on).
import { computed, ref } from 'vue'
import MIcon from '../MIcon.vue'
import MControllerArt from '../MControllerArt.vue'
import { OPEN, designProps } from './tileData.js'
import MPickSheet from '../MPickSheet.vue'
import { modeOf, padChoices, padNoteOf, resNameOf } from './b2.js'
import { b3Texts } from './b3Texts.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const id = computed(() => props.card.id)
const d = computed(() => props.card.data || {})
const size = computed(() => (props.card.size === 'strip' ? 'strip' : props.card.size === 'm' || props.card.size === 'l' ? props.card.size : 's'))
const kindOf = (s) => { const v = String(s || '').toLowerCase(); return /ds5|dualsense|ps5/.test(v) ? 'ds5' : /ds4|dualshock|ps4/.test(v) ? 'ds4' : /x360|360/.test(v) ? 'x360' : /xone|xbox/.test(v) ? 'xone' : /switch|pro/.test(v) ? 'switch' : 'auto' }
const pad = computed(() => d.value.rows?.[0] || {})
const padReady = computed(() => pad.value.tone === 'ok')
// 'DualSense（DS5 / PS5 手柄） · 已就绪' -> the name 'DualSense' and the line 'DS5 / PS5 手柄 · 已就绪'
const padParts = computed(() => { const [named, ...rest] = String(pad.value.value || '').split(' · '); const m = /^([^（(]+)[（(]([^）)]*)[）)]\s*$/.exec(named.trim()); return { name: m ? m[1].trim() : named.trim(), line: [m?.[2], ...rest].filter(Boolean).join(' · ') } })
// at 方形 the line under the name is the state alone (the last part), so the art keeps its height
const padLine = computed(() => (size.value === 's' ? padParts.value.line.split(' · ').pop() : padParts.value.line))
const usbN = computed(() => Number(d.value.big) || 0)
// 手柄类型: the types as list buttons (the product saves a pressed one through the controller-type path and puts the old one back if the host refuses, as it does for the strip)
const L = computed(() => b3Texts(props.texts))
// 方形 and 中 show three types and the way to the rest; 大 has the room for every type (that is what it adds to 中)
const choices = computed(() => padChoices(d.value.options, d.value.value, size.value === 'l' ? 12 : 3))
// when a new controller type applies: the next virtual controller on a Windows host, after a restart anywhere else (and when the platform is not known)
const padNote = computed(() => padNoteOf(d.value, L.value))
const pickOpen = ref(false)
const pick = (value) => { if (props.preview || d.value.busy || String(value) === String(d.value.value)) return; emit('act', { type: 'group', value }) }
const chosen = computed(() => (d.value.options || []).find((o) => o.value === d.value.value))
const micOn = computed(() => (id.value === 'sw:mic' ? d.value.value === 'on' : d.value.tone === 'ok'))
const setMic = (v) => emit('act', { type: 'switch', value: { id: d.value.id || 'mic', value: v } })
const vddOn = computed(() => d.value.state === 'ready')
const vddMode = computed(() => modeOf(d.value.sub))
const hz = computed(() => /(\d+)/.exec(d.value.unit || '')?.[1] || '')
// 虚拟显示器: the name of the resolution is the hero ('4K', '2K', '1080p'), as 编码器's name is; the state and the refresh rate are the caption
const vddName = computed(() => { const m = /^\s*(\d+)\s*p?\s*$/i.exec(d.value.value || ''); return m ? resNameOf(vddMode.value?.h === Number(m[1]) ? vddMode.value.w : 0, Number(m[1])) : d.value.value || '–' })
const vddExact = computed(() => (/^\s*\d+\s*p\s*$/i.test(d.value.value || '') ? String(d.value.value).trim() : ''))
const kind = computed(() => ({ devices: 'm-calo m-b2dev', 'usb-devices': 'm-b2usb', 'gamepad-status': 'm-b2pad', 'gamepad-type': 'm-b2padtype', vdd: 'm-b2vdd', 'stream-mic': 'm-b2mic', 'sw:mic': 'm-b2mic' }[id.value]))
</script>

<template>
  <button v-if="size === 'strip' && id === 'sw:mic'" type="button" class="m-tile m-cal m-b2 m-b2strip m-b2strip--switch m-b2--sw-mic" :class="{ 'is-on': micOn }" data-accent="primary" role="switch" :aria-checked="micOn" :aria-label="d.title" :disabled="d.busy" @click.stop="setMic(!micOn)"><span class="m-b2glyph" :class="{ 'is-on': micOn }"><MIcon :name="d.icon" /></span><b>{{ d.title }}</b><span class="m-b2__cap m-b2strip__sp">{{ [d.sub, L.restartNote].filter(Boolean).join(' · ') }}</span></button>
  <section v-else-if="size === 'strip'" class="m-tile m-cal m-b2 m-b2strip" :class="`m-b2--${id.replace(':', '-')}`" data-accent="primary">
    <span class="m-b2strip__title"><MIcon :name="d.icon" /><span class="m-b2strip__tt">{{ d.title }}<small>{{ padNote }}</small></span></span>
    <div class="m-b2strip__bar" role="toolbar" :aria-label="d.title"><ul class="m-b2strip__seg" role="radiogroup" :aria-label="d.title"><li v-for="o in d.options || []" :key="o.value"><button type="button" role="radio" :aria-checked="o.value === d.value" :class="{ 'is-on': o.value === d.value }" :disabled="d.busy" @click.stop="emit('act', { type: 'group', value: o.value })">{{ o.label }}</button></li></ul></div>
  </section>

  <section v-else class="m-tile m-cal m-b2" :class="[`m-b2--${id.replace(':', '-')}`, `is-${size}`, kind, { 'is-on': id === 'vdd' && vddOn }]" :data-size="size" data-accent="primary">
    <template v-if="id === 'devices'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
      <ul class="m-calo__tiles"><li v-for="t in d.tiles || []" :key="t.icon" :class="{ 'is-live': t.ready }" style="clip-path: inset(0 round 20px); border-radius: 0"><b v-if="t.icon === 'usb' && /^\d+$/.test(t.word)" class="m-b2dev__n">{{ t.word }}</b><MIcon v-else :name="t.icon" /><span><b>{{ t.label }}</b><small>{{ t.icon === 'usb' && /^\d+$/.test(t.word) ? '' : t.word }}</small></span></li></ul>
    </template>

    <template v-else-if="id === 'usb-devices'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
      <div class="m-b2plate" :class="usbN ? 'is-on' : 'is-quiet'"><b class="m-dnum">{{ usbN }}</b><small>{{ d.rows?.[0]?.title }}</small></div>
    </template>

    <template v-else-if="id === 'gamepad-type'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="choices.more && !preview" type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="pickOpen = true"><MIcon name="chevron_right" /></button></header>
      <div class="m-b2padtype__body">
        <div v-if="size !== 's'" class="m-b2plate is-on"><MControllerArt :type="kindOf(d.value)" /></div>
        <div class="m-b2padtype__side">
          <ul class="m-b2opts" role="radiogroup" :aria-label="card.title"><li v-for="o in choices.shown" :key="o.value"><button type="button" role="radio" class="m-b2opt" :class="{ 'is-on': o.value === d.value }" :aria-checked="o.value === d.value" :disabled="d.busy" @click.stop="pick(o.value)"><span>{{ o.label }}</span><MIcon v-if="o.value === d.value" name="check" /></button></li></ul>
          <span class="m-b2__cap m-b2padtype__note">{{ padNote }}</span>
        </div>
      </div>
      <MPickSheet v-if="choices.more" :model-value="d.value" v-model:open="pickOpen" :title="card.title" :options="d.options" :help="padNote" :close-label="texts.close || 'Close'" @update:model-value="pick" />
    </template>

    <template v-else-if="id === 'gamepad-status'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span></header>
      <div class="m-b2plate" :class="padReady ? 'is-on' : 'is-quiet'"><MControllerArt :type="kindOf(`${pad.title} ${pad.value}`)" /></div>
      <b class="m-b2__name" :title="pad.value">{{ padParts.name }}</b>
      <span v-if="padParts.line" class="m-b2__cap">{{ padLine }}</span>
    </template>

    <template v-else-if="id === 'vdd'">
      <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button v-if="size === 'm'" type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="emit('act', { type: 'open', value: 'vdd' })"><MIcon name="chevron_right" /></button></header>
      <div class="m-b2vdd__body">
        <div class="m-b2vdd__hero">
          <b class="m-b2res__name">{{ vddName }}</b>
          <span class="m-b2vdd__state"><i :class="{ 'is-on': vddOn }" aria-hidden="true" /><template v-if="vddOn && size === 's' && vddExact">{{ vddExact }}<template v-if="hz"> · {{ hz }} Hz</template></template><template v-else>{{ d.stateLabel }}<template v-if="hz && size === 's'"> · {{ hz }} Hz</template></template></span>
        </div>
        <div v-if="size === 'm'" class="m-b2vdd__side"><span class="m-b2__line">{{ hz ? `${hz} Hz` : '' }}{{ vddMode ? ` · ${vddMode.w}×${vddMode.h}` : '' }}</span><div class="m-b2__chips" data-fit-rows="drop"><span v-for="c in d.chips || []" :key="c.label" :class="{ 'is-ok': c.tone === 'ok' }"><MIcon v-if="c.icon" :name="c.icon" />{{ c.label }}</span></div></div>
      </div>
    </template>

    <template v-else-if="id === 'stream-mic'">
      <header class="m-calm__head"><span class="m-calm__title">{{ card.title }}</span></header>
      <div class="m-b2plate" :class="micOn ? 'is-on' : 'is-quiet'"><span class="m-b2glyph"><MIcon name="mic" /></span><b>{{ d.big }}</b></div>
    </template>

    <button v-else type="button" class="m-b2mic__btn" role="switch" :aria-checked="micOn" :aria-label="d.title" :disabled="d.busy" @click.stop="setMic(!micOn)">
      <header class="m-calm__head"><span class="m-calm__title">{{ d.title }}</span></header>
      <div class="m-b2plate" :class="micOn ? 'is-on' : 'is-quiet'"><span class="m-b2glyph"><MIcon name="mic" /></span><b>{{ (d.options || []).find((o) => o.value === d.value)?.label }}</b></div>
      <span class="m-b2__cap m-b2mic__note">{{ L.restartNote }}</span>
    </button>
  </section>
</template>
