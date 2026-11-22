import { getCurrentInstance, onBeforeUnmount, onMounted, reactive, unref, watch } from 'vue'
import { useNotify } from '../../notify/store.js'
import { feedbackTexts } from '../../feedback/texts.js'
import { ASK_GAP_MS, REPLY_BASE, applyReplies, askReplies, dismissItem, keysToAsk, loadState, previewOf, prune, saveState } from '../../feedback/replies.js'
import { registerDevReport } from '../devmode/devReport.js'

/** The reply the sheet shows: `item` is an inbox item (feedback/replies.js) or null. Closed by the sheet itself. */
export const replySheet = reactive({ open: false, item: null })

const noticeId = (item) => `feedback-reply:${item.id}`

/**
 * The developers' answers to the feedback this window sent, in the status button of the caption bar. Call once in the root component of a product (next to useSystemNotices):
 *   locale   the UI language (a ref or a string)
 *   base     the server (default REPLY_BASE); fetchFn / storage / now replace the platform's for tests
 * It asks the server for the answers to this window's reports a few seconds after the window is up and again every ASK_GAP_MS (the time of the last ask is in the storage, so a second window or a restart
 * does not ask early), puts each new answer into the status button once (title = what the person wrote, text = the start of the answer, 查看 opens the whole text) and takes it out when it is closed or opened.
 * Returns { refresh(force?), sync() } for the product's own triggers and tests.
 */
export function useFeedbackReplies({ locale = 'zh', base = REPLY_BASE, fetchFn, storage, now = () => Date.now(), startDelayMs = 4000, tickMs = 30 * 60_000 } = {}) {
  const notify = useNotify()
  const shown = new Set()
  let state = loadState(storage)
  let busy = false
  const words = () => feedbackTexts(String(unref(locale)))

  function open(item) {
    replySheet.item = item
    replySheet.open = true
    dismiss(item.id)
  }
  function dismiss(id) {
    state = dismissItem(loadState(storage), id)
    saveState(state, storage)
    notify.clearSystem(`feedback-reply:${id}`)
    shown.delete(`feedback-reply:${id}`)
  }

  /** Puts the items of the storage that nobody closed into the status button (again after a restart), with the words of the current language. */
  function sync() {
    state = loadState(storage)
    const W = words()
    const live = new Set()
    for (const item of state.inbox) {
      if (item.dismissed) continue
      const id = noticeId(item)
      live.add(id)
      shown.add(id)
      notify.system(id, {
        tone: 'info', icon: item.kind === 'fixed' ? 'check_circle' : 'forum', dismissible: true, revision: item.id,
        title: item.title || W.replyUntitled, text: previewOf(item, W),
        actions: [{ id: 'open', label: W.replyOpen, onClick: () => open(item) }],
        onDismiss: () => dismiss(item.id),
      })
    }
    for (const id of [...shown]) if (!live.has(id)) { notify.clearSystem(id); shown.delete(id) }
  }

  async function refresh(force = false) {
    if (busy) return
    const current = loadState(storage)
    const t = now()
    const keys = keysToAsk(current, t, { force })
    if (!keys.length) { sync(); return }
    busy = true
    try {
      const answer = await askReplies({ keys, base, ...(fetchFn ? { fetchFn } : {}) })
      // a failed or refused ask counts too: the next one is after the gap, so a server that is down is not asked in a loop
      let next = { ...loadState(storage), lastAt: t }
      if (answer.state === 'ok') next = applyReplies(next, answer.replies, t).state
      saveState(prune(next, t), storage)
    } finally {
      busy = false
    }
    sync()
  }

  registerDevReport({ replies: true })
  let timer = 0
  let tick = 0
  const start = () => {
    sync()
    timer = setTimeout(() => { void refresh() }, startDelayMs)
    tick = setInterval(() => { void refresh() }, tickMs)
    // a timer never keeps a process (a test, a script) alive
    timer?.unref?.(); tick?.unref?.()
  }
  if (getCurrentInstance()) {
    onMounted(start)
    onBeforeUnmount(() => { clearTimeout(timer); clearInterval(tick) })
  } else start()
  // the words follow the language
  if (locale && typeof locale === 'object') watch(locale, () => sync())
  return { refresh, sync, ASK_GAP_MS }
}
