import { reactive } from 'vue'
import { mergeRects } from '../../devmode/shot.js'
import { collectAllRects } from '../../devmode/frameRects.js'
import { withCarriedLogs } from '../../devmode/feedback.js'
import { maskCapture, paintMasks } from '../../devmode/shotCanvas.js'
import { SHOT_LIMITS, canvasCodec, checkShotFile, compressShot } from '../../feedback/shotImage.js'

// The state of the report and sign-in sheets of the developer-mode flows. The product registers what only it can give (the screenshot, the log text, the environment, saving a file, opening an address),
// anything can open the sheets (the error dialog, the Issue page, the context menu), and one DevReportHost mounted at the root draws them.
//   The screenshot is redacted before the sheet exists: the marked boxes (data-redact) are measured around the capture and painted over (shot.js, shotCanvas.js); `shotBase` is that automatic result and the original is never kept.
//   The person adds boxes by hand on top of shotBase (`shotManual`); `shot` is always the exact image that will be sent. An automatic box cannot be removed.
//   providers: { mask(png, cssRects, view) and paint(png, rects) replace the canvas work (tests); codec() replaces the picture codec (tests); capture() -> Uint8Array | null (PNG), logs() -> string, env() -> string, hostNames() -> string[], save(name, bytes, mime), openUrl(url), anon(report) -> 'sent' | 'queued' | 'rejected' | 'limited',
//     replies: true when the product shows the developers' answers (useFeedbackReplies) and its host passes the report's reply key on: the panel then tells the person where an answer will show,
//     shots: true when the host takes a screenshot with a feedback report (the feedback panel then has its screenshot row: the window capture where capture() exists, a picture chosen, pasted or dropped everywhere) }
const providers = {}
export const devReport = reactive({ open: false, kind: 'feedback', error: null, context: { page: '', place: '', element: '' }, decision: '', repo: '', shot: null, shotBase: null, shotAuto: [], shotManual: [], shotSize: null, shotFailed: false, shotMaskFailed: false, shotSource: '', shotError: '', hidden: false, logs: '', env: '', loading: false, signIn: false, token: 0, draft: { title: '', description: '' } })
export const registerDevReport = (next = {}) => { Object.assign(providers, next) }
export const devProviders = () => providers

async function safe(fn, fallback) { try { return (await fn?.()) ?? fallback } catch { return fallback } }

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())
/** The time one step of opening the sheet took, as a User Timing measure `dev-report:<step>` (the console and a trace of the window show where the time went). */
function span(step, start) { try { globalThis.performance?.measure?.(`dev-report:${step}`, { start, end: now() }) } catch { /* no timing */ } }

/**
 * The capture of the window and its automatic redaction: -> { shot: { bytes, regions, width, height } | null, maskFailed } (the boxes are measured when the capture starts and again when it is back; both count).
 * The first measure is taken synchronously at the start (only the frames that cannot be read are waited for), so it runs beside the capture and not before it. `onCaptured` is called when the capture is back,
 * before the picture is redacted: the log and the environment are collected while the redaction runs. The unredacted picture stays in this function.
 */
async function takeWindowShot(onCaptured) {
  const view = () => ({ width: globalThis.innerWidth || 0, height: globalThis.innerHeight || 0, dpr: globalThis.devicePixelRatio || 1 })
  const boxes = async () => (typeof document === 'undefined' ? [] : (providers.collect || collectAllRects)(document, view()))
  const t0 = now()
  const [before, raw] = await Promise.all([boxes(), safe(providers.capture, null)])
  span('capture', t0)
  try { onCaptured?.() } catch { /* the context is optional */ }
  const t1 = now()
  const rects = mergeRects([...before, ...(await boxes())])
  span('boxes', t1)
  const t2 = now()
  const shot = raw && raw.length ? await (providers.mask || maskCapture)(raw, rects, view()) : null
  span('mask', t2)
  return { shot, maskFailed: !!(raw && raw.length && !shot) }
}

