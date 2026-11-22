import { reactive } from 'vue'
import { onReportSent, wasSent } from '../telemetry/send.js'

// What the person sent through the feedback flows, kept in this window's storage (a list of the last 30): published (an issue number), saved (the zip is on this computer), queued (no network), sent.
// `ref` is the reference the panel showed (the first 8 characters of the report id). `mineState.v` changes whenever the list does, so a computed that reads it follows the storage; the automatic flush that sends a
// queued report later changes it too (onReportSent), and `listMine` reports such a record as sent.
export const MINE_KEY = 'foundation-ui.devmode.mine'
export const mineState = reactive({ v: 0 })
const store = () => { try { return globalThis.localStorage } catch { return null } }
export function listMine(storage = store()) {
  void mineState.v
  let rows = []
  try { const v = JSON.parse(storage?.getItem(MINE_KEY) || '[]'); rows = Array.isArray(v) ? v : [] } catch { rows = [] }
  // the record says queued, the report has gone out since: it is sent. A record from before `ref` existed has none (the id is the document id of a report: its first 8 characters are the reference)
  return rows.map((r) => ({ ...r, status: r.status === 'queued' && wasSent(r.id, storage) ? 'sent' : r.status, ref: r.ref || (/^[0-9a-f]{32}$/i.test(String(r.id || '')) ? String(r.id).slice(0, 8).toUpperCase() : '') }))
}
export function addMine(entry, storage = store(), now = () => Date.now()) {
  const row = { id: entry.id || `f${now()}`, title: String(entry.title || ''), repo: entry.repo, status: entry.status, n: entry.n || 0, url: entry.url || '', at: entry.at || new Date(now()).toISOString(), ...(entry.ref ? { ref: String(entry.ref) } : {}) }
  const next = [row, ...listMine(storage).filter((r) => r.id !== row.id)].slice(0, 30)
  try { storage?.setItem(MINE_KEY, JSON.stringify(next)) } catch { /* not remembered */ }
  mineState.v += 1
  return next
}
onReportSent(() => { mineState.v += 1 })
