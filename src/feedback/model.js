// What the one feedback panel decides, without any drawing (so it can be tested): where it sits for a window width, what its rows and its button say for the state it is in, how an answer to a send reads.

/** Below this window width the drawer from the right edge is a full-width panel from the bottom. */
export const DRAWER_MIN_WIDTH = 720
export const layoutFor = (width) => (Number(width) > 0 && Number(width) < DRAWER_MIN_WIDTH ? 'bottom' : 'drawer')

/** The types of a report, in the order the person sees them. */
export const FEEDBACK_TYPES = Object.freeze(['bug', 'suggestion', 'performance', 'other'])

/**
 * The state of the panel's rows.
 *   offline: the window has no network (the report is kept and sent by itself)
 *   hasShot / canSendShot: there is a screenshot attached / the product can send one (the row shows whenever the product can: with the picture, or with the ways to add one)
 * The log is always part of a report the person sends: no switch for it. Pressing 发送 is the consent for this one send, so the error-report switch does not decide whether it can go.
 * `shot` is the state of the row: 'attached' (a picture, with preview and remove) or 'empty' (the ways to add one); '' when there is no row.
 */
export function feedbackPlan({ offline = false, hasShot = false, canSendShot = false } = {}) {
  return { sendMode: offline ? 'queue' : 'send', shotRow: canSendShot, shot: canSendShot ? (hasShot ? 'attached' : 'empty') : '', logRow: true, banner: offline ? 'offline' : '' }
}

/** What the title of the report is: the first line of what the person wrote, at most 80 characters. */
export function titleOf(description) {
  const line = String(description || '').split('\n').map((l) => l.trim()).find(Boolean) || ''
  return line.length > 80 ? `${line.slice(0, 79)}…` : line
}

/** The context line of the panel: the page and what was under the pointer, or the error. Static page names only: the text of a tile is not sent. */
export function contextLine({ page = '', element = '', error = null, texts }) {
  if (error) return [texts.contextError, error.code || error.name].filter(Boolean).join(' ')
  const part = String(element || '').replace(/\s+/g, ' ').trim()
  return [page, part.length > 24 ? `${part.slice(0, 23)}…` : part].filter(Boolean).join(' › ')
}

/**
 * An answer of the send, in the phase the panel shows. A refusal is one thing: `rejected`. The host answers `{ accepted: n }` and nothing more, so `accepted: 0` can mean a report it could not shape as well as an old host that held
 * the report back with the error-report switch: the panel cannot tell them apart and does not guess (a host of this version never holds a report back with the switch).
 */
export function phaseOf(answer) {
  const state = answer?.state
  // `shot`: what the host did with the screenshot it was given ('uploaded', or why it was left out); '' when the host did not say (an older host): the panel then does not claim the picture went
  if (state === 'sent') return { phase: 'done', kind: 'sent', again: !!answer.again, shot: typeof answer.shot === 'string' ? answer.shot : '' }
  if (state === 'queued') return { phase: 'done', kind: 'queued', ...(answer.shotLost ? { shotLost: true } : {}) }
  if (state === 'limited') return { phase: 'edit', problem: 'limited' }
  return { phase: 'edit', problem: 'rejected' }
}
