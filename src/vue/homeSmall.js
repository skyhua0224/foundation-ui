import { recommendForOs, osLabel } from '../clients/recommend.js'
import { readOs } from '../clients/osChoice.js'
import { registeredComponentStatus } from '../status/controller.js'
import { statusTexts } from '../status/texts.js'

// The small tile of a card: { icon, title, value, unit, secondary, tone, spark, progress, chip, empty, action } read from the card's data.
// The tile is one anatomy (see MDashSmall): a leading icon in a shape of its category, the label, a strong value, one meaningful second line, and at the right
// one of: a small trend curve (data that is a trend), a progress ring (a share of something), a status chip, or a chevron. Nothing is added to the data: the value and
// the second line are ones that the larger layout shows too. A card with nothing to show yet is an empty tile: the empty text and the one action that fills it.
const first = (...v) => v.find((x) => x !== undefined && x !== null && x !== '')
const dot = (...p) => p.filter((x) => x !== undefined && x !== null && x !== '').join(' · ')
const names = (list, key = 'name', n = 3) => { const all = (list || []).map((x) => x?.[key]).filter(Boolean); return all.length > n ? `${all.slice(0, n).join(' · ')} +${all.length - n}` : all.join(' · ') }
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
// the small graphics of the tile: stacked covers, stacked device avatars, a drawn display
// a cover is the picture the app has; without one the tile shows an icon (the apps, the gamepad for games), never the first letter of its name
const coversOf = (items, nameKey = 'title', icon = 'sports_esports') => (items || []).slice(0, 3).map((i) => ({ cover: i.cover || '', icon }))
const avatarsOf = (list, n = 3) => (list || []).slice(0, n).map((x) => ({ icon: x.icon || 'devices', tone: x.tone || '' }))
const displayOf = (sub, unit, hdr) => { const m = /(\d{3,5})\s*×\s*(\d{3,5})/.exec(sub || ''); return { ratio: m ? `${m[1]} / ${m[2]}` : '16 / 9', label: (/(\d+)/.exec(unit || '') || [])[1] || '', hdr: !!hdr } }

/** A processor or a graphics card as a short name that is whole in a small tile: the generation, the vendor, the trademark signs and the filler words go
 *  ("13th Gen Intel(R) Core(TM) i7-13700K" is i7-13700K, "AMD Ryzen 7 7800X3D 8-Core Processor" Ryzen 7 7800X3D, "NVIDIA GeForce RTX 4070" RTX 4070). Nothing short enough or unknown is touched. */
export function shortHardware(name) {
  const raw = String(name || '').trim()
  if (!raw) return ''
  let s = raw.replace(/\((?:R|TM)\)|[®™]/gi, '').replace(/@\s*[\d.]+\s*GHz/i, '').replace(/\b\d+(?:st|nd|rd|th) Gen\b/i, '').replace(/\b\d+-Core\b/i, '').replace(/\b(?:CPU|Processor|Graphics|with Radeon Graphics|Series)\b/gi, '')
  s = s.replace(/^\s*(?:Intel|AMD|NVIDIA|Apple|Qualcomm)\s+/i, '').replace(/^(?:GeForce|Radeon)\s+(?=RTX|GTX|RX|Pro|Vega)/i, '').replace(/^Core\s+(?=i\d)/i, '').replace(/\s+/g, ' ').trim()
  return s || raw
}

/** The name of a product's part without the maker's name when it is long and in Latin letters ("Foundation Virtual Display" is "Virtual Display"): one line of a small tile, never a cut one. */
export const shortTitle = (title) => (/^[\x20-\x7e]+$/.test(title) && title.length > 16 ? title.replace(/^Foundation\s+/i, '') : title)

