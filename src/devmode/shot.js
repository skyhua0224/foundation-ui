// The screenshot of a report is a picture of our own window, so it is redacted by structure, not by looking at the pixels: the elements that carry something private are marked data-redact in the markup
// (a host name, an address and port, a PIN or pairing code, a client name, the user, a path, a serial number, the Web address). Their boxes are measured at the moment of the capture and painted over before
// the image is encoded; the person can add more boxes by hand, and can never take an automatic one away. Pure and framework-free here; the canvas work is in shotCanvas.js.
//
// Where the picture comes from the native side (the window with its frame) the content is not at 0,0: the offset is worked out from the sizes (mapRects).

/** The mark a settings key deserves, from its name: what it holds says whose machine this is (a file or folder, an address, a name, a serial). '' for a key that holds nothing private. */
export function redactKindOf(key) {
  const k = String(key || '').toLowerCase()
  if (!k) return ''
  if (/(serial|uuid|guid|edid|device_id|unique)/.test(k)) return 'serial'
  if (/(path|file|dir|folder|cert|pkey|credential|cmd|command|apps|exe|prep|image)/.test(k)) return 'path'
  if (/(addr|(^|_)ip|url|host|domain|ssid|mac|origin|external|upnp|webhook|proxy)/.test(k)) return 'address'
  if (/name/.test(k)) return 'host'
  return ''
}

/** What a data-redact mark may say. Only for the summary and the outline label; every kind is painted the same. */
export const REDACT_KINDS = Object.freeze(['host', 'address', 'pin', 'client', 'user', 'path', 'serial', 'web', 'secret', 'text'])
export const SELECTOR = '[data-redact], input[inputmode="numeric"], input[name*="pin" i], input[name*="port" i], input[type="password"], input[name*="cdk" i], input[id*="cdk" i], input[autocomplete="off"][placeholder*="CDK"], input[autocomplete="one-time-code"], input[autocomplete="username"], input[autocomplete="current-password"], input[autocomplete="new-password"]'
export const PAD = 3
const FILL = 'rgb(0, 0, 0)'
export const MASK_FILL = FILL
export const MAX_RECTS = 400

const num = (v) => (Number.isFinite(v) ? v : 0)
/** A rectangle { x, y, w, h } (+ kind) clamped to a box of w x h; null when nothing is left. */
export function clampRect(r, w, h) {
  const x0 = Math.max(0, Math.floor(num(r.x))), y0 = Math.max(0, Math.floor(num(r.y)))
  const x1 = Math.min(w, Math.ceil(num(r.x) + num(r.w))), y1 = Math.min(h, Math.ceil(num(r.y) + num(r.h)))
  if (x1 - x0 < 1 || y1 - y0 < 1) return null
  return { ...r, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** A frame that cannot show anything: hidden by style (the product's own sleeping frames are about:blank, which is readable and empty). It is not judged by what is on top: a modal scrim over a visible frame must not hide it from the redaction. */
function frameShows(root, frame) {
  try {
    const style = root?.defaultView?.getComputedStyle?.(frame) || (typeof getComputedStyle === 'function' ? getComputedStyle(frame) : null)
    if (style && (style.visibility === 'hidden' || style.display === 'none')) return false
  } catch { /* judged as shown */ }
  return true
}

/**
 * The boxes (CSS pixels, relative to the viewport) of every marked element under `root` that can be seen. A hidden or collapsed element has no box; one outside the viewport is left out.
 * A frame of the same origin is read too (its boxes moved by the frame's own position). A frame that cannot be read is listed in `unreadable` when the caller gives one (frameRects.js asks it), and is covered whole otherwise, because nothing in it can be checked.
 */
export function collectRedactRects(root, view = {}, offset = { x: 0, y: 0 }, depth = 0, unreadable = null) {
  const vw = view.width || (typeof window !== 'undefined' ? window.innerWidth : 0)
  const vh = view.height || (typeof window !== 'undefined' ? window.innerHeight : 0)
  const out = []
  const push = (box, kind) => {
    const r = clampRect({ x: offset.x + box.left - PAD, y: offset.y + box.top - PAD, w: box.width + PAD * 2, h: box.height + PAD * 2, kind }, vw, vh)
    if (r) out.push(r)
  }
  let list = []
  try { list = Array.from(root?.querySelectorAll?.(SELECTOR) || []) } catch { list = [] }
  for (const el of list) {
    if (out.length >= MAX_RECTS) break
    const box = el.getBoundingClientRect?.()
    if (!box || !(box.width > 0) || !(box.height > 0)) continue
    push(box, el.getAttribute?.('data-redact') || (el.type === 'password' ? 'secret' : 'text'))
  }
  let frames = []
  try { frames = depth < 3 ? Array.from(root?.querySelectorAll?.('iframe, frame') || []) : [] } catch { frames = [] }
  for (const frame of frames) {
    const box = frame.getBoundingClientRect?.()
    if (!box || !(box.width > 0) || !(box.height > 0)) continue
    if (!frameShows(root, frame)) continue
    let doc = null
    try { doc = frame.contentDocument } catch { doc = null }
    if (doc?.body) out.push(...collectRedactRects(doc, view, { x: offset.x + box.left, y: offset.y + box.top }, depth + 1, unreadable))
    else if (unreadable && !offset.x && !offset.y) unreadable.push({ frame, box: { left: box.left, top: box.top, width: box.width, height: box.height } })
    else push({ left: box.left + PAD, top: box.top + PAD, width: box.width - PAD * 2 + 0, height: box.height - PAD * 2 }, 'text')
  }
  return out.slice(0, MAX_RECTS)
}

/**
 * CSS-pixel boxes -> image pixels. `view`: { width, height, dpr } of the window content; `image`: { width, height } of the picture. A picture of exactly the content (a canvas capture of the page) has no offset;
 * one that is larger (the native window with its title bar and border) has the content at the bottom right of the extra space horizontally centred: the frame is on top and at the sides.
 */
export function mapRects(rects, view, image) {
  const dpr = view.dpr > 0 ? view.dpr : 1
  const cw = view.width * dpr, ch = view.height * dpr
  const extraW = Math.max(0, image.width - cw), extraH = Math.max(0, image.height - ch)
  const ox = Math.round(extraW / 2), oy = Math.round(extraH - extraW / 2)
  const sx = cw > 0 && image.width <= cw ? image.width / cw : 1
  const sy = ch > 0 && image.height <= ch ? image.height / ch : 1
  return rects.map((r) => clampRect({ ...r, x: ox + r.x * dpr * sx, y: Math.max(0, oy) + r.y * dpr * sy, w: r.w * dpr * sx, h: r.h * dpr * sy }, image.width, image.height)).filter(Boolean)
}

/** Overlapping or touching boxes become one (the count in the summary is regions, not elements). */
export function mergeRects(rects) {
  const list = rects.map((r) => ({ ...r }))
  let changed = true
  while (changed) {
    changed = false
    outer: for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i], b = list[j]
        if (a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
          list[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y, kind: a.kind === b.kind ? a.kind : 'text' }
          list.splice(j, 1)
          changed = true
          break outer
        }
      }
    }
  }
  return list
}

