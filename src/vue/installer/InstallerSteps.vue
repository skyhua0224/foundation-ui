<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MIcon from '../MIcon.vue'
import MProgress from '../MProgress.vue'
import { installProgress, stepRows } from './installerModel.js'
import { t } from './installerTexts.js'

// The installing page: the steps of the group that runs (each with its own state), the hint, and the overall bar.
// The bar is determinate: settled steps over the steps this selection runs; the step that runs shows the indeterminate wave (the engine reports no percentage inside a step).
const props = defineProps({ view: { type: Object, required: true }, locale: { type: String, default: 'zh' }, note: { type: Object, default: null } })
const rows = computed(() => stepRows(props.view, props.locale))
const total = computed(() => installProgress(props.view))
const percent = computed(() => Math.round(total.value.value * 100))
const group = computed(() => Math.min(3, Math.max(0, props.view.progress.current)))
// The bar never jumps, however rarely the shell reports: a new value is reached in 480 ms (ease-out, a CSS transition
// of the wave's width), then the bar creeps for up to 14 s toward the start of the next planned step and never past it.
// The wave itself runs on its own CSS animation, untouched by the view. No frame is stepped from script.
const shown = ref(total.value.value)
const creeping = ref(false)
let creepTimer = null
watch(() => total.value.value, (v) => {
  clearTimeout(creepTimer)
  creeping.value = false
  shown.value = v
  const t = total.value
  const next = t.total ? Math.min(1, (t.done + 1) / t.total) - 0.004 : v
  if (v < 1 && next > v) creepTimer = setTimeout(() => { creeping.value = true; shown.value = next }, 500)
})
onBeforeUnmount(() => clearTimeout(creepTimer))
</script>

<template>
  <div class="m-inst__run">
    <ul class="m-inst__rows" role="list">
      <li v-for="(r, i) in rows" :key="r.key" class="m-inst__step" :class="`is-${r.state}`" :style="{ '--i': i }" role="listitem">
        <span class="m-inst__sdot" aria-hidden="true">
          <MIcon v-if="r.state === 'done'" name="check" />
          <MIcon v-else-if="r.state === 'failed'" name="error" fill />
          <MProgress v-else-if="r.state === 'running'" circular class="m-inst__sdot-spin" />
        </span>
        <span class="m-inst__stext">{{ r.label }}</span>
        <span v-if="r.state === 'running'" class="m-inst__snext">{{ t(locale, 'ins.next') }}</span>
      </li>
    </ul>
    <div v-if="note" class="m-inst__note" :class="`m-inst__note--${note.tone}`" role="note"><MIcon :name="note.icon" fill /><span>{{ note.text }}</span></div>
    <div class="m-inst__total">
      <div class="m-inst__total-row"><span>{{ t(locale, 'ins.stepof', group + 1, 4) }}</span><b>{{ percent }}%</b></div>
      <MProgress :value="shown" class="m-inst__bar" :class="{ 'is-creeping': creeping }" :glide="creeping ? 14000 : 480" :glide-ease="creeping ? 'creep' : 'standard'" :label="t(locale, 'ins.progress')" />
    </div>
  </div>
</template>
