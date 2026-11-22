<script>
export const tileIds = ['announcements', 'errors', 'logs', 'update', 'tip', 'sponsor', 'vivi']
</script>

<script setup>
// The info tiles of B3 in the calibrated language (round 31; references: REFERENCES.md "信息类"). One focal element each:
//   错误: the 24 h count in display type and the latest error beside it; 大 and 特大 a calm list of the newest lines (iOS Reminders, Google Tasks). No bars: the team read them as noise twice; the hours are in the detail sheet, with their axes.
//   日志: the number of new lines and their levels; 中 adds the newest line; 大 the list (Google Tasks, iOS Reminders).
//   公告: the banner of the newest post is the tile when it has one, under a deep scrim with its kind and title (iOS News, Google's news widget); else the title in type.
//   版本: the version in display type and its state (iOS Weather small, Pixel Weather's pill).
//   小贴士, 赞助: strips with the quiet title at the start (快捷操作's language); 赞助's actions as pills.
//   vivi: Vivi on a tonal ground with the greeting of the hour (Duolingo's widget).
import { computed } from 'vue'
import MIcon from '../MIcon.vue'
import MTileHead from '../MTileHead.vue'
import MTileShape from '../MTileShape.vue'
import { VIVI } from '../../about/mascot.js'
import { coverOk } from '../coverOk.js'
import { announcementHero } from '../../announcements/hero.js'
import { b3Texts, fill } from './b3Texts.js'
import { designProps } from './tileData.js'
import { isVersionLike, versionParts } from './versionParts.js'

const props = defineProps(designProps)
const emit = defineEmits(['act'])
const d = computed(() => props.card.data || {})
const id = computed(() => props.card.id)
const size = computed(() => props.card.size)
const L = computed(() => b3Texts(props.texts))
const act = (type, value) => { if (!props.preview) emit('act', { type, value }) }

// 错误
const sum = (l) => (l || []).reduce((a, b) => a + (Number(b) || 0), 0)
const total = computed(() => sum(d.value.series?.[0]?.values))
const totalW = computed(() => sum(d.value.series?.[1]?.values))
const lines = computed(() => ((id.value === 'logs' ? d.value.rows : d.value.lines) || []))
const shown = computed(() => lines.value.slice(0, { xl: 8, l: id.value === 'logs' ? 6 : 4 }[size.value] || 0))
// a line's level is its glyph, in the words of the settings (an unlabelled colour bar read as a chart)
const MARK = { err: 'error', warn: 'warning' }
// the line 中 shows: the newest error, else the newest warning
const latest = computed(() => lines.value.find((r) => r.tone === 'err') || lines.value[0] || null)
const levels = computed(() => { const e = lines.value.filter((r) => r.tone === 'err').length, w = lines.value.filter((r) => r.tone === 'warn').length; return [e && fill(L.value.levelErr, { n: e }), w && fill(L.value.levelWarn, { n: w })].filter(Boolean).join(' · ') })
// 公告
const posts = computed(() => d.value.items || [])
const lead = computed(() => posts.value.find((p) => coverOk(p.banner)) || posts.value[0] || null)
const banner = computed(() => (coverOk(lead.value?.banner) ? lead.value.banner : ''))
// a post without a banner gets a plate that says what the post is (the generated gradient was a placeholder that said nothing): the glyph of its kind in an expressive shape on a tonal
// plate. The shape and the colour (primary or tertiary) are chosen stably from its id (hero.js), the glyph from the post: the product's own free-software notice, a release, a guide, an announcement.
const KIND_ICON = { announce: 'campaign', update: 'new_releases', guide: 'menu_book' }
const PLATE_SHAPES = ['cookie', 'clover', 'sunny', 'burst']
const gen = computed(() => {
  if (banner.value || !lead.value) return null
  const g = announcementHero(lead.value.id || lead.value.title)
  return { icon: lead.value.builtin ? 'volunteer_activism' : KIND_ICON[lead.value.category] || 'campaign', shape: PLATE_SHAPES[Math.round(g.x1 / 10) % PLATE_SHAPES.length], tertiary: g.vivi }
})
const kindLabel = (k) => d.value.tabs?.find((t) => t.id === k)?.label || ''
const rest = computed(() => posts.value.filter((p) => p !== lead.value).slice(0, size.value === 'xl' ? 6 : 3))
const openPost = (p) => { if (p) act(p.hasText || !p.url ? 'news-open' : 'open-url', p.hasText || !p.url ? { id: p.id } : p.url) }
// 版本: the catalogue's row holds the state ({ tone: 'warn' } and the update when one is ready). The Panel's update is a label (「有可用更新」), another host's a version: only a version is written out, the
// state is ONE line either way. The version is split by level (versionParts.js): the date is the hero, the build number goes small after it, a suffix (「杂鱼」) is a line of its own.
const vp = computed(() => versionParts(d.value.big))
const heroChars = computed(() => (vp.value.main.length > 1 ? Math.max(vp.value.main[0].length, vp.value.main[1].length + 0.45 * vp.value.build.length) : Math.max(4, vp.value.main[0].length)))
const hasUpdate = computed(() => d.value.rows?.[0]?.tone === 'warn')
const updateVersion = computed(() => { const v = String(d.value.rows?.[0]?.value || '').replace(/^v/i, ''); return hasUpdate.value && isVersionLike(v) ? v : '' })
// the state is one short line: 「已最新」, or 「有新版本」 / the Panel's label for an update; the version of the update is on the page the tile opens (a version in the pill would take the room of the hero)
const stateText = computed(() => (!hasUpdate.value ? L.value.current : updateVersion.value ? fill(L.value.updateTo, { v: '' }).trim() : String(d.value.rows?.[0]?.title || '').trim() || fill(L.value.updateTo, { v: '' }).trim()))
const restLines = computed(() => Math.ceil(vp.value.rest.length / 18))
// 赞助
const targets = computed(() => d.value.targets || [])
// vivi
const hour = new Date().getHours()
const part = hour < 5 ? 'night' : hour < 11 ? 'morning' : hour < 18 ? 'day' : 'evening'
</script>

