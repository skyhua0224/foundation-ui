import { computed, onBeforeUnmount, ref } from 'vue'
import { useAppearance } from './useAppearance.js'

// What the first screen of the guide needs for light or dark: the appearance state (`appearance.set({ mode })` applies it at once), the three options (跟随系统, 浅色, 深色) with their icons, and whether the window is
// narrow (a phone): then the choice is a compact icon row right under the name card, where the first screen always shows it. `texts()` gives the guide texts of the language shown.
export function useGuideLook(texts) {
  const appearance = useAppearance()
  const lookOptions = computed(() => [['system', 'contrast'], ['light', 'light_mode'], ['dark', 'dark_mode']].map(([value, icon]) => ({ value, icon, label: texts().welcome.modes[value] })))
  const query = typeof matchMedia === 'function' ? matchMedia('(max-width: 599.98px)') : null
  const narrow = ref(!!query?.matches)
  const onChange = (event) => { narrow.value = event.matches }
  query?.addEventListener?.('change', onChange)
  onBeforeUnmount(() => query?.removeEventListener?.('change', onChange))
  return { appearance, lookOptions, narrow }
}
