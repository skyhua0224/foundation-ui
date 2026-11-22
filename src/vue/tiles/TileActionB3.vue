<script>
export const tileIds = ['act-apps', 'act-clients', 'act-community', 'act-diagnostics', 'act-docs', 'act-downloads', 'act-export-diag', 'act-logs', 'act-open-desktop', 'act-pair-qr', 'act-pair', 'act-restart', 'act-scan-games', 'act-settings', 'act-star', 'act-stop', 'act-stream-check', 'act-update']
</script>

<script setup>
// The action tiles in the calibrated language of 添加应用:
// an Android 16 Quick Settings tile. The whole tile is the button: the tonal container, the glyph in a filled circle at the top left, the action's name at the bottom left.
// An action with a live state says it in one bold line under the name (the paired count, the version, the 24 h errors, the session's clock), and a state that matters
// takes the tile's colour (an update ready, errors in the log, a stream running). A link that leaves the app carries ↗. On press the circle squares a little on the
// fast spatial spring (none under reduced motion).
import { computed } from 'vue'
import MIcon from '../MIcon.vue'
import { registeredComponentStatus } from '../../status/controller.js'
import { recommendForOs } from '../../clients/recommend.js'
import { readOs } from '../../clients/osChoice.js'
import { b3Texts, fill } from './b3Texts.js'
import { designProps } from './tileData.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const id = computed(() => props.card.id)
const L = computed(() => b3Texts(props.texts))
const OUT = new Set(['act-community', 'act-docs', 'act-star'])
const n = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null)
const clock = (ms) => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}` }
const checks = () => {
  const rows = (registeredComponentStatus()?.rows?.value || []).filter((r) => r.hasSource && r.loaded && r.state && r.state !== 'unknown')
  return rows.length ? { ok: rows.filter((r) => r.state === 'ok').length, all: rows.length } : null
}
// { state: the bold line, accent: the tile's colour }
const view = computed(() => {
  const x = d.value, i = id.value
  if (i === 'act-apps') return { state: n(x.count) ? fill(L.value.apps, { n: x.count }) : n(x.count) === 0 ? L.value.noApps : '' }
  if (i === 'act-clients' || i === 'act-pair') return { state: n(x.count) ? fill(L.value.paired, { n: x.count }) : n(x.count) === 0 ? L.value.unpaired : '' }
  if (i === 'act-logs') return n(x.errors) ? { state: fill(L.value.errors24, { n: x.errors }), alert: true } : n(x.errors) === 0 ? { state: L.value.noErrors } : {}
  if (i === 'act-update') return x.update ? { state: fill(L.value.updateTo, { v: x.update }), accent: 'tertiary' } : x.version ? { state: `${L.value.current} · ${x.version}` } : {}
  if (i === 'act-stop') return { state: [x.client, n(x.uptimeMs) !== null ? clock(x.uptimeMs) : ''].filter(Boolean).join(' · '), glyph: 'stop', alert: true, quiet: true }
  if (i === 'act-diagnostics') { const c = checks(); return c ? { state: fill(L.value.ready, { a: c.ok, b: c.all }), alert: c.ok < c.all } : {} }
  if (i === 'act-settings') return { state: x.facts || '' }
  if (i === 'act-downloads') { try { return { state: String(recommendForOs(readOs())?.client?.name || '') } } catch { return {} } }
  return {}
})
const go = () => { if (!props.preview) emit('act', { type: d.value.act, value: d.value.value }) }
</script>

<template>
  <button type="button" class="m-tile m-cal m-cala m-b3a" :class="{ 'has-state': !!view.state, 'is-alert': view.alert, 'is-quiet': card.quiet || view.quiet }" data-size="s" :data-accent="view.accent || 'secondary'" :data-act="id"
    :aria-label="[card.title, view.state].filter(Boolean).join(' · ')" @click="go">
    <span class="m-cala__glyph"><MIcon :name="view.glyph || d.icon" :fill="(view.glyph || d.icon) === 'stop'" /></span>
    <MIcon v-if="OUT.has(id)" class="m-b3a__out" name="open_in_new" />
    <span class="m-b3a__text"><b class="m-cala__name">{{ card.title }}</b><small v-if="view.state" class="m-b3a__state m-dnum" data-redact="client">{{ view.state }}</small></span>
  </button>
</template>
