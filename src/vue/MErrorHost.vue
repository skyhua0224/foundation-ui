<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import MDialog from './MDialog.vue'
import MButton from './MButton.vue'
import MField from './MField.vue'
import MBanner from './MBanner.vue'
import MIcon from './MIcon.vue'
import { useNotify } from '../notify/store.js'
import { errorTexts } from './errorTexts.js'
import { dismissError, hideError, hostMounted, showError, useErrors } from './useErrors.js'
import { bundleArchive, bundleRows, canUploadCrash, crashText, flushQueueAuto, latestCrashBundle, readErrors, referenceOf, removeQueued, reportIdOf, reportProblems, reportToDocument, reportToEvent, reportToFile, reportToText, submitReport, uploadCrash } from '../telemetry/index.js'
import { currentFingerprint } from './useAutoReport.js'
import { devReport, openDevReport } from './devmode/devReport.js'
import { devmodeTexts } from '../devmode/texts.js'
import { errorDraft } from '../devmode/feedback.js'
import { feedbackTexts } from '../feedback/texts.js'

// The error surface of both products. A blocking error is a dialog with the way out first: 返回上一页, then 重启 Sunshine, then 复制 / 下载 / 报告给开发者. A non-blocking one is a snackbar with
// a way to the same details. 报告给开发者 is a form (title and description are required) that shows exactly what is sent, and sends it as an error event named report through the host; where the host or the server cannot be reached the
// report is kept and sent later, and the copy and the file are the other ways. Used by the control panel and the Web UI.
const props = defineProps({
  locale: { type: String, default: 'en' },
  /** there is a page to go back to (otherwise the way back is to the overview) */
  canGoBack: { type: Boolean, default: false },
  /** Sunshine answers; while it does not, 重启 is disabled and says why */
  hostOnline: { type: Boolean, default: true },
  /** restarts Sunshine: resolves when the request was made (the window then waits for the host to go away and come back) */
  restart: { type: Function, default: null },
  /** opens 体检 running, the product's own checks first (they answer while Sunshine is down): ({ reason: 'stop' | 'hung' }); without it the dialogs offer no 运行体检 */
  doctor: { type: Function, default: null },
  openUrl: { type: Function, default: null },
  /** 报告问题 opens the report sheet of the developer-mode flows (screenshot and log attached by default, the choice of where it goes) instead of the form below; the form stays for the products that do not mount DevReportHost */
  reportSheet: { type: Boolean, default: false },
})
const emit = defineEmits(['back', 'restarted'])
const T = computed(() => errorTexts(props.locale))
const F = computed(() => feedbackTexts(props.locale))
const { state } = useErrors()
const notify = useNotify()
const report = computed(() => state.current?.report || null)
const blocking = computed(() => !!state.current?.blocking)
// the report form opened without an error (feedback from the diagnostics page): no error dialog in front of it, and closing the form closes the whole surface
const feedback = computed(() => !!state.current?.feedback)

// ---- a non-blocking error: a snackbar that leads to the details
watch(() => state.current, (cur) => {
  if (cur?.feedback) { openForm(); return }
  if (!cur || cur.blocking) return
  notify.snack(T.value.titleSoft, { action: T.value.details, onAction: () => { cur.blocking = true; state.open = true }, timeout: 8000 })
  state.open = false
})

