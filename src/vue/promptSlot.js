// The card at the top of the overview (the star, the recommendation of a client) comes and goes with the stream and with 以后再说. The grid or the dock under it must not jump when it does: the card
// opens and closes in height (and fades) on the spatial spring, the page below moves with it, frame by frame. Reduced motion: no move, a short fade.
import { reducedMotion } from '../appearance/motion.js'

const seconds = (v, d) => { const n = parseFloat(v); if (!Number.isFinite(n)) return d; return /ms\s*$/.test(v) ? n : n * 1000 }
function spring(el) {
  const cs = getComputedStyle(el)
  return { duration: seconds(cs.getPropertyValue('--m-spring-default-spatial-duration').trim(), 412), easing: cs.getPropertyValue('--m-spring-default-spatial').trim() || 'ease' }
}
// the height (with the margin under it) a card that opens or closes is going to have: what the page under it will be laid out by, not where the animation has it in this frame
const going = new WeakMap()
const px = (v) => parseFloat(v) || 0
const play = (el, from, to, done) => {
  if (typeof el.animate !== 'function') return done()
  const { duration, easing } = spring(el)
  const calm = reducedMotion()
  going.set(el, px(to.height) + px(to.marginBottom))
  const a = el.animate(calm ? [{ opacity: from.opacity }, { opacity: to.opacity }] : [from, to], { duration: calm ? 140 : duration, easing: calm ? 'linear' : easing })
  const end = () => { going.delete(el); done() }
  a.finished.then(end, end)
}
/** How far the page under a card that is opening or closing still has to move (px, down is positive): its final height with the margin minus what it has in this frame; 0 when it is at rest. */
export function slotAhead(el) {
  if (!el || !going.has(el)) return 0
  return going.get(el) - (el.offsetHeight + px(getComputedStyle(el).marginBottom))
}
export function slotEnter(el, done) {
  const cs = getComputedStyle(el), h = el.offsetHeight
  play(el, { height: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0, overflow: 'hidden' }, { height: `${h}px`, marginBottom: cs.marginBottom, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1, overflow: 'hidden' }, done)
}
export function slotLeave(el, done) {
  const cs = getComputedStyle(el), h = el.offsetHeight
  // the card stays in the flow while it closes
  play(el, { height: `${h}px`, marginBottom: cs.marginBottom, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1, overflow: 'hidden' }, { height: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0, overflow: 'hidden' }, done)
}