<template>
  <!-- 错误 -->
  <section v-if="id === 'errors'" class="m-tile m-cal m-b3e" :class="`is-${size}`" :data-size="size" :data-accent="total ? 'error' : totalW ? 'warn' : 'ok'">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><button type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="act('detail')"><MIcon name="chevron_right" /></button></header>
    <div class="m-b3e__body">
      <div class="m-b3e__count"><div class="m-calm__value"><b class="m-dnum">{{ total }}</b><small>{{ L.errorsUnit }}</small></div><small class="m-b3e__warn">{{ L.last24 }}<template v-if="totalW"> · {{ fill(L.warnings, { n: totalW }) }}</template></small></div>
      <p v-if="size === 'm' && latest" class="m-b3l__newest" :class="`is-${latest.tone}`"><MIcon :name="MARK[latest.tone] || 'info'" fill /><span>{{ latest.title }}</span><time class="m-dnum">{{ latest.sub }}</time></p>
      <p v-else-if="size === 'm'" class="m-b3e__clear"><MIcon name="check_circle" /><span>{{ L.noWarnings }}</span></p>
      <ol v-else-if="shown.length" class="m-b3e__lines" data-fit-rows="drop"><li v-for="(r, i) in shown" :key="i" :class="`is-${r.tone}`"><MIcon :name="MARK[r.tone] || 'info'" fill /><span>{{ r.title }}</span><time class="m-dnum">{{ r.sub }}</time></li></ol>
    </div>
  </section>

  <!-- 日志 -->
  <section v-else-if="id === 'logs' && (empty || !lines.length)" class="m-tile m-cal" data-accent="secondary">
    <MTileHead icon="description" :title="card.title" />
    <div class="m-empty-basic"><b>{{ empty?.value || d.empty || L.noLines }}</b><button v-if="empty?.action" type="button" class="m-b2__btn is-tonal" @click.stop="emit('act', empty.action)">{{ empty.action.label }}</button></div>
  </section>
  <section v-else-if="id === 'logs'" class="m-tile m-cal m-calm m-b3l" :class="`is-${size}`" :data-size="size" :data-accent="lines.some((r) => r.tone === 'err') ? 'error' : 'secondary'">
    <header class="m-calm__head"><MIcon :name="d.icon" /><span class="m-calm__title">{{ card.title }}</span><span v-if="size === 'l'" class="m-calm__peak m-dnum">{{ lines.length }}</span><button type="button" class="m-calm__more" :aria-label="texts.more || card.title" @click.stop="act('open', 'diagnostics')"><MIcon name="chevron_right" /></button></header>
    <div v-if="size !== 'l'" class="m-b3l__top" data-fit-rows>
      <div class="m-b3l__count"><div class="m-calm__value"><b class="m-dnum">{{ lines.length }}</b><small>{{ L.linesUnit }}</small></div><small v-if="size === 'm'" class="m-b3l__levels">{{ levels }}</small></div>
      <small v-if="size === 's' && levels" class="m-b3l__levels is-s">{{ levels }}</small>
      <p class="m-b3l__newest" :class="`is-${lines[0].tone}`"><MIcon :name="MARK[lines[0].tone] || 'info'" fill /><span>{{ lines[0].title }}</span><time class="m-dnum">{{ lines[0].sub }}</time></p>
    </div>
    <ol v-else class="m-b3e__lines m-b3l__list" data-fit-rows="drop"><li v-for="(r, i) in shown" :key="i" :class="`is-${r.tone}`"><MIcon :name="MARK[r.tone] || 'info'" fill /><span>{{ r.title }}</span><time class="m-dnum">{{ r.sub }}</time></li></ol>
  </section>

  <!-- 公告 -->
  <section v-else-if="id === 'announcements' && (empty || !lead)" class="m-tile m-cal" data-accent="primary">
    <MTileHead icon="campaign" :title="card.title" />
    <div class="m-empty-basic"><b>{{ empty?.value || d.empty }}</b><button v-if="empty?.action" type="button" class="m-b2__btn" @click.stop="emit('act', empty.action)">{{ empty.action.label }}</button></div>
  </section>
  <section v-else-if="id === 'announcements'" class="m-tile m-cal m-b3n" :class="[`is-${size}`, { 'has-banner': !!banner || !!gen }]" :data-size="size" data-accent="primary">
    <button type="button" class="m-b3n__lead" :aria-label="lead.title" @click="openPost(lead)">
      <img v-if="banner" class="m-b3n__pic" :src="banner" alt="" decoding="async">
      <span v-else-if="gen" class="m-b3n__pic m-b3n__gen m-b3n__plate" :class="{ 'is-tertiary': gen.tertiary }" aria-hidden="true"><MTileShape :icon="gen.icon" :shape="gen.shape" size="min(60cqmin, 132px)" tone="solid" /></span>
      <span class="m-b3n__text"><small>{{ kindLabel(lead.category) || card.title }}<template v-if="lead.date"> · {{ lead.date }}</template></small><b>{{ lead.title }}</b></span>
    </button>
    <ol v-if="(size === 'l' || size === 'xl') && rest.length" class="m-b3n__rest"><li v-for="p in rest" :key="p.id"><button type="button" @click="openPost(p)"><span>{{ p.title }}</span><time class="m-dnum">{{ p.date }}</time></button></li></ol>
  </section>

  <!-- 版本 -->
  <section v-else-if="id === 'update'" class="m-tile m-cal m-calm m-b3u" data-size="s" :data-accent="hasUpdate ? 'tertiary' : 'primary'" :class="{ 'm-tile--tonal': hasUpdate }" :style="{ '--chars': heroChars, '--rl': restLines }">
    <button type="button" class="m-b3-hit" :aria-label="`${card.title} ${vp.main.join('')}${vp.build} ${vp.rest} · ${stateText}`" @click="act('detail')" />
    <span class="m-calm__head"><MIcon :name="hasUpdate ? 'system_update_alt' : 'check_circle'" /><span class="m-calm__title">{{ card.title }}</span></span>
    <span class="m-b3u__hero m-dnum"><b v-if="vp.main.length > 1">{{ vp.main[0] }}</b><b>{{ vp.main[vp.main.length - 1] }}<small v-if="vp.build">{{ vp.build }}</small></b></span>
    <small v-if="vp.rest" class="m-b3u__rest">{{ vp.rest }}</small>
    <small class="m-b3u__state" :class="{ 'is-update': hasUpdate }">{{ stateText }}<MIcon v-if="hasUpdate" name="chevron_right" /></small>
  </section>

  <!-- 小贴士 -->
  <section v-else-if="id === 'tip'" class="m-tile m-cal m-calq m-b3s m-b3s--tip" data-size="strip" data-accent="tertiary">
    <span class="m-calq__title"><MIcon name="lightbulb" />{{ card.title }}</span>
    <p class="m-b3s__tip"><span>{{ d.text }}</span></p>
  </section>

  <!-- 赞助 -->
  <section v-else-if="id === 'sponsor'" class="m-tile m-cal m-calq m-b3s" data-size="strip" data-accent="tertiary">
    <span class="m-calq__title"><MIcon name="favorite" /><span>{{ d.texts?.title || card.title }}</span></span>
    <div class="m-b3s__row">
      <button v-for="t in targets" :key="t.id" type="button" @click="act('sponsor', t.id)"><i><MIcon name="favorite" /></i>{{ t.label }}</button>
      <button v-if="!targets.length" type="button" @click="act('sponsor', 'sponsor')"><i><MIcon name="favorite" /></i>{{ d.texts?.sponsor }}</button>
      <button type="button" @click="act('sponsor', 'star')"><i><MIcon name="star" /></i>{{ d.texts?.star }}</button>
    </div>
  </section>

  <!-- vivi -->
  <section v-else class="m-tile m-cal m-b3vi" :class="`is-${part}`" data-size="s" data-accent="secondary">
    <p class="m-b3vi__hi">{{ d.text }}</p>
    <img data-bleed class="m-b3vi__img" data-tile-art :src="VIVI.logo[192]" alt="" decoding="async">
  </section>
</template>
