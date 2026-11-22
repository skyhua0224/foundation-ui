/**
 * What the snackbar host does when the message on screen changes.
 *   - another message (a new id): its auto-dismiss timer starts and the popover is shown again (the new element enters);
 *   - the same id with new content (a progress sentence that becomes its result): the element stays where it is and only its text changes; the timer restarts for
 *     the new content, so a result is never cut short by the clock of the sentence it replaced, and nothing leaves and enters again.
 * `shown` is the id the host drew last ('' for none).
 */
export function snackPlan(shown, item) {
  if (!item) return { id: '', timeout: 0, show: false }
  return { id: item.id, timeout: item.timeout > 0 ? item.timeout : 0, show: item.id !== shown }
}
