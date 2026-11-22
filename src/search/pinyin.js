// Pinyin of Chinese text without a dictionary service, so that `yinpin`, `yp` and `yinp` find 音频.
//  - Full pinyin comes from a small table of the characters the products' texts use (pinyinTable.js, generated from the Unicode Character Database).
//  - A character the table lacks still gets its initial from the browser's own pinyin collation (Intl.Collator, zh-u-co-pinyin): the first letter is the
//    last letter whose boundary character sorts at or before the one asked about.
// Everything is built once per index entry (never per keystroke); a match walks at most a few dozen characters.
import { PINYIN_ALT, PINYIN_MAIN } from './pinyinTable.js'

const BOUNDARIES = [['a', '阿'], ['b', '八'], ['c', '嚓'], ['d', '搭'], ['e', '蛾'], ['f', '发'], ['g', '噶'], ['h', '哈'], ['j', '击'], ['k', '喀'], ['l', '垃'], ['m', '妈'], ['n', '拿'], ['o', '哦'], ['p', '啪'], ['q', '期'], ['r', '然'], ['s', '撒'], ['t', '塌'], ['w', '挖'], ['x', '昔'], ['y', '压'], ['z', '匝']]

// characters whose initial depends on the word: the collation gives one reading, these add the other (used for characters the table lacks)
const ALSO = Object.freeze({ 重: 'c', 长: 'z', 传: 'z', 行: 'h', 调: 't', 会: 'k', 乐: 'y', 参: 's', 数: 'c', 校: 'j', 觉: 'j', 少: 'd', 曲: 'q', 降: 'x', 便: 'p', 着: 'z', 差: 'c', 度: 'd', 率: 's', 地: 'd', 给: 'j', 假: 'j', 角: 'j', 解: 'x', 处: 'c', 切: 'q' })

let collator = null
const cache = new Map()
const isHan = (ch) => ch >= '一' && ch <= '鿿'
export const hasHan = (text) => { for (const ch of String(text)) if (isHan(ch)) return true; return false }
export const isHanChar = isHan

function initialOf(ch) {
  if (cache.has(ch)) return cache.get(ch)
  let out = ''
  try {
    collator ||= new Intl.Collator('zh-Hans-CN-u-co-pinyin')
    for (const [letter, boundary] of BOUNDARIES) { if (collator.compare(ch, boundary) >= 0) out = letter; else break }
  } catch { out = '' }
  cache.set(ch, out)
  return out
}

// the table, read on first use: character -> [reading in use, other readings...]
let table = null
function loadTable() {
  table = new Map()
  for (const [data, alt] of [[PINYIN_MAIN, false], [PINYIN_ALT, true]]) {
    for (const part of data.split(';')) {
      const at = part.indexOf(':')
      if (at < 1) continue
      const syllable = part.slice(0, at)
      for (const ch of part.slice(at + 1)) {
        const list = table.get(ch)
        if (!list) table.set(ch, [syllable])
        else if (alt && !list.includes(syllable)) list.push(syllable)
      }
    }
  }
}

/** The readings of a character as toneless syllables, the usual one first; null when the table lacks it. */
export function syllablesOf(ch) {
  if (!table) loadTable()
  return table.get(ch) || null
}

/** Whether every Han character of a text is in the table (a test of each product checks its own texts). */
export function uncoveredHan(text) {
  if (!table) loadTable()
  const out = new Set()
  for (const ch of String(text)) if (isHan(ch) && !table.has(ch)) out.add(ch)
  return [...out]
}

/**
 * The initials of a text as strings, with the index of the character each initial came from: [{ s: 'mlbz', at: [0, 1, 2, 3] }].
 * Han characters give their initial (two readings of a character give up to `max` strings); letters and digits stand for themselves; spaces and marks are skipped.
 */
export function initialsOf(text, max = 4) {
  const chars = Array.from(String(text))
  let variants = [{ s: '', at: [] }]
  chars.forEach((ch, i) => {
    let options = null
    if (isHan(ch)) {
      const known = syllablesOf(ch)
      if (known) options = [...new Set(known.map((s) => s[0]))]
      else { const a = initialOf(ch); if (a) options = [a]; if (ALSO[ch] && ALSO[ch] !== a) options = [...(options || []), ALSO[ch]] }
    } else if (/[a-z0-9]/i.test(ch)) options = [ch.toLowerCase()]
    if (!options) return
    const next = []
    for (const v of variants) for (const o of options) { if (next.length < max) next.push({ s: v.s + o, at: [...v.at, i] }) }
    variants = next
  })
  return variants.filter((v) => v.s)
}

/**
 * The text as a row of units for pinyin matching: [{ o: ['yin'], at: 0 }, { o: ['pin'], at: 1 }]. A unit is a Han character (its syllables) or a letter or digit
 * (itself); `at` is the index of the character in the text (for highlighting). Spaces and marks are skipped.
 */
export function pinyinUnits(text) {
  const units = []
  Array.from(String(text)).forEach((ch, at) => {
    if (isHan(ch)) {
      const known = syllablesOf(ch)
      if (known) units.push({ o: known, at })
      else { const a = initialOf(ch); if (a) units.push({ o: ALSO[ch] && ALSO[ch] !== a ? [a, ALSO[ch]] : [a], at }) }
    } else if (/[a-z0-9]/i.test(ch)) units.push({ o: [ch.toLowerCase()], at })
  })
  return units
}

/** The text as one string of syllables (the usual reading of each character, letters as they are): `音频` -> `yinpin`. */
export function pinyinString(text) {
  let out = ''
  for (const ch of String(text)) {
    if (isHan(ch)) out += syllablesOf(ch)?.[0] || initialOf(ch)
    else if (/[a-z0-9]/i.test(ch)) out += ch.toLowerCase()
  }
  return out
}

// ü is typed as v or u: both are the same letter here
const letters = (q) => String(q).replace(/v/g, 'u')

/**
 * Whether a query of letters (no spaces) is written in the pinyin of a run of the units. Each character may give its whole syllable or its initial, and the
 * last one a beginning of its syllable (a person is still typing): `yinpin`, `yp`, `yinp`, `yinpi` all find 音频. Returns { start, at: [unit indexes] } or null.
 */
export function pinyinMatch(units, query) {
  const q = letters(query)
  const n = units.length, m = q.length
  if (!m || !n) return null
  let dead = null
  const path = []
  const walk = (ui, qi) => {
    if (qi >= m) return true
    if (ui >= n) return false
    const key = ui * 256 + qi
    if (dead?.has(key)) return false
    const rest = m - qi
    path.push(ui)
    for (const raw of units[ui].o) {
      const o = raw.includes('v') ? letters(raw) : raw
      if (o.length <= rest) {
        if (q.startsWith(o, qi) && walk(ui + 1, qi + o.length)) return true
      } else if (o.startsWith(q.slice(qi))) return true
      if (o.length > 1) {
        // zh, ch, sh are one initial
        if (o[1] === 'h' && 'zcs'.includes(o[0]) && q.startsWith(o.slice(0, 2), qi) && walk(ui + 1, qi + 2)) return true
        if (q[qi] === o[0] && walk(ui + 1, qi + 1)) return true
      }
    }
    path.pop()
    ;(dead ||= new Set()).add(key)
    return false
  }
  const first = q[0]
  for (let s = 0; s < n; s++) {
    // a match starts with the first letter of a reading of the character it starts at
    if (!units[s].o.some((o) => o[0] === first)) continue
    path.length = 0
    if (walk(s, 0)) return { start: s, at: path.slice() }
  }
  return null
}
