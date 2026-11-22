// The detail of an automatic error report as the `error_report` event of the contract (docs/privacy_telemetry.md in the host): the stack as `function@file:line:column` (the real name of the file, which the build id
// maps to its source map), the place of the error, the last actions (actions.js) and the fingerprint. Free text never enters: the message of the error stays on this computer.
import { actions } from './actions.js'
import { catalogueId } from './events.js'

export const ERROR_EVENT = Object.freeze({ frames: 32, crumbs: 50 })
const FRAME = /^[A-Za-z0-9_./:+<>~$@!-]{1,120}$/
const V8 = /^\s*at\s+(?:async\s+)?(?:(.*?)\s+\()?(\S+?):(\d+):(\d+)\)?\s*$/
const GECKO = /^\s*(.*?)@(\S+?):(\d+):(\d+)\s*$/

const fileName = (url) => String(url || '').replace(/[?#].*$/, '').split('/').pop().slice(0, 60)
const fnWord = (fn) => String(fn || '').replace(/^(?:async|new)\s+/, '').replace(/\[as [^\]]*\]/g, '').replace(/[^\w$.<>-]+/g, '').slice(0, 40) || 'anon'

/** The frames of a stack that fit the contract: `fn@file:line:column`, at most 32. */
export function stackFrames(stack, max = ERROR_EVENT.frames) {
  const out = []
  for (const line of String(stack || '').split('\n')) {
    const m = V8.exec(line) || GECKO.exec(line)
    if (!m) continue
    const frame = `${fnWord(m[1])}@${fileName(m[2])}:${m[3]}:${m[4]}`
    if (FRAME.test(frame)) out.push(frame)
    if (out.length >= max) break
  }
  return out
}

const codeOf = (doc) => String(`${doc.category || 'ui'}.${doc.code || 'error'}`).replace(/[^A-Za-z0-9_.:+-]+/g, '-').slice(0, 64) || 'unknown'

/** The props of an `error_report`: the first occurrence has the stack and the actions; `count` > 1 and no stack is the count of later ones. */
export function errorReportProps(doc, { count = 1, withDetail = true, ring = actions, now = Date.now() } = {}) {
  const props = { component: catalogueId(doc.product || 'web', 32) || 'web', lang: 'js', fingerprint: String(doc.fingerprint || '').slice(0, 64), code: codeOf(doc), severity: 'error', count: Math.max(1, Math.floor(count)) }
  const release = catalogueId(doc.release || '', 40)
  if (release) props.build = release
  const page = catalogueId(doc.page || '', 48)
  if (page) props.page = page
  if (withDetail) {
    const frames = stackFrames(doc.stack)
    if (frames.length) { props.frames = frames; props.loc = frames[0].split('@').pop() }
    const crumbs = ring.snapshot(now).slice(-ERROR_EVENT.crumbs)
    if (crumbs.length) props.crumbs = crumbs
  }
  return props
}
export const errorReportEvent = (doc, options) => ({ kind: 'error', name: 'error_report', props: errorReportProps(doc, options) })
