/**
 * Scenes, after Navigation 3: a scene strategy gets the back stack and the window size and returns the scene (which
 * entries are visible and how they are arranged), or null when it does not apply. The single pane is the fallback.
 * A decorator (the persistent rail) wraps every scene, so it is never rebuilt on navigation.
 *
 * Entry: { key, id, role: 'list' | 'detail' | 'supporting', rail?: category id, list?: false, supporting?: id, params? }
 * Size classes (window width): under 600, or a window shorter than 480 (SHORT_HEIGHT), the compact navigation (the bar at the bottom, or beside the content in a short window) with one pane; from 600 the navigation rail, collapsed (96 wide, icon and label under it)
 * or, when the person chose it and the window has room for it (from 1120: list and detail still fit beside 240), expanded; one
 * pane under 720 and list and detail from 720; from 1600 for pages that have content that deserves one (a live preview or
 * chart) a supporting pane at least 400 wide. Below that the status those pages would show sits inside the detail page.
 */
export const BREAKPOINTS = Object.freeze({ rail: 600, listDetail: 720, supporting: 1600, expandedMin: 1120 })
/** A window shorter than this (px) is a short one (a phone on its side, a small window; Material's compact height): it takes the compact navigation, whatever its width. */
export const SHORT_HEIGHT = 480
/** The narrowest window whose compact navigation stands beside the content; a narrower one keeps the bar at the bottom. */
export const SIDE_MIN_WIDTH = 480
/** The supporting pane is never narrower than this (px) and the detail pane keeps at least `detailMin`. */
export const SUPPORTING_WIDTH = Object.freeze({ min: 400, max: 460, detailMin: 560 })
export const RAIL_WIDTH = Object.freeze({ collapsed: 96, expanded: 240, side: 80 })

/**
 * 'bar' | 'rail' | 'expanded' for a window width. The expanded rail is only ever the person's choice, and only where it fits across (from 1120). The height never decides: the menu button is shown
 * from that width and has to do what it says at every height, so a window too short for the rows gets the expanded rail with its items scrolling (MRail), not a button that does nothing.
 */
export function navigationOf(width, expandedChoice = false, height = Infinity) {
  if (width < BREAKPOINTS.rail || height < SHORT_HEIGHT) return 'bar'
  return expandedChoice && width >= BREAKPOINTS.expandedMin ? 'expanded' : 'rail'
}
/** Whether a window of this size has the compact navigation (the bar at the bottom or beside the content): the products read it for what they keep per navigation (the stack of a phone). */
export const isCompactNav = (width, height = Infinity) => navigationOf(width, false, height) === 'bar'
/** Whether the window has room for the expanded rail (the menu button is shown only then). */
export const canExpand = (width) => width >= BREAKPOINTS.expandedMin
/** The compact navigation ('bar') stands at the side, as a narrow rail with the labels under the icons, in a short window; in a tall and narrow one it is the bar at the bottom. */
export const barSideOf = (width, height) => height < SHORT_HEIGHT && width >= SIDE_MIN_WIDTH
export const railWidthOf = (mode, side = false) => (mode === 'bar' ? (side ? RAIL_WIDTH.side : 0) : mode === 'expanded' ? RAIL_WIDTH.expanded : RAIL_WIDTH.collapsed)

/** Width of the list pane: 0.3636 of the window (as Android Settings), kept inside a pixel range (320 to 360 at the sizes where the list is a pane of its own). */
export function listWidth(width, { ratio = 0.3636, min = 240, max = 360, preferred = null } = {}) {
  const wanted = preferred ?? width * ratio
  return Math.round(Math.min(max, Math.max(min, Math.min(wanted, width * 0.5))))
}

const lastOf = (entries, role) => { for (let i = entries.length - 1; i >= 0; i--) if (entries[i].role === role) return entries[i]; return null }

