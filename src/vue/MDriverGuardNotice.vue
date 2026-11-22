<script setup>
import { computed } from 'vue'
import MBanner from './MBanner.vue'
import MButton from './MButton.vue'
import { guardNotices, probeLine } from '../driverGuard/model.js'

// The state of the graphics driver at the top of the home page, the same on the Panel and the Web UI: the safe mode (what was skipped, how to leave it) and the
// notice that the last failure lay in the driver (where to update it, who to ask when it is the latest). `guard` is GET /api/gpu-driver-guard (src/driverGuard/model.js).
// Links open through `open` (a Tauri window opens them in the browser; the default is a new tab); a dismissal and a retry go up to the page, which posts them to the host.
const props = defineProps({
  guard: { type: Object, default: null },
  locale: { type: String, default: 'zh' },
  open: { type: Function, default: (href) => window.open(href, '_blank', 'noopener,noreferrer') },
})
const emit = defineEmits(['dismiss', 'retry'])
const notices = computed(() => guardNotices(props.guard, props.locale))
const line = computed(() => probeLine(props.guard, props.locale))
const run = (notice, action) => {
  if (action.href) props.open(action.href)
  else if (action.id === 'dismiss') emit('dismiss', notice.key)
  else if (action.id === 'retry') emit('retry')
}
</script>

<template>
  <div v-if="notices.length || line" class="m-driver-guard">
    <MBanner v-for="n in notices" :key="n.id" :tone="n.tone" :icon="n.icon" :data-guard="n.id">
      <b>{{ n.title }}</b><br>{{ n.text }}
      <template #actions>
        <MButton v-for="a in n.actions" :key="a.id" variant="text" size="md" :data-action="a.id" @click="run(n, a)">{{ a.label }}</MButton>
      </template>
    </MBanner>
    <p v-if="line" class="m-driver-guard__line" data-guard="probing">{{ line }}</p>
  </div>
</template>

<style>
.m-driver-guard { display: grid; gap: 8px; min-width: 0; }
/* four actions do not fit beside each other on a phone: they wrap and the banner keeps to its column */
.m-driver-guard .m-banner { grid-template-columns: auto minmax(0, 1fr); }
.m-driver-guard .m-banner__actions { flex-wrap: wrap; }
@media (max-width: 520px) { .m-driver-guard .m-banner__actions { grid-column: 1 / -1; justify-content: flex-start; } }
.m-driver-guard__line { margin: 0; padding: 0 4px; color: var(--md-sys-color-on-surface-variant); font: var(--m-body-medium); }
</style>
