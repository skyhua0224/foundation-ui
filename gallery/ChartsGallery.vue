<script setup>
import { computed } from 'vue'
import { MChartX, MEventStrip, MHeatStrip, MSparkline, MGauge, MRing, MArcGauge, MInlineBar, MTable, MIcon } from '../src/vue/index.js'

// The chart set on sample data, for the gallery only: every number below is generated here (seeded), none comes from a host.
const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const wave = (n, base, amp, seed, period = 14) => { const r = rnd(seed); return Array.from({ length: n }, (_, i) => Math.max(0, base + Math.sin(i / period * Math.PI * 2) * amp + (r() - 0.5) * amp * 0.5)) }
const N = 40
const times = Array.from({ length: N }, (_, i) => `${String(Math.floor((i * 3) / 60)).padStart(2, '0')}:${String((i * 3) % 60).padStart(2, '0')}`)
const bitrate = wave(N, 44, 8, 11)
const fps = wave(N, 117, 4, 5)
const up = wave(N, 38, 10, 3), loss = wave(N, 0.4, 0.6, 9).map((v, i) => (i % 7 === 3 ? v * 3 : v * 0.3))
const cores = wave(16, 38, 30, 21, 5).map((v) => Math.min(96, v))
const engines = [{ id: '3d', label: '3D', values: wave(8, 52, 20, 2) }, { id: 'enc', label: 'Video encode', values: wave(8, 18, 8, 4) }, { id: 'copy', label: 'Copy', values: wave(8, 6, 4, 6) }]
const memory = [{ id: 'host', label: 'Host', values: wave(N, 1, 0.2, 31) }, { id: 'apps', label: 'Other apps', values: wave(N, 12, 2, 32) }, { id: 'cache', label: 'Cache', values: wave(N, 6, 1, 33) }]
const errors = [{ id: 'e', label: 'Errors', values: [0, 1, 0, 0, 3, 2, 0, 1, 0, 0, 4, 1, 0, 0, 2, 0, 0, 1, 0, 0, 0, 2, 1, 0] }, { id: 'w', label: 'Warnings', values: [1, 2, 0, 1, 2, 3, 1, 0, 2, 1, 3, 2, 1, 0, 1, 2, 0, 1, 1, 0, 0, 1, 2, 1] }]
const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
const latency = wave(160, 5.2, 1.6, 77, 23)
const temp = wave(N, 62, 8, 41)
const days = Array.from({ length: 30 }, (_, i) => ({ label: `day ${i + 1}`, value: [0, 0, 2, 1, 0, 3, 5, 0, 0, 1, 2, 4, 0, 0, 0, 6, 3, 1, 0, 2, 0, 0, 1, 7, 2, 0, 0, 3, 1, 4][i] }))
const events = [{ at: 0.12, label: 'dropped 3', tone: 'warn' }, { at: 0.31, label: 'dropped 1', tone: 'warn' }, { at: 0.34, label: 'dropped 2', tone: 'warn' }, { at: 0.62, label: 'error', tone: 'err' }, { at: 0.85, label: 'dropped 5', tone: 'warn' }]
const clients = [{ id: 1, name: 'Pixel 9', hours: 18.4, share: 0.82, spark: wave(14, 3, 2, 51) }, { id: 2, name: 'Living room TV', hours: 9.1, share: 0.41, spark: wave(14, 2, 1.4, 52) }, { id: 3, name: 'iPad Air', hours: 3.7, share: 0.17, spark: wave(14, 1, 1, 53) }]
const cols = [{ key: 'name', label: 'Client' }, { key: 'share', label: 'Share of play time', width: '40%' }, { key: 'spark', label: '14 days', width: '120px' }]
const segments = computed(() => [{ value: 0.06, tone: 'a' }, { value: 0.38, tone: 'b' }, { value: 0.2, tone: 'free' }])
const items = [
  ['Line with a target band', 'Session detail: bitrate against its target'], ['Line', 'Session detail: frame rate'], ['Event strip', 'Dropped frames and errors on the session time axis'],
  ['Mirrored area and bars', 'Network: up and down, loss as bars'], ['Bars', 'Performance: one bar per core'], ['Grouped bars', 'Performance: GPU engines'],
  ['Stacked area', 'Performance: memory by owner'], ['Line with a threshold', 'Performance: temperature'], ['Stacked bars', 'Logs: errors and warnings per hour'],
  ['Histogram', 'Latency distribution'], ['Arc gauge', 'A value with a safe range'], ['Donut and ring gauge', 'Shares of a whole, one value of 100'],
  ['Heat strip', 'Clients: sessions per day, 30 days'], ['Sparkline and inline bar in a table', 'Clients: per-row history and share'],
]
</script>

