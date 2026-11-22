import { reactive } from 'vue'
import { formatHostAddress } from './hostAddress.js'

/**
 * The pairing QR code of the home card. The product passes how it talks to the host; the card asks for a code only while it is on screen
 * at a size that shows it, and gives it back (cancel) when it goes away, so no pairing window stays open behind a hidden card.
 * Every request opens a preset PIN on the host (it logs it), so the code is asked for ONCE when it is shown and renewed ONCE shortly before it expires, only while it is shown:
 *  - begin() while a code is loading or ready asks for nothing (a card that is re-created by a layout change calls it again at once);
 *  - stop() gives the window back after a short grace; a begin() within the grace keeps the same window (the same card, drawn again);
 *  - RENEW_AT seconds before the end the code is replaced in place (no flicker), once; after the end, or an error, the card shows a refresh button (begin(true));
 *  - after pairing nothing is asked for.
 *   start():  Promise<{ url, pin, expires_in }>   opens a pairing window on the host
 *   poll():   Promise<{ status }>                 'paired' once a client used it
 *   cancel(): Promise                             closes the window
 *   render(url): Promise<string>                  the image (data URL) of the code
 * view: { state: 'idle' | 'loading' | 'ready' | 'expired' | 'paired' | 'error', image, pin, seconds, address (host or host:port the code points to) } (reactive; the card reads it)
 */
export const RENEW_AT = 12
export const STOP_GRACE_MS = 4000
export function createPairQr({ start, poll, cancel, render, onPaired, autoRenew = true }) {
  const view = reactive({ state: 'idle', image: '', pin: '', seconds: 0, address: '' })
  // what the code carries, as a person would type it in a client: the host answers with the address and the port it put in the link
  const addressOf = (r) => (r && r.host ? formatHostAddress(r.host, Number(r.port) || 0) : '')
  let timer = 0
  let graceTimer = 0
  let token = 0
  let renewing = false
  let renewed = false
  const clear = () => { if (timer) clearInterval(timer); timer = 0 }
  const quiet = (p) => { try { Promise.resolve(p).catch(() => {}) } catch { /* the window closes by itself */ } }
  const reset = () => { token++; clear(); renewing = false; view.state = 'idle'; view.image = ''; view.pin = ''; view.seconds = 0; view.address = '' }
  // a fresh code, put in place of the shown one without leaving the ready state
  async function renew(mine) {
    if (renewing || renewed) return
    renewing = true; renewed = true
    try {
      const r = await start()
      if (mine !== token || graceTimer) { if (r && r.url) quiet(cancel()); return }
      if (!r || !r.url) return
      const image = await render(r.url)
      if (mine !== token || graceTimer || view.state !== 'ready') return
      view.image = image; view.pin = String(r.pin || ''); view.seconds = Math.max(0, Number(r.expires_in) || 0); view.address = addressOf(r)
    } catch { /* the code on screen runs out and shows the refresh button */ } finally { renewing = false }
  }
  async function begin(force = false) {
    if (graceTimer) { clearTimeout(graceTimer); graceTimer = 0; if (!force && (view.state === 'ready' || view.state === 'loading')) return }
    if (!force && (view.state === 'ready' || view.state === 'loading' || view.state === 'paired')) return
    const mine = ++token
    clear(); renewing = false; renewed = false
    view.state = 'loading'
    try {
      const r = await start()
      if (mine !== token) { quiet(cancel()); return }
      if (!r || !r.url) throw new Error('no url')
      const image = await render(r.url)
      if (mine !== token) { quiet(cancel()); return }
      view.image = image
      view.pin = String(r.pin || '')
      view.seconds = Math.max(0, Number(r.expires_in) || 0)
      view.address = addressOf(r)
      view.state = 'ready'
      let tick = 0
      timer = setInterval(async () => {
        if (mine !== token) return clear()
        view.seconds = Math.max(0, view.seconds - 1)
        if (view.seconds === 0) { clear(); view.state = 'expired'; view.image = ''; quiet(cancel()); return }
        if (autoRenew && view.seconds <= RENEW_AT && !graceTimer) void renew(mine)
        if (++tick % 2) return
        try {
          const s = await poll()
          if (mine === token && (view.state === 'ready' || view.state === 'expired') && s && s.status === 'paired') { clear(); view.state = 'paired'; if (onPaired) onPaired() }
        } catch { /* the next tick asks again */ }
      }, 1000)
    } catch {
      if (mine === token) view.state = 'error'
    }
  }
  function stop() {
    const open = view.state === 'ready' || view.state === 'loading'
    if (!open) { reset(); return }
    if (graceTimer) return
    // the window is given back after a grace: a card that the layout re-creates asks again within it and keeps the window
    graceTimer = setTimeout(() => { graceTimer = 0; const stillOpen = view.state === 'ready' || view.state === 'loading'; reset(); if (stillOpen) quiet(cancel()) }, STOP_GRACE_MS)
  }
  return { view, begin, stop }
}
