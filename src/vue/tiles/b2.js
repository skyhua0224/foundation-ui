// Shared reading of the B2 tiles (round 31; docs/tile-kit.md): plain functions over a card's data, nothing invented.

/** The size a B2 design draws: s, m, l, xl (特大竖 draws 大: none of B2's tiles has a portrait layout). */
export const sizeB2 = (card) => ({ s: 's', m: 'm', l: 'l', xl: 'xl' }[card?.size] || (card?.size === 'xlp' ? 'l' : 'm'))
/** The first letter of a name, upper case (a CJK name: its first character). */
export const initialOf = (name) => String(name || '?').trim().charAt(0).toUpperCase() || '?'
/** A device's glyph: the client's own icon, or '' (the circle then shows the initial of its name). */
export const deviceGlyph = (icon) => (icon && icon !== 'devices' ? icon : '')
/** '2560×1440 · 120' -> { w: 2560, h: 1440, label: '1440p', hz: 120 } */
export const modeOf = (s) => { const m = /(\d{3,5})\s*[×x]\s*(\d{3,5})(?:\s*·\s*(\d+))?/.exec(String(s || '')); return m ? { w: +m[1], h: +m[2], label: `${m[2]}p`, hz: m[3] ? +m[3] : null } : null }
/** '1 h 42 min' / '1小时42分' -> [{ v, u }]: the numerals of a length and their units, for the display numeral */
export const lengthParts = (s) => [...String(s || '').matchAll(/(\d+(?:\.\d+)?)\s*([^\d\s]*)/g)].map((m) => ({ v: m[1], u: m[2] }))
/**
 * The buttons of a setting tile that holds a choice: three (`limit`; 大 of the 手柄类型 shows every type), never fewer than the one in use. The first option, the one in use, then the most likely of the rest (`likely`, in that order),
 * shown in the order of the page. A setting with three options or fewer shows them all. `more`: there are options the buttons do not show (the chevron opens them all).
 */
export function choicesOf(options, value, { first = null, likely = [], limit = 3 } = {}) {
  const all = Array.isArray(options) ? options : []
  if (all.length <= limit) return { shown: all, more: false }
  const has = (v) => all.some((o) => String(o.value) === String(v))
  const pick = []
  const add = (v) => { if (pick.length < limit && has(v) && !pick.includes(String(v))) pick.push(String(v)) }
  add(first ?? all[0].value); add(value ?? ''); for (const v of likely) add(v)
  for (const o of all) add(o.value)
  return { shown: all.filter((o) => pick.includes(String(o.value))), more: true }
}
/** 手柄类型: 自动, the type in use, then Xbox 360, DualSense, DualShock 4. */
export const padChoices = (options, value, limit = 3) => choicesOf(options, value, { first: 'auto', likely: ['x360', 'ds5', 'ds4'], limit })

/** The note under the controller type: a live note the product set on the strip (a client pad runs as a DS4) comes
 *  first, then the note of when a change of the type applies. */
export const padNoteOf = (data, texts) => String(data?.note || '') || (data?.applies === 'next' ? texts.padNote : texts.restartNote)

/** The name a resolution goes by (the hero of the tiles of a resolution): 3840x2160 -> '4K', 2560x1440 -> '2K', 7680x4320 -> '8K'; the others keep their height ('1080p', '720p', '3440x1440 -> 1440p'). A height alone (no width yet) is read as the 16 : 9 size of that height. */
const STANDARD = { '3840x2160': '4K', '4096x2160': '4K', '2560x1440': '2K', '7680x4320': '8K' }
const BY_HEIGHT = { 2160: '4K', 1440: '2K', 4320: '8K' }
export const resNameOf = (w, h) => {
  const hh = Math.round(Number(h) || 0); if (!hh) return ''
  const ww = Math.round(Number(w) || 0)
  return (ww ? STANDARD[`${ww}x${hh}`] : BY_HEIGHT[hh]) || `${hh}p`
}