/** Fallback: only the top entry is visible. Back pops. */
export function singlePaneStrategy(entries, { defaultDetail } = {}) {
  const top = entries[entries.length - 1] || defaultDetail
  if (!top) return null
  return { kind: 'single', key: `single:${top.key}`, panes: { [top.role === 'list' ? 'list' : 'detail']: top }, visible: top.role === 'list' ? 'list' : 'detail', previous: entries.slice(0, -1) }
}

/** List and detail side by side from `minWidth` on. An entry marked `list: false` (the overview) takes the whole width. */
export function listDetailStrategy({ minWidth = BREAKPOINTS.listDetail } = {}) {
  return (entries, { width, defaultDetailOf }) => {
    if (width < minWidth) return null
    const list = lastOf(entries, 'list')
    const detail = lastOf(entries, 'detail') || (list && defaultDetailOf ? defaultDetailOf(list) : null)
    if (!list || !detail || detail.list === false) return null
    return { kind: 'list-detail', key: 'list-detail', panes: { list, detail }, visible: 'both', previous: entries.slice(0, -1) }
  }
}

/** A supporting pane next to the detail pane, only for entries that declare one, from `minWidth` on. */
export function supportingPaneStrategy({ minWidth = BREAKPOINTS.supporting } = {}) {
  return (entries, { width, defaultDetailOf, railWidth = RAIL_WIDTH.collapsed }) => {
    if (width < minWidth) return null
    const space = width - railWidth
    const list = lastOf(entries, 'list')
    const detail = lastOf(entries, 'detail') || (list && defaultDetailOf ? defaultDetailOf(list) : null)
    if (!list || !detail || detail.list === false || !detail.supporting) return null
    // the detail pane must keep room: no supporting pane when it would be squeezed
    if (space !== undefined && space - listWidth(space) - SUPPORTING_WIDTH.min < SUPPORTING_WIDTH.detailMin) return null
    const supporting = { key: `${detail.key}:supporting`, id: detail.supporting, role: 'supporting', params: detail.params }
    return { kind: 'list-detail-supporting', key: 'list-detail-supporting', panes: { list, detail, supporting }, visible: 'all', previous: entries.slice(0, -1) }
  }
}

/** The first strategy that returns a scene wins; the single pane is the fallback. */
export function calculateScene(strategies, entries, context) {
  for (const strategy of strategies) {
    const scene = strategy(entries, context)
    if (scene) return scene
  }
  return singlePaneStrategy(entries, context)
}

/**
 * Pixel columns [list, detail, supporting] of the space beside the rail, and the width each pane lays out at.
 * `focus`: the page in the detail pane is being read (an issue is open): the list pane gives its column to the detail (the list keeps the width it lays out at, so it does not re-flow while it slides away).
 */
export function layoutOf(scene, space, { listPreferred = null, focus = false } = {}) {
  const list = listWidth(space, { preferred: listPreferred })
  if (scene.kind === 'single') {
    return scene.visible === 'list' ? { cols: [space, 0, 0], inner: [space, space, 0] } : { cols: [0, space, 0], inner: [space, space, 0] }
  }
  const lead = focus ? 0 : list
  if (scene.kind === 'list-detail') return { cols: [lead, space - lead, 0], inner: [list, space - lead, 0] }
  const sup = Math.max(SUPPORTING_WIDTH.min, Math.min(SUPPORTING_WIDTH.max, Math.round(space * 0.3)))
  return { cols: [lead, space - lead - sup, sup], inner: [list, space - lead - sup, sup] }
}

/**
 * The width the pane that fills the space ends at: its column in the layout the scene is going to, less the scrollbar the pane shows now. While the columns slide, the page in that pane lays out at
 * this width (as the list pane keeps the width it lays out at, above), so a page that is opened from another one is arranged once, at the width it keeps, and not at every width on the way.
 */
export const settledWidth = (layout, fill, gutter = 0) => Math.max(0, layout.cols[fill] - Math.max(0, gutter))
