<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import MIcon from '../MIcon.vue'
import MButton from '../MButton.vue'
import MSheet from '../MSheet.vue'
import MField from '../MField.vue'
import MSeg from '../MSeg.vue'
import MBanner from '../MBanner.vue'
import MLoading from '../MLoading.vue'
import DevShotMask from '../devmode/DevShotMask.vue'
import { devReport, devProviders, devReportReady, closeDevReport, setDevShot, removeDevShot, retakeDevShot } from '../devmode/devReport.js'
import { composeReport, reportZip } from '../../devmode/feedback.js'
import { addMine } from '../../devmode/mine.js'
import { devmodeTexts } from '../../devmode/texts.js'
import { userReportDocument } from '../../devmode/userReport.js'
import { referenceOf, reportIdOf, scrubText, submitReport, reportMessage } from '../../telemetry/index.js'
import { queuedReplyKey } from '../../telemetry/send.js'
import { newReplyKey, rememberReport } from '../../feedback/replies.js'
import { SHOT_LIMITS, SHOT_TYPES, bytesToBase64, canvasCodec, compressShot, sizeText } from '../../feedback/shotImage.js'
import { REPO_ISSUES_URL } from '../../telemetry/report.js'
import { feedbackTexts, fillText } from '../../feedback/texts.js'
import { FEEDBACK_TYPES, contextLine, feedbackPlan, layoutFor, phaseOf, titleOf } from '../../feedback/model.js'

// The ONE feedback panel. Every way in (the caption bar, the context menu, the error dialog, 帮助与关于, the tray, a recovered crash) opens it, and it has one way to send: directly and privately to the developers.
// It is a drawer from the right edge (the page stays in sight, scrollable, while the person writes) and a full-width panel from the bottom in a narrow window.
// A report always carries the run log (the host prepares it with the personal details removed): no switch for it, and pressing 发送 is the consent for this one send, whatever 问题自动上报 says.
// The screenshot is optional and a row of its own whenever the product can send one (it registers `shots`): the window capture taken when the panel opened (automatically covered), 重新截取 where the product can capture, and in every product a picture chosen, pasted or
// dropped (not covered automatically: the preview is where the person covers what they want). It is shown, can be previewed, covered and removed before anything is sent, and travels inside the report (base64, at most 700 KB), so offline it is kept with the report.
// The contact is optional, shown only in this report's one issue. Offline, the report is kept and sent by itself.
const props = defineProps({ locale: { type: String, default: 'zh' } })
const F = computed(() => feedbackTexts(props.locale))
const T = computed(() => devmodeTexts(props.locale))
const form = reactive({ type: 'other', text: '', contact: '' })
const maskOpen = ref(false)
const dropping = ref(false)
const fileInput = ref(null)
const phase = ref('edit') // edit | sending | done
const problem = ref('')
const touched = ref(false)
const previewOpen = ref(false)
const result = ref(null)
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
const width = ref(typeof innerWidth === 'number' ? innerWidth : 1280)
const onOnline = () => { online.value = true }
const onOffline = () => { online.value = false }
const onResize = () => { width.value = innerWidth }
onMounted(() => { addEventListener('online', onOnline); addEventListener('offline', onOffline); addEventListener('resize', onResize) })
onBeforeUnmount(() => { removeEventListener('online', onOnline); removeEventListener('offline', onOffline); removeEventListener('resize', onResize) })

const isError = computed(() => devReport.kind === 'error' && !!devReport.error)
const canShot = computed(() => devProviders().shots === true)
const canCapture = computed(() => typeof devProviders().capture === 'function')
const plan = computed(() => feedbackPlan({ offline: !online.value, hasShot: !!devReport.shot, canSendShot: canShot.value }))
const layout = computed(() => layoutFor(width.value))
const ctx = computed(() => contextLine({ page: devReport.context.page, element: devReport.context.element, error: isError.value ? devReport.error : null, texts: F.value }))
const typeOptions = computed(() => FEEDBACK_TYPES.map((value) => ({ value, label: F.value[{ bug: 'typeBug', suggestion: 'typeSuggestion', performance: 'typeImprove', other: 'typeOther' }[value]] })))
const productName = () => devProviders().product || (globalThis.isTauri ? 'panel' : 'web')
const pageToken = () => [devReport.context.page, devReport.context.place].filter(Boolean).join('-')
const doc = () => userReportDocument({ error: isError.value ? devReport.error : null, title: titleOf(form.text), description: form.text, type: form.type, product: productName(), page: pageToken(), contact: form.contact })
const needText = computed(() => touched.value && !form.text.trim())

