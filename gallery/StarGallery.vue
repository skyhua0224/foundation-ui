<script setup>
// The star prompt and the client recommendation at many widths of their container, in Chinese and English, with and without the star of a client (a Mac client adds a third long button).
// The layout check starfit.mjs (the gate of the banner) reads this page.
import { MStarPrompt } from '../src/vue/index.js'
import { homeTexts } from '../src/vue/homeModel.js'

const q = new URLSearchParams(location.search)
const WIDTHS = (q.get('w') || '320,360,400,480,560,620,700,800,900,1000,1100,1280,1600,1920,2560,3840').split(',').map(Number)
const host = { name: 'Foundation Sunshine', url: 'https://github.com/AlkaidLab/foundation-sunshine' }
const mac = { name: 'Moonlight macOS Enhanced', url: 'https://github.com/AlkaidLab/moonlight-macos' }
const textsOf = (loc) => { const T = homeTexts(loc); return { title: T.starTitle, sub: T.starSub, action: T.starPromptAction, later: T.starLater, sponsor: T.sponsorAction, bilibili: T.starBilibili } }
const LOCALES = ['zh', 'en']
const STATES = [['串流中 · Mac 客户端（三个星标按钮）', { streaming: true, client: mac }], ['串流中 · 只有主机的星标', { streaming: true, client: null }], ['空闲 · 星标与赞助', { streaming: false, client: null }]]
</script>

<template>
  <main class="stg" style="padding: 16px; display: grid; gap: 14px; color: var(--md-sys-color-on-surface); background: var(--md-sys-color-background)">
    <template v-for="w in WIDTHS" :key="w">
      <template v-for="loc in LOCALES" :key="loc">
        <section v-for="[label, st] in STATES" :key="label" class="stg__case" :data-w="w" :data-loc="loc" :data-state="st.streaming ? (st.client ? 'mac' : 'host') : 'idle'">
          <small style="font: 12px sans-serif; opacity: .7">{{ w }} px · {{ loc }} · {{ label }}</small>
          <div class="stg__box" :style="{ width: `${w}px`, containerType: 'inline-size' }"><MStarPrompt :texts="textsOf(loc)" :host="host" :client="st.client" :streaming="st.streaming" /></div>
        </section>
      </template>
    </template>
  </main>
</template>
