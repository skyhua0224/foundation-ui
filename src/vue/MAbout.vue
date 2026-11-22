<script setup>
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import MPage from './MPage.vue'
import MSection from './MSection.vue'
import MGroup from './MGroup.vue'
import MItem from './MItem.vue'
import MIcon from './MIcon.vue'
import MChip from './MChip.vue'
import MIconButton from './MIconButton.vue'
import MSplitButton from './MSplitButton.vue'
import MSeg from './MSeg.vue'
import MButton from './MButton.vue'
import MSheet from './MSheet.vue'
import MDeveloper from './MDeveloper.vue'
import MSwitchItem from './MSwitchItem.vue'
import MPrivacyMore from './MPrivacyMore.vue'
import MCredits from './MCredits.vue'
import MPixelFriends from './MPixelFriends.vue'
import { errorTexts } from './errorTexts.js'
import { updateSourceTexts } from '../update/sourceTexts.js'
import { aboutTexts } from '../about/texts.js'
import { announcementTexts } from './announcementTexts.js'
import { useDeveloperMode } from './useDeveloperMode.js'
import { useCommunityLinks } from './useCommunityLinks.js'
import MGithubMark from './MGithubMark.vue'
import { starTargets } from './starCard.js'
import { BILIBILI, CONTRIBUTORS, CONTRIBUTORS_URL, CREDITS_TAPS, CREDITS_WINDOW_MS, FOUNDER, NOTICE_URL, PRODUCT, PROJECT_LINKS, TEAM, TEAM_SPONSORS, THANKS, VIVI_TAPS, buildDateOf, linkDetail, resolveLink, tapCounter, versionSubline, versionText, LONG_PRESS_MS, buildChannelLabel, buildRows, buildTimeLocal, normalizeBuild } from '../about/index.js'
import { avatarImage, avatarUrl } from '../about/avatars.js'
import { fillText } from './guideTexts.js'
import MMascot from './MMascot.vue'
import MProductHero from './MProductHero.vue'
import { VIVI } from '../about/mascot.js'
import { HERO } from '../about/hero.js'

