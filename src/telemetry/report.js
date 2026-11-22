// The error report: what an uncaught error becomes, what the person copies, downloads or sends, and the event that goes to the developers' server.
// Pure and framework-free. Everything is scrubbed (scrub.js) and cut to the limits of the report.
import { scrubStack, scrubText } from './scrub.js'
import { REPLY_KEY } from '../feedback/replies.js'
import { describeError } from './describe.js'

export { describeError }

export const REPORT_SCHEMA = 1
export const REPORT_KINDS = Object.freeze(['error', 'unhandledrejection', 'vue', 'api', 'manual', 'hoststop'])
export const PRODUCTS = Object.freeze(['panel', 'web'])
export const REPORT_LIMITS = Object.freeze({ title: 120, description: 4000, message: 1000, stack: 8000, logs: 6000, page: 120, version: 64, os: 80, locale: 20, clientTime: 40, name: 80, category: 24, code: 40, issue: 40, breadcrumbs: 6000, components: 300, key: 60 })
export const REPO_ISSUES_URL = 'https://github.com/AlkaidLab/foundation-sunshine/issues/new'

/** The report of one error. `context`: { product, version, os, page, locale, logs, now } from the product. */
export function buildReport(error, { kind = 'error', fatal = true, context = {} } = {}) {
  const d = describeError(error)
  const L = REPORT_LIMITS
  return {
    schema: REPORT_SCHEMA,
    kind: REPORT_KINDS.includes(kind) ? kind : 'error',
    fatal: !!fatal,
    name: scrubText(d.name, L.name),
    message: scrubText(d.message, L.message),
    stack: scrubStack(d.stack, L.stack),
    product: PRODUCTS.includes(context.product) ? context.product : 'web',
    version: scrubText(context.version || '', L.version),
    os: scrubText(context.os || '', L.os),
    page: scrubText(context.page || '', L.page),
    locale: scrubText(context.locale || '', L.locale),
    logs: scrubText(context.logs || '', L.logs),
    category: scrubText(context.category || '', L.category),
    code: scrubText(context.code || '', L.code),
    classKind: ['EXPECTED-ENV', 'KNOWN-ENV', 'UNEXPECTED'].includes(context.errorKind) ? context.errorKind : '',
    breadcrumbs: scrubText(context.breadcrumbs || '', L.breadcrumbs),
    components: scrubText(context.components || '', L.components),
    keys: Object.fromEntries(['encoder', 'gpu_vendor', 'capture_backend'].filter((k) => context.keys && context.keys[k]).map((k) => [k, scrubText(String(context.keys[k]), L.key)])),
    time: new Date(context.now ?? Date.now()).toISOString(),
  }
}

/** The same error twice in a short time is one error. */
export const signatureOf = (report) => `${report.kind}|${report.name}|${report.message.slice(0, 120)}|${(report.stack.split('\n')[0] || '').slice(0, 120)}`

/** The text of a report for the clipboard. */
export function reportToText(report, extra = {}) {
  const lines = [
    `${extra.title ? `${scrubText(extra.title, REPORT_LIMITS.title)}\n\n` : ''}${report.name}: ${report.message}`,
    '',
    `Foundation Sunshine ${report.version || '?'} (${report.product}) · ${report.os || '?'} · ${report.locale || '?'}`,
    `Page: ${report.page || '?'} · ${report.time} · ${report.kind}${report.fatal ? '' : ' (not blocking)'}`,
  ]
  if (extra.description) lines.push('', scrubText(extra.description, REPORT_LIMITS.description))
  if (report.stack) lines.push('', 'Stack:', report.stack)
  if (report.logs) lines.push('', 'Recent log lines:', report.logs)
  if (report.breadcrumbs) lines.push('', 'Recent events:', report.breadcrumbs)
  return lines.join('\n')
}

/** The file of a report for the download: the same content as JSON. */
export function reportToFile(report, extra = {}) {
  const stamp = report.time.replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-')
  const body = { ...report, ...(extra.title ? { title: scrubText(extra.title, REPORT_LIMITS.title) } : {}), ...(extra.description ? { description: scrubText(extra.description, REPORT_LIMITS.description) } : {}) }
  return { name: `foundation-sunshine-error-${stamp}.json`, mime: 'application/json', text: JSON.stringify(body, null, 2) }
}

