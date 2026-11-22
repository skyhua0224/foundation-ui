import { onBeforeUnmount, ref } from 'vue'
import { RESET_SECONDS } from '../reset/model.js'

/**
 * The seconds left before a confirm button can be pressed: `begin()` when the question opens (it starts at `seconds`), `end()` when it closes. The timer is stopped with the
 * component, so a question that is gone cannot tick on. `ready` is true only after the last second has passed.
 */
export function useCountdown(seconds = RESET_SECONDS, { setTimer = (fn, ms) => setInterval(fn, ms), clearTimer = (id) => clearInterval(id) } = {}) {
  const remaining = ref(seconds)
  const ready = ref(false)
  let timer = null
  const end = () => { if (timer !== null) { clearTimer(timer); timer = null } }
  function begin() {
    end()
    remaining.value = seconds
    ready.value = false
    timer = setTimer(() => {
      if (remaining.value > 0) remaining.value -= 1
      if (remaining.value <= 0) { ready.value = true; end() }
    }, 1000)
  }
  onBeforeUnmount(end)
  return { remaining, ready, begin, end }
}
