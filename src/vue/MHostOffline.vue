<script setup>
import { computed, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import MProgress from './MProgress.vue'
import { VIVI } from '../about/mascot.js'
import { offlineTexts } from '../status/offlineTexts.js'
import { fillText } from './guideTexts.js'

// The offline state, a Material 3 Expressive error state: the host does not answer. Vivi, the title and line, the countdown to the next probe as a wavy
// circular progress, the actions as one button group (restart and user mode where the product can do them, try again, the log where there is one), and the
// tips as a short list with an icon each. No boxes: the page material and a soft scrim behind the text keep it readable. The Web UI cannot restart a dead server: it passes no restart.
const props = defineProps({
  state: { type: Object, required: true }, // useHostConnection().state
  locale: { type: String, default: 'zh' },
  canRestart: { type: Boolean, default: false },
  canUserMode: { type: Boolean, default: false },
  canLogs: { type: Boolean, default: false },
  /** why the host cannot be used: 'down' (nothing answers, the process is gone), 'unresponsive' (the process runs and does not answer), 'proxy' (the panel's own proxy does not answer the window); '' = read it from the connection's verdict */
  cause: { type: String, default: '' },
  port: { type: [Number, String], default: 47990 }, // the port of the Web UI the tips name (the product's real one; the original page's default otherwise)
  /** 运行体检: the product's own checks answer without Sunshine (the panel) */
  canDoctor: { type: Boolean, default: false },
})
const emit = defineEmits(['retry', 'restart', 'user-mode', 'logs', 'doctor'])
const T = computed(() => offlineTexts(props.locale, { port: props.port }))
const TIP_ICONS = ['bedtime', 'lan', 'shield']
const restarting = computed(() => props.state.status === 'restarting')
// the window opened while the host was still starting: a neutral state, not an error (status/hostConnection.js)
const connecting = computed(() => props.state.status === 'connecting')
// the process runs and does not answer: its own words (the original ones say that Sunshine cannot start)
const kind = computed(() => props.cause || (props.state.verdict === 'unresponsive' ? 'unresponsive' : 'down'))
const proxy = computed(() => kind.value === 'proxy')
const unresponsive = computed(() => kind.value === 'unresponsive' && !restarting.value)
const failedCount = computed(() => props.state.fails + Math.max(0, props.state.round - 1))
const problem = computed(() => (props.state.error ? (props.state.error === 'timeout' ? T.value.restartTimeout : fillText(T.value.restartFailed, { message: props.state.error })) : ''))

// the length of the wait that is running (the biggest value seen since it started): the ring shows what is left of it. A wait of a second or two is just a
// probe after probe, which the ring shows as running.
const total = ref(props.state.nextIn || 0)
let last = props.state.nextIn || 0
watch(() => props.state.nextIn, (n) => { if (n > last || n > total.value) total.value = n; last = n })
const waiting = computed(() => !restarting.value && !props.state.probing && total.value > 2)
const left = computed(() => (waiting.value ? Math.max(0, Math.min(1, props.state.nextIn / total.value)) : null))
const headline = computed(() => {
  if (proxy.value) return props.state.probing ? fillText(T.value.proxyChecking, { n: failedCount.value + 1 }) : T.value.proxyWaiting
  if (restarting.value) return T.value.restarting
  if (props.state.probing) return fillText(T.value.probing, { n: failedCount.value + 1 })
  return fillText(T.value.retryIn, { s: props.state.nextIn })
})
const detail = computed(() => (proxy.value ? fillText(T.value.proxyAttempts, { n: failedCount.value }) : restarting.value || props.state.probing ? '' : fillText(T.value.attemptFailed, { n: failedCount.value })))
</script>

<template>
  <section v-if="connecting" class="m-offline m-offline--connecting" data-cause="connecting" aria-live="polite">
    <div class="m-offline__inner"><MProgress circular :label="T.connectingTitle" class="m-offline__ring" /><h2 class="m-offline__connecting">{{ T.connectingTitle }}</h2></div>
  </section>
  <section v-else class="m-offline" :data-cause="kind" aria-live="polite">
    <div class="m-offline__inner">
      <div v-if="VIVI.bg" class="m-offline__art"><img class="m-offline__vivi" :src="VIVI.bg" alt="" width="512" height="768" decoding="async" /></div>
      <div class="m-offline__copy">
        <h2 class="m-offline__title">{{ proxy ? T.proxyTitle : unresponsive ? T.unresponsiveTitle : T.title }}</h2>
        <p class="m-offline__line">{{ proxy ? T.proxyLine : unresponsive ? T.unresponsiveLine : T.line }}</p>
        <p v-if="problem" class="m-offline__problem" role="alert"><MIcon name="error" fill />{{ problem }}</p>
        <div class="m-offline__wait">
          <MProgress circular :value="left" :label="headline" class="m-offline__ring" />
          <div class="m-offline__waittext"><b>{{ headline }}</b><span v-if="detail">{{ detail }}</span></div>
        </div>
        <div class="m-offline__actions" role="group">
          <MButton v-if="canRestart" size="lg" icon="restart_alt" :loading="restarting && state.mode === 'service'" :disabled="restarting" @click="emit('restart')">{{ T.restart }}</MButton>
          <MButton v-if="canUserMode" size="lg" variant="tonal" icon="person" :loading="restarting && state.mode === 'user'" :disabled="restarting" @click="emit('user-mode')">{{ T.userMode }}</MButton>
          <MButton size="lg" :variant="canRestart ? 'text' : 'filled'" icon="refresh" :disabled="restarting" @click="emit('retry')">{{ T.retry }}</MButton>
          <MButton v-if="canDoctor" size="lg" variant="tonal" icon="health_and_safety" class="m-offline__doctor" @click="emit('doctor')">{{ T.runDoctor }}</MButton>
          <MButton v-if="canLogs" size="lg" variant="text" icon="terminal" @click="emit('logs')">{{ T.viewLog }}</MButton>
        </div>
        <section v-if="!proxy" class="m-offline__tips">
          <h3 class="m-offline__label">{{ T.tipsTitle }}</h3>
          <ul><li v-for="(tip, i) in T.tips" :key="tip"><MIcon :name="TIP_ICONS[i] || 'lightbulb'" />{{ tip }}</li></ul>
        </section>
        <p v-if="!proxy" class="m-offline__footer"><MIcon name="info" fill />{{ T.footer }}</p>
      </div>
    </div>
  </section>
</template>
