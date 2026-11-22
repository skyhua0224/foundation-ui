<script setup>
import { reactive } from 'vue'
import MDashCardView from '../src/vue/MDashCardView.vue'
import { buildCatalogue } from '../src/vue/homeCatalogue.js'
import { CATALOGUE_TEXTS } from '../src/vue/homeCatalogueTexts.js'
import { CARD_META, sponsorCardData } from '../src/vue/homeCards.js'
import { catalogueMeta } from '../src/vue/homeCatalogue.js'
import { UNIT_PX, offeredOf, sizePx } from '../src/vue/homeSizes.js'
import { createVddStore } from '../src/vue/useVddStore.js'
import { VIVI } from '../src/about/mascot.js'

// The tiles of B3 on sample data, for the evidence of round 30 only: every value here is made up in this file (no host). Each tile is drawn in a cell of the overview's
// size (one unit = 176 px, the standard density) through MDashCardView, so the same page shows the tile as before (no flag) and with its design (?tiles=bold).
const q = new URLSearchParams(location.search)
const T = { ms: 'ms', ...CATALOGUE_TEXTS.zh, __locale: 'zh' }
const NOW = Date.parse('2026-11-04T11:20:00')
const pad = (n) => String(n).padStart(2, '0')
const stamp = (h, m) => { const d = new Date(NOW - h * 3600000 - m * 60000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00` }
const LOG = [[1, 17, 'Error', 'Failed to encode frame'], [3, 5, 'Warning', 'NVENC: session limit reached'], [5, 40, 'Error', 'Failed to duplicate output: access lost'], [7, 2, 'Warning', 'Audio sink changed'], [9, 30, 'Error', 'Virtual display: mode set failed'], [12, 0, 'Warning', 'Client sent an unknown packet'], [15, 11, 'Error', 'Failed to encode frame'], [20, 45, 'Warning', 'High frame time']]
const logText = (rows) => rows.map(([h, m, lv, t]) => `[${stamp(h, m)}.000]: ${lv}: ${t}`).join('\n')
const logRows = (rows) => rows.map(([h, m, lv, t]) => ({ level: lv, text: t, time: stamp(h, m).slice(5, 16) }))
const vddCfg = reactive({ vdd_reuse: 'disabled', vdd_headless_create: 'enabled', output_name: 'ZakoHDR', resolution_change: 'automatic', refresh_rate_change: 'automatic', display_device_prep: 'no_operation', dynamic_resolution_follow_display: true })
const vddStore = createVddStore({ read: () => vddCfg, write: (p) => Object.assign(vddCfg, p), commit: async () => {} })
const base = (o = {}) => ({
  now: NOW, canAct: true,
  apps: ['Elden Ring', 'Forza Horizon 5', 'Hades II', 'Cyberpunk 2077', 'Celeste', 'Desktop', 'Steam Big Picture', 'Balatro', 'Hollow Knight', 'Dota 2', 'Stardew Valley', 'Halo'].map((name) => ({ name, cover: '' })),
  clients: [{ name: 'Pixel 9', icon: 'mobile' }, { name: 'iPad Air', icon: 'tablet' }, { name: 'Steam Deck', icon: 'sports_esports' }],
  host: { version: '1.4.2', update: '1.4.3' },
  logText: logText(LOG), logs: { rows: logRows(LOG) },
  config: { platform: 'windows', encoder: 'nvenc', max_bitrate: 0, fps: '[60,90,120]', controller: 'enabled', keyboard: 'enabled', mouse: 'disabled', capture_cursor: true, stream_audio: false, upnp: 'disabled', port: 47989 },
  vddStore,
  announcements: [{ id: 'a1', title: 'Foundation Sunshine 1.4.3：虚拟显示器 HDR 与更低的延迟', category: 'update', banner: VIVI.wallpaper[2], date: '11-03' }, { id: 'a2', title: '社区串流挑战赛开始报名', category: 'announce', banner: VIVI.wallpaper[1], date: '10-28' }, { id: 'a3', title: '手把手：用手机串流 PC 游戏', category: 'guide', banner: '', date: '10-20' }],
  session: { client_name: "Pixel 9", uptimeMs: 3723000, fps: 120, bitrate: 48000, enable_mic: false, use_vdd: true },
  ...o,
})
// the states a tile is shown in (the first is its usual one)
const STATES = {
  budget: [['帧预算：有分段', { session: { client_name: 'Pixel 9', uptimeMs: 3723000, fps: 120, bitrate: 48000, latencyMs: 6.15, pipeCaptureToConvertMs: 0.04, pipeConvertMs: 0.15, pipeEncodeQueueMs: 0.01, pipeEncodeMs: 5.94, pipePacketToBroadcastMs: 0.01, pipeTotalMs: 6.15 } }], ['部分缺失（只有转换与编码）', { session: { client_name: 'Pixel 9', uptimeMs: 3723000, fps: 60, bitrate: 48000, latencyMs: 12.4, pipeConvertMs: 0.8, pipeEncodeMs: 11.6 } }], ['全缺（只有主机延迟）', { session: { client_name: 'Pixel 9', uptimeMs: 3723000, fps: 120, bitrate: 48000, latencyMs: 6.1 } }], ['超出一帧', { session: { client_name: 'Pixel 9', uptimeMs: 3723000, fps: 240, bitrate: 48000, latencyMs: 6.2, pipeCaptureToConvertMs: 0.2, pipeConvertMs: 0.5, pipeEncodeQueueMs: 0.9, pipeEncodeMs: 4.3, pipePacketToBroadcastMs: 0.3, pipeTotalMs: 6.2 } }]],
  update: [['有新版本', {}], ['已最新', { host: { version: '1.4.3', update: '' } }], ['长版本号', { host: { version: '2026.1102.1', update: '2026.1103.1' } }], ['长版本号已最新', { host: { version: '2026.1102.1', update: '' } }], ['测试版（Panel 的标签）', { host: { version: '2026.1116.22909 杂鱼', update: '有可用更新' } }], ['测试版已最新', { host: { version: '2026.1116.22909 杂鱼', update: '' } }], ['本地构建（6 位）', { host: { version: '2026.1112.025657', update: '' } }], ['稳定版', { host: { version: '2026.1031.141735', update: '2026.1116.22909' } }], ['手动构建', { host: { version: 'manual-20261116-123456-dev', update: '' } }], ['不规则文本', { host: { version: 'v2026.1116.22909-杂鱼-测试版-abcdef0123', update: '有可用更新' } }]],
  'act-update': [['有新版本', {}], ['已最新', { host: { version: '1.4.3', update: '' } }]],
  errors: [['有错误', {}], ['无错误', { logText: '', logs: { rows: [] } }]],
  logs: [['有日志', {}], ['无日志', { logs: { rows: [] } }]],
  'act-logs': [['有错误', {}], ['无错误', { logText: '', logs: { rows: [] } }]],
  announcements: [['有公告', {}], ['无横幅', { announcements: [{ id: 'a3', title: '手把手：用手机串流 PC 游戏', category: 'guide', banner: '', date: '10-20' }] }]],
  'ctl-controller': [['开', {}], ['关', { config: { ...base().config, controller: 'disabled' } }]],
  'ctl-keyboard': [['开', {}], ['关', { config: { ...base().config, keyboard: 'disabled' } }]],
  'ctl-mouse': [['关', {}], ['开', { config: { ...base().config, mouse: 'enabled' } }]],
  'ctl-cursor': [['开', {}], ['关', { config: { ...base().config, capture_cursor: false } }]],
  'ctl-audio': [['关', {}], ['开', { config: { ...base().config, stream_audio: true } }]],
  'act-pair': [['3 台', {}], ['未配对', { clients: [] }]],
  'act-clients': [['3 台', {}], ['未配对', { clients: [] }]],
  'act-apps': [['12 个', {}], ['没有应用', { apps: [] }]],
}
const meta = catalogueMeta()
const SPONSOR = { kind: 'sponsor', data: sponsorCardData({ sponsorTitle: '赞助', sponsorLine: '', sponsorAction: '赞助', star: 'Star' }, [{ id: 'qiin', label: 'Qiin' }, { id: 'yundi', label: 'Yundi' }]) }
const cardOf = (id, x) => {
  if (id === 'sponsor') return { id, title: '赞助', group: 'resources', cls: 'strip', ...SPONSOR }
  const data = buildCatalogue(x, T).data[id]
  if (!data) return null
  const m = meta[id] || CARD_META[id] || {}
  return { id, title: T[`c_${id}`] || data.title, group: m.group || 'resources', cls: m.cls, kind: 'widget', data }
}
const IDS = (q.get('ids') || 'act-restart,act-pair,act-update,ctl-controller,ctl-encoder,ctl-fps,ctl-vdd,pers-colour,pers-theme,pers-wallpaper,announcements,errors,logs,update,tip,sponsor,vivi').split(',')
const only = Object.fromEntries((q.get('sizes') || '').split(',').filter(Boolean).map((p) => { const [id, s] = p.split(':'); return [id, s.split('.')] }))
const unit = UNIT_PX
const rows = IDS.flatMap((id) => (STATES[id] || [['', {}]]).map(([label, o]) => {
  const card = cardOf(id, base(o))
  if (!card) return null
  const sizes = only[id] || only['*'] || offeredOf(id, card, 'large')
  return { id, label, sizes: sizes.map((k) => { const [w, h] = sizePx(k, unit); return { k, w, h, card: { ...card, size: k } } }) }
})).filter(Boolean)
const act = (a) => console.log('act', JSON.stringify(a))
</script>

<template>
  <main class="b3g">
    <section v-for="r in rows" :key="r.id + r.label" class="b3g__row" :data-tile="r.id">
      <h2>{{ r.id }}<small v-if="r.label"> · {{ r.label }}</small></h2>
      <div class="b3g__sizes">
        <figure v-for="s in r.sizes" :key="s.k" :data-size="s.k">
          <figcaption>{{ s.k }}</figcaption>
          <div class="m-dash__cell b3g__cell" :data-card="r.id" :style="{ width: `${s.w}px`, height: `${s.h}px` }"><div class="m-dash__body"><MDashCardView :card="s.card" :texts="T" :details="{}" @act="act" /></div></div>
        </figure>
      </div>
    </section>
  </main>
</template>

<style>
html { background: var(--m-page-solid); }
.b3g { padding: 20px 28px; font-family: var(--md-ref-typeface-brand); color: var(--md-sys-color-on-surface); }
.b3g__row { margin-bottom: 18px; }
.b3g__row h2 { margin: 0 0 8px; font: 600 15px/20px var(--md-ref-typeface-brand); } .b3g__row h2 small { font-weight: 500; color: var(--md-sys-color-on-surface-variant); }
.b3g__sizes { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px; }
.b3g figure { margin: 0; display: flex; flex-direction: column; gap: 4px; }
.b3g figcaption { font: 500 12px/16px var(--md-ref-typeface-brand); color: var(--md-sys-color-on-surface-variant); }
.b3g__cell { --m-dash-radius: 28px; }
</style>
