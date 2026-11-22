// The unified search: one index of everything a person can look for (settings, pages, actions, clients, applications, tiles of the overview), one matcher,
// results grouped by type. Pure functions (no Vue, no DOM), so both products and the tests use them as they are. Nothing is sent anywhere: the index is built in
// the page and the words a person types never leave it.
//
// A doc: { id, type, title, path?, icon?, keywords?, aliases?, key?, route?, params?, tier?, ... } -- the fields the product needs to open it travel with it.
//   path      the breadcrumb ("主机设置 › 编码器"), searched too
//   keywords  other words that find it (the other language's label, the words of its key)
//   aliases   what people call it instead (喇叭, speaker): a string or a list, in both languages; the doc's own words, so they rank before the shared table
//   key       the configuration key (`hevc_mode`): typing it finds the row
// Matching, best first (the tier, lower is better):
//   0 exact title or key   1 a prefix   2 a word of the title   3 inside the title   4 its keywords   4.1 its aliases   4.5 the shared synonym table (synonyms.js)
//   5-6 pinyin: full, initials or a mix (yinpin, yp, yinp = 音频)   7 the breadcrumb   7.5 the words in another order   8 a slip (a typo, a missing or an extra character)
// Every word of the query has to match; their order does not matter. Filler words ("怎么", "how to") are dropped when they match nothing.
// When nothing matches, `suggest` holds the nearest docs ("did you mean").

import { hasHan, pinyinMatch, pinyinString, pinyinUnits } from './pinyin.js'
import { groupsOfText, groupsOfWord, SYNONYM_GROUPS } from './synonyms.js'
import { isUnavailable } from '../settings/availability.js'

export const TYPES = Object.freeze(['setting', 'page', 'action', 'client', 'app', 'tile'])
export const PER_GROUP = 5
// below this many answers a slip in the typing is looked for as well
const FEW = 3

const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase()
const keyForm = (s) => norm(s).trim().replace(/[\s.-]+/g, '_')
const textOf = (v) => (Array.isArray(v) ? v.join(' ') : String(v ?? ''))
const tokensOf = (s) => s.split(/[^a-z0-9]+/).filter((x) => x.length >= 3)
const HAN_RUN = /^[一-鿿]+$/
const hanOf = (s) => s.replace(/[^一-鿿]+/g, ' ')
// the offsets in pinyinString(title) at which a character's syllable starts (a letter or digit is one)
function startsOf(units) {
  const out = []
  let at = 0
  for (const u of units) { out.push(at); at += u.o[0].length }
  return out
}

/** Prepare docs for matching: normalised fields, the groups of the synonym table, pinyin units and the words a slip is looked for in, computed once. */
export function buildIndex(docs) {
  const rows = docs.map((doc, order) => {
    const title = String(doc.title ?? '')
    const t = norm(title)
    const kw = norm(doc.keywords)
    const aliasList = (Array.isArray(doc.aliases) ? doc.aliases : String(doc.aliases ?? '').split(/[,，;；]+/)).map((x) => norm(x).trim()).filter(Boolean)
    const al = aliasList.join(' ')
    const alt = norm(doc.alt)
    const units = hasHan(title) ? pinyinUnits(title) : null
    // what the doc is also called, in pinyin (shengyin finds a setting whose alias is 声音)
    const aliasHan = hanOf(`${al} ${kw}`).replace(/\s+/g, ' ').trim()
    const aunits = aliasHan ? pinyinUnits(aliasHan) : null
    const k = doc.key ? keyForm(doc.key) : ''
    // the synonym groups are for the words people type: the technical key (restore_log) and its spaced words do not put a doc into a group (default settings finds the reset, not every setting whose key says restore)
    const kwForGroups = k ? kw.split(k).join(' ').split(k.replace(/_/g, ' ')).join(' ') : kw
    const groups = groupsOfText(`${t} ${kwForGroups} ${alt} ${al}`)
    const pool = new Set([...tokensOf(t), ...tokensOf(k.replace(/_/g, ' ')), ...tokensOf(kw), ...tokensOf(al), ...tokensOf(alt)])
    for (const gi of groups) for (const term of SYNONYM_GROUPS[gi].terms) if (/^[a-z0-9]{3,}$/.test(term)) pool.add(term)
    return {
      doc, order, title, t, tc: t.replace(/\s+/g, ''), k, kw, al, aliasList, alt, groups,
      primary: norm(doc.primary),
      p: norm(`${doc.path ?? ''} ${doc.pathAlt ?? ''}`),
      units, aunits,
      py: units ? pinyinString(title) : '',
      pool: [...pool],
      // the Han characters of the title, aliases and keywords, where a slip in the characters is looked for
      han: hanOf(`${t} ${al} ${kw}`),
      // where each syllable of the title's pinyin starts, where a slip in the pinyin is looked for
      pyStarts: units ? startsOf(units) : [],
    }
  })
  // every word of the index once: a slip is looked for in these, not in each doc
  const vocab = [...new Set(rows.flatMap((r) => r.pool))]
  return { rows, size: rows.length, vocab }
}

