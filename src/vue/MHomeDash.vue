<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MDashCardView from './MDashCardView.vue'
import MDockClock from './MDockClock.vue'
import MDashSections from './MDashSections.vue'
import MDashSkeleton from './MDashSkeleton.vue'
import MSheet from './MSheet.vue'
import MTileGallery from './MTileGallery.vue'
import MIcon from './MIcon.vue'
import MStarPrompt from './MStarPrompt.vue'
import MClientPrompt from './MClientPrompt.vue'
import { STAR_HOST } from './starCard.js'
import { UNIT_GAP, effectiveSize, windowClassOf } from './homeSizes.js'
import { badgeSpot } from './homeBadge.js'
import MStackSheet from './MStackSheet.vue'
import { EDIT_TEXTS } from './homeEditTexts.js'
import { useDashPlan } from './dash/dashPlan.js'
import { useDashStacks } from './dash/dashStacks.js'
import { useDashGrid } from './dash/dashGrid.js'
import { useDashStackEdit } from './dash/dashStackEdit.js'
import { useDashDock } from './dash/dashDock.js'
import { useDashEditSheet } from './dash/dashEditSheet.js'
import { useDashDrag } from './dash/dashDrag.js'
import { useDashContext } from './dash/dashContext.js'
import { useDashSkeleton } from './dash/dashSkeletonUse.js'
import { useFitText } from './fitText.js'
import { useFitRows } from './fitRows.js'

// the parts of the setup (src/vue/dash/) share one scope, D, and are made in order after this core
const D = {}
/**
 * The home of both products: a catalogue of cards in a grid of eight units. Any card may go anywhere; the packer keeps the rows full.
 * Edit mode (pencil): the whole card is the drag target (it lifts and springs into its slot, the slot shows a live placeholder), a small
 * neutral minus badge at its top-left corner removes it. A tap or a long press selects a card: only the selected card shows its resize affordance, corner
 * handles that snap to small, medium and large as they are dragged (the page reflows live) and a small size selector in the middle of the card. A floating sheet at the bottom holds the cards that are not on the page, as live previews under group
 * chips: drag one onto the page (a placeholder shows where it lands) or click it to add it; dragging a card back onto the sheet removes it.
 * Keyboard: Space picks a card up, the arrows move it, + and - resize it, Space drops it, Esc cancels. The arrangement is kept locally.
 * `cards` come from buildCards(); the product reacts to the single `action` event ({ card, type, value }).
 */
const edit = defineModel('edit', { type: Boolean, default: false })
const props = defineProps({
  cards: { type: Array, required: true },
  details: { type: Object, default: () => ({}) },
  ctx: { type: Object, default: () => ({ live: false, isNew: false }) },
  storageKey: { type: String, default: 'home' },
  texts: { type: Object, default: () => ({}) },
  /** the host's configuration (the pinned setting tiles show and write its keys) and the language of the tiles the person pinned */
  config: { type: Object, default: null },
  locale: { type: String, default: 'en' },
})
const emit = defineEmits(['action'])
// ctx.pending: the product does not know yet what decides the page (the session, the clients): the skeleton stands and the card at the top is not drawn, so nothing is drawn idle and redrawn
const pending = computed(() => !!props.ctx.pending)
// a card that is there in the first drawn frame (the skeleton kept its place) does not open from nothing; one that comes later does (promptSlot.js). "The first drawn frame" is the frame the release is
// drawn in: the card's enter hook runs in the same task as the release, before the next paint. A time limit would not do: a machine that takes longer to build the tiles than the limit would open the card
// under tiles that were fitted for it closed.
let firstDraw = false
watch(pending, (p) => { if (p) return; firstDraw = true; const end = () => { firstDraw = false }; typeof requestAnimationFrame === 'function' ? requestAnimationFrame(end) : setTimeout(end, 0) }, { flush: 'pre' })
const onSlotEnter = (el, done) => (firstDraw ? done() : slotIn(el, done))
const T = computed(() => ({ ...EDIT_TEXTS.en, addCard: 'Add card', catalogueAll: 'All cards', all: 'All', ...props.texts }))
const root = ref(null)
useFitRows(root) // a list or a row of chips shows the entries that fit whole and takes the rest out (fitRows.js)
useFitText(root) // a value wider than its tile shrinks to fit, then wraps; it is not cut (fitText.js)
const grid = ref(null)
const width = ref(1200)
// the delete badge cuts a quarter of its disc into the tile's corner (homeBadge.js): its place follows the tile's corner radius (--m-dash-radius) and the badge's radius, worked out numerically
const BADGE_R = 14
const tileRadius = ref(28)
const badge = computed(() => badgeSpot(tileRadius.value, BADGE_R))
const tall = ref(typeof window !== 'undefined' ? window.innerHeight : 900)
const wide = ref(typeof window !== 'undefined' ? window.innerWidth : 1440)
// the window's class (Material 3), read from the window's width: the size a tile is drawn at is its preference clamped to the class (homeSizes.js effectiveSize), nothing else decides it
const windowClass = computed(() => windowClassOf(wide.value))
D.ro = null

