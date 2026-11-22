<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { MTileChart, MTileShape, MTileNumeral, MTileChip, MTileRing, MTileStack, MTileEmpty, MIcon } from '../src/vue/index.js'
import { columnsOf, sizePx } from '../src/vue/homeSizes.js'

// The tile kit (docs/tile-kit.md) on sample data, for the gallery only: every number below is generated here (seeded), none comes from a host.
const q = new URLSearchParams(location.search)
const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const wave = (n, base, amp, seed, period = 14) => { const r = rnd(seed); return Array.from({ length: n }, (_, i) => Math.max(0, Math.min(100, base + Math.sin(i / period * Math.PI * 2) * amp + (r() - 0.5) * amp * 0.6))) }
// the unit of the overview at this window (the content is the window less the rail and the page's padding)
const unit = columnsOf((+q.get('w') || window.innerWidth) - 190).unit
const box = (k) => { const [w, h] = sizePx(k, unit); return { width: `${w}px`, height: `${h}px` } }
const load = ref(wave(60, 42, 22, 7))
let t = 0, r = rnd(99)
onMounted(() => { if (q.get('live')) t = setInterval(() => { const l = load.value; load.value = [...l.slice(1), Math.max(2, Math.min(98, l[l.length - 1] + (r() - 0.5) * 18))] }, 1000) })
onBeforeUnmount(() => clearInterval(t))
const covers = [{ letter: 'E' }, { letter: 'F' }, { letter: 'H' }]
</script>

<template>
  <main class="m-gal-tiles" :style="{ '--u': `${unit}px` }">
    <h1>Tile kit</h1>
    <section class="row">
      <figure><div class="m-tile" :style="box('s')"><div class="m-tile__head"><MIcon name="memory" /><span>CPU</span></div><MTileNumeral :value="String(Math.round(load.at(-1)))" unit="%" size="s" /><MTileChart class="m-tile__bleed" :points="load" :max="100" kind="area" dot :window="20" /></div><figcaption>MTileChart area + MTileNumeral s</figcaption></figure>
      <figure><div class="m-tile" data-accent="tertiary" :style="box('s')"><div class="m-tile__head"><MIcon name="developer_board" /><span>GPU</span></div><MTileRing :value="load.at(-1) / 100" style="width: 74%; margin: 4px auto 0"><MTileNumeral :value="String(Math.round(load.at(-1)))" unit="%" size="s" /></MTileRing></div><figcaption>MTileRing</figcaption></figure>
      <figure><div class="m-tile m-tile--tonal" data-accent="secondary" :style="box('s')"><div class="m-tile__head"><MIcon name="speed" /><span>码率</span></div><MTileNumeral value="48.2" unit="Mbps" size="s" /><MTileChart class="m-tile__bleed" style="--tile-bleed: 46%" :points="load" kind="bars" :window="14" /></div><figcaption>tonal + bars</figcaption></figure>
      <figure><div class="m-tile" :style="box('s')"><MTileShape class="m-tile__corner" icon="desktop_windows" shape="cookie" size="150px" /><div style="margin-top: auto"><MTileNumeral value="1440p" size="s" /><div style="display: flex; gap: 6px; margin-top: 8px"><MTileChip label="120 Hz" /><MTileChip label="HDR" tone="ok" /></div></div></div><figcaption>MTileShape corner + MTileChip</figcaption></figure>
      <figure><div class="m-tile" data-accent="tertiary" :style="box('s')"><div class="m-tile__head"><MIcon name="apps" /><span>应用</span></div><MTileStack kind="covers" :items="covers" :more="5" size="86px" style="margin: auto" /></div><figcaption>MTileStack covers</figcaption></figure>
      <figure><div class="m-tile" data-accent="tertiary" :style="box('s')"><MTileEmpty icon="sports_esports" shape="clover" title="最近玩过" text="还没有玩过" :action="{ label: '开始串流' }" size="s" /></div><figcaption>MTileEmpty s</figcaption></figure>
    </section>
    <section class="row">
      <figure><div class="m-tile" :style="box('m')"><div class="m-tile__head"><MIcon name="memory" /><span>CPU</span></div><MTileNumeral :value="String(Math.round(load.at(-1)))" unit="%" size="m" caption="AMD Ryzen 9 7950X" /><MTileChart class="m-tile__bleed" :points="load" :max="100" kind="area" dot :window="36" /></div><figcaption>中: chart</figcaption></figure>
      <figure><div class="m-tile" :style="box('m')"><MTileEmpty icon="public" shape="sunny" title="公网地址" text="未设置" :action="{ label: '设置公网访问' }" size="m" /></div><figcaption>MTileEmpty m</figcaption></figure>
      <figure><div class="m-tile" :style="box('m')"><div class="m-tile__head"><MIcon name="devices" /><span>配对客户端</span></div><div style="display: flex; align-items: center; gap: 16px; margin-top: auto"><MTileNumeral value="6" size="m" /><MTileStack kind="avatars" :items="[{ icon: 'mobile' }, { icon: 'tablet' }, { icon: 'tv', tone: 'ok' }]" :more="3" size="56px" /></div></div><figcaption>MTileStack avatars</figcaption></figure>
    </section>
    <section class="row">
      <figure><div class="m-tile" :style="box('l')"><div class="m-tile__head"><MIcon name="memory" /><span>CPU</span></div><MTileNumeral :value="String(Math.round(load.at(-1)))" unit="%" size="l" caption="AMD Ryzen 9 7950X · 16 核 32 线程" /><MTileChart class="m-tile__bleed" :points="load" :max="100" kind="area" dot grid :window="48" /></div><figcaption>大: chart + grid</figcaption></figure>
      <figure><div class="m-tile" data-accent="secondary" :style="box('l')"><div class="m-tile__head"><MIcon name="storage" /><span>内存</span></div><MTileRing :segments="[{ value: 0.06, tone: 'a' }, { value: 0.33, tone: 'b' }]" style="width: 70%; margin: 8px auto 0"><MTileNumeral value="39" unit="%" size="l" caption="32 GB" /></MTileRing></div><figcaption>MTileRing segments</figcaption></figure>
      <figure><div class="m-tile" data-accent="error" :style="box('l')"><div class="m-tile__head"><MIcon name="device_thermostat" /><span>温度</span></div><MTileRing :value="0.78" style="width: 80%; margin: 8px auto 0"><MTileNumeral value="78" unit="°C" size="l" /></MTileRing></div><figcaption>MTileRing, a value in its zone colour</figcaption></figure>
    </section>
  </main>
</template>

<style>
html { background: var(--m-page-solid); }
.m-gal-tiles { padding: 24px 32px; font-family: var(--md-ref-typeface-brand); color: var(--md-sys-color-on-surface); }
.m-gal-tiles h1 { margin: 0 0 16px; font: 600 20px/28px var(--md-ref-typeface-brand); }
.m-gal-tiles .row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px 12px; margin-bottom: 20px; }
.m-gal-tiles figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.m-gal-tiles figcaption { font: 500 12px/16px var(--md-ref-typeface-brand); color: var(--md-sys-color-on-surface-variant); }
</style>
