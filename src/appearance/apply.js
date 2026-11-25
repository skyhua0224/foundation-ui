import { applyTheme, seedFromImage, warmTheme } from '../tokens/theme.js'
import { persistBoot } from './boot.js'
import { PRESET_SEEDS, DEFAULT_GRADIENT, DEFAULT_WALLPAPER_STATS, UNREADABLE_STATS, frostFor, imageSource, imageStats, seedFor, scrimsFor } from './appearance.js'
import { WALLPAPERS, autoPick, colourPictureId, wallpaperBox } from './wallpaper.js'
import { bakeInWorker, canBakeInWorker } from './bakeWorker.js'
import { readPicturePalette } from './pictureRead.js'
import { reducedMotion } from './motion.js'
import { applyListStyle, setListStyle } from './listStyle.js'

// how the list pane meets the frame, for the first frame (the mirror of the record's choice, or the address): html[data-list]
applyListStyle()

const loadImage = (url, { cors, timeout }) => new Promise((resolve, reject) => {
  const img = new Image()
  if (cors) img.crossOrigin = 'anonymous'
  const timer = setTimeout(() => { img.src = ''; reject(new Error('timeout')) }, timeout)
  // decoded off the main thread before anyone paints or draws it: the first paint of a 4K picture decoded on the spot costs the frame that shows it
  img.onload = () => { clearTimeout(timer); (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => resolve(img)) }
  img.onerror = () => { clearTimeout(timer); reject(new Error('load')) }
  img.src = url
})

const readCache = new Map()
/** Loads the picture: readable pixels when the source allows it (own file, built-in, CORS), else shown but unreadable. Never hangs: `timeout` ms. */
export async function readPicture(url, { timeout = 8000 } = {}) {
  if (url === 'gradient') return { readable: false, stats: DEFAULT_WALLPAPER_STATS, seed: null, gradient: DEFAULT_GRADIENT }
  if (readCache.has(url)) return readCache.get(url)
  let pic
  try {
    // the palette comes from a small decoded copy, read in a worker (pictureRead.js); the full picture is loaded for showing only, and where the small
    // copy cannot be made the old way is used: the whole picture drawn into a canvas on the main thread
    try {
      const { stats, seed, seeds } = await readPicturePalette(url, { timeout })
      pic = { readable: true, stats, seed, seeds: seeds?.length ? seeds : [seed] }
    } catch (fast) {
      if (fast && fast.message === 'timeout') throw fast
      const img = await loadImage(url, { cors: true, timeout })
      const c = document.createElement('canvas'); const w = 64, h = Math.max(1, Math.round(64 * img.naturalHeight / img.naturalWidth)); c.width = w; c.height = h
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h)
      const d = x.getImageData(0, 0, w, h).data
      const seed = await seedFromImage(img)
      pic = { readable: true, stats: imageStats(d, w, h), seed, seeds: [seed] }
    }
  } catch (e) {
    if (e.message === 'timeout') throw e
    await loadImage(url, { cors: false, timeout }) // shown, not readable
    pic = { readable: false, stats: UNREADABLE_STATS, seed: null }
  }
  if (readCache.size > 8) readCache.clear()
  readCache.set(url, pic)
  return pic
}

// ---- the wallpaper layers: two, so a picture can cross-fade into the next one --------------------------------------------------------------
let layers = null
let front = 'a'
let shown = null // { css, url, picture, readable, gradient } of the front layer
let lastState = null
let lastFile = ''
let autoId = null
let resizeBound = false
const reduced = reducedMotion

function ensureLayers() {
  if (layers && layers.root.isConnected) return layers
  const root = document.createElement('div')
  root.className = 'm-wp'; root.setAttribute('aria-hidden', 'true')
  const a = document.createElement('i'), b = document.createElement('i')
  root.append(a, b); document.body.prepend(root)
  layers = { root, a, b }
  // the panes of the window change width now and then (list pane, rail, a page that is wider): place the picture again when they did
  let sig = ''
  setInterval(() => { if (document.hidden) return; const v = viewBox(); const next = JSON.stringify([Math.round(v.left), Math.round(v.width), Math.round(v.height), ...covered(v).map((r) => [Math.round(r.left), Math.round(r.right)])]); if (next !== sig) { sig = next; relayout() } }, 800)
  return layers
}

/** The shape of the window, known before the layer shows: what Auto picks the picture by (the picture and its frost span the whole window). */
function panelShape() { return { width: Math.max(1, window.innerWidth), height: Math.max(1, window.innerHeight) } }