/** Why a report cannot be sent yet: the title and the description are required. */
export function reportProblems({ title = '', description = '' } = {}) {
  const out = []
  if (!String(title).trim()) out.push('title')
  if (!String(description).trim()) out.push('description')
  return out
}

/** The contact line of a report: one line, trimmed, at most CONTACT_MAX characters, no control characters. */
export const CONTACT_MAX = 200
export const cleanContact = (value) => String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CONTACT_MAX)

/** The categories a user report can have (the contract's): what the form's type maps to. */
export const REPORT_TYPES = Object.freeze(['bug', 'performance', 'compat', 'suggestion', 'other'])
/** The category of a report: the type the person chose when the form has one, else a bug for an error the product met and `other` for feedback written without an error. */
export const reportTypeOf = (report, type = '') => (REPORT_TYPES.includes(type) ? type : report.kind === 'manual' ? 'other' : 'bug')
/** The reference of an uploaded attachment (the one the developer panel returns); anything else is not a reference. */
export const ATTACHMENT_REF = /^att-\d{4}-\d{2}\/[0-9a-f]{64}\.[a-z0-9]{1,8}$/

/** The document of a report (plain values), or null while the title or the description is empty. Exactly these fields, nothing else; no contact line: the contract has none on purpose. */
export function reportToDocument(report, { title = '', description = '', issue = '', type = '', attachment = '', contact = '' } = {}) {
  if (reportProblems({ title, description }).length) return null
  const L = REPORT_LIMITS
  const doc = {
    schema: REPORT_SCHEMA,
    title: scrubText(title, L.title).trim(),
    description: scrubText(description, L.description).trim(),
    kind: report.kind,
    fatal: !!report.fatal,
    message: report.message,
    product: report.product,
    app_version: report.version,
    client_time: report.time,
  }
  if (!doc.title || !doc.description) return null
  if (report.name) doc.name = report.name
  if (report.stack) doc.stack = report.stack
  if (report.os) doc.os = report.os
  if (report.page) doc.page = report.page
  if (report.locale) doc.locale = report.locale
  if (report.logs) doc.logs = report.logs
  if (report.category) doc.category = report.category
  if (report.code) doc.code = report.code
  if (report.breadcrumbs) doc.breadcrumbs = report.breadcrumbs
  if (report.components) doc.components = report.components
  for (const [k, v] of Object.entries(report.keys || {})) doc[k] = v
  // the fingerprint of the automatic report of the same error, when there is one: the manual report joins that issue
  if (/^[0-9a-f]{32}$/.test(String(issue || ''))) doc.issue = issue
  doc.report_type = reportTypeOf(report, type)
  if (ATTACHMENT_REF.test(String(attachment || ''))) doc.attachment = attachment
  // the contact the person chose to leave: only the developers read it, in the one issue of this report; it is not scrubbed (an address the person gave is what it is for) and never leaves the one event
  const reach = cleanContact(contact)
  if (reach) doc.contact = reach
  return doc
}

/** The names of the fields of a document (what the form builds; the event that is sent carries the part the contract has room for, reportToEvent). */
export const DOCUMENT_FIELDS = Object.freeze(['schema', 'title', 'description', 'kind', 'fatal', 'message', 'product', 'app_version', 'client_time', 'name', 'stack', 'os', 'page', 'locale', 'logs', 'category', 'code', 'contact', 'issue', 'breadcrumbs', 'components', 'encoder', 'gpu_vendor', 'capture_backend', 'report_type', 'attachment'])
export const DOCUMENT_REQUIRED = Object.freeze(['schema', 'title', 'description', 'kind', 'fatal', 'message', 'product', 'app_version', 'client_time'])

const token = (value, max) => String(value || '').toLowerCase().replace(/[^a-z0-9._:+-]+/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, max).replace(/-+$/, '')
const lines = (text, count, width, last = false) => { const all = String(text || '').split('\n').map((l) => l.trim().slice(0, width)).filter(Boolean); return (last ? all.slice(-count) : all.slice(0, count)).join('\n') }
export const USER_REPORT_MESSAGE_MAX = 2000

