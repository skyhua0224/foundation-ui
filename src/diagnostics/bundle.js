import { redactAll, redactConfig } from './redact.js'
import { scrubText } from '../telemetry/scrub.js'
import { redactRecords } from './redact.js'
import { parseRecords } from './adapters.js'
import { parsePanelLogs } from './adapters.js'
import { recordsToText } from './record.js'
import { zipStore } from './zip.js'

// The diagnostics bundle: what goes in, what is taken out, and the file. The product collects the raw material (`collected`); this module
// prepares one entry per part (redacted, with its size and how much was removed) so the person can look at each and untick what they do not
// want, then writes only the ticked ones. Nothing is sent anywhere: saving is the product's file dialog or a download.

/** id, file name, whether it is on by default. `crash` is binary and cannot be redacted: off by default and marked. */
export const PARTS = Object.freeze([
  { id: 'log', file: 'sunshine.log', on: true },
  { id: 'config', file: 'config.json', on: true },
  { id: 'versions', file: 'versions.json', on: true },
  { id: 'os', file: 'os.json', on: true },
  { id: 'gpu', file: 'gpu.json', on: true },
  { id: 'displays', file: 'displays.json', on: true },
  { id: 'devices', file: 'devices.json', on: true },
  { id: 'sessions', file: 'sessions.json', on: true },
  // the result of 体检 (MDoctor), when the bundle is exported from that page
  { id: 'doctor', file: 'doctor.json', on: true },
  { id: 'crash', file: 'crash', on: false, binary: true },
])

export const PANEL_PART = Object.freeze({ id: 'panel', file: 'panel.log', on: true })

const pretty = (v) => JSON.stringify(v, null, 2)

/**
 * @param {Record<string, any>} collected  log: string; config/versions/os/gpu/displays/devices/sessions/doctor: JSON-able; crash: [{ name, data: Uint8Array }]
 * @param {{ network?: boolean, hostNames?: string[], clientNames?: string[] }} options  network true = addresses and names are masked
 */
export function prepareBundle(collected = {}, { network = true, hostNames = [], clientNames = [], panel = false } = {}) {
  const entries = []
  const parts = panel ? [...PARTS, PANEL_PART] : PARTS
  for (const part of parts) {
    const raw = collected[part.id] ?? (part.id === 'log' ? collected.records : part.id === 'panel' ? collected.panelRecords : undefined)
    const empty = raw === undefined || raw === null || (Array.isArray(raw) && !raw.length) || raw === ''
    if (empty) { entries.push({ id: part.id, file: part.file, available: false, included: false, size: 0, text: '', counts: { secrets: 0, ips: 0, names: 0 }, binary: !!part.binary }); continue }
    if (part.binary) {
      const files = raw.map((f) => ({ name: f.name, data: f.data }))
      entries.push({ id: part.id, file: part.file, available: true, included: false, size: files.reduce((n, f) => n + (f.data?.length || 0), 0), text: files.map((f) => f.name).join('\n'), counts: { secrets: 0, ips: 0, names: 0 }, binary: true, unredacted: true, files })
      continue
    }
    if (part.id === 'log') {
      const records = Array.isArray(collected.records) ? collected.records : parseRecords(String(raw))
      const red = redactRecords(records, { network, hostNames, clientNames })
      const text = last(recordsToText(red.records), network)
      entries.push({ id: part.id, file: part.file, available: true, included: part.on, size: new TextEncoder().encode(text).length, text, counts: red.counts, binary: false })
      continue
    }
    if (part.id === 'panel') {
      const source = Array.isArray(collected.panelRecords) ? collected.panelRecords : Array.isArray(raw) ? raw : []
      const records = source.length && typeof source[0]?.severity === 'number' && 'body' in source[0]
        ? source
        : parsePanelLogs(source)
      const red = redactRecords(records, { network, hostNames, clientNames })
      const text = last(recordsToText(red.records), network)
      entries.push({ id: part.id, file: part.file, available: true, included: part.on, size: new TextEncoder().encode(text).length, text, counts: red.counts, binary: false })
      continue
    }
    const secretCounts = { secrets: 0 }
    const source = pretty(part.id === 'config' ? redactConfig(raw, secretCounts) : raw)
    const r = redactAll(source, { network, hostNames, clientNames })
    r.text = last(r.text, network)
    r.counts.secrets += secretCounts.secrets
    entries.push({ id: part.id, file: part.file, available: true, included: part.on, size: new TextEncoder().encode(r.text).length, text: r.text, counts: r.counts, binary: false })
  }
  return entries
}

// the telemetry scrub is the last word over every text part (origins, query values, long tokens, the shapes it knows that the diagnostics redaction does not); not when the person chose to keep network identity
const last = (text, network) => (network ? scrubText(text, Infinity) : text)

const two = (n) => String(n).padStart(2, '0')
export const bundleName = (now = new Date()) => `foundation-diagnostics-${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}.zip`

/** The ZIP of the ticked entries plus a README that says what is inside and what was removed. */
export function finalizeBundle(entries, selected, { network = true, now = new Date(), product = '' } = {}) {
  const chosen = entries.filter((e) => e.available && selected.includes(e.id))
  const files = []
  for (const e of chosen) {
    if (e.binary) for (const f of e.files) files.push({ name: `${e.file}/${f.name}`, data: f.data })
    else files.push({ name: e.file, data: e.text })
  }
  const lines = [
    `${product ? `${product} ` : ''}diagnostics bundle`, `Created ${now.toISOString()}`, '',
    'Files:', ...chosen.map((e) => `- ${e.file}${e.binary ? ' (not redacted)' : ''}  ${e.size} bytes${e.counts.secrets ? `, ${e.counts.secrets} secrets removed` : ''}${e.counts.ips ? `, ${e.counts.ips} addresses masked` : ''}${e.counts.names ? `, ${e.counts.names} names masked` : ''}${e.counts.sensitive ? `, ${e.counts.sensitive} sensitive fields hashed` : ''}`), '',
    `Credentials, tokens and pairing data were removed by the application.`,
    network ? 'IP addresses, MAC addresses and machine names were masked.' : 'IP addresses and machine names are included, as chosen.',
    chosen.some((e) => e.unredacted) ? 'Crash dumps are included as they are: the application cannot redact them.' : '',
  ].filter((l, i, all) => l !== '' || all[i - 1] !== '')
  files.unshift({ name: 'README.txt', data: `${lines.join('\n')}\n` })
  return { name: bundleName(now), bytes: zipStore(files, now), files: files.map((f) => f.name), totalBytes: files.reduce((n, f) => n + (typeof f.data === 'string' ? new TextEncoder().encode(f.data).length : f.data.length), 0) }
}