/** The box the picture lies in: the whole window, behind the frame, the list pane and the content alike. */
function viewBox() {
  const r = layers?.root.getBoundingClientRect()
  return r && r.width > 0 && r.height > 0 ? { left: r.left, width: r.width, height: r.height } : { left: 0, width: window.innerWidth, height: window.innerHeight }
}

/** The horizontal ranges, in the picture's own box, that the list pane and the page column sit on: the picture is placed so her face is in what is left. */
function covered(view = viewBox()) {
  const out = []
  for (const sel of ['.m-rail:not(.m-rail--bar)', '.m-scene__pane--list', '.m-page__column', '[data-wp-cover]']) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      const left = Math.max(0, r.left - view.left), right = Math.min(view.width, r.right - view.left)
      if (r.width > 0 && r.height > 0 && right > left) out.push({ left, right })
    }
  }
  return out
}

// the least width of a gap beside the content in which the whole picture is shown (small, its edges faded into a plain field)
const WHOLE_MIN_GAP = 0 // off: the frosted layer blurs the picture, a small whole copy of it would only be a smudge

/**
 * The blur of the frosted layer is done once, not by the compositor on every frame: the picture is placed (wallpaper.js), drawn blurred into a
 * small canvas (a quarter of the size, so the blur is cheap and the scaling back up softens it further) and the result is the layer's image. A
 * live backdrop blur over the whole window cost twice the frame time of the page under it while it scrolled (software rendering, tools/perf-frost.mjs);
 * the baked copy costs nothing per frame. The copy is made again when the picture, the window, the placement or the blur changes (and kept for the
 * last few). A picture the canvas may not read (a remote one without CORS) is blurred live by a CSS filter on its layer instead.
 */
const canBake = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype // a WebView without canvas filters blurs live
const baked = new Map()
let workerBake = canBake && canBakeInWorker() // the draw and the encoding run in a worker; the main thread draws them itself where there is none
const bakeKey = (url, view, box, blur) => [url.length > 160 ? `${url.length}:${url.slice(-60)}` : url, Math.round(view.width), Math.round(view.height), Math.round(box.left), Math.round(box.top), Math.round(box.size), blur].join('|')
const margin = (blur) => Math.ceil(Math.min(160, blur * 2.5))
async function bake(url, picture, view, box, blur, img) {
  const key = bakeKey(url, view, box, blur)
  if (baked.has(key)) return baked.get(key)
  const f = blur >= 24 ? 4 : blur >= 8 ? 3 : 2
  const M = margin(blur)
  const w = Math.ceil((view.width + 2 * M) / f), h = Math.ceil((view.height + 2 * M) / f)
  const ih = box.size * picture.h / picture.w
  // the picture reaches a margin beyond the window on every side (stretched by the few per cent it takes), so the blur has no empty edge
  const L = Math.min(box.left, -M), T = Math.min(box.top, -M), R = Math.max(box.left + box.size, view.width + M), B = Math.max(box.top + ih, view.height + M)
  const [dx, dy, dw, dh] = [(L + M) / f, (T + M) / f, (R - L) / f, (B - T) / f]
  let blob = null
  if (workerBake) {
    try { blob = await bakeInWorker({ key: bakeKey(url, { width: 0, height: 0 }, { left: 0, top: 0, size: 0 }, 0), image: img, w, h, dx, dy, dw, dh, blur: blur / f }) } catch { workerBake = false }
  }
  if (!blob) {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d')
    x.filter = `blur(${blur / f}px)`
    x.drawImage(img, dx, dy, dw, dh)
    blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.88)) // not WebP: its encoder took 30 to 70 ms of the main thread here, JPEG 1 to 5 ms; the picture has no alpha
  }
  if (!blob) throw new Error('bake')
  const href = URL.createObjectURL(blob)
  baked.set(key, href)
  if (baked.size > 6) { const [oldKey, oldHref] = baked.entries().next().value; baked.delete(oldKey); setTimeout(() => URL.revokeObjectURL(oldHref), 2000) }
  return href
}
const currentBlur = () => (lastState ? frostFor(lastState, scope).blur : 0)

