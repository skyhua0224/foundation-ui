<script setup>
import { computed } from 'vue'
import MIcon from '../MIcon.vue'
import MProgress from '../MProgress.vue'
import { railItems } from './installerModel.js'
import { t } from './installerTexts.js'
import { VIVI } from '../../about/mascot.js'

// The left rail of the installer: the brand (the Vivi logo and the product's name) and the five steps. A step is a number while it waits, a turning wave while it runs, a check when it is done and a mark when it stopped;
// the line between two steps fills with the primary colour once the step above is done. It only draws what the model says.
const props = defineProps({ view: { type: Object, required: true }, locale: { type: String, default: 'zh' } })
const items = computed(() => railItems(props.view, props.locale))
const logo = VIVI.logo[64]
const logo2 = VIVI.logo[128]
</script>

<template>
  <aside class="m-inst__rail" data-tauri-drag-region>
    <div class="m-inst__brand" data-tauri-drag-region>
      <img v-if="logo" class="m-inst__logo" :src="logo" :srcset="logo2 ? `${logo} 1x, ${logo2} 2x` : undefined" width="56" height="56" alt="" draggable="false" data-tauri-drag-region />
      <b class="m-inst__name" data-tauri-drag-region>{{ t(locale, 'brand') }}</b>
      <span class="m-inst__setup" data-tauri-drag-region>{{ t(locale, 'setup') }}</span>
    </div>
    <ol class="m-inst__steps-rail" :aria-label="t(locale, 'rail.label')">
      <li v-for="s in items" :key="s.index" class="m-inst__rs" :class="`is-${s.state}`" :aria-current="s.state === 'running' ? 'step' : undefined">
        <span class="m-inst__dot" aria-hidden="true">
          <MIcon v-if="s.state === 'done'" class="m-inst__dot-icon" name="check" />
          <MIcon v-else-if="s.state === 'failed'" class="m-inst__dot-icon" name="error" fill />
          <MProgress v-else-if="s.state === 'running'" circular class="m-inst__dot-spin" />
          <template v-else>{{ s.index + 1 }}</template>
        </span>
        <span class="m-inst__rs-text"><b>{{ s.title }}</b><small>{{ s.sub }}</small></span>
      </li>
    </ol>
  </aside>
</template>
