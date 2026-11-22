<script setup>
import MBreakText from './MBreakText.vue'
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import MReachVerdict from './MReachVerdict.vue'
import MPublicEndpoints from './MPublicEndpoints.vue'
import { reachTexts } from '../settings/reachTexts.js'

// 公网地址: the address clients use from outside (the configuration's external_endpoints): shown with the verdict the host's reachability check gave it, an edit action and 检测. The verdict is the
// component of the network page's status card; the edit field is the same one as there. Unset is not a problem (clients then use the address that is found).
const props = defineProps({ data: { type: Object, required: true }, size: { type: String, default: 's' } })
const emit = defineEmits(['act'])
const T = computed(() => ({ ...reachTexts(props.data.locale).address, ...props.data.texts }))
const editing = ref(false)
const av = computed(() => props.data.view || null)
const shown = computed(() => (av.value && av.value.state !== 'unset' ? av.value.value : props.data.saved || T.value.unset || '–'))
const word = computed(() => (av.value ? av.value.word : props.data.path?.word || ''))
const save = (value) => { emit('act', 'address-save', { value }); editing.value = false }
const check = () => emit('act', 'reach-check')
</script>

<template>
  <section class="m-dcard m-daddr" :class="`m-daddr--${size}`">
    <header class="m-dcard__head"><MIcon class="m-dcard__icon" :name="data.icon" /><h3 class="m-dcard__title">{{ data.title }}</h3></header>
    <div class="m-daddr__value"><b :class="{ 'is-unset': !data.saved && !(av && av.state !== 'unset') }" :data-redact="!av || av.address ? 'address' : null"><MBreakText :text="shown" /></b>
      <span v-if="word" class="m-daddr__word" :class="av ? `is-${{ ok: 'ok', bad: 'error' }[av.tone] || 'neutral'}` : `is-${data.path.tone}`">{{ word }}</span></div>
    <ul v-if="data.path?.endpoints?.length && size === 'l' && !editing" class="m-daddr__eps">
      <li v-for="e in data.path.endpoints" :key="e.input" :class="`is-${e.tone}`"><MIcon :name="e.icon" :fill="e.reached" /><b data-redact="address">{{ e.input }}</b><span>{{ e.word }}</span><small v-if="e.portText">{{ e.portText }}<template v-if="e.latencyText"> · {{ e.latencyText }}</template></small></li>
    </ul>
    <MReachVerdict v-if="data.path && size !== 's' && !editing" :path="data.path" :locale="data.locale" :compact="size === 'm'" />
    <MPublicEndpoints v-if="editing && size !== 's'" :saved="data.saved" :results="data.path?.endpoints || []" :locale="data.locale" :checking="data.checking" @save="save" @check="check" />
    <div v-if="size !== 's' && data.canAct" class="m-daddr__acts">
      <button type="button" class="m-dpill" @click="editing = !editing"><MIcon name="edit" />{{ editing ? T.cancel : T.edit }}</button>
      <button type="button" class="m-dpill m-dpill--fill" :disabled="data.checking" @click="check"><MIcon name="network_check" />{{ data.checking ? (data.progress ? `${T.checking} ${data.progress}` : T.checking) : T.detect }}</button>
    </div>
  </section>
</template>