/** Sets the picture of a layer: baked blur where the canvas may read it, else the picture itself under a CSS blur. */
async function dress(el, shown, blur) {
  el.style.filter = ''; el.style.inset = ''
  if (shown.gradient) { el.style.backgroundImage = shown.css; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; return }
  const view = viewBox()
  let img = null
  try { img = await shownImage(shown) } catch { img = null }
  const pic = shown.picture || (img ? { w: img.naturalWidth, h: img.naturalHeight, focus: { x: 0.5, y: 0.5 } } : null)
  if (!pic) { el.style.backgroundImage = shown.css; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; return }
  const box = wallpaperBox(pic, { width: view.width, height: view.height }, shown.picture ? covered(view) : [], { whole: WHOLE_MIN_GAP })
  if (canBake && shown.readable && img && blur > 0) {
    try {
      const href = await bake(shown.url, pic, view, box, blur, img)
      const M = margin(blur)
      el.style.inset = `${-M}px`; el.style.backgroundImage = `url("${href}")`; el.style.backgroundSize = '100% 100%'; el.style.backgroundPosition = '0 0'
      return
    } catch { /* fall through to the live blur */ }
  }
  const M = blur > 0 ? margin(blur) : 0
  el.style.backgroundImage = shown.css; el.style.backgroundSize = `${box.size}px auto`; el.style.backgroundPosition = `${box.left + M}px ${box.top + M}px`
  if (blur > 0) { el.style.inset = `${-M}px`; el.style.filter = `blur(${blur}px)` }
}
const images = new Map()
async function shownImage(shown) {
  if (!shown.url) return null
  if (!images.has(shown.url)) { if (images.size > 4) images.clear(); images.set(shown.url, loadImage(shown.url, { cors: shown.readable, timeout: 8000 })) }
  return images.get(shown.url)
}

async function showLayer(next, { fade = reduced() ? 0 : 700 } = {}) {
  const l = ensureLayers()
  const mine = ++showSeq
  const back = front === 'a' ? 'b' : 'a'
  const el = l[back], prev = l[front]
  await dress(el, next, currentBlur())
  if (mine !== showSeq) return
  l.root.style.setProperty('--m-wp-fade', `${fade}ms`)
  // the new picture fades in ABOVE the old one, which stays fully opaque until it is covered: two layers faded against each other let the page
  // background through in the middle (a layer at half opacity over one at half opacity covers only three quarters)
  prev.classList.remove('is-under'); el.classList.remove('is-under')
  requestAnimationFrame(() => {
    prev.classList.add('is-under'); prev.classList.remove('is-front'); el.classList.add('is-front')
    clearTimeout(underTimer); underTimer = setTimeout(() => prev.classList.remove('is-under'), fade + 80)
  })
  front = back
  shown = next
  shownBlur = currentBlur()
}
let showSeq = 0
let underTimer = 0
let shownBlur = 0

/** Places the picture again (the window's panes changed, the window was resized, the blur changed): a quick cross-fade to the new copy. */
function relayout({ fade = 160 } = {}) {
  if (!layers || !shown) return
  return showLayer(shown, { fade: reduced() ? 0 : fade })
}

// The themes the person may choose next (the other dark variant, every preset colour) are worked out one per idle slice after the one that is shown,
// so a click on a swatch or on the pure-black variant finds its colours ready instead of computing them inside the click.
let warmedFor = ''
// the time of the last pointer, key or wheel input: the preparation of the next themes (below) works only when nobody has touched the window for this long
const WARM_QUIET_MS = 4000
let lastInputAt = -Infinity
let watchingInput = false
function watchInput() {
  if (watchingInput || typeof addEventListener !== 'function') return
  watchingInput = true
  const mark = () => { lastInputAt = performance.now() }
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel']) addEventListener(type, mark, { capture: true, passive: true })
}
function warmNextThemes(s, black) {
  const key = JSON.stringify([s.color, s.preset, s.custom, s.dark, black, s.colorStyle, s.seedIndex])
  if (warmedFor === key || typeof setTimeout !== 'function') return
  try { if (localStorage.getItem('foundation-ui.theme-warm') === 'off') return } catch { /* storage unavailable */ }
  warmedFor = key
  // one scheme of one theme per job (about 20 ms), and only while nobody is using the window
  const jobs = []
  if (lastPic) jobs.push(() => warmTheme({ ...lastPic.seeds, black: !black, style: s.colorStyle }, 'dark'))
  for (const p of PRESET_SEEDS || []) {
    const theme = () => ({ ...seedFor({ ...s, color: 'preset', preset: p.id }, null), black, style: s.colorStyle })
    jobs.push(() => warmTheme(theme(), 'light'), () => warmTheme(theme(), 'dark'))
  }
  const inputPending = () => { try { return !!navigator.scheduling?.isInputPending?.() } catch { return false } }
  watchInput()
  const step = () => {
    // a job is a task of about 20 ms of colour science (the HCT solver behind Material dynamic colours): it must not fall into the frame of a click or of a page that has just opened, so it also waits while the window is being used
    if (inputPending() || performance.now() - lastInputAt < WARM_QUIET_MS || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) { setTimeout(step, 700); return }
    const job = jobs.shift()
    if (!job) return
    try { job() } catch { /* a theme that cannot be worked out is worked out when it is chosen */ }
    setTimeout(step, 250)
  }
  setTimeout(step, 8000)
}

