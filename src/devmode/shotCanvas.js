// The canvas side of the screenshot redaction: decode the PNG, paint the boxes black, encode again and strip what the encoder or the source put in (shot.js). Nothing leaves this file unmasked:
// when a canvas is not there or the encode fails, the answer is null and the report has no screenshot (never the original).
import { MASK_FILL, clampRect, mapRects, mergeRects, pngInfo, stripPngMetadata } from './shot.js'

const makeCanvas = (w, h) => {
  if (typeof document !== 'undefined' && document.createElement) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  return null
}
async function decode(bytes) {
  const blob = new Blob([bytes], { type: 'image/png' })
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob)
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url })
  } finally { URL.revokeObjectURL(url) }
}
async function encode(canvas) {
  const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type: 'image/png' }) : await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

/** PNG bytes + boxes (image pixels) -> { bytes, width, height } with the boxes painted black and the metadata stripped; null on any failure. */
export async function paintMasks(bytes, rects) {
  try {
    const bitmap = await decode(bytes)
    const width = bitmap.width, height = bitmap.height
    const canvas = makeCanvas(width, height)
    const ctx = canvas?.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0)
    ctx.fillStyle = MASK_FILL
    for (const raw of rects || []) { const r = clampRect(raw, width, height); if (r) ctx.fillRect(r.x, r.y, r.w, r.h) }
    bitmap.close?.()
    const out = await encode(canvas)
    const clean = out && stripPngMetadata(out)
    return clean ? { bytes: clean, width, height } : null
  } catch { return null }
}

/**
 * The automatic redaction of a capture: the marked boxes of the window (CSS pixels, taken at the capture) are mapped onto the picture and painted. -> { bytes, width, height, regions } or null.
 * `regions` are the boxes in image pixels (merged), so the sheet can outline them and count them.
 * One decode and one encode: the size comes from the PNG header, the boxes are painted on the decoded picture and only that canvas is encoded (the original never leaves this function). A picture whose decoded
 * size is not the size its header says is refused (null), like any other failure.
 */
export async function maskCapture(bytes, cssRects, view) {
  const info = pngInfo(bytes)
  if (!info || !(info.width > 0) || !(info.height > 0)) return null
  const regions = mergeRects(mapRects(cssRects, view, info))
  const done = await paintMasks(bytes, regions)
  return done && done.width === info.width && done.height === info.height ? { ...done, regions } : null
}
