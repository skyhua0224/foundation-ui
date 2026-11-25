// 薇薇 (Vivi, the mascot) and her two wallpapers: brand assets of AlkaidLab. They are not part of foundation-ui and not under its licence (see
// BRAND-ASSETS.md). A Product that has the right to use them imports this module and calls `registerViviAssets()` once, before it mounts; the
// library itself holds no picture.
import { registerMascot, registerWallpapers } from '../src/registry/index.js'

// every file is named literally so the bundlers find and copy it
export const VIVI_ART = Object.freeze({
  logo: Object.freeze({ 24: new URL('./vivi/vivi-logo-24.png', import.meta.url).href, 32: new URL('./vivi/vivi-logo-32.png', import.meta.url).href, 48: new URL('./vivi/vivi-logo-48.png', import.meta.url).href, 64: new URL('./vivi/vivi-logo-64.png', import.meta.url).href, 96: new URL('./vivi/vivi-logo-96.png', import.meta.url).href, 128: new URL('./vivi/vivi-logo-128.png', import.meta.url).href, 192: new URL('./vivi/vivi-logo-192.png', import.meta.url).href }),
  avatar: Object.freeze({ 256: new URL('./vivi/vivi-avatar-256.webp', import.meta.url).href, 384: new URL('./vivi/vivi-avatar-384.webp', import.meta.url).href, 512: new URL('./vivi/vivi-avatar-512.webp', import.meta.url).href, 768: new URL('./vivi/vivi-avatar-768.webp', import.meta.url).href, 1024: new URL('./vivi/vivi-avatar-1024.webp', import.meta.url).href }),
  clip: Object.freeze({ 24: new URL('./vivi/vivi-clip-24.png', import.meta.url).href, 32: new URL('./vivi/vivi-clip-32.png', import.meta.url).href, 48: new URL('./vivi/vivi-clip-48.png', import.meta.url).href, 64: new URL('./vivi/vivi-clip-64.webp', import.meta.url).href, 96: new URL('./vivi/vivi-clip-96.webp', import.meta.url).href, 128: new URL('./vivi/vivi-clip-128.webp', import.meta.url).href, 256: new URL('./vivi/vivi-clip-256.webp', import.meta.url).href, 512: new URL('./vivi/vivi-clip-512.webp', import.meta.url).href }),
  loading: new URL('./vivi/vivi-loading.webp', import.meta.url).href, // four open-eyed frames, 288 x 392 each
  bg: new URL('./vivi/vivi-bg.webp', import.meta.url).href,
  buttons: Object.freeze({ close: new URL('./vivi/btn-close.svg', import.meta.url).href, maximize: new URL('./vivi/btn-maximize.svg', import.meta.url).href, minimize: new URL('./vivi/btn-minimize.svg', import.meta.url).href, restore: new URL('./vivi/btn-restore.svg', import.meta.url).href }),
})

/** focus: the middle of her face as a fraction of the picture (measured on the pictures themselves). */
export const VIVI_WALLPAPERS = Object.freeze([
  Object.freeze({ id: 'vivi1', url: new URL('./vivi/vivi-wallpaper-1.webp', import.meta.url).href, w: 1491, h: 1055, focus: Object.freeze({ x: 0.60, y: 0.50 }), labelKey: 'srcVivi1' }),
  Object.freeze({ id: 'vivi2', url: new URL('./vivi/vivi-wallpaper-2.webp', import.meta.url).href, w: 1672, h: 941, focus: Object.freeze({ x: 0.63, y: 0.52 }), labelKey: 'srcVivi2' }),
])
/** Auto: the narrow picture for tall and square windows, the wide one for wide windows; the colours always grow from the wide one. */
export const VIVI_AUTO = Object.freeze({ narrow: 'vivi1', wide: 'vivi2', colour: 'vivi2' })

/** Registers 薇薇 (the mascot slots) and her two wallpapers (with Auto). Call it once, before the first mount. */
export function registerViviAssets() {
  registerMascot(VIVI_ART)
  registerWallpapers(VIVI_WALLPAPERS, { auto: VIVI_AUTO })
}