// in the frame of the change: the resize event comes before the layout of the frame, so the wallpaper is laid out for the size that is about to be painted (a different picture for the new shape loads asynchronously)
function onResize() {
  if (lastState?.source === 'auto' && lastState.background === 'wallpaper') {
    const shape = panelShape(); const next = autoPick(autoId, shape.width, shape.height)
    if (next !== autoId) { void applyAppearance(document.documentElement, lastState, { file: lastFile }); return }
  }
  relayout()
}

let seq = 0
let scope = 'other' // 'home' (the overview) or 'other': which frost values the window shows
let lastPic = null // { seeds, stats } of the picture shown
let pictureSeedList = [] // up to four seeds of the picture the colours are read from (the choices of the colour section)
/** The seeds of the wallpaper (distinct hues, the best first), [] until a picture was read. */
export const pictureSeeds = () => pictureSeedList

/** Runs `fn` after the next frame was painted (a window that paints no frames, a hidden one, runs it after 200 ms). */
function afterPaint(fn) {
  let done = false
  const run = () => { if (!done) { done = true; fn() } }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(run, 0))
  setTimeout(run, 200)
}

// The scrims are colour-science (HCT) work, about 13 ms; going between the overview and another page asks for the same two answers again and again.
const scrimMemo = new Map()
function cachedScrims(seeds, stats, dim, blur, black, style) {
  const key = JSON.stringify([seeds, stats, dim, blur, black, style])
  let value = scrimMemo.get(key)
  if (!value) {
    value = scrimsFor(seeds, stats, dim, blur, { black, style })
    if (scrimMemo.size >= 16) scrimMemo.delete(scrimMemo.keys().next().value)
    scrimMemo.set(key, value)
  }
  return value
}

/** Puts the frost of the current scope on the page: blur and tint (the scrim). The properties are registered, so a change moves on the effects spring. */
function applyFrost(root) {
  if (!lastState || !lastPic) return null
  const frost = frostFor(lastState, scope)
  const scrims = cachedScrims(lastPic.seeds, lastPic.stats, frost.dim, frost.blur, lastState.dark === 'black', lastState.colorStyle)
  root.dataset.dark = lastState.dark === 'black' ? 'black' : 'tinted'
  root.style.setProperty('--m-scrim-light', String(scrims.light.alpha)); root.style.setProperty('--m-scrim-dark', String(scrims.dark.alpha))
  root.style.setProperty('--m-wp-blur', `${frost.blur}px`)
  root.dataset.scrimRatio = `${Math.min(scrims.light.ratio, scrims.dark.ratio)}/${Math.min(scrims.light.card, scrims.dark.card)}`
  root.dataset.frost = `${frost.blur}/${frost.dim}`
  root.dataset.fade = lastState.fade === false ? 'off' : 'on'
  if (shown && shownBlur !== frost.blur) afterPaint(() => relayout({ fade: 700 })) // not inside the click that changed the page: placing reads the layout, which the click has just made dirty
  return scrims
}
/** The overview is lighter than the other pages: the product says which page the window is on. */
export function setFrostScope(root, next) {
  const to = next === 'home' ? 'home' : 'other'
  if (to === scope) return
  scope = to
  applyFrost(root)
}
/**
 * 界面 (css/look.css): the card corner and the text scale are set only away from their defaults (no attribute, no variable, the design as it is).
 */
export function applyInterfaceLook(root, s) {
  const corner = Number(s.cardCorner), size = Number(s.textSize)
  if (Number.isFinite(corner) && corner !== 28) { root.dataset.cardCorner = String(corner); root.style.setProperty('--m-card-corner', `${corner}px`) }
  else { delete root.dataset.cardCorner; root.style.removeProperty('--m-card-corner') }
  if (Number.isFinite(size) && size !== 14) { root.dataset.textSize = String(size); root.style.setProperty('--m-text-scale', String(Math.round((size / 14) * 10000) / 10000)) }
  else { delete root.dataset.textSize; root.style.removeProperty('--m-text-scale') }
  setListStyle(root, s.listStyle)
}
/**
 * Puts the appearance on the page: wallpaper layers, scrim, theme from the chosen seed (a spring transition). A picture that does not
 * load in time leaves the solid background and the brand seed. Returns 'solid' | 'wallpaper' | 'failed'.
 * Auto picks the picture of the window's shape (with hysteresis, see wallpaper.js) and cross-fades when a resize changes the pick.
 */
