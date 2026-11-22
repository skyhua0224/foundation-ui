import { createApp } from 'vue'
import '../src/css/all.css'
import '../src/vue/index.js'
import { applyTheme } from '../src/tokens/theme.js'
import Star from './StarGallery.vue'

// ?theme=light|dark|black &w=<comma list of container widths in px>
const q = new URLSearchParams(location.search)
applyTheme(document.documentElement, { black: q.get('theme') === 'black' })
createApp(Star).mount('#app')
