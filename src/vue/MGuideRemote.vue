<script setup>
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import MGroup from './MGroup.vue'
import MItem from './MItem.vue'
import MRemoteAccess from './MRemoteAccess.vue'
import { remoteAdvice, upnpState } from './guideModel.js'
import { fillText } from './guideTexts.js'

// 远程串流与组网, opened from the done page of the guide. Most people play at home and need nothing here, so the page says that first, then checks: the host's own reachability check says what this
// computer's network allows (a public address, UPnP, a mesh tool installed), and the page offers the one way that fits, the other behind 「其他办法」. The steps of each way are MRemoteAccess (UPnP, the port
// forward, the mesh tools), unchanged. The way to lead through it was chosen by the owner on 2026-11-16 from two (ask first, check first); the sources are in docs/authority.
const props = defineProps({
  T: { type: Object, required: true },
  locale: { type: String, default: 'en' },
  state: { type: Object, default: () => ({}) },
  callbacks: { type: Object, default: () => ({}) },
})
const R = computed(() => props.T.remoteGuide)
const reach = computed(() => props.state.reach || { report: null, status: 'idle' })
const advice = computed(() => remoteAdvice(reach.value.report))
// the first answer is awaited; a re-check keeps the report on screen (the tutorial below asks for the check itself, and a page that disappears while it runs would ask again)
const checking = computed(() => !reach.value.report && (reach.value.status === 'loading' || reach.value.status === 'idle'))
const rechecking = computed(() => reach.value.status === 'loading')
const runReach = () => props.callbacks.checkReach?.(true)
void runReach()

const facts = computed(() => {
  const F = R.value.facts
  const a = advice.value
  const upnp = upnpState(props.state.network)
  return [
    { icon: a.direct === 'works' || a.direct === 'possible' ? 'check_circle' : 'cancel', ok: a.direct === 'works' || a.direct === 'possible', text: { works: F.publicYes, possible: F.publicPossible, no: F.publicNo, unknown: F.publicUnknown }[a.direct] },
    ...(upnp.known ? [{ icon: upnp.on ? 'check_circle' : 'cancel', ok: upnp.on, text: upnp.on ? F.upnpOn : F.upnpOff }] : []),
    { icon: a.meshTool ? 'check_circle' : 'cancel', ok: !!a.meshTool, text: a.meshTool ? fillText(F.meshYes, { name: a.meshTool }) : F.meshNo },
  ]
})
const other = computed(() => (advice.value.recommended === 'mesh' ? 'public' : 'mesh'))
const shown = ref('')
const recLabel = computed(() => (advice.value.recommended === 'mesh' ? R.value.recMesh : R.value.recDirect))
const recText = computed(() => (advice.value.recommended === 'mesh' ? R.value.recMeshText : R.value.recDirectText))
// the check of the host is this page's own: the tutorial below does not repeat it
const accessProps = computed(() => ({ locale: props.locale, state: props.state, callbacks: props.callbacks, hideChoice: true, hideReach: true }))
</script>

<template>
  <div class="m-gremote">
    <p class="m-guide__note"><MIcon name="info" />{{ R.homeOnly }}</p>
    <MGroup class="m-gremote__facts" role="status">
      <MItem icon="lan" :title="R.checkTitle" :text="checking ? R.checking : ''">
        <template #trail><MButton variant="text" icon="refresh" :loading="rechecking" @click="runReach">{{ R.again }}</MButton></template>
      </MItem>
      <template v-if="!checking">
        <MItem v-for="f in facts" :key="f.text" :icon="f.icon" :title="f.text" :class="{ 'is-ok': f.ok, 'is-no': !f.ok }" />
      </template>
    </MGroup>
    <template v-if="!checking">
      <section class="m-gremote__rec" :aria-label="R.recommend">
        <span class="m-gremote__tag">{{ R.recommend }}</span>
        <h3>{{ recLabel }}</h3>
        <p>{{ recText }}</p>
      </section>
      <MRemoteAccess :key="advice.recommended" v-bind="accessProps" :initial-mode="advice.recommended" />
      <MGroup>
        <MItem action icon="swap_horiz" :title="R.other" :aria-expanded="shown === other" @click="shown = shown === other ? '' : other"><template #trail><MIcon :name="shown === other ? 'keyboard_arrow_up' : 'keyboard_arrow_down'" /></template></MItem>
      </MGroup>
      <MRemoteAccess v-if="shown === other" :key="`o-${other}`" v-bind="accessProps" :initial-mode="other" />
    </template>
  </div>
</template>