/** Paints boxes over RGBA pixels (4 bytes a pixel, row by row) in place. The browser path paints on a canvas; this is the same operation on bytes, for tests and for a host without a canvas. */
export function maskPixels(rgba, width, height, rects) {
  for (const raw of rects) {
    const r = clampRect(raw, width, height)
    if (!r) continue
    for (let y = r.y; y < r.y + r.h; y += 1) {
      let i = (y * width + r.x) * 4
      for (let x = 0; x < r.w; x += 1, i += 4) { rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = 255 }
    }
  }
  return rgba
}

// ---- PNG bytes
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'])
const isPng = (b) => b instanceof Uint8Array && b.length > 33 && SIGNATURE.every((v, i) => b[i] === v)
const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
const typeAt = (b, i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3])

/** [{ type, length }] for every chunk of a PNG (what is in the file); [] when it is not a PNG or is cut short. */
export function pngChunks(bytes) {
  if (!isPng(bytes)) return []
  const out = []
  for (let i = 8; i + 12 <= bytes.length;) {
    const length = u32(bytes, i)
    if (i + 12 + length > bytes.length) return []
    out.push({ type: typeAt(bytes, i + 4), length })
    i += 12 + length
  }
  return out
}
export function pngInfo(bytes) {
  if (!isPng(bytes) || typeAt(bytes, 12) !== 'IHDR') return null
  return { width: u32(bytes, 16), height: u32(bytes, 20) }
}
/** The same picture with only the chunks that draw it (header, palette, transparency, data, end). Text (tEXt, iTXt, zTXt), time, EXIF (eXIf), colour profile and every other kind of metadata are gone. null when it is not a PNG. */
export function stripPngMetadata(bytes) {
  if (!isPng(bytes)) return null
  const parts = [Uint8Array.from(SIGNATURE)]
  let total = 8
  for (let i = 8; i + 12 <= bytes.length;) {
    const length = u32(bytes, i)
    if (i + 12 + length > bytes.length) return null
    if (KEEP.has(typeAt(bytes, i + 4))) { const chunk = bytes.subarray(i, i + 12 + length); parts.push(chunk); total += chunk.length }
    i += 12 + length
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

/** The summary line of the picture: how many boxes the markup made and how many the person added. */
export const regionCount = ({ auto = [], manual = [] } = {}) => ({ auto: auto.length, manual: manual.length, total: auto.length + manual.length })