// ---- the query ----

const STOP_LATIN = new Set(['how', 'to', 'the', 'a', 'an', 'my', 'i', 'can', 'cant', "can't", 'not', 'no', 'why', 'what', 'where', 'do', 'does', 'is', 'are', 'in', 'on', 'of', 'for', 'it', 'set', 'change', 'enable', 'disable', 'turn', 'use', 'make', 'fix', 'please', 'all', 'settings', 'setting', 'option', 'options', 'working', 'work', 'works', 'wont', "won't", 'doesnt', "doesn't"])
const HAN_FILLER = ['怎么办', '怎么设置', '怎么调', '怎么开', '怎么关', '怎么样', '在哪里', '怎么', '如何', '怎样', '没有', '不能', '不了', '无法', '打不开', '请问', '我想', '我要', '想要', '想', '调整', '修改', '开启', '关闭', '打开', '设置', '选项', '的', '吗', '呢', '没']

// the words of a run of Han characters that is a sentence ("麦克风没声音" is 麦克风 and 声音): the filler between them cut out; [] when there is none
function partsOf(w) {
  let rest = w
  for (const f of HAN_FILLER) rest = rest.split(f).join(' ')
  const parts = rest.split(' ').filter((x) => x.length >= 2)
  return parts.length && parts.join('') !== w ? parts : []
}