watch(() => devReport.token, () => {
  form.type = isError.value ? 'bug' : 'other'; form.text = ''; form.contact = ''
  phase.value = 'edit'; problem.value = ''; touched.value = false; previewOpen.value = false; maskOpen.value = false; result.value = null
})
const shotUrl = ref('')
watch(() => devReport.shot, (bytes) => {
  if (shotUrl.value) URL.revokeObjectURL(shotUrl.value)
  shotUrl.value = bytes?.length ? URL.createObjectURL(new Blob([bytes], { type: 'image/png' })) : ''
  if (!bytes) maskOpen.value = false
}, { immediate: true })
onBeforeUnmount(() => { if (shotUrl.value) URL.revokeObjectURL(shotUrl.value) })
const limitText = () => sizeText(SHOT_LIMITS.sendBytes)
const shotHint = computed(() => fillText(F.value.shotHint, { size: limitText() }))
const shotNote = computed(() => (devReport.shotSource === 'window' ? (devReport.shotAuto.length ? fillText(F.value.shotAuto, { n: devReport.shotAuto.length }) : F.value.shotAutoNone) : F.value.shotOwn))
const shotMeta = computed(() => (devReport.shotSize ? `${devReport.shotSize.width}×${devReport.shotSize.height} · ${sizeText(devReport.shot?.length || 0)}` : ''))
const shotErrorText = computed(() => ({ type: F.value.shotErrType, input_too_large: fillText(F.value.shotErrInput, { size: sizeText(SHOT_LIMITS.inputBytes) }), unreadable: F.value.shotErrUnreadable }[devReport.shotError] || ''))
const problemText = computed(() => (problem.value === 'shotErrFit' ? fillText(F.value.shotErrFit, { size: limitText() }) : F.value[problem.value] || F.value.rejected))

