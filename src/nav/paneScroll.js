/**
 * Where the detail pane was scrolled, per place. The pane is one scroll box that stays while its content is swapped, so a page that is opened (a row of the list, the rail, a jump)
 * would open at whatever height the last page had been scrolled to: it starts at the top. A page that is reached again by going back (the page's own back, the global back of a
 * jump) opens where it was left. Only the last places are kept.
 *
 * placeOf(entry)       -> a string for where an entry of the navigation is (its destination and its parameters, not the number of the entry)
 * leave(place, top)    the place is left at scroll height `top`
 * enter(place, back)   -> the height to open the place at: where it was left when going back, else 0
 */
export const placeOf = (entry) => {
  if (!entry) return ''
  const params = entry.params && typeof entry.params === 'object' ? Object.keys(entry.params).filter((k) => entry.params[k] !== undefined).sort().map((k) => [k, entry.params[k]]) : []
  return params.length ? `${entry.id}${JSON.stringify(params)}` : String(entry.id)
}

export function createPaneScroll(max = 24) {
  const left = new Map()
  return {
    leave(place, top) {
      if (!place) return
      left.delete(place)
      left.set(place, Math.max(0, Number(top) || 0))
      while (left.size > max) left.delete(left.keys().next().value)
    },
    enter(place, back = false) { return back ? left.get(place) || 0 : 0 },
    get size() { return left.size },
  }
}