/** The words of a query, each with what it can stand for. */
function prepare(query) {
  const ws = norm(query).replace(/[?？!！,，。、;；:："“”‘’]/g, ' ').trim().split(/\s+/).filter(Boolean)
  return ws.map((w) => {
    const parts = HAN_RUN.test(w) && w.length >= 3 ? partsOf(w).map((x) => ({ w: x, groups: groupsOfWord(x) })) : []
    return { w, parts, stop: STOP_LATIN.has(w), groups: groupsOfWord(w) }
  })
}

// ---- slips ----

// edit distance (insert, delete, replace, swap of two neighbours) up to `max`, on three rows that are kept between calls
const ROWS = [new Int32Array(80), new Int32Array(80), new Int32Array(80)]
function within(a, b, max) {
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > max || la > 78 || lb > 78) return false
  let [two, one, cur] = ROWS
  for (let j = 0; j <= lb; j++) one[j] = j
  for (let i = 1; i <= la; i++) {
    cur[0] = i
    let low = i
    for (let j = 1; j <= lb; j++) {
      let v = Math.min(one[j] + 1, cur[j - 1] + 1, one[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && two[j - 2] + 1 < v) v = two[j - 2] + 1
      cur[j] = v
      if (v < low) low = v
    }
    if (low > max) return false
    const spare = two
    two = one; one = cur; cur = spare
  }
  return one[lb] <= max
}

// the characters of `w` in order inside `text`, close together (a character left out: 麦风 for 麦克风)
function spread(w, text) {
  const n = w.length
  for (let start = text.indexOf(w[0]); start >= 0; start = text.indexOf(w[0], start + 1)) {
    let at = start
    for (let i = 1; i < n && at >= 0; i++) at = text.indexOf(w[i], at + 1)
    if (at >= 0 && at - start <= n + 2) return true
  }
  return false
}

// the words of the index that `w` is a slip of (the query typed wrongly, or the beginning of a longer word typed wrongly); asked once per query word
let near = null
function nearWords(w) {
  let set = near.map.get(w)
  if (set) return set
  set = new Set()
  const max = w.length >= 8 ? 2 : 1
  for (const x of near.vocab) if ((Math.abs(x.length - w.length) <= max && within(w, x, max)) || (x.length > w.length && within(w, x.slice(0, w.length), max))) set.add(x)
  near.map.set(w, set)
  return set
}
const slipLatin = (row, w) => { const set = nearWords(w); return set.size > 0 && row.pool.some((x) => set.has(x)) }

// a slip in the pinyin: a typo in the letters or a homophone (音平 for 音频): compared with the pinyin of the title from the start of each syllable
function slipPinyin(row, letters) {
  const n = letters.length
  if (n < 4 || !row.py) return false
  const py = row.py
  for (const s of row.pyStarts) {
    if (py[s] !== letters[0] && py[s + 1] !== letters[1]) continue
    if (within(letters, py.slice(s, s + n), 1) || within(letters, py.slice(s, s + n + 1), 1)) return true
  }
  return false
}

function slip(row, w) {
  if (HAN_RUN.test(w)) {
    if (w.length >= 2 && spread(w, row.han)) return true
    if (w.length >= 3) for (let i = 0; i < w.length; i++) if (row.han.includes(w.slice(0, i) + w.slice(i + 1))) return true
    return row.py ? slipPinyin(row, pinyinString(w)) : false
  }
  if (!/^[a-z0-9_]+$/.test(w) || w.length < 4) return false
  return slipLatin(row, w) || slipPinyin(row, w.replace(/v/g, 'u'))
}

// ---- tiers ----

// a short word of Latin letters (up to four) has to start a word: `yp` is not in `type`, `mic` is not in `dynamic`
const shortLatin = (w) => w.length < 5 && /^[a-z0-9]+$/.test(w)
const has = (hay, w) => (shortLatin(w) ? hay.startsWith(w) || hay.includes(` ${w}`) || hay.includes(`_${w}`) : hay.includes(w))

/** Tier of one word against a row (lower is better), with the title ranges to highlight; null when it does not match. `groups` is { direct, below } of the word. */
function tierOf(row, w, groups, fuzzy, inner = false) {
  const { t, k, kw, p, al } = row
  const kf = keyForm(w)
  if (t === w || (k && k === kf)) return { tier: 0, range: t === w ? [0, t.length] : null }
  if (t.startsWith(w)) return { tier: 1, range: [0, w.length] }
  if (k && k.startsWith(kf)) return { tier: 1, range: null }
  const at = shortLatin(w) ? (has(t, w) ? t.indexOf(w) : -1) : t.indexOf(w)
  if (at >= 0) {
    const wordStart = at === 0 || /[\s._\-/›(（·:：]/.test(t[at - 1])
    return { tier: wordStart ? 2 : 3, range: [at, at + w.length] }
  }
  if (k && has(k, kf)) return { tier: 3, range: null }
  // the title spelled out in pinyin from its start (yinpin, yinpinshuchu = 音频输出): as good as the start of the title
  if (row.py && w.length >= 4 && /^[a-z]+$/.test(w)) {
    const l = w.replace(/v/g, 'u')
    if (row.py === l) return { tier: 1.1, range: null }
    if (row.py.startsWith(l)) return { tier: 1.3, range: null }
  }
  if (has(kw, w)) return { tier: 4, range: null }
  if (al) {
    if (row.aliasList.includes(w)) return { tier: 4.05, range: null }
    if (has(al, w)) return { tier: 4.1, range: null }
  }
  if (groups) {
    if (groups.direct.size && row.groups.some((g) => groups.direct.has(g))) return { tier: 4.5, range: null }
    if (groups.below.size && row.groups.some((g) => groups.below.has(g))) return { tier: 4.6, range: null }
  }
  if (row.units && /^[a-z0-9]+$/.test(w)) {
    const m = pinyinMatch(row.units, w)
    if (m) return { tier: m.start === 0 ? 5 : 6, indexes: m.at.map((u) => row.units[u].at) }
  }
  if (row.aunits && /^[a-z]{3,}$/.test(w) && pinyinMatch(row.aunits, w)) return { tier: 5.5, range: null }
  if (has(p, w)) return { tier: 7, range: null }
  // the words in another order (启用音频 for 音频启用): a run of Han characters that is two parts, each of which is somewhere in the doc
  if (!inner && w.length >= 4 && w.length <= 8 && HAN_RUN.test(w)) {
    for (let cut = 2; cut <= w.length - 2; cut++) {
      const a = tierOf(row, w.slice(0, cut), null, false, true), b = a && tierOf(row, w.slice(cut), null, false, true)
      if (a && b && a.tier <= 4 && b.tier <= 4) return { tier: 7.5, range: null }
    }
  }
  if (fuzzy && !inner && slip(row, w)) return { tier: 8, range: null }
  return null
}

/** Score a row for the words of a query: the worst tier of its words (every word has to match), with the highlight ranges of the title. */
function scoreRow(row, ws, fuzzy) {
  let tier = 0
  let counted = 0
  const ranges = []
  for (const q of ws) {
    let hit = tierOf(row, q.w, q.groups, fuzzy)
    if (!hit && q.parts.length) {
      const hits = q.parts.map((x) => tierOf(row, x.w, x.groups, fuzzy))
      // the filler cut out: never above what the doc itself carries as its words (the aliases are at 4.05)
      if (hits.every(Boolean)) hit = { tier: Math.max(4.2, ...hits.map((h) => h.tier + 0.3)), range: null }
    }
    // a filler word counts only when it is a word of the title; any other doc is not held to it
    if (q.stop && ws.length > 1 && (!hit || hit.tier > 2)) continue
    if (!hit) return null
    // the title in the other language counts as a title for a lead doc (English finds 下载客户端 by 下载 before the doc that merely lists the word)
    if (row.doc.lead && hit.tier > 1.2 && row.alt.startsWith(q.w)) hit = { tier: 1.2, range: null }
    else if (row.doc.lead && hit.tier > 1.4 && row.alt.includes(q.w)) hit = { tier: 1.4, range: null }
    else if (row.doc.lead && hit.tier > 1.45 && row.primary.split(/\s+/).includes(q.w)) hit = { tier: 1.45, range: null }
    counted++
    if (hit.tier > tier) tier = hit.tier
    if (hit.range) ranges.push(hit.range)
    if (hit.indexes) for (const i of hit.indexes) ranges.push([i, i + 1])
  }
  if (!counted) return null
  // a lead doc (the connect and download actions) answers the words that name its task before any setting, page or tile: a keyword hit counts as a strong one
  if (row.doc.lead) { if (tier === 4) tier = 1.6; else if (tier >= 2 && tier < 4) tier = 1.4 }
  return { tier, ranges: mergeRanges(ranges) }
}

function mergeRanges(ranges) {
  const sorted = ranges.filter((r) => r && r[1] > r[0]).sort((a, b) => a[0] - b[0])
  const out = []
  for (const r of sorted) { const last = out[out.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else out.push([r[0], r[1]]) }
  return out
}

// ---- did you mean ----

const gramCache = new Map()
// the neighbouring pairs of characters of a text, as a list (a text of one character is its character)
function gramsOf(s) {
  let g = gramCache.get(s)
  if (g) return g
  const c = Array.from(s)
  g = []
  if (c.length < 2) g = c
  else for (let i = 0; i < c.length - 1; i++) g.push(c[i] + c[i + 1])
  if (gramCache.size > 6000) gramCache.clear()
  gramCache.set(s, g)
  return g
}
// Dice coefficient of the pairs of characters of two texts, with the pairs of the first one counted once by the caller (`left`: pair -> count, `size`: how many)
function diceWith(left, size, b) {
  const gb = gramsOf(b)
  if (!size || !gb.length) return 0
  let common = 0
  const used = new Map()
  for (const g of gb) {
    const have = left.get(g)
    if (!have) continue
    const n = (used.get(g) || 0) + 1
    if (n <= have) { common++; used.set(g, n) }
  }
  return (2 * common) / (size + gb.length)
}
const countGrams = (a) => { const m = new Map(); const g = gramsOf(a); for (const x of g) m.set(x, (m.get(x) || 0) + 1); return { m, n: g.length } }
// the share of the characters of `a` that `b` has: 音平 against 音频 is half
const share = (a, b) => { const set = new Set(Array.from(b)); const c = Array.from(a); return c.filter((x) => set.has(x)).length / c.length }

const SUGGEST_TYPES = new Set(['setting', 'page', 'action'])
const SUGGEST_MIN = 0.4

/** The nearest docs to a query that matched nothing: [{ doc, score }], best first, at most `limit`. Settings, pages and actions only. */
export function suggest(index, query, limit = 3) {
  const q = norm(query).replace(/[\s?？!！,，。、;；:：]+/g, '')
  if (q.length < 2) return []
  const letters = /^[a-z0-9]+$/.test(q) ? q.replace(/v/g, 'u') : ''
  const qg = countGrams(q)
  const lg = letters ? countGrams(letters) : null
  // the similarity of the letters to each word of the index, once
  const words = new Map()
  if (lg) for (const x of index.vocab || []) words.set(x, diceWith(lg.m, lg.n, x))
  const pyq = !letters && HAN_RUN.test(q) ? countGrams(pinyinString(q)) : null
  const out = []
  for (const row of index.rows) {
    if (!SUGGEST_TYPES.has(row.doc.type)) continue
    let best = Math.max(diceWith(qg.m, qg.n, row.tc), HAN_RUN.test(q) ? 0.8 * share(q, row.t) : 0)
    if (lg) {
      if (row.py) best = Math.max(best, diceWith(lg.m, lg.n, row.py))
      for (const x of row.pool) best = Math.max(best, words.get(x) || 0)
    } else if (pyq) best = Math.max(best, 0.8 * share(q, row.han), row.py ? diceWith(pyq.m, pyq.n, row.py) : 0)
    if (best >= SUGGEST_MIN) out.push({ doc: row.doc, score: best, order: row.order })
  }
  return out.sort((a, b) => b.score - a.score || a.order - b.order).slice(0, limit).map(({ doc, score }) => ({ doc, score }))
}

/**
 * Search the index. Returns { groups: [{ type, items: [{ doc, tier, ranges }], more }], flat: [doc...] (in display order), total, query, suggest }.
 * Groups with a strong match (the title or its start) come first, each half in the order of TYPES, and the tiles last; a group shows `perGroup` rows and says how many more there are.
 * `suggest` is [{ doc, score }] and only filled when nothing matched.
 */
export function search(index, query, { perGroup = PER_GROUP, types = TYPES } = {}) {
  const ws = prepare(query)
  if (!ws.length) return { groups: [], flat: [], total: 0, query: '', suggest: [] }
  near = { vocab: index.vocab || [], map: new Map() }
  const hits = []
  const missed = []
  for (const row of index.rows) { const s = scoreRow(row, ws, false); if (s) hits.push({ row, ...s }); else missed.push(row) }
  // a slip in the typing is looked for when there is no answer, or only a weak and short one; the rows that matched stay as they are
  if (!hits.length || (hits.length < FEW && Math.min(...hits.map((h) => h.tier)) > 4.5)) {
    for (const row of missed) { const s = scoreRow(row, ws, true); if (s) hits.push({ row, ...s }) }
  }
  const byType = new Map()
  for (const h of hits) { const list = byType.get(h.row.doc.type) || []; list.push(h); byType.set(h.row.doc.type, list) }
  const groups = []
  for (const type of types) {
    const list = byType.get(type)
    if (!list) continue
    // within a tier: actions in the order the product lists them (restart before the rarer ones), the rest the shorter title first
    // a setting that cannot be used now is kept (a person has to know it exists) but comes after every usable one
    list.sort((a, b) => (isUnavailable(a.row.doc) ? 1 : 0) - (isUnavailable(b.row.doc) ? 1 : 0) || (b.row.doc.lead ? 1 : 0) - (a.row.doc.lead ? 1 : 0) || a.tier - b.tier || (type === 'action' ? 0 : a.row.t.length - b.row.t.length) || a.row.order - b.row.order)
    groups.push({ type, lead: !!list[0].row.doc.lead, best: list[0].tier, total: list.length, items: list.slice(0, perGroup).map((h) => ({ doc: h.row.doc, tier: h.tier, ranges: h.ranges })), more: Math.max(0, list.length - perGroup) })
  }
  // a strong match (the title itself or its start) comes before a good one (its own words, aliases, the synonym table), and a good one before a weak one (pinyin, the
  // breadcrumb, a slip); within each, the order of the types
  // (the tiles of the overview are the least wanted answer: they always come after the settings, pages and actions)
  const strength = (best) => (best < 1 ? 0 : best <= 1.3 ? 1 : best <= 4.6 ? 2 : 3)
  groups.sort((a, b) => (b.lead ? 1 : 0) - (a.lead ? 1 : 0) || (a.type === 'tile') - (b.type === 'tile') || strength(a.best) - strength(b.best) || types.indexOf(a.type) - types.indexOf(b.type))
  const query2 = ws.map((x) => x.w).join(' ')
  return { groups, flat: groups.flatMap((g) => g.items.map((i) => i.doc)), total: hits.length, query: query2, suggest: hits.length ? [] : suggest(index, query2) }
}

/** The title cut into { text, mark } pieces for the ranges (the matched parts are marked). */
export function highlight(title, ranges = []) {
  const chars = Array.from(String(title ?? ''))
  if (!ranges.length) return [{ text: chars.join(''), mark: false }]
  const out = []
  let at = 0
  for (const [a, b] of ranges) {
    if (a > at) out.push({ text: chars.slice(at, a).join(''), mark: false })
    out.push({ text: chars.slice(a, Math.min(b, chars.length)).join(''), mark: true })
    at = Math.min(b, chars.length)
  }
  if (at < chars.length) out.push({ text: chars.slice(at).join(''), mark: false })
  return out.filter((p) => p.text)
}