// a picture from outside the window: chosen with the button, pasted (Ctrl+V / ⌘V) or dropped. Several files: the first picture counts.
const imageOf = (list) => Array.from(list || []).find((f) => SHOT_TYPES.includes(f.type) || /^image\//.test(f.type || '')) || Array.from(list || [])[0] || null
async function takeFile(file, source) {
  if (!file || phase.value === 'sending') return
  devReport.shotError = ''
  let bytes
  try { bytes = new Uint8Array(await file.arrayBuffer()) } catch { devReport.shotError = 'unreadable'; return }
  const done = await setDevShot(bytes, { source })
  if (done.ok) maskOpen.value = true
}
const pickFile = () => fileInput.value?.click()
function onPicked(e) { const f = e.target.files?.[0]; e.target.value = ''; void takeFile(f, 'file') }
function onPaste(e) {
  if (!canShot.value) return
  const files = Array.from(e.clipboardData?.files || []).filter((f) => /^image\//.test(f.type || ''))
  if (!files.length) return // text pastes as text
  e.preventDefault()
  void takeFile(files[0], 'paste')
}
const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
function onDragOver(e) { if (canShot.value && hasFiles(e)) { e.preventDefault(); dropping.value = true } }
function onDrop(e) { dropping.value = false; if (!canShot.value || !hasFiles(e)) return; e.preventDefault(); void takeFile(imageOf(e.dataTransfer.files), 'drop') }
async function recapture() { await retakeDevShot(); if (devReport.shot) maskOpen.value = false }
const previewLines = computed(() => scrubText(String(devReport.logs || '').split('\n').slice(-12).join('\n'), 1500))
const previewText = computed(() => { const d = doc(); return d ? reportMessage(d) : '' })

async function send() {
  touched.value = true
  if (!form.text.trim()) return
  const d = doc()
  if (!d) return
  phase.value = 'sending'; problem.value = ''
  // the picture goes inside the report: fitted to what the host and the server take (a picture that cannot be made small enough stops the send, with the reason, so nothing is dropped behind the person's back)
  if (plan.value.shotRow && devReport.shot) {
    const fit = await compressShot(devReport.shot, { codec: (devProviders().codec || canvasCodec)() })
    if (!fit.ok) { phase.value = 'edit'; problem.value = fit.reason === 'cannot_fit' ? 'shotErrFit' : 'shotErrUnreadable'; return }
    d.shot = bytesToBase64(fit.bytes)
  }
  const id = reportIdOf(d)
  // the address of the developers' answer (feedback/replies.js): made once for a report, so a second press of the same words (the first one timed out, or waits in the queue) keeps the key the first one carried;
  // a platform without a secure random source sends the report without one
  d.reply_key = queuedReplyKey(id) || (() => { try { return newReplyKey() } catch { return '' } })()
  if (!d.reply_key) delete d.reply_key
  const answer = await submitReport(d, { id, explicit: true })
  const next = phaseOf(answer)
  phase.value = next.phase
  problem.value = next.problem || ''
  if (next.phase === 'done') {
    const sentShot = !!d.shot
    result.value = { kind: next.kind, ref: referenceOf(id).toUpperCase(), shot: sentShot && !next.shotLost && (next.kind === 'queued' || next.shot === 'uploaded'), shotNotSent: sentShot && next.kind === 'sent' && next.shot !== 'uploaded', shotLost: !!next.shotLost, contact: !!d.contact }
    addMine({ id, title: titleOf(form.text), status: next.kind === 'sent' ? 'sent' : 'queued', ref: result.value.ref })
    // a report that was already sent says `again` without a request: its key was remembered the first time
    if (d.reply_key && !answer.again) rememberReport({ key: d.reply_key, title: titleOf(form.text), product: d.product })
    result.value.reply = !!d.reply_key && !!devProviders().replies
  }
}
async function saveZip() {
  // the log and the environment are collected after the sheet opens: the file waits for them, and only for this report (a sheet closed and opened again meanwhile is another report)
  const mine = devReport.token
  await devReportReady()
  if (!devReport.open || devReport.token !== mine) return
  const t = T.value
  const r = composeReport({ kind: 'feedback', repo: devReport.repo, title: titleOf(form.text) || F.value.title, description: form.text, contact: '', form: form.type === 'suggestion' ? 'feature' : 'bug', locale: props.locale, category: '', steps: '', error: devReport.error, env: devReport.env, logs: devReport.logs, screenshot: devReport.shot, shotRegions: { auto: devReport.shotAuto.length, manual: devReport.shotManual.length }, include: { shot: !!devReport.shot, logs: true, dump: false }, hostNames: devProviders().hostNames?.() || [], texts: { description: t.fContent, error: 'Error', environment: t.envTitle, logTail: t.aLogs, attached: t.attach, contact: t.fContact } })
  const zip = reportZip(r)
  Promise.resolve(devProviders().save?.(zip.name, zip.bytes, zip.mime)).catch(() => {})
  problem.value = ''
}
const openGithub = () => { const open = devProviders().openUrl; if (open) open(REPO_ISSUES_URL); else globalThis.open?.(REPO_ISSUES_URL, '_blank', 'noopener') }
const close = () => closeDevReport()
defineExpose({ send, form, doc, plan, layout, takeFile })
</script>

<template>
  <MSheet :model-value="devReport.open" :title="F.title" side="end" :close-label="F.close" :persistent="phase === 'sending'" class="fb-panel" :class="[`fb-panel--${layout}`, { 'fb-panel--hidden': devReport.hidden }]" @update:model-value="(v) => { if (!v) close() }">
    <div v-if="phase === 'done'" class="fb-done" data-fb="done">
      <span class="fb-done__ico" :class="{ 'fb-done__ico--wait': result.kind === 'queued' }"><MIcon :name="result.kind === 'queued' ? 'schedule' : 'check'" /></span>
      <h3>{{ result.kind === 'queued' ? F.queuedTitle : F.sentTitle }}</h3>
      <p class="fb-done__ref">{{ F.refLabel }} <b data-fb="ref">#{{ result.ref }}</b></p>
      <p class="fb-done__text">{{ result.kind === 'queued' ? F.queuedText : F.sentText }}</p>
      <p v-if="result.reply" class="fb-done__attached" data-fb="reply-note">{{ F.sentReply }}</p>
      <p class="fb-done__attached">{{ F.attached }}{{ [F.attachedText, F.attachedLogs, result.shot ? F.attachedShot : '', result.contact ? F.attachedContact : ''].filter(Boolean).join(' · ') }}</p>
      <p v-if="result.shotNotSent || result.shotLost" class="fb-done__attached" data-fb="shot-note">{{ result.shotLost ? F.shotLost : F.shotNotSent }}</p>
      <MButton variant="filled" @click="close">{{ F.done }}</MButton>
    </div>
    <div v-else class="fb-body" :class="{ 'fb-body--drop': dropping }" data-fb="panel" @paste="onPaste" @dragover="onDragOver" @dragleave.self="dropping = false" @drop="onDrop">
      <p class="fb-lead">{{ F.lead }}</p>
      <MBanner v-if="plan.banner === 'offline'" tone="warn" icon="cloud_off" data-fb="offline">{{ F.offline }}</MBanner>
      <div v-if="ctx" class="fb-ctx" data-fb="context"><MIcon name="touch_app" /><span>{{ ctx }}</span><small>{{ F.context }}</small></div>
      <MSeg v-model="form.type" size="sm" :label="F.typeLabel" :options="typeOptions" :disabled="phase === 'sending'" data-fb="type" />
      <MField v-model="form.text" type="textarea" :rows="4" :label="F.description" :supporting="isError ? `${F.descriptionHint}。${F.errorLead}` : F.descriptionHint" :error="needText ? F.descriptionRequired : ''" :disabled="phase === 'sending'" data-fb="text" />
      <section class="fb-attach">
        <h4>{{ F.attach }}</h4>
        <div class="fb-row" data-fb="logs">
          <span class="fb-thumb fb-thumb--ico"><MIcon name="description" /></span>
          <span class="fb-row__main"><b>{{ F.logsTitle }}</b><small>{{ F.logsText }}</small></span>
        </div>
        <div v-if="plan.shotRow" class="fb-shot" :data-state="plan.shot" data-fb="shot">
          <div class="fb-row" :class="{ 'fb-row--drop': dropping }">
            <button v-if="plan.shot === 'attached'" type="button" class="fb-thumb fb-thumb--shot" :aria-label="F.shotEdit" data-fb="shot-thumb" @click="maskOpen = !maskOpen"><img :src="shotUrl" :alt="F.shotAlt" /></button>
            <span v-else class="fb-thumb fb-thumb--ico"><MIcon name="image" /></span>
            <span class="fb-row__main">
              <b>{{ F.shotTitle }}</b>
              <small v-if="plan.shot === 'attached'" data-fb="shot-meta">{{ shotMeta }}</small>
              <small v-else>{{ dropping ? F.shotDropNow : canCapture ? F.shotPaste : F.shotDrop }}</small>
            </span>
            <span class="fb-row__actions">
              <MButton v-if="plan.shot === 'attached'" variant="text" size="sm" icon="delete" :disabled="phase === 'sending'" data-fb="shot-remove" @click="removeDevShot">{{ F.shotRemove }}</MButton>
              <MButton v-if="canCapture" variant="tonal" size="sm" icon="screenshot_monitor" :disabled="phase === 'sending'" data-fb="shot-capture" @click="recapture">{{ plan.shot === 'attached' ? F.shotRecapture : F.shotCapture }}</MButton>
              <MButton variant="tonal" size="sm" icon="image" :disabled="phase === 'sending'" data-fb="shot-pick" @click="pickFile">{{ F.shotAdd }}</MButton>
            </span>
          </div>
          <input ref="fileInput" type="file" class="fb-file" accept="image/png,image/jpeg,image/webp" tabindex="-1" aria-hidden="true" data-fb="shot-file" @change="onPicked" />
          <p v-if="shotErrorText" class="fb-shot__error" role="alert" data-fb="shot-error">{{ shotErrorText }}</p>
          <p class="fb-shot__note" data-fb="shot-note-line">{{ plan.shot === 'attached' ? shotNote : shotHint }}</p>
          <MButton v-if="plan.shot === 'attached'" variant="text" size="sm" :icon="maskOpen ? 'visibility_off' : 'visibility'" class="fb-previewbtn" data-fb="shot-edit" @click="maskOpen = !maskOpen">{{ maskOpen ? F.shotEditHide : F.shotEdit }}</MButton>
          <DevShotMask v-if="plan.shot === 'attached' && maskOpen" :locale="locale" />
        </div>
        <MButton variant="text" size="sm" :icon="previewOpen ? 'visibility_off' : 'visibility'" class="fb-previewbtn" data-fb="preview-toggle" @click="previewOpen = !previewOpen">{{ previewOpen ? F.previewHide : F.preview }}</MButton>
        <div v-if="previewOpen" class="fb-preview" data-fb="preview">
          <h5>{{ F.previewText }}</h5>
          <pre>{{ previewText || '—' }}</pre>
          <template v-if="pageToken()"><h5>{{ F.previewPage }}</h5><pre>{{ pageToken() }}</pre></template>
          <template v-if="form.contact.trim()"><h5>{{ F.previewContact }}</h5><pre>{{ form.contact.trim() }}</pre></template>
          <h5>{{ F.previewLogs }}</h5>
          <p class="fb-preview__note">{{ F.previewLogsNote }}</p>
          <MLoading v-if="devReport.loading" size="24px" data-fb="preview-loading" />
          <pre v-else>{{ previewLines || F.previewNone }}</pre>
        </div>
      </section>
      <MField v-model="form.contact" :label="F.contact" :supporting="F.contactHint" :disabled="phase === 'sending'" data-fb="contact" />
      <MBanner v-if="problem" tone="warn" icon="error" data-fb="problem">
        {{ problemText }}
      </MBanner>
      <div class="fb-links">
        <MButton variant="text" size="sm" icon="download" data-fb="zip" :title="F.saveZipHint" @click="saveZip">{{ F.saveZip }}</MButton>
        <MButton variant="text" size="sm" icon="open_in_new" data-fb="github" @click="openGithub">{{ F.github }}</MButton>
      </div>
    </div>
    <template v-if="phase !== 'done'" #actions>
      <MButton variant="text" :disabled="phase === 'sending'" @click="close">{{ F.cancel }}</MButton>
      <MButton :icon="plan.sendMode === 'queue' ? 'schedule' : 'send'" :loading="phase === 'sending'" data-fb="send" @click="send">{{ phase === 'sending' ? F.sending : plan.sendMode === 'queue' ? F.sendQueue : F.send }}</MButton>
    </template>
  </MSheet>
</template>

<style>
/* the drawer: a sheet from the right edge. The product's side sheets are centred dialogs (expressive.css `.m-sheet--end { margin: auto }`); the feedback panel keeps the page in sight and in reach, so it sits at the edge */
.m-sheet.fb-panel--drawer { margin: 0 0 0 auto; width: min(460px, 100vw); height: 100dvh; max-height: none; }
.m-sheet.fb-panel--drawer .m-sheet__panel { height: 100%; max-height: none; border-radius: 28px 0 0 28px; animation: m-sheet-end var(--m-spring-default-spatial-duration) var(--m-spring-default-spatial) both; }
.m-sheet.fb-panel--drawer .m-sheet__body { flex: 1; min-height: 0; overflow: auto; }
/* a narrow window: full width from the bottom */
.m-sheet.fb-panel--bottom { margin: auto 0 0; width: 100%; height: fit-content; max-height: 90dvh; }
.m-sheet.fb-panel--bottom .m-sheet__panel { height: auto; max-height: 90dvh; border-radius: 28px 28px 0 0; animation: m-sheet-bottom var(--m-spring-default-spatial-duration) var(--m-spring-default-spatial) both; }
.m-sheet.fb-panel--bottom .m-sheet__body { overflow: auto; }
.fb-body { display: flex; flex-direction: column; gap: 14px; }
.fb-lead { margin: 0; font: var(--m-body-medium); color: var(--md-sys-color-on-surface-variant); }
.fb-ctx { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px 0 10px; width: fit-content; max-width: 100%; border-radius: 18px; background: var(--md-sys-color-surface-container-high); font: var(--m-label-large); }
.fb-ctx .m-icon { font-size: 18px; width: 18px; height: 18px; color: var(--md-sys-color-primary-text); flex: none; }
.fb-ctx span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fb-ctx small { font: var(--m-label-small); color: var(--md-sys-color-on-surface-variant); margin-left: 4px; flex: none; }
.fb-attach { display: flex; flex-direction: column; gap: 6px; }
.fb-attach h4 { margin: 4px 0 2px; font: var(--m-title-small); color: var(--md-sys-color-on-surface-variant); }
.fb-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 10px; border-radius: 20px; background: var(--m-card); }
.fb-thumb { width: 64px; height: 44px; border-radius: 12px; overflow: hidden; flex: none; display: grid; place-items: center; background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant); }
.fb-thumb img { width: 100%; height: 100%; object-fit: cover; object-position: top left; display: block; }
.fb-thumb--ico { width: 44px; border-radius: 22px; }
.fb-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fb-row__main b { font: var(--m-title-small); }
.fb-row__main small { font: var(--m-body-small); color: var(--md-sys-color-on-surface-variant); }
.fb-previewbtn { align-self: flex-start; }
.fb-shot { display: flex; flex-direction: column; gap: 6px; }
.fb-shot .fb-row { flex-wrap: wrap; row-gap: 8px; }
.fb-row--drop { outline: 2px dashed var(--md-sys-color-primary); outline-offset: -2px; }
.fb-row__actions { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; margin-left: auto; }
.fb-thumb--shot { border: 0; padding: 0; cursor: pointer; }
.fb-shot__note, .fb-shot__error { margin: 0 4px; font: var(--m-body-small); color: var(--md-sys-color-on-surface-variant); }
.fb-shot__error { color: var(--md-sys-color-error); }
.fb-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.m-sheet.fb-panel--hidden { visibility: hidden; }
.m-sheet.fb-panel--hidden .m-sheet__panel { animation: none; }
.fb-preview { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 20px; background: var(--m-card); }
.fb-preview h5 { margin: 6px 0 0; font: var(--m-label-large); color: var(--md-sys-color-on-surface-variant); }
.fb-preview pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: var(--m-body-small); font-family: var(--m-font-mono); }
.fb-preview__note { margin: 0; font: var(--m-body-small); color: var(--md-sys-color-on-surface-variant); }
.fb-links { display: flex; flex-wrap: wrap; gap: 4px 8px; }
.fb-links .m-btn { color: var(--md-sys-color-on-surface-variant); }
.fb-done { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 12px 8px; text-align: center; }
.fb-done__ico { width: 64px; height: 64px; border-radius: 32px; display: grid; place-items: center; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
.fb-done__ico--wait { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.fb-done__ico .m-icon { font-size: 32px; width: 32px; height: 32px; }
.fb-done h3 { margin: 6px 0 0; font: var(--m-headline-small); }
.fb-done__ref { margin: 0; font: var(--m-body-large); }
.fb-done__ref b { font-family: var(--m-font-mono); }
.fb-done__text, .fb-done__attached { margin: 0; max-width: 38ch; text-wrap: balance; font: var(--m-body-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
