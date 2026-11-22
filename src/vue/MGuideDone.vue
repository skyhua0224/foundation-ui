<script setup>
import { computed } from 'vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import MGroup from './MGroup.vue'
import MItem from './MItem.vue'
import { GUIDE_OPTIONAL } from './guideModel.js'
import { fillText } from './guideTexts.js'

// The done page of the first-run guide: the game library the guide found in the background (tick what to add), and the optional pages as buttons. A button opens that page of the guide as a
// sub-flow and comes back here; nothing here is required, 「开始使用」 in the foot ends the guide.
//   library: { status: 'scanning' | 'ready' | 'none' | 'failed' | 'unsupported', games: [{ key, name, platform }], picked: [keys], busy, added }
const props = defineProps({
  T: { type: Object, required: true },
  library: { type: Object, default: null },
  /** ids of the optional pages this product offers (the step's `optional`) */
  optional: { type: Array, default: () => GUIDE_OPTIONAL.map((p) => p.id) },
  /** the line under each optional page: what is set now, when the product knows it */
  states: { type: Object, default: () => ({}) },
  /** pages the product cannot offer now, { id: true } (the reason is the text of the page); they are listed apart, quiet, under 「暂不可用」 and cannot be opened */
  unavailable: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['open', 'toggle', 'add', 'rescan'])
const D = computed(() => props.T.done)
const pages = computed(() => GUIDE_OPTIONAL.filter((p) => props.optional.includes(p.id)))
const usable = computed(() => pages.value.filter((p) => !props.unavailable[p.id]))
const plain = computed(() => usable.value.filter((p) => !p.advanced))
const advanced = computed(() => usable.value.filter((p) => p.advanced))
const unusable = computed(() => pages.value.filter((p) => props.unavailable[p.id]))
const lib = computed(() => props.library)
const showLibrary = computed(() => !!lib.value && lib.value.status !== 'unsupported')
const line = computed(() => {
  const l = lib.value
  if (!l) return ''
  if (l.status === 'scanning') return D.value.scanning
  if (l.status === 'ready') return fillText(D.value.found, { n: l.games.length })
  if (l.status === 'none') return D.value.none
  if (l.status === 'failed') return D.value.failed
  return ''
})
const text = (id) => props.states[id] || D.value.items[id].text
</script>

<template>
  <div class="m-gdone">
    <section v-if="showLibrary" class="m-gdone__lib" :aria-label="D.library">
      <MGroup>
        <MItem :icon="lib.status === 'scanning' ? 'sync' : 'sports_esports'" :title="D.library" :text="line" :class="{ 'is-busy': lib.status === 'scanning' }">
          <template v-if="lib.status === 'failed' || lib.status === 'none'" #trail><MButton variant="text" icon="refresh" @click="emit('rescan')">{{ D.rescan }}</MButton></template>
        </MItem>
      </MGroup>
      <template v-if="lib.status === 'ready'">
        <div class="m-gdone__chips" role="group" :aria-label="D.library">
          <button v-for="g in lib.games" :key="g.key" type="button" role="checkbox" class="m-gdone__chip" :class="{ 'is-on': lib.picked.includes(g.key) }" :aria-checked="lib.picked.includes(g.key)" @click="emit('toggle', g.key)"><MIcon :name="lib.picked.includes(g.key) ? 'check' : 'add'" />{{ g.name }}</button>
        </div>
        <div class="m-gdone__add"><MButton variant="outlined" icon="add" :loading="lib.busy" :disabled="lib.busy || !lib.picked.length" @click="emit('add')">{{ fillText(D.addPicked, { n: lib.picked.length }) }}</MButton></div>
      </template>
    </section>

    <section class="m-gdone__opt" aria-labelledby="m-gdone-opt">
      <h2 id="m-gdone-opt" class="m-guide__label">{{ D.optional }}</h2>
      <p class="m-guide__note"><MIcon name="info" />{{ D.optionalNote }}</p>
      <MGroup v-if="plain.length">
        <MItem v-for="p in plain" :key="p.id" action :icon="p.icon" :title="D.items[p.id].title" :text="text(p.id)" :data-optional="p.id" @click="emit('open', p.id)"><template #trail><MIcon name="chevron_right" /></template></MItem>
      </MGroup>
      <template v-if="advanced.length">
        <h3 class="m-gdone__adv">{{ D.advanced }}</h3>
        <MGroup>
          <MItem v-for="p in advanced" :key="p.id" action :icon="p.icon" :title="D.items[p.id].title" :text="text(p.id)" :data-optional="p.id" @click="emit('open', p.id)"><template #trail><MIcon name="chevron_right" /></template></MItem>
        </MGroup>
      </template>
      <template v-if="unusable.length">
        <h3 class="m-gdone__adv m-gdone__adv--off">{{ D.unavailable }}</h3>
        <MGroup class="m-gdone__off">
          <MItem v-for="p in unusable" :key="p.id" :icon="p.icon" :title="D.items[p.id].title" :text="D.reasons[p.id]" :data-unavailable="p.id" />
        </MGroup>
      </template>
    </section>
  </div>
</template>
