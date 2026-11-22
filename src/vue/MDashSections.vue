<script setup>
import { computed, ref } from 'vue'
import MChart from './MChart.vue'
import MChartX from './MChartX.vue'
import MEventStrip from './MEventStrip.vue'
import MHeatStrip from './MHeatStrip.vue'
import MInlineBar from './MInlineBar.vue'
import MSeg from './MSeg.vue'
import MSparkline from './MSparkline.vue'
import MRing from './MRing.vue'
import MIcon from './MIcon.vue'

/**
 * The sections of a card's detail ({ ranges, sections }, see buildCatalogueDetails and the product's own details): the detail sheet shows them with the time
 * range switch, the large size of a card shows them inline (smaller charts, no switch, the 5 minute range). `uid` keeps the ranges of one card apart.
 */
const props = defineProps({
  detail: { type: Object, required: true },
  uid: { type: String, default: '' },
  texts: { type: Object, default: () => ({}) },
  inline: { type: Boolean, default: false },
})
const chartRange = ref({})
const rangeOf = (key, first) => chartRange.value[key] || first
// the time range (1 min, 5 min, this session): sections hold every sample, the view shows the newest `n` (0 = all)
const spanOf = ref({})
const span = computed(() => spanOf.value[props.uid] ?? props.detail?.ranges?.[1]?.value ?? 0)
const cut = (list) => (span.value > 0 && Array.isArray(list) ? list.slice(-span.value) : list)
const agoLabels = (n, step = 3) => Array.from({ length: n }, (_, i) => { const s = Math.round((n - 1 - i) * step); return s === 0 ? '0:00' : `-${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })
const seriesOf = (s) => s.series.map((x) => ({ ...x, values: cut(x.values) }))
const labelsOf = (s) => (s.step ? agoLabels(cut(s.series[0].values).length, s.step) : s.labels)
const marksOf = (s) => { const v = cut(s.samples) || []; return v.map((x, i) => (i > 0 && x > v[i - 1] ? { at: v.length > 1 ? i / (v.length - 1) : 0, label: `+${x - v[i - 1]}`, tone: 'warn' } : null)).filter(Boolean) }
</script>

<template>
  <div class="m-ddetail" :class="{ 'm-ddetail--inline': inline }">
  <MSeg v-if="detail.ranges && !inline" class="m-ddetail__ranges" :model-value="span" :options="detail.ranges" :label="texts.range || ''" @update:model-value="(v) => (spanOf = { ...spanOf, [uid]: v })" />
  <template v-for="(s, i) in detail.sections" :key="i">
    <div v-if="s.type === 'ring'" class="m-timer"><b class="m-timer__text m-dnum">{{ s.label }}</b></div>
    <div v-else-if="s.type === 'donut'" class="m-ddetail__donut">
      <MRing :segments="s.segments" :size="inline ? 120 : 168" :label="s.title"><b class="m-dnum m-ddetail__centre">{{ s.centre }}</b><small>{{ s.caption }}</small></MRing>
      <ul class="m-dstack__legend"><li v-for="(g, j) in s.segments" :key="j"><i :class="`m-dstack__dot--${g.tone}`" /><span>{{ g.label }}</span><b class="m-dnum">{{ g.text }}</b></li></ul>
    </div>
    <div v-else-if="s.type === 'chart'" class="m-ddetail__chart">
      <h4 v-if="s.title">{{ s.title }}</h4>
      <MChart :points="s.points" :unit="s.unit" :decimals="s.decimals || 0" :ranges="s.ranges || []" :range="rangeOf(`${uid}:${i}`, s.ranges?.[0]?.value)" :step="s.step || 1" :empty-text="s.empty" :label="s.title" @update:range="(v) => (chartRange = { ...chartRange, [`${uid}:${i}`]: v })" />
    </div>
    <div v-else-if="s.type === 'chartx'" class="m-ddetail__chart"><h4 v-if="s.title">{{ s.title }}</h4><MChartX :type="s.chart" :series="seriesOf(s)" :labels="labelsOf(s)" :height="inline ? Math.min(s.height || 140, 160) : (s.height || 140)" :unit="s.unit || ''" :decimals="s.decimals || 0" :band="s.band || null" :threshold="s.threshold || null" :fixed-max="s.max || null" :floor="s.floor || 0" :gutter="40" :legend="s.series.length > 1 ? 'compact' : 'none'" :key="`${uid}${span}`" :empty="s.empty || ''" :label="s.title || ''" /></div>
    <div v-else-if="s.type === 'events'" class="m-ddetail__chart"><h4 v-if="s.title">{{ s.title }}</h4><MEventStrip :events="s.samples ? marksOf(s) : s.events" :height="30" :label="s.title" :empty="s.empty" /></div>
    <div v-else-if="s.type === 'heat'" class="m-ddetail__chart"><h4 v-if="s.title">{{ s.title }}</h4><MHeatStrip :days="s.days" :cell="inline ? 16 : 22" :label="s.title" :empty="s.empty" /></div>
    <div v-else-if="s.type === 'clientrows'" class="m-ddetail__chart"><h4 v-if="s.title">{{ s.title }}</h4><ul v-if="s.rows.length" class="m-ddetail__clients" data-redact="client"><li v-for="r in s.rows" :key="r.id"><span>{{ r.name }}</span><MInlineBar :value="r.share" :text="r.text" /><MSparkline :points="r.spark" :width="88" :height="26" /></li></ul><p v-else class="m-ddetail__note">{{ s.empty }}</p></div>
    <ul v-else-if="s.type === 'rows'" class="m-ddetail__rows"><li v-for="(r, j) in s.rows" :key="j"><MIcon v-if="r.icon" :name="r.icon" /><span>{{ r.title }}</span><b class="m-dnum">{{ r.value }}</b></li></ul>
    <div v-else-if="s.type === 'chips'" class="m-dinfo__chips"><span v-for="(c, j) in s.chips" :key="j" class="m-dchip" :class="c.tone && `m-dchip--${c.tone}`"><MIcon v-if="c.icon" :name="c.icon" />{{ c.label }}</span></div>
    <p v-else-if="s.type === 'note'" class="m-ddetail__note">{{ s.text }}</p>
  </template>
  </div>
</template>