Object.assign(D, { T, edit, emit, grid, props, root, tall, tileRadius, wide, width, windowClass })
useDashPlan(D)
useDashStacks(D)
useDashGrid(D)
useDashStackEdit(D)
useDashDock(D)
useDashEditSheet(D)
useDashDrag(D)
useDashContext(D)
useDashSkeleton(D)
// Touch: the selected tile's actions (size, join a stack, remove) are a bar at the bottom of the window, in the place of the add button, with targets a finger can hit (edit-phone.css). It sits above the
// app's bottom bar where the window has one.
const fabBottom = ref(0)
const measureBar = () => { const bar = document.querySelector('.m-rail--bar:not(.m-rail--side)'); const r = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect() : null; fabBottom.value = r && r.height ? Math.max(0, Math.round(window.innerHeight - r.top + 16)) : 0 }
const fabStyle = computed(() => (fabBottom.value ? { bottom: `${fabBottom.value}px` } : undefined))
onMounted(() => window.addEventListener('resize', measureBar))
onBeforeUnmount(() => window.removeEventListener('resize', measureBar))
watch(edit, (on) => { if (on) nextTick(measureBar) }, { immediate: true, flush: 'post' })
// The snackbar that says 加了 rests above the page's own bottom controls, wherever they stand: the add button, or the bar of the selected tile. On a phone they stand above the app's bottom bar, higher than the
// fixed 92 px the snackbar used to take, so the snackbar covered the add button (and a tap on it) for the whole time it was there, after every add.
const clearOfBottom = () => {
  const tops = [...document.querySelectorAll('.m-dedit__fab, .m-dedit__selbar')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => r.top)
  if (tops.length) document.body.style.setProperty('--m-dedit-clear', `${Math.max(0, Math.round(window.innerHeight - Math.min(...tops)))}px`); else document.body.style.removeProperty('--m-dedit-clear')
}
onMounted(() => window.addEventListener('resize', clearOfBottom))
onBeforeUnmount(() => { window.removeEventListener('resize', clearOfBottom); document.body.style.removeProperty('--m-dedit-clear') })
const { resizing, mode, units, compact, xl, layout, allCards, appearance, smart, onHover, stacksOn, stacks, dockLayout, onStackRotate, onStackSuggest, onStackHover, onStackFlags, setStackRotate, stackSheetId, stackSheetOpen, stackSheetStack, openStackSheet, joinFor, joinTargetsOf, joinIcon, joinMe, joinTargets, joinOpen, joinTitle, joinInto, sheetReorder, sheetRemove, sheetAdd, sheetOut, ghostIconOf, sectioned, sectionCount, dockOn, clockLocale, clockSizeDrawn, dateText, statusText, dockCards,  setOverview, starClient, clientRec, recOpen, recLater, starOpen, starLater, dockGridStyle, dockHeadMin, blocks, slack, placedOf, cellStyle, blockStyle, whyRows, whyOpen, restoreSmart, acceptGhost, hideGhost, addable, detailId, detail, onAct, group, sheetEl, query, pickerOpen, compChoice, sheetSize, GALLERY_FIT, galleryEntries, galleryGroups, galleryVariants, sheetAway, landing, addFromGallery, live, say, addCard, setCardSize, removeCard, drag, sel, settling, dragVars, down, inside, sizing, handleDown, galleryPick, picked, key, slotIn, slotOut, starSponsor, starStreaming, skeleton, skeletonSlack, skeletonTop } = D
const selCard = computed(() => (sel.value ? blocks.value.flatMap((b) => b.boxed).find((c) => c.id === sel.value && !c.ghost) : null))
watch([edit, sel, pickerOpen, fabBottom], () => nextTick(clearOfBottom), { flush: 'post' })
</script>