// The log and the environment are collected after the window is captured and are not waited for: the sheet opens as soon as the redacted picture is there, the preview and the zip use them when they are in.
// A provider that never answers must not keep the preview loading or the zip waiting for ever: after CONTEXT_WAIT_MS the report goes on with what it has, and a late answer is still taken when it comes.
export const CONTEXT_WAIT_MS = 8000
let contextToken = 0
let contextLoading = Promise.resolve()
function loadContext(carriedLogs, carriedLabel) {
  const mine = (contextToken += 1)
  const started = now()
  devReport.logs = withCarriedLogs('', carriedLogs, carriedLabel)
  devReport.env = ''
  devReport.loading = true
  let timer
  const give = new Promise((resolve) => { timer = setTimeout(resolve, CONTEXT_WAIT_MS); timer?.unref?.() }).then(() => { if (mine === contextToken) devReport.loading = false })
  const work = Promise.all([safe(providers.logs, ''), safe(providers.env, '')]).then(([logs, env]) => {
    clearTimeout(timer)
    if (mine !== contextToken) return
    // the log of the window as it is now, and the lines the error report carried from the time of the error
    devReport.logs = withCarriedLogs(logs, carriedLogs, carriedLabel)
    devReport.env = env
    devReport.loading = false
    span('context', started)
  })
  contextLoading = Promise.race([work, give])
}
/** Resolves when the log and the environment of the open report are in (the zip waits for it; the preview shows them when they arrive). */
export const devReportReady = () => contextLoading

let opening = false
/**
 * Opens the report. The screenshot is taken and redacted now, before the sheet is drawn, so it shows the window as it was when it failed and nothing of the sheet is in it; the log and the environment
 * are collected beside the redaction and the sheet does not wait for them (devReportReady()). A second press while the first is on its way does nothing.
 */
export async function openDevReport({ kind = 'feedback', error = null, repo = '', draft = null, carriedLogs = '', carriedLabel = '', context = null } = {}) {
  if (devReport.open || opening) return
  opening = true
  try {
    await openNow({ kind, error, repo, draft, carriedLogs, carriedLabel, context })
  } finally { opening = false }
}
async function openNow({ kind, error, repo, draft, carriedLogs, carriedLabel, context }) {
  const opened = now()
  devReport.kind = kind
  devReport.error = error
  devReport.repo = repo
  // where the report was opened from: the page (a static name the product gives), the id of what was under the pointer and its short text (the text only shows in the panel; it is not sent)
  devReport.context = { page: String(context?.page || ''), place: String(context?.place || ''), element: String(context?.element || '') }
  devReport.draft = { title: String(draft?.title || ''), description: String(draft?.description || '') }
  let contextStarted = false
  const startContext = () => { if (!contextStarted) { contextStarted = true; loadContext(carriedLogs, carriedLabel) } }
  let taken
  try { taken = await takeWindowShot(startContext) } finally { startContext() }
  devReport.shotBase = taken.shot ? taken.shot.bytes : null
  devReport.shot = taken.shot ? taken.shot.bytes : null
  devReport.shotAuto = taken.shot ? taken.shot.regions : []
  devReport.shotManual = []
  devReport.shotSize = taken.shot ? { width: taken.shot.width, height: taken.shot.height } : null
  devReport.shotMaskFailed = taken.maskFailed
  devReport.shotFailed = !devReport.shot
  devReport.shotSource = taken.shot ? 'window' : ''
  devReport.shotError = ''
  devReport.token += 1
  devReport.open = true
  span('open', opened)
}
/** 反馈此处的问题 of the context menu: the panel with where it was opened from. `page` is the static name of the page the product gives; `text` (what was under the pointer) only shows in the panel and is not sent. */
export const openFeedbackHere = ({ page = '', place = '', text = '' } = {}) => openDevReport({ kind: 'feedback', context: { page: page || currentPageName(), place, element: text } })
/** The name of the page the person is on: the title of the page in the window (the same static words the page shows), or '' when there is none. */
export const currentPageName = () => { try { return String(globalThis.document?.querySelector('.m-page__title')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) } catch { return '' } }
export const closeDevReport = () => { devReport.open = false }
/** A short decision in a centred dialog before the panel (the crash that was just recovered): `ask` is its kind, the panel opens after the person chose 发送反馈. */
export const askDevReport = (ask = 'crash', context = null) => { devReport.decision = ask; devReport.context = { page: String(context?.page || ''), place: String(context?.place || ''), element: String(context?.element || '') } }
export const clearDevReportAsk = () => { devReport.decision = '' }