/**
 * The message of a user report: what the person wrote (title, description) first, then a short summary of the error (its name and message, the top frames of the stack, the last events), all within 2000 characters;
 * the full stack and the log lines stay in the copy, the download and the GitHub issue.
 */
export function reportMessage(doc) {
  const description = String(doc.description || '').slice(0, 1200)
  // the title of a report written without an error is the first line of what the person wrote: it is not said twice
  const first = description.split('\n').map((l) => l.trim()).find(Boolean) || ''
  const stem = String(doc.title || '').replace(/…$/, '')
  const same = !!stem && (first === doc.title || first.startsWith(stem))
  const written = (same ? [description] : [doc.title, description]).filter(Boolean).join('\n\n')
  // feedback with no error has nothing to say about one ("Error: Feedback" was a placeholder)
  const error = doc.kind === 'manual' && !doc.message ? '' : [doc.name, doc.message].filter(Boolean).join(': ').slice(0, 300)
  const stack = lines(doc.stack, 6, 120)
  const events = lines(doc.breadcrumbs, 5, 100, true)
  const parts = [written, error && `Error: ${error}`, stack && `Stack:\n${stack}`, events && `Recent events:\n${events}`].filter(Boolean)
  return scrubText(parts.join('\n\n'), USER_REPORT_MESSAGE_MAX)
}

/** The most characters of the base64 text of a screenshot that travels in the event (700 KB of picture, a little room for the padding). */
export const SHOT_BASE64_MAX = 960_000
/** A screenshot as it is carried in a document: base64 of a picture, at most SHOT_BASE64_MAX characters. */
export const isShotData = (v) => typeof v === 'string' && v.length >= 16 && v.length <= SHOT_BASE64_MAX && /^[A-Za-z0-9+/]+={0,2}$/.test(v)

/**
 * The event a report written by the person becomes: kind `error`, name `user_report` (telemetry-v1-spec, "Worker additions"): the category (bug | performance | compat | suggestion | other), the component (the product),
 * the page, the error code, the reference of an uploaded attachment, the screenshot when the person attached one (`shot`, base64), the contact when the person left one, and the message above. This is what the form shows as "what is sent".
 */
export function reportToEvent(doc) {
  const props = { category: REPORT_TYPES.includes(doc.report_type) ? doc.report_type : 'other', component: token(doc.product, 32) || 'web' }
  const page = token(doc.page, 48)
  if (page) props.page = page
  const code = String(doc.category && doc.code ? `${doc.category}.${doc.code}` : doc.code || '').replace(/[^A-Za-z0-9_.:+-]+/g, '-').slice(0, 64)
  if (code) props.error_code = code
  if (ATTACHMENT_REF.test(String(doc.attachment || ''))) props.attachment = doc.attachment
  // the screenshot (shotImage.js, at most 700 KB, base64): the host uploads it to the developers' server like the run log and puts the reference it gets into the event; the page never names a reference itself
  if (isShotData(doc.shot)) props.shot = doc.shot
  const contact = cleanContact(doc.contact)
  if (contact) props.contact = contact
  // the address of the developers' answer (feedback/replies.js): random, made by the sheet, kept on this computer; the host passes it on and the server writes it only into the issue of this report
  if (REPLY_KEY.test(String(doc.reply_key || ''))) props.reply_key = doc.reply_key
  props.message = reportMessage(doc)
  return { kind: 'error', name: 'user_report', props }
}

/** A GitHub issue with the title and the text filled in (the way out when the report cannot be sent). */
export function issueUrl(report, { title = '', description = '' } = {}) {
  const body = scrubText(reportToText(report, { description }), 5000)
  const url = new URL(REPO_ISSUES_URL)
  url.searchParams.set('title', scrubText(title || `${report.name}: ${report.message}`, REPORT_LIMITS.title))
  url.searchParams.set('body', body.length > 4500 ? `${body.slice(0, 4499)}…` : body)
  return url.href
}
