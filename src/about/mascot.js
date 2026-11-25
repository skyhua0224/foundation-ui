// 薇薇 (Vivi) as a registered figure. The library ships no picture of her: a Product that has her art registers it once (`registerMascot`, from
// `foundation-ui/registry`), before anything is mounted. A Product that registers nothing carries no picture.
// Every file is its own downscale of the original art, so each size is crisp: the small sizes are made from the original no-background art, the large
// ones from the avatar render. A slot asks for the size it draws and the density of the screen; `viviImage` returns the file that fits (never a big
// image shrunk by the browser). Nothing registered: every lookup answers an empty string, and the slots that draw her leave themselves out.
const NONE = Object.freeze({})
let art = null

/** The registered art: { logo: {px: url}, avatar: {px: url}, clip: {px: url}, loading, bg, buttons: {close, maximize, minimize, restore} }, or null to clear it. */
export function registerMascot(next) {
  art = next ? Object.freeze({ logo: Object.freeze({ ...next.logo }), avatar: Object.freeze({ ...next.avatar }), clip: Object.freeze({ ...next.clip }), loading: next.loading || '', bg: next.bg || '', buttons: Object.freeze({ ...next.buttons }) }) : null
}
export const hasMascot = () => !!art

/** The figure's files, read at the moment of use (empty while nothing is registered). */
export const VIVI = Object.freeze({
  get logo() { return art ? art.logo : NONE },
  get avatar() { return art ? art.avatar : NONE },
  get clip() { return art ? art.clip : NONE },
  get loading() { return art ? art.loading : '' }, // four open-eyed frames, 288 x 392 each
  get bg() { return art ? art.bg : '' },
  get buttons() { return art ? art.buttons : NONE },
})
const sizesOf = (map) => Object.keys(map).map(Number).sort((a, b) => a - b)
const atLeast = (sizes, need) => sizes.find((s) => s >= need) ?? sizes[sizes.length - 1]
const NO_IMAGE = Object.freeze({ src: '', srcset: '', size: 0 })

/**
 * The file of the figure for a slot: `px` CSS pixels at `dpr` device pixels per CSS pixel. Up to the largest logo the no-background original art,
 * above that the avatar render. Returns { src, srcset, size } with a 1x and a 2x candidate so the browser can also choose by its own density.
 * Nothing registered: { src: '', srcset: '', size: 0 }.
 */
export function viviImage(px, dpr = 1) {
  if (!art) return NO_IMAGE
  const logoSizes = sizesOf(art.logo), avatarSizes = sizesOf(art.avatar), max = logoSizes[logoSizes.length - 1]
  const one = (d) => { const need = Math.ceil(px * d); return need <= max ? { file: art.logo[atLeast(logoSizes, need)], w: atLeast(logoSizes, need) } : { file: art.avatar[atLeast(avatarSizes, need)], w: atLeast(avatarSizes, need) } }
  const a = one(1), b = one(2), c = one(dpr)
  return { src: c.file, size: c.w, srcset: a.file === b.file ? '' : `${a.file} 1x, ${b.file} 2x` }
}

/** The clip for a button of `px` CSS pixels: the head only up to 48 device pixels, the whole clip above. '' while nothing is registered. */
export function viviClip(px, dpr = 1) {
  if (!art) return ''
  const need = Math.ceil(px * dpr)
  return art.clip[atLeast(sizesOf(art.clip), need)] || ''
}

/** The names the older call sites use: 45 (small mark), 256 (avatar), 1024 (hero). */
export const MASCOT = Object.freeze({
  get 45() { return art ? art.logo[48] || '' : '' },
  get 256() { return art ? art.avatar[256] || '' : '' },
  get 1024() { return art ? art.avatar[1024] || '' : '' },
})
