// The report sheet's report as the document of a user_report event (telemetry/report.js reportToEvent): the type the person picked is the category, an error brings its name, message, code, page and stack (summarised
// in the message), feedback without an error brings nothing but the words. Nothing public is created: the sheet sends the event to the host, which sends it to the developers' own server.
import { REPORT_TYPES, buildReport, reportToDocument } from '../telemetry/index.js'

/** The categories of the sheet's type choice, in the order the person sees them: 问题/崩溃, 功能建议, 体验改进, 其他. */
export const SHEET_TYPES = Object.freeze(['bug', 'suggestion', 'performance', 'other'])
/**
 * @returns the document for reportToEvent, or null while the title or the description is empty.
 * The run log is NOT part of this document or of the event the page sends: the host adds it. When it receives a `user_report` it uploads the anonymised log of the running host and puts the returned `log_ref` into the
 * event, whatever the error-report switch says (a `log_ref` named by the page is erased first); without a log (unreadable, the service refuses it) the report still goes, without `log_ref`.
 * The panel's line about the log (`logsText`) describes that path, and `查看将发送的内容` shows the page's last lines only as a sample of it.
 */
export function userReportDocument({ error = null, title = '', description = '', type = '', product = 'web', page = '', contact = '', attachment = '' } = {}) {
  const e = error ? { name: String(error.name || 'Error'), message: String(error.message || ''), stack: String(error.stack || '') } : { name: 'Feedback', message: '', stack: '' }
  const report = buildReport(e, { kind: error ? 'error' : 'manual', fatal: false, context: { product, page: error?.page || page || '', code: error?.code || '', category: error?.code ? 'ui' : '' } })
  return reportToDocument(report, { title, description, contact, attachment, type: REPORT_TYPES.includes(type) ? type : '' })
}