<template>
  <div class="cg">
    <header class="cg__head"><h1>Chart set</h1><span class="cg__note"><MIcon name="info" />Sample data generated for this gallery. In the products every series comes from the host.</span></header>
    <div class="cg__grid">
      <section class="cg__card cg__span2"><h2>{{ items[0][0] }}</h2><p>{{ items[0][1] }}</p><MChartX type="area" :series="[{ id: 'b', label: 'Bitrate', values: bitrate }]" :labels="times" :height="150" unit=" Mbps" :decimals="1" :band="{ lo: 36, hi: 52, label: 'target' }" :threshold="{ value: 60, label: 'cap' }" legend="none" /></section>
      <section class="cg__card"><h2>{{ items[1][0] }}</h2><p>{{ items[1][1] }}</p><MChartX type="line" :series="[{ id: 'f', label: 'Frame rate', values: fps }]" :labels="times" :height="150" unit=" fps" :floor="120" legend="none" /></section>
      <section class="cg__card"><h2>{{ items[2][0] }}</h2><p>{{ items[2][1] }}</p><MEventStrip :events="events" :height="34" label="events" /><div class="cg__axis"><span>00:00</span><span>02:00</span></div></section>
      <section class="cg__card cg__span2"><h2>{{ items[3][0] }}</h2><p>{{ items[3][1] }}</p><MChartX type="mirror" :series="[{ id: 'u', label: 'Up', values: up }, { id: 'd', label: 'Down', values: up.map((v) => v * 0.3) }]" :labels="times" :height="130" :gutter="34" unit=" Mbps" :decimals="1" /><MChartX type="bar" :series="[{ id: 'l', label: 'Loss', values: loss, color: 'var(--md-sys-color-error)' }]" :height="54" unit=" %" :decimals="1" :axis="false" :gutter="34" legend="none" /></section>
      <section class="cg__card"><h2>{{ items[4][0] }}</h2><p>{{ items[4][1] }}</p><MChartX type="bar" :series="[{ id: 'c', label: 'Core', values: cores }]" :labels="cores.map((_, i) => `C${i}`)" :height="150" unit=" %" :fixed-max="100" legend="none" /></section>
      <section class="cg__card"><h2>{{ items[5][0] }}</h2><p>{{ items[5][1] }}</p><MChartX type="groupbar" :series="engines" :height="150" unit=" %" :fixed-max="100" /></section>
      <section class="cg__card cg__span2"><h2>{{ items[6][0] }}</h2><p>{{ items[6][1] }}</p><MChartX type="stacked" :series="memory" :labels="times" :height="150" unit=" GB" :decimals="1" /></section>
      <section class="cg__card"><h2>{{ items[7][0] }}</h2><p>{{ items[7][1] }}</p><MChartX type="line" :series="[{ id: 't', label: 'GPU temperature', values: temp }]" :labels="times" :height="150" unit=" °C" :floor="90" :threshold="{ value: 83, label: '83 °C' }" legend="none" /></section>
      <section class="cg__card cg__span2"><h2>{{ items[8][0] }}</h2><p>{{ items[8][1] }}</p><MChartX type="stackbar" :series="errors" :labels="hours" :height="150" /></section>
      <section class="cg__card"><h2>{{ items[9][0] }}</h2><p>{{ items[9][1] }}</p><MChartX type="hist" :series="[{ id: 'h', label: 'Samples', values: latency }]" :bins="12" :height="150" unit=" ms" :decimals="1" legend="none" /></section>
      <section class="cg__card cg__row"><div><h2>{{ items[10][0] }}</h2><p>{{ items[10][1] }}</p></div><MArcGauge :value="0.74" :size="150" label="temperature"><b class="cg__big">74</b><small>°C</small></MArcGauge></section>
      <section class="cg__card cg__row"><div><h2>{{ items[11][0] }}</h2><p>{{ items[11][1] }}</p></div><div class="cg__rings"><MRing :segments="segments" :size="112" label="memory"><b class="cg__big">64</b></MRing><MGauge :value="0.37" :size="64" label="frame budget" /><MSparkline :points="bitrate" :width="110" :height="40" /></div></section>
      <section class="cg__card"><h2>{{ items[12][0] }}</h2><p>{{ items[12][1] }}</p><MHeatStrip :days="days" :cell="22" label="sessions per day" /></section>
      <section class="cg__card cg__span2"><h2>{{ items[13][0] }}</h2><p>{{ items[13][1] }}</p><MTable :columns="cols" :rows="clients" dense><template #cell-share="{ row }"><MInlineBar :value="row.share" :text="`${row.hours} h`" :marker="0.5" /></template><template #cell-spark="{ row }"><MSparkline :points="row.spark" :width="104" :height="28" /></template></MTable></section>
    </div>
  </div>
</template>

<style>
.cg { padding: 28px 32px 40px; background: var(--md-sys-color-surface-container-low); min-height: 100vh; box-sizing: border-box; }
.cg__head { display: flex; align-items: baseline; gap: 16px; margin-bottom: 18px; } .cg__head h1 { margin: 0; font: 500 28px/1.2 var(--md-ref-typeface-brand); color: var(--md-sys-color-on-surface); }
.cg__note { display: inline-flex; align-items: center; gap: 6px; font: 400 13px/18px var(--md-ref-typeface-brand); color: var(--md-sys-color-on-surface-variant); } .cg__note .m-icon { font-size: 16px; }
.cg__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.cg__card { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 18px 20px 16px; border-radius: 28px; background: var(--m-card, var(--md-sys-color-surface-container-lowest)); }
.cg__span2 { grid-column: span 2; } .cg__row { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; }
.cg__card h2 { margin: 0; font: 600 13px/18px var(--md-ref-typeface-brand); color: var(--md-sys-color-on-surface); } .cg__card p { margin: 0 0 10px; font: 400 12px/16px var(--md-ref-typeface-brand); color: var(--md-sys-color-on-surface-variant); }
.cg__big { font: 500 30px/1 var(--md-ref-typeface-brand); letter-spacing: -.02em; color: var(--md-sys-color-on-surface); } .cg__rings { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: flex-end; }
.cg__axis { display: flex; justify-content: space-between; margin-top: 4px; font: 500 11px/14px var(--md-ref-typeface-brand); color: var(--md-sys-color-on-surface-variant); }
</style>