export async function applyAppearance(root, s, { file = '', timeout = 8000 } = {}) {
  const mine = ++seq
  lastState = s; lastFile = file
  root.dataset.motion = s.motion || 'full'
  applyInterfaceLook(root, s)
  let url = imageSource(s, file)
  let picture = null
  // no wallpaper: the window gets the tonal backdrop (a gradient of the container tones), not a bare surface
  const tonal = !url
  if (tonal) url = 'gradient'
  if (url === 'auto') { const shape = panelShape(); autoId = autoPick(autoId, shape.width, shape.height); picture = WALLPAPERS[autoId]; url = picture.url }
  else { autoId = null; picture = Object.values(WALLPAPERS).find((p) => p.url === url) || null }
  if (typeof window !== 'undefined' && !resizeBound) { window.addEventListener('resize', onResize); resizeBound = true }
  const theming = () => { if (root.classList.contains('m-theme-fade')) return; root.classList.add('m-theming'); setTimeout(() => root.classList.remove('m-theming'), 800) } // a change of colours only holds the transitions itself
  const solid = (state) => {
    theming()
    root.classList.remove('m-has-wallpaper'); root.style.removeProperty('--m-wallpaper')
    applyTheme(root, { ...seedFor(s, null), black: s.dark === 'black', style: s.colorStyle })
    root.dataset.dark = s.dark === 'black' ? 'black' : 'tinted'
    root.dataset.wallpaper = state
    persistBoot(root, s, null)
    return state
  }
  try {
    const pic = await readPicture(url, { timeout })
    if (mine !== seq) return 'superseded'
    // the colours do not follow the window's shape: with Auto they grow from the same picture in every window
    const colourId = colourPictureId(s.source, picture?.id)
    const colourPic = colourId && picture && colourId !== picture.id ? await readPicture(WALLPAPERS[colourId]?.url, { timeout }).catch(() => pic) : pic
    if (mine !== seq) return 'superseded'
    const imageSeeds = colourPic.seeds?.length ? colourPic.seeds : [colourPic.seed]
    const seeds = seedFor(s, imageSeeds)
    lastPic = { seeds, stats: pic.stats }
    pictureSeedList = imageSeeds
    root.dataset.pictureStats = `${pic.readable ? 'read' : 'unreadable'} lo ${pic.stats.lo.toFixed(2)} hi ${pic.stats.hi.toFixed(2)} busy ${pic.stats.busy.toFixed(2)}`
    theming()
    const css = pic.gradient || `url("${url}")`
    root.style.setProperty('--m-wallpaper', css)
    applyFrost(root)
    root.classList.add('m-has-wallpaper')
    const next = { css, url: pic.gradient ? '' : url, picture, readable: !!pic.readable && !pic.gradient, gradient: !!pic.gradient }
    if (!shown || shown.css !== css) await showLayer(next); else { shown = next; if (shownBlur !== currentBlur()) await relayout({ fade: 160 }) }
    applyTheme(root, { ...seeds, black: s.dark === 'black', style: s.colorStyle })
    warmNextThemes(s, s.dark === 'black')
    root.dataset.wallpaper = tonal ? 'solid' : 'wallpaper'
    root.dataset.wallpaperId = picture ? picture.id : tonal ? 'tonal' : s.source
    // the record the sign-in page paints its first frame from (colours, mode, frost, a tiny copy of the picture)
    void (async () => { const img = next.readable && !next.gradient ? await shownImage(next).catch(() => null) : null; persistBoot(root, s, { img, picture, gradient: next.gradient ? css : '' }) })()
    return 'wallpaper'
  } catch {
    if (mine !== seq) return 'superseded'
    return solid('failed')
  }
}

/** Places the picture again (the window's panes changed width): her face stays out from under them. */
export const relayoutWallpaper = relayout

/** A picture the person picked: scaled to at most 1920 px and stored as a JPEG data URL. */
export async function fileToDataUrl(file, maxSide = 1920) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}
