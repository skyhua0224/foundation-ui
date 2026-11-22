<script setup>
import { computed, ref, watch } from 'vue'
import MSheet from './MSheet.vue'
import MIcon from './MIcon.vue'

// Picker for a long list of choices (languages, adapters, presets): a sheet with a search field and one row per
// option; choosing a row applies it and closes the sheet. Replaces a native select. The trigger lives outside
// (a row or a button) and opens the sheet through `v-model:open`. Extra attributes
// (a class or a style, such as a caller's `--m-dialog-w`) land on the sheet itself.
const model = defineModel({ type: [String, Number, Boolean], default: '' })
const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({
  title: { type: String, required: true },
  /** [{ value, label, text?, disabled? }]: a disabled option is shown with its reason (text) and cannot be chosen */
  options: { type: Array, required: true },
  searchLabel: { type: String, default: 'Search' },
  emptyText: { type: String, default: 'Nothing found' },
  closeLabel: { type: String, default: 'Close' },
  help: { type: String, default: '' },
  /** the search field shows from this many options on */
  searchFrom: { type: Number, default: 7 },
})
const query = ref('')
defineOptions({ inheritAttrs: false })
const norm = (s) => String(s ?? '').toLowerCase()
const shown = computed(() => {
  const q = norm(query.value).trim()
  if (!q) return props.options
  return props.options.filter((o) => norm(`${o.label} ${o.text || ''} ${o.value}`).includes(q))
})
watch(open, (value) => { if (value) query.value = '' })
const choose = (option) => { if (option.disabled) return; model.value = option.value; open.value = false }
</script>

<template>
  <Teleport to="body">
    <MSheet v-bind="$attrs" v-model="open" :title="title" side="center" :close-label="closeLabel">
      <p v-if="help" class="m-pick__help">{{ help }}</p>
      <label v-if="options.length > searchFrom" class="m-pick__search">
        <MIcon name="search" />
        <input v-model="query" type="search" :placeholder="searchLabel" :aria-label="searchLabel" autocomplete="off" />
      </label>
      <ul class="m-pick__list" role="listbox" :aria-label="title">
        <li v-for="option in shown" :key="String(option.value)" role="presentation">
          <button type="button" role="option" class="m-pick__opt" :class="{ 'is-on': option.value === model, 'is-disabled': option.disabled }" :aria-selected="option.value === model" :aria-disabled="option.disabled ? 'true' : undefined" :disabled="option.disabled" @click="choose(option)">
            <span class="m-pick__text"><span>{{ option.label }}</span><small v-if="option.text">{{ option.text }}</small></span>
            <MIcon v-if="option.value === model" name="check" />
          </button>
        </li>
      </ul>
      <p v-if="!shown.length" class="m-pick__empty">{{ emptyText }}</p>
    </MSheet>
  </Teleport>
</template>
