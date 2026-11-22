// The screenshot of a feedback report: which files are taken, how large it may be, and how a picture that is too large is made to fit. Pure and framework-free; the canvas work is `canvasCodec()` at the end, and
// the tests give `compressShot` a codec of their own.
//   Only PNG, JPEG and WebP are taken, found by the first bytes of the file (the name and the declared type of a file say nothing). The Worker checks the same again and takes the metadata out (EXIF, text chunks,
//   colour profile) of what it stores; the redaction of the window (shot.js) and the person's own boxes are painted before anything here runs.
//   A picture is sent at most SHOT_LIMITS.sendBytes (it travels inside the report, base64, through the host to the Worker's 1 MiB limit) and SHOT_LIMITS.maxSide pixels on its long side. A larger one is scaled down and,
//   when that is not enough, written as WebP (or JPEG where the browser cannot write WebP) at a lower quality, a few steps, before it is refused as too large.

export const SHOT_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp'])
export const SHOT_LIMITS = Object.freeze({
  /** a file larger than this is not even opened (a picture of 20 MiB is a photograph, not a screenshot) */
  inputBytes: 20 * 1024 * 1024,
  /** what travels with the report */
  sendBytes: 700 * 1024,
  /** the long side of what is kept and sent, in pixels */
  maxSide: 1920,
  /** the smallest long side the compression goes down to before it gives up */
  minSide: 1080,
})

const at = (b, i) => (b && b.length > i ? b[i] : -1)
/** The type of a picture by its first bytes: 'image/png' | 'image/jpeg' | 'image/webp' | ''. */
export function sniffShotType(bytes) {
  if (!bytes || bytes.length < 12) return ''
  if (at(bytes, 0) === 0x89 && at(bytes, 1) === 0x50 && at(bytes, 2) === 0x4e && at(bytes, 3) === 0x47 && at(bytes, 4) === 0x0d && at(bytes, 5) === 0x0a && at(bytes, 6) === 0x1a && at(bytes, 7) === 0x0a) return 'image/png'
  if (at(bytes, 0) === 0xff && at(bytes, 1) === 0xd8 && at(bytes, 2) === 0xff) return 'image/jpeg'
  const tag = (i) => String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3])
  if (tag(0) === 'RIFF' && tag(8) === 'WEBP') return 'image/webp'
  return ''
}

/** Whether a file may be taken at all: { ok: true, type } or { ok: false, reason: 'empty' | 'type' | 'input_too_large' }. */
export function checkShotFile(bytes, limits = SHOT_LIMITS) {
  if (!bytes || !bytes.length) return { ok: false, reason: 'empty' }
  if (bytes.length > limits.inputBytes) return { ok: false, reason: 'input_too_large' }
  const type = sniffShotType(bytes)
  return type ? { ok: true, type } : { ok: false, reason: 'type' }
}

/** A size scaled to a long side of at most `max` (never up), whole pixels. */
export function fitSide(width, height, max) {
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height))
  const long = Math.max(w, h)
  if (long <= max) return { width: w, height: h }
  const k = max / long
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

/**
 * The tries, in order, for a picture of this size: first the picture at its own size when it is within the long side, then PNG at the long sides 1920, 1440, 1080, then WebP at 1920, 1440, 1080 with falling quality, then JPEG (the way out where the browser cannot write WebP). The first result within `maxBytes` is taken. `formats` limits what may be written (a normalisation that wants PNG only).
 */
export function compressPlan(width, height, { maxSide = SHOT_LIMITS.maxSide, minSide = SHOT_LIMITS.minSide, formats = ['image/png', 'image/webp', 'image/jpeg'] } = {}) {
  const sides = [maxSide, Math.round((maxSide + minSide) / 2), minSide].filter((s, i, a) => s >= minSide && a.indexOf(s) === i)
  const plan = []
  for (const side of sides) {
    const size = fitSide(width, height, side)
    if (formats.includes('image/png')) plan.push({ ...size, type: 'image/png', quality: 1 })
    if (formats.includes('image/webp')) for (const q of [0.88, 0.76, 0.62]) plan.push({ ...size, type: 'image/webp', quality: q })
  }
  // JPEG last: the way out of a browser that cannot write WebP (it answers PNG for every WebP try, which is skipped)
  if (formats.includes('image/jpeg')) for (const side of sides) for (const q of [0.82, 0.66]) plan.push({ ...fitSide(width, height, side), type: 'image/jpeg', quality: q })
  return plan
}

/**
 * Makes a picture fit. `codec` = { decode(bytes) -> { width, height, close?() }, encode(image, { width, height, type, quality }) -> { bytes, type } | null }.
 * -> { ok: true, bytes, type, width, height, changed } or { ok: false, reason: 'unreadable' | 'cannot_fit' }.
 * A picture that already fits (type allowed, within the long side and `maxBytes`) is returned as it is, so a PNG of a window is not written twice.
 */
export async function compressShot(bytes, { codec, maxBytes = SHOT_LIMITS.sendBytes, maxSide = SHOT_LIMITS.maxSide, minSide = SHOT_LIMITS.minSide, formats } = {}) {
  const found = checkShotFile(bytes, { ...SHOT_LIMITS, inputBytes: Infinity })
  if (!found.ok) return { ok: false, reason: found.reason === 'type' ? 'unreadable' : found.reason }
  let image
  try { image = await codec.decode(bytes) } catch { return { ok: false, reason: 'unreadable' } }
  if (!image || !(image.width > 0) || !(image.height > 0)) return { ok: false, reason: 'unreadable' }
  try {
    const allowed = !formats || formats.includes(found.type)
    if (allowed && bytes.length <= maxBytes && Math.max(image.width, image.height) <= maxSide) return { ok: true, bytes, type: found.type, width: image.width, height: image.height, changed: false }
    for (const step of compressPlan(image.width, image.height, { maxSide, minSide, formats })) {
      let out = null
      try { out = await codec.encode(image, step) } catch { out = null }
      if (!out || !out.bytes || !out.bytes.length) continue
      if (out.type !== step.type) continue // the browser wrote another type than asked (WebP unsupported): the next step names one it can write
      if (out.bytes.length <= maxBytes) return { ok: true, bytes: out.bytes, type: out.type, width: step.width, height: step.height, changed: true }
    }
    return { ok: false, reason: 'cannot_fit' }
  } finally { image.close?.() }
}

/** Base64 of bytes (in pieces, so a large picture does not overflow the argument limit). */
export function bytesToBase64(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(out)
}
export function base64ToBytes(text) {
  const raw = atob(String(text || ''))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

/** "312 KB" / "1.4 MB" */
export const sizeText = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** The codec of a window: createImageBitmap to read, a canvas to write. Null where there is no canvas (the person then gets "unreadable"). */
export function canvasCodec() {
  const make = (w, h) => {
    if (typeof document !== 'undefined' && document.createElement) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
    return null
  }
  return {
    async decode(bytes) {
      const blob = new Blob([bytes], { type: sniffShotType(bytes) })
      if (typeof createImageBitmap === 'function') return createImageBitmap(blob)
      const url = URL.createObjectURL(blob)
      try { return await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, source: img }); img.onerror = reject; img.src = url }) } finally { URL.revokeObjectURL(url) }
    },
    async encode(image, { width, height, type, quality }) {
      const canvas = make(width, height)
      const ctx = canvas?.getContext('2d')
      if (!ctx) return null
      // a JPEG has no transparency: the picture is laid on white first
      if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height) }
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image.source || image, 0, 0, width, height)
      const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type, quality }) : await new Promise((resolve) => canvas.toBlob(resolve, type, quality))
      return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type } : null
    },
  }
}
