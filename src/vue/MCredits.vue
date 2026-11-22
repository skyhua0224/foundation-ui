<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import MMascot from './MMascot.vue'
import MGithubMark from './MGithubMark.vue'
import { CONTRIBUTORS, PRODUCT, SPONSORS, TEAM, THANKS, FONTS, FOUNDER, TEAM_SPONSORS, resolveLink } from '../about/index.js'
import { avatarImage } from '../about/avatars.js'
import { reducedMotion } from '../appearance/motion.js'

// 制作人员: the credits the seventh tap on the version opens. The team in team order (the founder tagged), the projects it is built on, the
// sponsor pages and every contributor of the README, rolling up slowly like the end of a game. The roll is one transform animation of the list;
// it pauses with the button (which takes the first focus of the sheet) and while a link has the keyboard focus, loops, and under reduced motion
// it is a list that scrolls by hand.
const props = defineProps({
  locale: { type: String, default: 'en' },
  texts: { type: Object, required: true },
  /** the sheet is open: the roll starts from the bottom each time */
  active: { type: Boolean, default: false },
})
const emit = defineEmits(['open'])
const SPEED = 32 // CSS pixels a second: slow enough to read a name
const roll = ref(null)
const view = ref(null)
const playing = ref(true)
const still = ref(false)
const timing = ref({})
const team = computed(() => TEAM.map((p) => ({ ...p, founder: p.login === FOUNDER, sponsor: TEAM_SPONSORS[p.login] || '' })))
// the length of the roll is measured once when the sheet opens (one layout), never per frame
watch(() => props.active, async (on) => {
  if (!on) return
  still.value = reducedMotion()
  playing.value = true
  timing.value = {}
  await nextTick()
  // the sheet shows its dialog after this tick: measure once it is laid out
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  if (!props.active || still.value || !roll.value || !view.value) return
  const h = view.value.clientHeight
  if (!h) return
  const total = roll.value.offsetHeight + h
  timing.value = { '--m-credits-from': `${h}px`, '--m-credits-d': `${Math.round(total / SPEED)}s` }
}, { immediate: true })
onBeforeUnmount(() => { timing.value = {} })
const open = (url) => emit('open', url)
</script>

<template>
  <div class="m-credits" :class="{ 'is-still': still, 'is-paused': !playing }">
    <div ref="view" class="m-credits__view" :tabindex="still ? 0 : -1">
      <div ref="roll" class="m-credits__roll" :class="{ 'is-rolling': active && !still && timing['--m-credits-d'] }" :style="timing">
        <header class="m-credits__head">
          <MMascot :size="64" />
          <p class="m-credits__product">{{ PRODUCT.name }}</p>
        </header>

        <section class="m-credits__part" :aria-label="texts.creditsTeam">
          <h3 class="m-credits__title">{{ texts.creditsTeam }}</h3>
          <ul class="m-credits__team">
            <li v-for="p in team" :key="p.id" class="m-credits__member">
              <img :src="avatarImage(p.avatar).src" :srcset="avatarImage(p.avatar).srcset || undefined" sizes="48px" alt="" width="48" height="48" loading="lazy" decoding="async" />
              <span class="m-credits__login">{{ p.login }}<span v-if="p.founder" class="m-about__tag">{{ texts.founder }}</span></span>
              <span class="m-credits__links">
                <button type="button" class="m-credits__link" @click="open(p.url)"><MGithubMark :size="14" />{{ texts.follow }}</button>
                <button v-if="p.sponsor" type="button" class="m-credits__link" @click="open(p.sponsor)"><MIcon name="favorite" />{{ texts.sponsorAfdian }}</button>
              </span>
            </li>
          </ul>
        </section>

        <section class="m-credits__part" :aria-label="texts.creditsUpstream">
          <h3 class="m-credits__title">{{ texts.creditsUpstream }}</h3>
          <ul class="m-credits__names m-credits__names--big">
            <li v-for="t in THANKS" :key="t.id"><button type="button" class="m-credits__link" @click="open(t.url)">{{ t.name }}</button></li>
          </ul>
        </section>

        <section class="m-credits__part" :aria-label="texts.creditsFonts">
          <h3 class="m-credits__title">{{ texts.creditsFonts }}</h3>
          <ul class="m-credits__names">
            <li v-for="f in FONTS" :key="f.id"><button type="button" class="m-credits__link" @click="open(f.url)">{{ f.name }}</button></li>
          </ul>
        </section>

        <section class="m-credits__part" :aria-label="texts.creditsSponsors">
          <h3 class="m-credits__title">{{ texts.creditsSponsors }}</h3>
          <ul class="m-credits__names m-credits__names--big">
            <li v-for="s in SPONSORS" :key="s.login"><button type="button" class="m-credits__link" @click="open(resolveLink(s, locale))"><MIcon name="favorite" />{{ s.login }}</button></li>
          </ul>
        </section>

        <section class="m-credits__part" :aria-label="texts.creditsContributors">
          <h3 class="m-credits__title">{{ texts.creditsContributors }}</h3>
          <ul class="m-credits__names">
            <li v-for="p in CONTRIBUTORS" :key="p.id">{{ p.login }}</li>
          </ul>
        </section>

        <p class="m-credits__end">{{ texts.creditsEnd }}</p>
      </div>
    </div>
    <div v-if="!still" class="m-credits__bar">
      <MButton variant="text" size="sm" autofocus :icon="playing ? 'pause' : 'play_arrow'" @click="playing = !playing">{{ playing ? texts.creditsPause : texts.creditsPlay }}</MButton>
    </div>
  </div>
</template>