// The about page of both products. The page shows and emits; the product owns the data and what happens:
//   version, channel ('stable' | 'prerelease' | ''), a build date when the version carries one,
//   build   the build identity the host recorded (about/build.js); when given, its channel and UTC build time replace the guesses from the version
//   update  { state: 'idle' | 'checking' | 'available' | 'latest' | 'error', version }  (the product runs the real check and opens MUpdateSheet)
//   sponsors [{ id, label, url, zh? }] the product's own constant; zh is used for Chinese locales
// Emits: check, open-update, open (url), copied.
const developer = useDeveloperMode()
const props = defineProps({
  version: { type: String, default: '' },
  channel: { type: String, default: '' },
  /** the host's build identity ({ commit, channel, buildTimeUtc, variant, package, ... }, about/build.js); null: an older host, the page guesses as before */
  build: { type: Object, default: null },
  update: { type: Object, default: () => ({ state: 'idle', version: '' }) },
  sponsors: { type: Array, default: () => [] },
  locale: { type: String, default: 'en' },
  texts: { type: Object, default: null },
  /** the top area: a = centred and calm (default), b = the banner art with one row under it, c = text on a card with the mascot standing on its edge */
  variant: { type: String, default: '' },
  /** fetch the announcements again (the developer entry changes their source) */
  onRefresh: { type: Function, default: null },
  /** usage statistics ('ask' | 'on' | 'off'); empty: the product has no such choice and the row is not shown */
  consent: { type: String, default: '' },
  /** the second note (how to support the project) is a link to the product's update-source setting: the product listens to `open-update-source` */
  supportLink: { type: Boolean, default: false },
  /** error reports ('on' | 'off'); empty: the product has no such choice and the row is not shown. A separate switch from the usage statistics */
  errors: { type: String, default: '' },
  /** what the product would send next, for the privacy rows: `() => Promise<{ events, envelope?, endpoint? }>`; empty: no such row */
  previewLoader: { type: Function, default: null },
  /** the channel updates come from, the person's choice ('stable' | 'prerelease'); empty: the product cannot change it here and the row is not shown */
  updateChannel: { type: String, default: '' },
})
const emit = defineEmits(['check', 'open-update', 'open', 'copied', 'developer-off', 'consent', 'errors', 'channel-change', 'open-update-source'])
const E = computed(() => errorTexts(props.locale))
const S = computed(() => updateSourceTexts(props.locale))
const devOpen = ref(false)
// seven quick taps on the 版本 row turn developer mode on (as on a phone); a few taps before it say how many are left. The same seventh tap
// opens 制作人员 (the credits), and seven quick taps open them again later; when the credits close, the pixel friends walk along the window's edge
const devText = computed(() => announcementTexts(props.locale).dev)
const devNote = ref('')
let devTimer = 0
const creditsTaps = tapCounter(CREDITS_TAPS, CREDITS_WINDOW_MS)
const creditsOpen = ref(false)
const friends = ref(false)
function tapVersion() {
  const was = developer.enabled.value
  const r = developer.tap()
  devNote.value = was ? devText.value.on : r.enabled ? devText.value.on : r.remaining <= 4 ? devText.value.taps.replace('{n}', r.remaining) : ''
  clearTimeout(devTimer); devTimer = setTimeout(() => { devNote.value = '' }, 2500)
  if (creditsTaps.tap(performance.now())) creditsOpen.value = true
}
watch(creditsOpen, (on, was) => { if (was && !on) friends.value = true })
// until the look is chosen, a person at the comparison can set `foundation.about.variant` (a | b | c) in the local storage
const pref = () => { try { return localStorage.getItem('foundation.about.variant') || '' } catch { return '' } }
const look = computed(() => ['a', 'b', 'c'].find((v) => v === (props.variant || pref())) || 'a')
const STAR_TARGETS = starTargets()
const T = computed(() => aboutTexts(props.locale, props.texts))
// the second line of the 版本 row: the version, then the channel and the build date (the stamp the version carries), when there are any
const versionLine = computed(() => versionSubline({ version: shownVersion.value || T.value.versionUnknown, channel: channelLabel.value, built: built.value && `${T.value.built} ${built.value}` }))
// a long press copies (the click that ends it is not a tap); the press must stay on the row
let pressTimer = 0
let pressed = false
function pressStart(event) {
  if (event.button > 0) return
  pressed = false
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => { pressed = true; copyVersion() }, LONG_PRESS_MS)
}
const pressEnd = () => clearTimeout(pressTimer)
function onVersionClick() {
  if (pressed) { pressed = false; return }
  tapVersion()
}
const identity = computed(() => normalizeBuild(props.build))
const built = computed(() => {
  const local = identity.value && buildTimeLocal(identity.value.buildTimeUtc)
  if (local) return local
  const b = buildDateOf(props.version)
  return b ? `${b.date} ${b.time}` : ''
})
// 构建详情: what the build recorded; the summary line is the short commit and the package
const buildList = computed(() => buildRows(props.build, T.value))
const buildSummary = computed(() => [identity.value?.commitShort, T.value.buildPackages?.[identity.value?.package]].filter(Boolean).join(' · '))
const channelOptions = computed(() => [{ value: 'stable', label: T.value.stable }, { value: 'prerelease', label: T.value.prerelease }])
const channelLabel = computed(() => (identity.value && buildChannelLabel(identity.value.channel, T.value)) || (props.channel === 'prerelease' ? T.value.prerelease : props.channel === 'stable' ? T.value.stable : ''))
const shownVersion = computed(() => String(props.version || '').replace(/^[vV](?=\d)/, ''))

const copied = ref('')
let copiedTimer = 0
async function flash(kind, text) {
  copied.value = kind
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = '' }, 1800)
  emit('copied', text)
}
async function copyVersion() {
  const text = versionText({ version: shownVersion.value, channel: channelLabel.value, buildDate: [built.value, identity.value?.commitShort].filter(Boolean).join(' ') })
  try { await navigator.clipboard.writeText(text); flash('version', text) } catch { /* the clipboard is not available here */ }
}
const commitCopied = computed(() => copied.value === 'commit')
async function copyCommit(commit) {
  try { await navigator.clipboard.writeText(commit); flash('commit', commit) } catch { /* the clipboard is not available here */ }
}
async function share() {
  const url = PRODUCT.repo
  try {
    if (navigator.share) { await navigator.share({ title: PRODUCT.name, text: T.value.shareText, url }); return }
    await navigator.clipboard.writeText(`${T.value.shareText} ${url}`)
    flash('share', url)
  } catch { /* the person closed the share sheet, or the clipboard is not available */ }
}