<template>
  <div ref="root" class="m-dash" :class="[`m-dash--${mode}`, { 'm-dash--compact': compact, 'm-dash--xl': xl, 'is-edit': edit, 'is-sectioned': sectioned, 'is-resizing': resizing }]" :style="{ '--u': units, '--m-badge-c': `${badge.c}px`, '--m-badge-r': `${BADGE_R}px` }" @pointerenter="onHover(true)" @pointerleave="onHover(false)">
    <!-- the card at the top: the recommendation of a client when it is due for the device in use, else the star card; it opens and closes in height so what is under it does not jump -->
    <Transition :css="false" mode="out-in" @enter="onSlotEnter" @leave="slotOut">
      <MClientPrompt v-if="clientRec && !edit && !pending" key="client" :texts="{ title: T.crTitle, line: T.crLine, lineAny: T.crLineAny, download: T.crDownload, later: T.crLater }" :rec="clientRec" @open="recOpen" @later="recLater" />
      <MStarPrompt v-else-if="ctx.star && !edit && !pending" key="star" :texts="{ title: T.starTitle, sub: T.starSub, action: T.starPromptAction, later: T.starLater, sponsor: T.sponsorAction, bilibili: T.starBilibili }" :host="STAR_HOST" :client="starClient" :streaming="starStreaming" @open="starOpen" @later="starLater" @sponsor="starSponsor" />
    </Transition>
    <!-- the smart arrangement is the default and has no label; only a manual one says so, with the way back -->
    <div v-if="dockOn" class="m-dock">
      <header class="m-dock__head" :data-align="appearance.state.clockAlign" :style="dockHeadMin ? { minHeight: `${dockHeadMin}px` } : undefined">
        <MDockClock class="m-dock__time" :face="appearance.state.clockFace" :size="clockSizeDrawn" :locale="clockLocale" />
        <p class="m-dock__date">{{ dateText }}</p>
        <p class="m-dock__status">{{ statusText }}</p>
      </header>
      <div class="m-dock__grid" :style="dockGridStyle" role="list">
        <div v-for="c in dockCards" :key="c.id" class="m-dock__cell" role="listitem" :data-group="c.group" :data-card="c.id" :data-ctx="`tile:${c.id}`" :data-size="c.size"><div class="m-dash__body"><MDashCardView :card="c" :details="details" :texts="T" @act="onAct" /></div></div>
      </div>
    </div>
    <div v-if="skeleton && skeletonTop" class="m-dskel__top" :style="{ height: `${skeletonTop}px` }" aria-hidden="true" />
    <MDashSkeleton v-if="skeleton" :blocks="skeleton" :style="skeletonSlack > 40 ? { marginTop: `${Math.round(skeletonSlack / 2)}px` } : undefined" />
    <div v-if="!dockOn && !skeleton" class="m-dash__blocks" :style="slack > 40 ? { marginTop: `${Math.round(slack / 2)}px` } : undefined">
    <section v-for="b in blocks" :key="b.key" class="m-dash__block" :data-natural="b.natural" :style="blockStyle(b)">
    <h2 v-if="sectioned" class="m-dash__sec">{{ b.title }}</h2>
    <div class="m-dash__grid" :style="{ '--m-dash-gap': `${UNIT_GAP}px`, gridTemplateColumns: `repeat(${b.units}, minmax(0, 1fr))`, gridTemplateRows: b.template }">
      <div
        v-for="c in b.boxed" :key="c.id" :ref="(el) => { if (el && !grid) grid = el.parentElement }" class="m-dash__cell" :data-group="c.group" :data-ctx="`tile:${c.id}`"
        :data-section="b.section"
        :data-merge-label="drag?.merge === c.id ? (T.stackMergeLabel || '合并为轮换组') : undefined" :class="{ 'is-merge-target': drag?.merge === c.id, 'is-merging': drag?.id === c.id && !!drag?.mergeCand, 'is-landing': landing === c.id, 'is-ghost': c.ghost, 'is-dragging': drag?.id === c.id, 'is-over-sheet': drag?.id === c.id && drag.over, 'is-picked': picked === c.id, 'is-settling': settling === c.id, 'is-selected': sel === c.id, 'is-sizing': sizing === c.id }" :data-card="c.id" :data-size="c.size" :style="[cellStyle(b, c.id), dragVars(c.id)]"
        :tabindex="edit ? 0 : undefined" :role="edit ? 'button' : undefined" :aria-label="edit ? `${T.drag}: ${c.title}` : undefined" :aria-pressed="edit ? picked === c.id : undefined"
        @pointerdown="down($event, c.id)" @keydown="key($event, c.id)"
      >
        <i v-if="edit" class="m-dash__ph" aria-hidden="true" />
        <div v-if="!c.ghost" class="m-dash__body" :inert="edit || undefined"><MDashCardView :card="c" :details="details" :texts="T" :preview="edit || c.ghost" @act="onAct" @rotate="onStackRotate" @hover="onStackHover" @suggest="onStackSuggest" @flags="onStackFlags" @say="say" /></div>
        <div v-if="c.ghost" class="m-dash__ghost" :class="{ 'is-strip': c.cls === 'strip' }"><span class="m-dash__suggest">{{ T.suggestBadge }}</span><span v-if="c.cls !== 'strip'" class="m-dash__gmid"><span class="m-dash__gicon" aria-hidden="true"><MIcon :name="ghostIconOf(c)" /></span><b class="m-dash__gtitle">{{ c.title }}</b></span>
          <span class="m-dash__gbtns"><button type="button" class="m-dpill m-dpill--fill" @click.stop="acceptGhost(c.id)"><MIcon name="add" />{{ T.suggestAdd }}</button>
          <button type="button" class="m-dash__ghostx" :aria-label="T.suggestHide" :data-tip="T.suggestHide" @click.stop="hideGhost(c.id)"><MIcon name="close" /></button></span></div>
        <!-- the delete badge sits in a layer that is moved, scaled and lifted exactly like the card's body, so it keeps its quarter inside the corner of the card while the card is dragged -->
        <button v-if="edit && c.kind === 'stack'" type="button" class="m-dash__stackbtn" data-stack-edit @pointerdown.stop @click.stop="openStackSheet(c.id)">{{ T.stackEdit || '编辑轮换组' }}</button>
        <div v-if="edit" class="m-dash__badge"><button type="button" class="m-dash__remove" :aria-label="`${T.hide}: ${c.title}`" :data-tip="T.hide" @pointerdown.stop @click.stop="removeCard(c.id)"><MIcon name="remove" /></button></div>
        <template v-if="edit && sel === c.id && !drag?.moved && (c.sizeKeys.length > 1 || (stacksOn && c.kind !== 'stack' && !c.ghost && joinTargetsOf(c).length))">
          <i v-if="c.sizeKeys.length > 1" class="m-dash__ring" aria-hidden="true" />
          <span class="m-dash__sizes" :class="{ 'is-below': (placedOf(c.id)?.row || 0) === 0 }" @pointerdown.stop><span v-if="c.sizeKeys.length > 1" class="m-dash__sizeset" role="radiogroup" :aria-label="`${T.size}: ${c.title}`"><button v-for="k in c.sizeKeys" :key="k" type="button" role="radio" :aria-checked="c.size === k" :aria-label="T['sizeName' + k.toUpperCase()]" :class="{ 'is-on': c.sizeKey === k }" @click.stop="setCardSize(c.id, k)">{{ T['size' + k.toUpperCase()] }}</button></span><button v-if="stacksOn && c.kind !== 'stack' && !c.ghost && joinTargetsOf(c).length" type="button" class="m-dash__sizes-join" :class="{ 'is-alone': c.sizeKeys.length <= 1 }" data-stack-join :aria-label="T.stackJoin || '加入轮换组'" @click.stop="joinFor = c.id"><MIcon name="library_add" /><b>{{ T.stackJoin || '加入轮换组' }}</b></button></span>
          <i v-for="k in (c.sizeKeys.length > 1 ? ['tr', 'bl', 'br'] : [])" :key="k" class="m-dash__handle" :class="`m-dash__handle--${k}`" aria-hidden="true" @pointerdown.stop.prevent="handleDown($event, c, k)" />
        </template>
      </div>
    </div>
    </section>
    </div>
    <div v-if="edit && sectioned" class="m-dash__secbar">
      <button type="button" class="m-dpill" :disabled="sectionCount >= 6" @click="layout.setSectionCount(sectionCount + 1)"><MIcon name="add" />{{ T.addSection }}</button>
      <button type="button" class="m-dpill" :disabled="sectionCount <= 1" @click="layout.setSectionCount(sectionCount - 1)"><MIcon name="remove" />{{ T.removeSection }}</button>
    </div>
    <MSheet v-if="stacksOn" v-model="joinOpen" :title="(T.stackJoinTitle || '{name}').replace('{name}', joinMe?.title || '')" side="end" :close-label="T.close">
      <ul class="m-stacksheet__pick m-joinlist">
        <li v-for="t in joinTargets" :key="t.id" :data-join="t.id"><button type="button" @click="joinInto(t)"><span>{{ joinTitle(t) }}</span><MIcon :name="joinIcon(t)" /></button></li>
        <li v-if="!joinTargets.length" class="m-joinlist__none">{{ T.stackJoinNone || '' }}</li>
      </ul>
    </MSheet>
    <MStackSheet v-if="stacksOn" v-model="stackSheetOpen" :stack="stackSheetStack" :cards="allCards" :window-class="windowClass" :height="tall" :texts="T"
      @reorder="sheetReorder" @remove="sheetRemove" @add="sheetAdd" @flags="(p) => stacks.setFlags(stackSheetId, p)" @dissolve="() => { stacks.dissolve(stackSheetId); stackSheetId = '' }" @out="sheetOut" />
    <MSheet v-model="whyOpen" :title="T.whyTitle" side="center" :close-label="T.close">
      <p class="m-dash__whyintro">{{ T.whyIntro }}</p>
      <ul class="m-dash__why"><li v-for="r in whyRows" :key="r.id"><MIcon :name="r.icon" /><span><b>{{ r.title }}</b><small>{{ r.reason }}</small></span></li></ul>
    </MSheet>
    <p class="m-dash__live" role="status" aria-live="polite">{{ live }}</p>

    <!-- edit: the picker opens from the add button; the previews are the cards at their real size, grouped under their category; the size is chosen on the preview -->
    <Teleport v-if="edit" to="body">
      <div v-if="!pickerOpen && selCard" class="m-dedit__selbar" role="toolbar" :aria-label="selCard.title" :style="fabStyle" @pointerdown.stop>
        <b class="m-dedit__seltitle">{{ selCard.title }}</b>
        <span v-if="selCard.sizeKeys.length > 1" class="m-dedit__selsizes" role="radiogroup" :aria-label="`${T.size}: ${selCard.title}`"><button v-for="k in selCard.sizeKeys" :key="k" type="button" role="radio" :aria-checked="selCard.size === k" :aria-label="T['sizeName' + k.toUpperCase()]" :class="{ 'is-on': selCard.sizeKey === k }" @click="setCardSize(selCard.id, k)">{{ T['size' + k.toUpperCase()] }}</button></span>
        <button v-if="stacksOn && selCard.kind !== 'stack' && joinTargetsOf(selCard).length" type="button" class="m-dedit__selbtn" data-stack-join :aria-label="T.stackJoin || '加入轮换组'" :data-tip="T.stackJoin || '加入轮换组'" @click="joinFor = selCard.id"><MIcon name="library_add" /></button>
        <button type="button" class="m-dedit__selbtn" :aria-label="T.addCard" :data-tip="T.addCard" @click="pickerOpen = true"><MIcon name="add" /></button>
        <button type="button" class="m-dedit__selbtn is-danger" :aria-label="`${T.hide}: ${selCard.title}`" :data-tip="T.hide" @click="removeCard(selCard.id)"><MIcon name="remove" /></button>
      </div>
      <button v-if="!pickerOpen" type="button" class="m-dedit__fab" :style="fabStyle" @click="pickerOpen = true"><MIcon name="add" />{{ T.addCard }}</button>
      <template v-else>
        <div class="m-dedit__dim" :class="{ 'is-away': sheetAway }" aria-hidden="true" />
        <section ref="sheetEl" class="m-dedit m-dedit--gallery" :class="{ 'is-drop': drag?.over, 'is-away': sheetAway }" role="dialog" :aria-label="T.editTitle">
          <header class="m-dedit__head">
            <label class="m-dedit__search"><MIcon name="search" /><input v-model="query" type="search" :placeholder="T.search" :aria-label="T.search"></label>
            <button type="button" class="m-dedit__close" :aria-label="T.close" @click="pickerOpen = false"><MIcon name="close" /></button>
            <!-- the tools: in line with the search on a wide window; on a phone one row of their own that scrolls sideways (edit-phone.css) -->
            <div class="m-dedit__tools">
              <button type="button" class="m-dpill" :aria-label="T.reset" :data-tip="T.reset" :disabled="layout.isDefault.value" @click="layout.reset()"><MIcon name="restart_alt" /><span class="m-dpill__t">{{ T.reset }}</span></button>
              <button type="button" class="m-dpill" :aria-label="T.restoreSmart" :data-tip="T.restoreSmart" @click="restoreSmart"><MIcon name="wand_stars" /><span class="m-dpill__t">{{ T.restoreSmart }}</span></button>
              <button v-if="stacksOn" type="button" class="m-dpill" data-stack-rotate :aria-pressed="stacks.state.rotate" :class="{ 'is-on': stacks.state.rotate }" @click="setStackRotate(!stacks.state.rotate)"><MIcon name="sync" /><span class="m-dpill__t">{{ stacks.state.rotate ? (T.stackRotateOn || '轮换：开') : (T.stackRotateOff || '轮换：关') }}</span></button>
              <button type="button" class="m-dpill" :aria-label="T.whyTitle" :data-tip="T.whyTitle" @click="whyOpen = true"><MIcon name="help" /><span class="m-dpill__t">{{ T.whyTitle }}</span></button>
              <span v-if="dockLayout" class="m-dsize m-dedit__layout m-dedit__align" role="radiogroup" :aria-label="T.clockPos"><button v-for="a in ['left', 'center', 'right']" :key="a" type="button" role="radio" :aria-checked="appearance.state.clockAlign === a" :class="{ 'is-on': appearance.state.clockAlign === a }" @click="appearance.set({ clockAlign: a })">{{ T['align' + a[0].toUpperCase() + a.slice(1)] }}</button></span>
              <span class="m-dedit__layoutlabel">{{ T.layoutLabel }}</span><span class="m-dsize m-dedit__layout" role="radiogroup" :aria-label="T.overviewGrid + ' / ' + T.overviewDock"><button type="button" role="radio" :aria-checked="appearance.state.overview !== 'dock'" :class="{ 'is-on': appearance.state.overview !== 'dock' }" @click="setOverview('grid')">{{ T.overviewGrid }}</button><button type="button" role="radio" :aria-checked="appearance.state.overview === 'dock'" :class="{ 'is-on': appearance.state.overview === 'dock' }" @click="setOverview('dock')">{{ T.overviewDock }}</button></span>
            </div>
          </header>
          <MTileGallery v-model:group="group" :fit="GALLERY_FIT" :entries="galleryEntries" :groups="galleryGroups" :texts="T" :variants="galleryVariants" :empty="addable.length ? T.noMatch : T.nothing" @add="addFromGallery" @size="(id, k) => (sheetSize = { ...sheetSize, [id]: k })" @variant="(id) => (compChoice = id)" @pick="galleryPick">
            <template #preview="{ entry }"><div class="m-dash m-gal__dash" :class="{ 'm-dash--compact': compact, 'm-dash--xl': xl }"><div class="m-dash__cell m-gal__tile" :data-group="entry.group" :data-size="entry.card.size"><div class="m-dash__body"><MDashCardView :card="entry.card" :details="details" :texts="T" preview /></div></div></div></template>
          </MTileGallery>
          <p class="m-dedit__drop" aria-hidden="true"><MIcon name="remove" />{{ T.dropRemove }}</p>
        </section>
      </template>
    </Teleport>

    <MSheet :model-value="!!detail" :title="detail?.title || ''" side="end" wide :close-label="T.close" @update:model-value="(v) => { if (!v) detailId = '' }">
      <MDashSections v-if="detail" :detail="detail" :uid="detailId" :texts="T" />
    </MSheet>
  </div>
</template>
