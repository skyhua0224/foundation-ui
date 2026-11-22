import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * How much room the search has in the caption bar. The bar's two ends are content-sized (the logo, the name, the version and the update line; the actions and the window buttons), the search
 * takes what is left. When what is left cannot show the field with its hint (about 290 px for 「搜索设置、页面、操作…」 and Ctrl K), `tight` is true and the product draws the search as its icon (as on a
 * phone) instead of letting the bar cut the field. The ends do not depend on the search, so the decision cannot flip back and forth.
 */
export const SEARCH_MIN = 290
export const roomFor = ({ bar, lead, end }) => bar - lead - end
export const isTight = (parts, min = SEARCH_MIN) => roomFor(parts) < min

/** The widest the search may be given as an icon (px): the icon button and its padding. */
export const SEARCH_ICON = 48
/** The bar's parts as laid out now: its width, what the content-sized lead takes (the logo, the name, the back button and the version) and what the end takes (the actions and the window's buttons). */
export function partsOf(bar) {
  const lead = bar.querySelector('.m-caption__lead')
  // the last part that is drawn: the version is not (a tier left it out), and a box that is not drawn has no right edge
  const drawn = lead ? [...lead.children].filter((c) => c.getBoundingClientRect().width > 0) : []
  const last = drawn[drawn.length - 1]
  const end = bar.querySelector('.m-caption__end')
  const leadWidth = last && lead ? last.getBoundingClientRect().right - lead.getBoundingClientRect().left : (bar.firstElementChild ? bar.firstElementChild.getBoundingClientRect().width : 0)
  return { bar: bar.clientWidth, lead: leadWidth, end: end ? end.getBoundingClientRect().width : 0 }
}

export function useCaptionRoom({ selector = '.m-caption', min = SEARCH_MIN } = {}) {
  const tight = ref(false)
  const tier = ref(0)
  let resize = null
  let mutate = null
  const measure = () => {
    const bar = document.querySelector(selector)
    if (!bar) return
    // MCaption has chosen the tier of the bar (what it shows, what it keeps for 更多): from tier 2 the search is its icon
    const t = Number(bar.dataset.tier)
    tier.value = Number.isFinite(t) ? t : 0
    if (bar.dataset.tier !== undefined) { tight.value = tier.value >= 2; return }
    tight.value = isTight(partsOf(bar), min)
  }
  onMounted(() => {
    const bar = document.querySelector(selector)
    if (!bar) return
    resize = new ResizeObserver(measure)
    resize.observe(bar)
    mutate = new MutationObserver(measure)
    mutate.observe(bar, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-tier'] })
    document.fonts?.ready?.then(measure)
    measure()
  })
  onBeforeUnmount(() => { resize?.disconnect(); mutate?.disconnect() })
  return { tight, tier, measure }
}