const updateLabel = computed(() => {
  const s = props.update?.state
  if (s === 'checking') return T.value.checking
  if (s === 'available') return props.update.version ? `${T.value.available} ${String(props.update.version).replace(/^[vV](?=\d)/, '')}` : T.value.available
  if (s === 'latest') return T.value.latest
  if (s === 'error') return T.value.failed
  return T.value.check
})
const onUpdate = () => {
  const s = props.update?.state
  if (s === 'checking') return
  emit(s === 'available' ? 'open-update' : 'check')
}

// two rows of faces (about 28), the rest behind a +N chip that opens them in place
const FACES = 28
const allFaces = ref(false)
const shownContributors = computed(() => (allFaces.value ? CONTRIBUTORS : CONTRIBUTORS.slice(0, FACES)))
// the QQ group and the documentation come from the community file when it is published (bundled README values until then, offline, or when it does not validate)
const community = useCommunityLinks({ locale: toRef(props, 'locale') })
const linkGroups = computed(() => [['docs', 'changelog'], ['github', 'issues', 'qq']].map((ids) => ids.map((id) => community.links.value.find((l) => l.id === id)).filter(Boolean)))
// 官网 and B 站: two cards under the top area, the doors to the project outside GitHub. The site follows the interface language (.cn for Chinese) and the community file; the channel is one address.
const brandCards = computed(() => {
  const site = community.links.value.find((l) => l.id === 'site')
  return [
    ...(site ? [{ id: 'site', icon: site.icon, title: T.value.site, detail: linkDetail(site, props.locale), url: resolveLink(site, props.locale) }] : []),
    { id: 'bilibili', icon: BILIBILI.icon, title: T.value.bilibili, detail: BILIBILI.host, url: BILIBILI.url },
  ]
})
const linkText = (id) => T.value[id === 'license' ? 'license' : id] || id
const open = (url) => emit('open', url)
// 薇薇's bubble: one short line from the list, never the same one twice in a row, gone after a few seconds
const bubble = ref('')
let bubbleTimer = 0
let lastLine = -1
// six quick taps on her: a little hop, one line of her own, and the pixel friends walk in
const viviTaps = tapCounter(VIVI_TAPS)
const viviHop = ref(false)
let hopTimer = 0
function sayVivi() {
  if (viviTaps.tap(performance.now())) {
    friends.value = true
    viviHop.value = false
    requestAnimationFrame(() => { viviHop.value = true })
    clearTimeout(hopTimer); hopTimer = setTimeout(() => { viviHop.value = false }, 900)
    bubble.value = T.value.viviFound
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => { bubble.value = '' }, 3600)
    return
  }
  const lines = T.value.viviLines || []
  if (!lines.length) return
  let i = Math.floor(Math.random() * lines.length)
  if (lines.length > 1 && i === lastLine) i = (i + 1) % lines.length
  lastLine = i
  bubble.value = lines[i]
  clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => { bubble.value = '' }, 3200)
}
onBeforeUnmount(() => { clearTimeout(devTimer); clearTimeout(copiedTimer); clearTimeout(bubbleTimer); clearTimeout(hopTimer); clearTimeout(pressTimer) })
// the team: everyone equal and in the team's choice; the founder alone carries a tag. Each card: the profile, a follow link and the member's sponsor page
const team = computed(() => TEAM.map((p) => ({ ...p, founder: p.login === FOUNDER, sponsor: TEAM_SPONSORS[p.login] || '' })))
</script>