const mainOpen = computed({ get: () => state.open && blocking.value && !feedback.value && !formOpen.value && !stopFormOpen.value && !confirmOpen.value && !running.value, set: (v) => { if (!v) hideError() } })
const stackText = computed(() => report.value?.stack || '')
// the stop of the host: the surface in its own variant, with what the host left behind; a restart is exactly what it is for, so a host that does not answer does not block it
const hostStop = computed(() => state.current?.hostStop || null)
// the host hung (it runs and does not answer) rather than stopped: { kind: 'hung', at, seconds? } -- the same surface, its own words, and waiting is the way out
const hostHung = computed(() => hostStop.value?.kind === 'hung')
const stopWhen = computed(() => { const d = new Date(hostStop.value?.at ?? NaN); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` })
const stopTitle = computed(() => (hostHung.value ? T.value.hungTitle : T.value.stopTitle))
const stopLead = computed(() => (!hostHung.value ? T.value.stopLead : hostStop.value?.seconds ? T.value.hungLead.replace('{seconds}', String(hostStop.value.seconds)) : T.value.hungLeadPlain))
const stopWhenText = computed(() => (stopWhen.value ? (hostHung.value ? T.value.hungAt : T.value.stopAt).replace('{time}', stopWhen.value) : ''))
const bundle = ref(null)
const stopContext = computed(() => ({ version: report.value?.version, os: report.value?.os, at: hostStop.value?.at }))
watch(hostStop, async (h) => { bundle.value = null; if (h) bundle.value = await latestCrashBundle() }, { immediate: true })
const rows = computed(() => bundleRows(bundle.value))
const kindWord = (k) => (k === 'minidump' ? T.value.kindMinidump : k === 'log' ? T.value.kindLog : T.value.kindInfo)
const kindIcon = (k) => (k === 'minidump' ? 'memory' : k === 'log' ? 'description' : 'info')
const way = reactive({ restartBlocked: computed(() => (hostStop.value ? !props.restart : !props.hostOnline || !props.restart)) })
const stopFormOpen = ref(false)
const stopSending = ref(false)
const stopResult = ref('')
// read when the dialog opens (the endpoint is a setting of the product, not reactive state)
const stopUpload = ref(false)
function saveBlob(bytes, name, mime) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
async function downloadStop() { const file = await bundleArchive(bundle.value, stopContext.value); saveBlob(file.bytes, file.name, file.mime); notify.snack(T.value.stopSaved) }
async function stopReportDo() {
  stopSending.value = true
  if (stopUpload.value) { stopResult.value = (await uploadCrash(bundle.value, { context: stopContext.value })) === 'sent' ? 'sent' : 'failed' }
  else { await downloadStop(); stopResult.value = 'saved' }
  stopSending.value = false
}
const openStopForm = () => { stopResult.value = ''; stopUpload.value = canUploadCrash(); stopFormOpen.value = true }

function goBack() { hideError(); emit('back'); dismissError() }
// 运行体检: the dialog steps aside (the stop stays in the surface, showError brings it back) and the product opens its health check
function runDoctor() { const reason = hostHung.value ? 'hung' : 'stop'; hideError(); props.doctor?.({ reason }) }
async function copy() {
  if (!report.value) return
  if (hostStop.value) { try { await navigator.clipboard.writeText(crashText(bundle.value, stopContext.value)) } catch { /* the snackbar says it either way */ } notify.snack(T.value.copied); return }
  try { await navigator.clipboard.writeText(reportToText(report.value, { title: form.title, description: form.description })); notify.snack(T.value.copied) } catch { notify.snack(T.value.copied) }
}
function download() {
  if (!report.value) return
  const file = reportToFile(report.value, { title: form.title, description: form.description })
  const url = URL.createObjectURL(new Blob([file.text], { type: file.mime }))
  const a = document.createElement('a')
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  notify.snack(T.value.downloaded)
}

// ---- 重启 Sunshine: a confirmation, then progress until the host has gone and is back
const confirmOpen = ref(false)
const running = ref(false)
const runState = ref('')
let timer = 0
let wentDown = false
function askRestart() { if (!way.restartBlocked) confirmOpen.value = true }
async function doRestart() {
  confirmOpen.value = false
  running.value = true; runState.value = 'restarting'; wentDown = false
  try { await props.restart() } catch { runState.value = 'failed'; return }
  const started = Date.now()
  clearInterval(timer)
  timer = setInterval(() => {
    if (!props.hostOnline) wentDown = true
    const back = props.hostOnline && (wentDown || Date.now() - started > 6000)
    if (back) { clearInterval(timer); runState.value = 'done'; setTimeout(() => { running.value = false; runState.value = ''; emit('restarted'); dismissError() }, 900) }
    else if (Date.now() - started > 45000) { clearInterval(timer); runState.value = 'failed' }
  }, 600)
}
function closeProgress() { clearInterval(timer); running.value = false; runState.value = '' }
onBeforeUnmount(() => clearInterval(timer))

// ---- 报告给开发者
const formOpen = ref(false)
const form = reactive({ title: '', description: '' })
const sending = ref(false)
const result = ref('')
const failReason = ref('')
const sentRef = ref('')
const sentAgain = ref(false)
// the id of the report this form kept for later: when the text changes it is dropped, so editing a kept report does not leave the old one behind
const keptId = ref('')
const consent = ref(readErrors())
const touched = ref(false)
const problems = computed(() => reportProblems(form))
const doc = computed(() => (report.value ? reportToDocument(report.value, { title: form.title || '…', description: form.description || '…', issue: currentFingerprint() }) : null))
// exactly what is sent: the event (the event carries a summary of the error, not the full stack and the logs, which stay in the copy and the download)
const preview = computed(() => (doc.value ? JSON.stringify(reportToEvent(doc.value), null, 2) : ''))
// the sheet: the dialog steps aside while it is open and comes back when it closes (a feedback has no dialog; closing the sheet ends it)
let viaSheet = ''
async function openSheet() {
  const r = report.value
  const fb = feedback.value
  viaSheet = fb ? 'feedback' : 'error'
  // an error report opens with its own words in 内容 (the error, the page, the version, a line for the steps) and its log lines on the 日志 attachment: nothing of it is typed again, nothing is empty
  const words = devmodeTexts(r?.locale || props.locale)
  await openDevReport({
    kind: fb ? 'feedback' : 'error',
    error: fb || !r ? null : { name: r.name, message: r.message, code: r.code, fingerprint: currentFingerprint(), stack: r.stack, page: r.page },
    draft: fb || !r ? null : { title: `${r.name}: ${r.message}`.slice(0, 100), description: errorDraft(r, words) },
    carriedLogs: fb || !r ? '' : r.logs,
    carriedLabel: words.draftLogs,
  })
  if (!fb) hideError()
}
watch(() => devReport.open, (open) => {
  if (open || !viaSheet) return
  const was = viaSheet
  viaSheet = ''
  if (was === 'feedback') dismissError(); else showError()
})
function openForm() { if (props.reportSheet) { openSheet(); return } result.value = ''; failReason.value = ''; touched.value = false; consent.value = readErrors(); if (!form.title && report.value && !feedback.value) form.title = `${report.value.name}: ${report.value.message}`.slice(0, 100); formOpen.value = true }
// One press, one report: a press while the request is on its way does nothing, the same report is the same document (reportIdOf) so a second press or a retry never makes a second one, and every answer has its words.
async function send() {
  if (sending.value) return
  touched.value = true
  if (problems.value.length || !report.value) return
  const d = reportToDocument(report.value, { ...form, issue: currentFingerprint() })
  if (!d) return
  const id = reportIdOf(d)
  if (keptId.value && keptId.value !== id) removeQueued(keptId.value)
  sending.value = true
  let answer
  try { answer = await submitReport(d, { id }) } catch { answer = { state: 'rejected', id } }
  sending.value = false
  result.value = answer.state
  failReason.value = answer.reason || ''
  sentRef.value = answer.state === 'sent' ? referenceOf(answer.id) : ''
  sentAgain.value = !!answer.again
  keptId.value = answer.state === 'queued' ? id : ''
}
const sentText = computed(() => (sentAgain.value ? T.value.sentAgain : sentRef.value ? T.value.sentRef : T.value.sent).replace('{ref}', sentRef.value))
// a report that waits is kept for the person to send again; where it stands depends on why (no connection, the server out of reach) and on whether error information is switched off
const queuedText = computed(() => (consent.value === 'off' ? T.value.queuedHeld : failReason.value === 'offline' ? T.value.queuedOffline : T.value.queued))
watch(formOpen, (v) => { if (!v) { sending.value = false; if (feedback.value) dismissError() } })
// A report that was kept for later is tried again when the window starts and when the connection is back, by itself only while error information is not switched off, at most once in 30 s (flushQueueAuto);
// the Retry button is the person's own press and always tries.
const autoFlush = () => { void flushQueueAuto({ consent: readErrors() }) }
const onConsent = () => { consent.value = readErrors(); autoFlush() }
let flushTimer = 0
onMounted(() => {
  hostMounted(true)
  if (typeof window === 'undefined') return
  flushTimer = setTimeout(autoFlush, 5000)
  window.addEventListener('online', autoFlush)
  window.addEventListener('foundation-telemetry-errors', onConsent)
})
onBeforeUnmount(() => {
  hostMounted(false)
  clearTimeout(flushTimer)
  if (typeof window === 'undefined') return
  window.removeEventListener('online', autoFlush)
  window.removeEventListener('foundation-telemetry-errors', onConsent)
})
</script>

<template>
  <MDialog v-model="mainOpen" class="m-err" :class="{ 'm-err--stop': hostStop }" :title="hostStop ? stopTitle : T.title" :icon="hostStop ? (hostHung ? 'schedule' : 'power_off') : 'error'" tone="error">
    <p class="m-err__lead">{{ hostStop ? stopLead : T.lead }}</p>
    <template v-if="hostStop">
      <p v-if="hostHung" class="m-err__note">{{ T.hungAuto }}</p>
      <section class="m-err__diag" :aria-label="T.stopFiles">
        <div class="m-err__diaghead"><span>{{ T.stopFiles }}</span><small v-if="stopWhenText">{{ stopWhenText }}</small></div>
        <ul v-if="rows.length" class="m-err__files"><li v-for="f in rows" :key="f.name"><MIcon :name="kindIcon(f.kind)" /><span>{{ f.name }}</span><small>{{ kindWord(f.kind) }} · {{ f.size }}</small></li></ul>
        <p v-else class="m-err__quiet">{{ hostHung ? T.hungNoBundle : T.noBundle }}</p>
        <div class="m-err__tools">
          <MButton variant="text" size="sm" icon="content_copy" @click="copy">{{ T.stopCopy }}</MButton>
          <MButton variant="text" size="sm" icon="download" @click="downloadStop">{{ T.stopDownload }}</MButton>
          <MButton variant="text" size="sm" icon="bug_report" @click="openStopForm">{{ T.report }}</MButton>
        </div>
      </section>
    </template>
    <template v-else>
      <p v-if="report" class="m-err__message" data-redact="path">{{ report.name }}: {{ report.message }}</p>
      <p v-if="state.more" class="m-err__more">{{ T.more.replace('{n}', state.more) }}</p>
      <details v-if="report" class="m-err__details" data-redact="path"><summary>{{ T.details }}</summary><pre>{{ stackText || T.noStack }}</pre></details>
    </template>
    <template #actions>
      <!-- the stop of the host: one way on (restart, filled, trailing), one way out (text); the three tools are a row of the diagnostics above (M3 dialog: the confirming action last) -->
      <div v-if="hostStop" class="m-err__primary">
        <MButton v-if="hostHung" variant="text" @click="hideError">{{ T.hungWait }}</MButton>
        <MButton v-else variant="text" @click="goBack">{{ canGoBack ? T.back : T.home }}</MButton>
        <MButton v-if="doctor" variant="tonal" icon="health_and_safety" class="m-err__doctor" @click="runDoctor">{{ T.doctor }}</MButton>
        <MButton icon="restart_alt" autofocus :disabled="way.restartBlocked" @click="askRestart">{{ T.restart }}</MButton>
      </div>
      <div v-else class="m-err__actions">
        <div class="m-err__primary">
          <MButton variant="filled" icon="arrow_back" @click="goBack">{{ canGoBack ? T.back : T.home }}</MButton>
          <MButton variant="tonal" icon="restart_alt" :disabled="way.restartBlocked" @click="askRestart">{{ T.restart }}</MButton>
        </div>
        <p v-if="way.restartBlocked && restart" class="m-err__reason">{{ T.hostDown }}</p>
        <div class="m-err__secondary">
          <MButton variant="text" size="sm" icon="content_copy" @click="copy">{{ T.copy }}</MButton>
          <MButton variant="text" size="sm" icon="download" @click="download">{{ T.download }}</MButton>
          <MButton variant="text" size="sm" icon="feedback" data-fb="error-feedback" @click="openForm">{{ reportSheet ? F.errorButton : T.report }}</MButton>
        </div>
      </div>
    </template>
  </MDialog>

  <MDialog v-model="stopFormOpen" class="m-err m-err--form" :title="T.stopFormTitle" icon="bug_report" persistent>
    <p class="m-err__lead">{{ T.stopFormLead }}</p>
    <ul v-if="rows.length" class="m-err__files"><li v-for="f in rows" :key="f.name"><MIcon :name="kindIcon(f.kind)" /><span>{{ f.name }}</span><small>{{ kindWord(f.kind) }} · {{ f.size }}</small></li></ul>
    <p v-else class="m-err__quiet">{{ T.noBundle }}</p>
    <MBanner v-if="!stopUpload" tone="info" icon="info">{{ T.stopNoServer }}</MBanner>
    <MBanner v-if="stopResult === 'sent'" tone="info" icon="check_circle">{{ T.stopSentOk }}</MBanner>
    <MBanner v-else-if="stopResult === 'failed'" tone="warn" icon="error">{{ T.stopSentFail }}</MBanner>
    <template #actions>
      <MButton variant="text" :disabled="stopSending" @click="stopFormOpen = false">{{ stopResult === 'sent' || stopResult === 'saved' ? T.close : T.cancel }}</MButton>
      <MButton v-if="stopResult !== 'sent'" :icon="stopUpload ? 'send' : 'download'" :loading="stopSending" @click="stopReportDo">{{ stopUpload ? T.stopSendDo : T.stopSave }}</MButton>
    </template>
  </MDialog>

  <MDialog v-model="confirmOpen" :title="T.restartTitle" icon="restart_alt">
    <p>{{ T.restartText }}</p>
    <template #actions><MButton variant="text" @click="confirmOpen = false">{{ T.restartCancel }}</MButton><MButton icon="restart_alt" @click="doRestart">{{ T.restartDo }}</MButton></template>
  </MDialog>

  <MDialog :model-value="running" :title="runState === 'done' ? T.restarted : runState === 'failed' ? T.restartFailed : T.restarting" icon="restart_alt" persistent @update:model-value="(v) => { if (!v) closeProgress() }">
    <p v-if="runState === 'restarting'" class="m-err__progress"><span class="m-err__bar" role="progressbar" /><span>{{ T.restartingSub }}</span></p>
    <template #actions><MButton v-if="runState === 'failed'" variant="text" @click="closeProgress">{{ T.close }}</MButton></template>
  </MDialog>

  <MDialog v-model="formOpen" class="m-err m-err--form" :title="feedback ? T.feedbackTitle : T.formTitle" icon="bug_report" persistent>
    <p class="m-err__lead">{{ feedback ? T.feedbackLead : T.formLead }}</p>
    <!-- the answer sits under the lead, where it is seen: the preview below is long and scrolls -->
    <MBanner v-if="result === 'sent'" tone="info" icon="check_circle">{{ sentText }}</MBanner>
    <MBanner v-else-if="result === 'queued'" tone="warn" icon="schedule">{{ queuedText }}</MBanner>
    <MBanner v-else-if="result === 'rejected'" tone="error" icon="error">{{ T.rejected }}</MBanner>
    <MBanner v-else-if="result === 'limited'" tone="warn" icon="schedule">{{ T.limited }}</MBanner>
    <MField v-model="form.title" :label="T.fTitle" :error="touched && problems.includes('title') ? T.fTitleHint : ''" :supporting="T.fTitleHint" :disabled="sending || result === 'sent'" />
    <MField v-model="form.description" type="textarea" :label="T.fDesc" :error="touched && problems.includes('description') ? T.fDescHint : ''" :supporting="T.fDescHint" :disabled="sending || result === 'sent'" />
    <details class="m-err__details" :open="result !== 'sent'"><summary>{{ T.whatSent }}</summary><p class="m-err__sent">{{ feedback ? T.feedbackSent : T.whatSentLead }}</p><pre>{{ preview }}</pre></details>
    <template #actions>
      <MButton v-if="result && result !== 'sent'" variant="text" size="sm" icon="content_copy" @click="copy">{{ T.copy }}</MButton>
      <MButton v-if="result && result !== 'sent'" variant="text" size="sm" icon="download" @click="download">{{ T.download }}</MButton>
      <span class="m-err__spacer" />
      <MButton variant="text" :disabled="sending" @click="formOpen = false">{{ result === 'sent' ? T.close : T.cancel }}</MButton>
      <MButton v-if="result !== 'sent'" :icon="result === 'queued' && !sending ? 'refresh' : 'send'" :loading="sending" @click="send">{{ sending ? T.sending : result === 'queued' ? T.retry : T.send }}</MButton>
    </template>
  </MDialog>
</template>