let paintToken = 0
const paintFrame = () => new Promise((resolve) => { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60))); else setTimeout(resolve, 0) })
const clearShot = () => { devReport.shot = null; devReport.shotBase = null; devReport.shotAuto = []; devReport.shotManual = []; devReport.shotSize = null; devReport.shotFailed = true; devReport.shotMaskFailed = false; devReport.shotSource = '' }

/**
 * A picture the person chose, pasted or dropped (never the window itself: that is the capture). Only PNG, JPEG and WebP up to SHOT_LIMITS.inputBytes; it is scaled to the long side the report keeps and written again as
 * PNG with the metadata gone (the same canvas pass the hand-drawn boxes use), so the preview, the boxes and the bytes that go out are one picture. Nothing about it is covered automatically (it comes from outside the window).
 * -> { ok: true } or { ok: false, reason: 'type' | 'input_too_large' | 'unreadable' } (also kept in `devReport.shotError`, which the panel shows).
 */
export async function setDevShot(bytes, { source = 'file' } = {}) {
  const found = checkShotFile(bytes, SHOT_LIMITS)
  const fail = (reason) => { devReport.shotError = reason; return { ok: false, reason } }
  if (!found.ok) return fail(found.reason === 'empty' ? 'unreadable' : found.reason)
  const size = await compressShot(bytes, { codec: (providers.codec || canvasCodec)(), maxBytes: Infinity, formats: ['image/png'] })
  if (!size.ok) return fail('unreadable')
  const clean = await (providers.paint || paintMasks)(size.bytes, [])
  if (!clean) return fail('unreadable')
  paintToken += 1
  devReport.shotBase = clean.bytes
  devReport.shot = clean.bytes
  devReport.shotAuto = []
  devReport.shotManual = []
  devReport.shotSize = { width: clean.width, height: clean.height }
  devReport.shotFailed = false
  devReport.shotMaskFailed = false
  devReport.shotSource = source
  devReport.shotError = ''
  return { ok: true }
}
/** 移除: the person does not want a screenshot (or wants to take another). */
export function removeDevShot() { paintToken += 1; clearShot(); devReport.shotError = '' }
/** 重新截取窗口: the sheet is hidden for the capture (it would be in the picture otherwise), then the window is taken and redacted again. Only where the product has a capture. */
export async function retakeDevShot() {
  if (typeof providers.capture !== 'function' || !devReport.open) return { ok: false }
  devReport.hidden = true
  try {
    await paintFrame()
    const taken = await takeWindowShot()
    if (!taken.shot) { devReport.shotError = 'unreadable'; devReport.shotMaskFailed = taken.maskFailed; return { ok: false } }
    paintToken += 1
    devReport.shotBase = taken.shot.bytes; devReport.shot = taken.shot.bytes; devReport.shotAuto = taken.shot.regions; devReport.shotManual = []
    devReport.shotSize = { width: taken.shot.width, height: taken.shot.height }
    devReport.shotFailed = false; devReport.shotMaskFailed = false; devReport.shotSource = 'window'; devReport.shotError = ''
    return { ok: true }
  } finally { devReport.hidden = false }
}

// the hand-drawn boxes: always painted on shotBase, so the automatic ones stay whatever is done here
async function repaint() {
  const token = (paintToken += 1)
  const done = devReport.shotManual.length ? await (providers.paint || paintMasks)(devReport.shotBase, devReport.shotManual) : { bytes: devReport.shotBase }
  if (token !== paintToken) return
  if (done) devReport.shot = done.bytes
  else { devReport.shot = null; devReport.shotMaskFailed = true }
}
export async function addManualMask(rect) {
  const size = devReport.shotSize
  if (!size || !devReport.shotBase) return
  const x = Math.max(0, Math.round(rect.x)), y = Math.max(0, Math.round(rect.y))
  const w = Math.min(size.width - x, Math.round(rect.w)), h = Math.min(size.height - y, Math.round(rect.h))
  if (w < 4 || h < 4) return
  devReport.shotManual = [...devReport.shotManual, { x, y, w, h, kind: 'manual' }]
  await repaint()
}
export async function undoManualMask() { if (!devReport.shotManual.length) return; devReport.shotManual = devReport.shotManual.slice(0, -1); await repaint() }
export async function clearManualMasks() { if (!devReport.shotManual.length) return; devReport.shotManual = []; await repaint() }
export const openDevSignIn = () => { devReport.signIn = true }
export const closeDevSignIn = () => { devReport.signIn = false }