<template>
  <MPage :title="T.title" class="m-about" :class="{ 'm-about--friends': friends }" :updated="update.checkedAt || 0" :refreshing="update.state === 'checking'" refreshable :locale="locale" @refresh="emit('check')">
    <!-- the top area: one component, three looks (`variant`) -->
    <MProductHero v-if="look === 'a'" :slogan="T.slogan">
      <MSplitButton v-if="updateChannel" :variant="update.state === 'available' ? 'filled' : 'tonal'" :icon="update.state === 'available' ? 'system_update_alt' : update.state === 'latest' ? 'check_circle' : 'refresh'" :busy="update.state === 'checking'" :label="updateLabel" :menu-label="T.updateChannel" :items="channelOptions.map((o) => ({ id: o.value, label: o.label, selected: o.value === updateChannel }))" @click="onUpdate" @select="(item) => emit('channel-change', item.id)" />
      <MButton v-else :variant="update.state === 'available' ? 'filled' : 'tonal'" :icon="update.state === 'available' ? 'system_update_alt' : update.state === 'latest' ? 'check_circle' : 'refresh'" :loading="update.state === 'checking'" @click="onUpdate">{{ updateLabel }}</MButton>
    </MProductHero>
    <section v-else class="m-about__top" :class="`m-about__top--${look}`" aria-label="Foundation Sunshine">
      <picture v-if="look === 'b'" class="m-about__banner">
        <img class="m-about__banner-light" :src="HERO.light" alt="Foundation Sunshine" width="2172" height="336" decoding="async" />
        <img class="m-about__banner-dark" :src="HERO.dark" alt="Foundation Sunshine" width="2171" height="724" decoding="async" />
      </picture>
      <div class="m-about__id">
        <template v-if="look !== 'b'">
          <h2 class="m-about__name">{{ PRODUCT.name }}</h2>
          <p class="m-about__slogan">{{ T.slogan }}</p>
        </template>
        <div class="m-about__actions">
          <MSplitButton v-if="updateChannel" :variant="update.state === 'available' ? 'filled' : 'tonal'" :icon="update.state === 'available' ? 'system_update_alt' : update.state === 'latest' ? 'check_circle' : 'refresh'" :busy="update.state === 'checking'" :label="updateLabel" :menu-label="T.updateChannel" :items="channelOptions.map((o) => ({ id: o.value, label: o.label, selected: o.value === updateChannel }))" @click="onUpdate" @select="(item) => emit('channel-change', item.id)" />
          <MButton v-else :variant="update.state === 'available' ? 'filled' : 'tonal'" :icon="update.state === 'available' ? 'system_update_alt' : update.state === 'latest' ? 'check_circle' : 'refresh'" :loading="update.state === 'checking'" @click="onUpdate">{{ updateLabel }}</MButton>
        </div>
      </div>
      <MMascot v-if="look === 'c'" class="m-about__mascot m-about__mascot--stand" :size="220" />
    </section>

    <section class="m-about__brand" :aria-label="T.projectTitle">
      <button v-for="b in brandCards" :key="b.id" type="button" class="m-about__brandcard" :class="`is-${b.id}`" :data-brand="b.id" @click="open(b.url)">
        <span class="m-about__brandico"><MIcon :name="b.icon" fill /></span>
        <span class="m-about__brandtext"><strong>{{ b.title }}</strong><small>{{ b.detail }}</small></span>
        <MIcon class="m-about__brandgo" name="open_in_new" />
      </button>
    </section>

    <!-- 版本, as the About of a phone shows it: one row, the version and its second line (channel and the build date the version carries; a row of
         its own for either would only repeat the version). Under it, in the same list, 更新通道 when the product lets the person choose it here. Seven quick taps on the row turn developer mode on and open 制作人员; a long press or the
         button at the end copies the version. The row is a list item of two buttons side by side (never a button inside a button). -->
    <MSection class="m-about__versionsection">
      <MGroup>
        <div class="m-item m-about__verrow" role="listitem">
          <button type="button" class="m-about__vertap" :aria-describedby="devNote ? 'm-about-devnote' : undefined" @click="onVersionClick" @pointerdown="pressStart" @pointerup="pressEnd" @pointerleave="pressEnd" @pointercancel="pressEnd" @contextmenu.prevent>
            <span class="m-item__lead"><MIcon name="info" /></span>
            <span class="m-item__body">
              <span class="m-item__title">{{ T.version }}</span>
              <span class="m-item__text m-about__version">{{ versionLine }}</span>
            </span>
          </button>
          <MIconButton class="m-about__vercopy" :icon="copied === 'version' ? 'check_circle' : 'content_copy'" :label="copied === 'version' ? T.copied : T.copy" @click="copyVersion" />
        </div>
        <!-- 构建详情 under 版本, in the same list: what the build recorded (commit, channel, build time, branch, variant, package, builder). Closed by
             default; the commit is copied whole. An older host without the identity has no such row. -->
        <details v-if="buildList.length" class="m-item m-about__build" role="listitem">
          <summary class="m-about__buildsum"><span class="m-item__lead"><MIcon name="build" /></span><span class="m-item__body"><span class="m-item__title">{{ T.buildDetails }}</span><span class="m-item__text">{{ buildSummary }}</span></span></summary>
          <dl class="m-about__buildlist">
            <template v-for="row in buildList" :key="row.id"><dt>{{ row.label }}</dt><dd :data-build="row.id"><span class="m-about__buildval">{{ row.value }}</span><MIconButton v-if="row.copy" :icon="commitCopied ? 'check_circle' : 'content_copy'" :label="commitCopied ? T.copied : T.copyCommit" @click="copyCommit(row.copy)" /></dd></template>
          </dl>
        </details>
        <!-- 更新通道 under 版本, in the same list: the product's own channel switch (the same handler as its update sheet and settings) -->
        <MItem v-if="updateChannel" class="m-about__channel" icon="science" :title="T.updateChannel" :text="T.channelNote">
          <template #trail><MSeg size="sm" :label="T.updateChannel" :model-value="updateChannel" :options="channelOptions" @update:model-value="(value) => emit('channel-change', value)" /></template>
        </MItem>
      </MGroup>
      <p v-if="devNote" id="m-about-devnote" class="m-about__devnote" role="status">{{ devNote }}</p>
    </MSection>

    <!-- the developer entry exists only while developer mode is on (seven taps on the version above); the way to turn it off is inside -->
    <MSection v-if="developer.enabled.value" :title="devText.title">
      <MGroup><MItem action icon="bug_report" :title="devText.title" :text="devText.entry" @click="devOpen = true" /></MGroup>
    </MSection>
    <MSheet v-model="creditsOpen" :title="T.credits" side="center" :close-label="T.dismiss" class="m-credits-sheet">
      <MCredits :locale="locale" :texts="T" :active="creditsOpen" @open="open" />
    </MSheet>
    <MSheet v-model="devOpen" :title="devText.title" side="end" :close-label="T.dismiss">
      <MDeveloper :locale="locale" :on-refresh="onRefresh" @disabled="devOpen = false; emit('developer-off')"><slot name="developer" /></MDeveloper>
    </MSheet>

    <!-- the product's help entries (开始体检) -->
    <slot name="help" />

    <MSection :title="T.projectTitle">
      <!-- one segmented list per kind: the site, then the repository; the licence is listed once, under the open-source thanks -->
      <MGroup v-for="(group, gi) in linkGroups" :key="gi" class="m-about__linkgroup">
        <MItem v-for="link in group" :key="link.id" action :icon="link.icon" :title="linkText(link.id)" :text="linkDetail(link, locale)" @click="open(resolveLink(link, locale))"><template #trail><MIcon name="open_in_new" /></template></MItem>
      </MGroup>
    </MSection>

    <MSection :title="T.developers">
      <ul class="m-about__team">
        <li v-for="person in team" :key="person.id" class="m-about__member">
          <button type="button" class="m-about__person" :aria-label="person.founder ? `${person.login}, ${T.founder}` : person.login" @click="open(person.url)">
            <img class="m-about__portrait" :src="avatarImage(person.avatar).src" :srcset="avatarImage(person.avatar).srcset || undefined" sizes="88px" alt="" width="88" height="88" loading="lazy" />
            <span class="m-about__person-name">{{ person.login }}</span>
            <span v-if="person.founder" class="m-about__tag">{{ T.founder }}</span>
          </button>
          <div class="m-about__person-actions">
            <MButton variant="tonal" size="sm" :aria-label="`${T.follow} · ${person.login}`" @click="open(person.url)"><MGithubMark :size="16" />{{ T.follow }}</MButton>
            <MButton v-if="person.sponsor" variant="text" size="sm" icon="favorite" :aria-label="`${T.sponsorAfdian} · ${person.login}`" @click="open(person.sponsor)">{{ T.sponsor }}</MButton>
          </div>
        </li>
      </ul>
    </MSection>

    <MSection :title="T.contributors">
      <MGroup>
        <MItem :title="fillText(T.contributorsLine, { n: CONTRIBUTORS.length })" plain stack>
          <template #control>
            <ul class="m-about__grid">
              <li v-for="person in shownContributors" :key="person.id"><button type="button" class="m-about__face" :title="person.login" :aria-label="person.login" @click="open(person.url)"><img :src="avatarUrl(person.avatar)" alt="" width="40" height="40" loading="lazy" decoding="async" /></button></li>
              <li v-if="CONTRIBUTORS.length > FACES"><button type="button" class="m-about__more" :aria-expanded="allFaces" @click="allFaces = !allFaces">{{ allFaces ? T.less : `+${CONTRIBUTORS.length - FACES}` }}</button></li>
            </ul>
          </template>
        </MItem>
        <MItem action icon="history" :title="T.contributorsAll" @click="open(CONTRIBUTORS_URL)"><template #trail><MIcon name="open_in_new" /></template></MItem>
      </MGroup>
    </MSection>

    <MSection :title="T.thanks">
      <MGroup>
        <MItem v-for="item in THANKS" :key="item.id" action :icon="item.icon" :title="item.name" :text="item.id === 'sunshine' ? T.thanksUpstream : ''" @click="open(item.url)"><template #trail><MIcon name="open_in_new" /></template></MItem>
        <MItem action icon="balance" :title="T.gpl" @click="open(PROJECT_LINKS.find((l) => l.id === 'license').url)"><template #trail><MIcon name="open_in_new" /></template></MItem>
        <MItem action icon="volunteer_activism" :title="T.freeTitle" :text="T.freeText" @click="open(PRODUCT.repo)"><template #trail><MIcon name="open_in_new" /></template></MItem>
        <MItem action icon="inventory_2" :title="T.thirdParty" @click="open(NOTICE_URL)"><template #trail><MIcon name="open_in_new" /></template></MItem>
      </MGroup>
    </MSection>

    <!-- the plain notes of the first screen, again: the program is free, and how to support it (the product may link the second line to its update-source setting) -->
    <div class="m-about__notes" data-about-notes>
      <p data-note="free">{{ S.freeNotice }}</p>
      <p data-note="support"><button v-if="supportLink" type="button" class="m-about__notelink" data-note-link @click="emit('open-update-source')">{{ S.supportLine }}</button><template v-else>{{ S.supportLine }}</template></p>
    </div>

    <MSection v-if="consent || errors" :title="E.consentSection">
      <MGroup>
        <MSwitchItem v-if="errors" :model-value="errors === 'on'" icon="bug_report" :title="E.errorsRow" :text="E.errorsRowText" data-privacy="errors" @update:model-value="(v) => emit('errors', v ? 'on' : 'off')" />
        <MSwitchItem v-if="consent" :model-value="consent === 'on'" icon="query_stats" :title="E.usageRow" :text="E.usageRowText" data-privacy="usage" @update:model-value="(v) => emit('consent', v ? 'on' : 'off')" />
      </MGroup>
      <MPrivacyMore :errors="errors" :consent="consent" :locale="locale" :preview-loader="previewLoader" />
    </MSection>

    <MSection :title="T.supportTitle">
      <MGroup>
        <MItem v-for="s in sponsors" :key="s.id" action icon="favorite" :title="`${T.sponsor} · ${s.label}`" @click="open(resolveLink(s, locale))"><template #trail><MIcon name="open_in_new" /></template></MItem>
        <MItem v-for="t in STAR_TARGETS" :key="t.url" action :title="`${T.star} · ${t.name}`" :text="t.repo" @click="open(t.url)"><template #lead><MGithubMark :size="22" /></template><template #trail><MIcon name="open_in_new" /></template></MItem>
        <MItem action :icon="copied === 'share' ? 'check_circle' : 'share'" :title="copied === 'share' ? T.shareCopied : T.share" @click="share" />
      </MGroup>
    </MSection>

    <!-- the easter egg: 薇薇 centred at the end of the page with her slogan under her; a click gives a speech bubble with one of a few short lines,
         six quick clicks bring the pixel friends -->
    <div class="m-about__end">
      <div class="m-about__bubblebox"><Transition name="m-about-bubble"><p v-if="bubble" :key="bubble" class="m-about__bubble" role="status">{{ bubble }}</p></Transition></div>
      <button type="button" class="m-about__vivi" :class="{ 'is-hop': viviHop }" :aria-label="T.viviLabel" @click="sayVivi"><img class="m-about__figure" :src="VIVI.bg" alt="" width="132" height="198" loading="lazy" decoding="async" /></button>
      <p class="m-about__vivislogan">{{ T.viviSlogan }}</p>
    </div>
    <MPixelFriends v-if="friends" :locale="locale" :texts="T" @open="open" />
  </MPage>
</template>