export function smallOf(card, T = {}) {
  const d = card.data || {}
  const title = shortTitle(card.title || d.title || '')
  const base = { icon: d.icon || 'apps', title }
  // the one action that fills an empty tile: what is empty is what the first stream, the first pairing or the announcements fill; reuses the actions the products already handle (guide-go, table-action, open)
  const fill = () => {
    const t = card.data?.type
    if (t === 'clients') return T.emptyPair ? { label: T.emptyPair, type: 'table-action' } : null
    if (t === 'news') return T.emptyNews ? { label: T.emptyNews, type: 'open', value: 'announcements' } : null
    return T.emptyStart ? { label: T.emptyStart, type: 'guide-go', value: { id: 'connect' } } : null
  }
  const empty = (text, action = null) => ({ ...base, value: text || '', empty: true, action: action || fill() })
  switch (card.kind) {
    // the state is a dot beside the word (no drawn circle: it said nothing); the name of the host and how long it has run are the two parts of the second line (the pairs are the pairing tile's)
    case 'hero': return { icon: d.icon || 'dns', title, value: d.statusLabel || d.title || '', secondary: dot(d.title, ...(d.pairs || []).slice(0, 1).map((p) => `${p.label} ${p.value}`)), tone: d.statusTone, state: d.statusTone || 'ok' }
    case 'table': {
      const tab = d.tabs?.[0]; const count = first(tab?.count, tab?.rows?.length, 0)
      const act = d.action ? { label: d.action.label, type: 'table-action' } : null
      return count ? { icon: 'devices', title: tab?.label || title, value: String(count), secondary: names((tab.rows || []).map((r) => ({ name: r.cells?.name })), 'name'), avatars: avatarsOf(tab.rows), more: Math.max(0, count - 3), chip: (tab.rows || []).some((r) => r.tones?.state === 'ok') ? { label: tab.rows.find((r) => r.tones?.state === 'ok').cells.state, tone: 'ok' } : null } : { ...empty(tab?.empty, act), icon: 'devices', title: tab?.label || title }
    }
    case 'guide': { const steps = d.steps || []; const done = steps.filter((s) => s.done).length; const next = steps.find((s) => !s.done); return { icon: 'rocket_launch', title, value: `${done}/${steps.length}`, secondary: next?.title || '', progress: steps.length ? done / steps.length : 0 } }
    case 'journey': return { icon: 'cast_connected', title: '', value: d.title || title, secondary: d.sub || '', avatars: [{ icon: 'mobile' }, { icon: 'tablet' }, { icon: 'computer' }] }
    case 'download': { const r = recommendForOs(readOs()); const ver = String(d.versionOf?.(r.client) || '').replace(/^v/i, ''); return { icon: 'download', title, value: String(r.client.name), secondary: osLabel(readOs(), T.__locale || 'en'), tag: { official: r.official, locale: T.__locale || 'en' }, pills: ver ? [{ label: `v${ver}` }] : null } }
    case 'apps': {
      const count = first(d.count, d.items?.length, 0)
      return count ? { icon: 'apps', title, value: String(count), secondary: names(d.items, 'title'), covers: coversOf(d.items, 'title', 'apps'), more: Math.max(0, count - 3) } : empty(d.empty, d.addLabel ? { label: d.addLabel, type: 'add-app' } : null)
    }
    case 'sponsor': return { icon: 'favorite', title, value: d.texts?.sponsor || title, secondary: d.texts?.line || '' }
    case 'vdd': return { icon: 'desktop_windows', title, value: String(first(d.value, d.stateLabel, d.state, '')), secondary: d.value ? dot(d.stateLabel, d.sub) : d.sub, tone: d.tone, pills: [d.unit && d.value ? { label: d.unit } : null, ...(d.chips || []).filter((c) => /HDR/i.test(c.label)).map((c) => ({ label: c.label, tone: c.tone }))].filter(Boolean).slice(0, 2) }
    case 'component': {
      const st = registeredComponentStatus(); const row = st?.row(d.id); const TT = st ? st.text() : statusTexts('en')
      const tone = { ok: 'ok', warn: 'warn', error: 'warn', missing: 'warn' }[row?.state]
      const name = String(TT.names?.[d.id] || title); const short = name.includes(' ') && /[\u4e00-\u9fff]/.test(name) ? name.slice(name.lastIndexOf(' ') + 1) : name
      return { icon: 'monitor_heart', title: short, value: TT.states[row?.state || 'unknown'], secondary: row?.version || row?.note || '', tone, avatars: [{ icon: { ok: 'check_circle', warn: 'warning', error: 'error', missing: 'warning' }[row?.state] || 'help', tone: tone === 'ok' ? 'ok' : '' }] }
    }
    case 'curve': {
      const pts = (d.points || []).filter((v) => Number.isFinite(v))
      const hw = card.id === 'cpu' || card.id === 'gpu'
      return { ...base, value: String(first(d.value, '')), unit: d.unit, secondary: (hw ? shortHardware(d.caption) : d.caption) || (d.peak ? `${d.peak} ${d.unit || ''}` : ''), spark: pts.length > 1 ? pts : null }
    }
    case 'info': {
      const segs = d.bar?.segments
      const free = segs?.find((s) => s.tone === 'free'); const total = segs?.reduce((a, s) => a + s.value, 0) || 0
      const tiles = d.tiles || []
      if (tiles.length) { const ready = tiles.filter((t) => t.ready).length; return { icon: d.icon || 'devices', title, value: `${ready}/${tiles.length}`, secondary: dot(...tiles.map((t) => `${t.label} ${t.word}`)), tone: ready === tiles.length ? 'ok' : '', avatars: tiles.map((t) => ({ icon: t.icon, tone: t.ready ? 'ok' : '' })) } }
      return { ...base, value: String(first(d.value, d.ring?.label, '')), unit: d.unit, secondary: d.sub || d.ring?.caption || d.chips?.[0]?.label || '', progress: free && total ? 1 - free.value / total : d.ring?.value ?? undefined, spark: d.spark?.length > 1 ? d.spark : null, chip: d.chips?.[0] && (d.value || d.ring) ? { label: d.chips[0].label, tone: d.chips[0].tone } : null }
    }
    default: break
  }
  switch (d.type) {
    case 'rows': {
      const r0 = d.rows?.[0]
      if (!r0 && d.empty) return empty(d.empty)
      // a value that is 'what · its state' (the gamepad: 'DualSense (PS5) · 已就绪') shows its state as the value and what it is on the second line
      const v = String(first(d.big, r0?.value, r0?.title, '')); const parts = d.big ? [v] : v.split(' · ')
      const value = parts.length > 1 ? parts[parts.length - 1] : v
      return { ...base, value, secondary: d.big ? (r0?.title || '') : parts.length > 1 ? parts.slice(0, -1).join(' · ') : dot(r0 && r0.value ? r0.title : '', d.rows?.[1]?.value), tone: r0?.tone, avatars: avatarsOf(d.rows?.filter((r) => r.icon), 3) }
    }
    case 'chips': return { ...base, value: String(first(d.big, d.chips?.[0]?.label, '')), secondary: d.big ? dot(...(d.chips || []).map((c) => c.label)) : dot(...(d.chips || []).slice(1, 3).map((c) => c.label)), tone: d.tone, pills: (d.big ? d.chips || [] : (d.chips || []).slice(1)).slice(0, 2).map((c) => ({ label: c.label, tone: c.tone })) }
    case 'control': { const cur = d.options?.find((o) => o.value === d.value); const bin = d.options?.length === 2 && d.options.every((o) => /^(on|off|true|false|yes|no|enabled|disabled|1|0)$/i.test(String(o.value))); const on = bin && /^(on|true|yes|enabled|1)$/i.test(String(d.value)); return { ...base, value: String(cur?.label ?? d.value ?? ''), secondary: d.note || '', toggle: bin ? on : undefined, tone: on ? 'ok' : '', dots: !bin && d.options?.length > 1 ? { n: Math.min(d.options.length, 6), i: Math.max(0, d.options.findIndex((o) => o.value === d.value)) } : undefined } }
    case 'appearance': return { ...base, value: String(d.options?.find((o) => o.value === d.current)?.label ?? ''), dots: d.options?.length > 1 ? { n: Math.min(d.options.length, 6), i: Math.max(0, d.options.findIndex((o) => o.value === d.current)) } : undefined }
    case 'action': return { ...base, title: '', value: String(title), secondary: '', cta: !!d.label, action: d.label ? { label: d.label, type: d.act, value: d.value } : null }
    case 'address': { const v = d.view; if (!d.saved && (!v || v.state === 'unset')) return empty(d.texts?.unset || '', T.emptyAddress ? { label: T.emptyAddress, type: 'detail' } : null)
      const word = v ? v.word : d.path?.word || ''; const bad = v ? v.tone === 'bad' : d.path?.tone === 'error'
      return { ...base, value: String(v ? v.value : first(d.saved, d.texts?.unset, '')), secondary: word, tone: bad ? 'warn' : '', pills: word ? [{ label: word, tone: v ? ({ ok: 'ok', bad: 'error' }[v.tone] || 'neutral') : d.path.tone }] : null, avatars: word ? null : [{ icon: d.saved ? 'public' : 'help' }] } }
    case 'nics': return { ...base, value: String(first(d.primary?.speed, d.primary?.kind, d.primary?.name, '')), secondary: dot(d.primary?.name, d.primary?.ipv4), chip: d.primary?.kind && d.primary?.speed ? { label: d.primary.kind } : null }
    case 'quick': return { ...base, value: String(d.items?.length || ''), secondary: dot(...(d.items || []).slice(0, 3).map((i) => i.label)), avatars: avatarsOf(d.items, 3), more: Math.max(0, (d.items?.length || 0) - 3) }
    case 'news': return d.items?.length ? { ...base, value: String(d.items.length), secondary: d.items[0]?.title || '' } : empty(d.empty)
    case 'recent': return d.rows?.length ? { ...base, value: d.rows[0].title, secondary: d.rows[0].appliesText } : empty(d.empty, T.rcOpenSettings ? { label: T.rcOpenSettings, type: 'open', value: 'settings' } : null)
    case 'live-bitrate': return { ...base, value: d.now === null ? '' : `${d.now}`, unit: 'Mbps', secondary: d.client }
    case 'live-ds5': return { ...base, value: d.sliders?.[0] ? `${Math.round(d.sliders[0].value * 100) / 100}` : '', secondary: d.sliders?.[0]?.label || '' }
    case 'pin-switch': return { ...base, value: d.on ? d.onText : d.offText, tone: d.on ? 'ok' : '' }
    case 'pin-slider': return { ...base, value: d.value === 0 && d.zeroText ? d.zeroText : `${d.value}${d.unit || ''}`, progress: num(d.max) > num(d.min) ? (d.value - d.min) / (d.max - d.min) : undefined }
    // the name under the count says what it is: the client that paired last
    case 'pair': return d.count ? { icon: 'person_add', title, value: String(d.count), secondary: d.latest?.name ? String(T.latestClient || 'Latest: {name}').replace('{name}', d.latest.name) : '', avatars: [d.latest || {}, ...Array.from({ length: Math.min(d.count - 1, 2) }, () => ({}))], more: Math.max(0, d.count - 3) } : empty(T.noClients, null)
    case 'vivi': return { icon: 'favorite', title, value: d.text || title, image: d.image }
    case 'tip': return { icon: 'lightbulb', title, value: d.text || title }
    case 'clients': { const n = first(d.count, d.items?.length, 0); return n ? { ...base, value: String(n), secondary: names(d.items), avatars: avatarsOf(d.items), more: Math.max(0, n - 3) } : empty(d.empty) }
    case 'covers': { const n = first(d.count, d.items?.length, 0); return n ? { ...base, value: String(n), secondary: names(d.items), covers: coversOf(d.items, 'name'), more: Math.max(0, n - 3) } : empty(d.empty) }
    case 'lines': return d.rows?.length ? { ...base, value: String(d.rows.length), secondary: d.rows[0]?.title || '', avatars: avatarsOf(d.rows.filter((r) => r.icon), 3), more: Math.max(0, d.rows.length - 3) } : empty(d.empty)
    case 'heat': return d.total ? { ...base, value: String(d.total), secondary: d.caption || '', bars: (d.days || []).slice(-14).map((x) => Number(x?.value ?? x) || 0) } : empty(d.empty)
    case 'gauge': case 'arc': return { ...base, value: `${first(d.centre, '')}`, unit: d.unit, secondary: d.caption || '', progress: num(d.value) ?? undefined, tone: d.zones?.find((z) => d.value <= z.to)?.tone }
    // an elapsed time has no full: the time is the value, no ring
    case 'ring': return { ...base, value: String(first(d.centre, '')), secondary: d.caption || '' }
    case 'now': return { ...base, value: String(first(d.name, '')), secondary: dot(...(d.rows || []).map((r) => r.value).slice(0, 2)), covers: d.name ? coversOf([{ cover: d.cover, name: d.name }], 'name') : null }
    case 'apps': return d.items?.length ? { ...base, value: String(d.items.length), secondary: names(d.items, 'name'), covers: coversOf(d.items, 'name', 'apps') } : empty(d.empty)
    case 'bars': { const v = d.series?.[0]?.values || []; return { ...base, value: String(v.reduce((a, b) => a + (Number(b) || 0), 0)), secondary: d.series?.[0]?.label || '', bars: v.slice(-14).map(Number) } }
    case 'chart': case 'chartx': { const v = (d.series?.[0]?.values || []).filter((x) => Number.isFinite(x)); return { ...base, value: '', spark: v.length > 1 ? v : null } }
    case 'vdd': return { ...base, value: '' }
    case 'fps': return { ...base, value: String(first(d.value, '')) }
    case 'strip-control': { const cur = d.options?.find((o) => o.value === d.value); const on = d.act === 'switch'; return { ...base, value: String(cur?.label ?? d.value ?? ''), secondary: d.sub || (on ? '' : dot(...(d.options || []).filter((o) => o !== cur).slice(0, 2).map((o) => o.label))), tone: on && d.value === 'on' ? 'ok' : '', toggle: on ? d.value === 'on' : undefined, dots: !on && d.options?.length > 1 ? { n: d.options.length, i: Math.max(0, d.options.findIndex((o) => o.value === d.value)) } : undefined } }
    default: return { ...base, value: '' }
  }
}
