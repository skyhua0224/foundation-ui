import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { osFromClientName, starClientFor, STAR_HOST } from '../src/vue/starCard.js'
import { DEFAULT_ORDER, CARD_META, starPromptTexts } from '../src/vue/homeCards.js'
import { homeTexts } from '../src/vue/homeModel.js'
import { readDash } from './dashSource.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }

test('T7: the star ask is not a tile: not in the grid, not in the default order, not planned', () => {
  assert.ok(!DEFAULT_ORDER.includes('star'))
  assert.equal(CARD_META.star, undefined)
  assert.ok(!existsStarTile(read('../src/vue/MDashCardView.vue')))
})
const existsStarTile = (source) => /MDashStar|kind === 'star'/.test(source)

test('T7: the prompt says it in few words in both languages, with the project named in the buttons', () => {
  const zh = starPromptTexts(homeTexts('zh')), en = starPromptTexts(homeTexts('en'))
  assert.equal(zh.title, '觉得好用？')
  assert.equal(zh.sub, '在 GitHub 点个 Star，帮更多人找到它。')
  assert.equal(zh.action, '给 {name} 点 Star')
  assert.equal(zh.later, '以后再说')
  for (const t of [zh, en]) for (const key of ['title', 'sub', 'action', 'later']) assert.ok(t[key], key)
  assert.match(en.action, /\{name\}/)
  // no gradient and no fixed colours: the prompt reads in the surface roles
  const css = read('../src/css/connect.css')
  const rule = css.split('\n').filter((l) => l.startsWith('.m-sprompt'))
  assert.ok(rule.length > 5)
  assert.ok(!rule.some((l) => /gradient/.test(l)))
  assert.ok(rule.some((l) => /\.m-sprompt \{[^}]*surface-container-low[^}]*color: var\(--md-sys-color-on-surface\)/.test(l)))
})

test('T7: the client of the second button is the one the person uses: the system of a paired device name, else the one chosen last; macOS gets Enhanced', () => {
  assert.equal(osFromClientName('iPhone 15 Pro'), 'ios')
  assert.equal(osFromClientName('Studio MacBook'), 'macos')
  assert.equal(osFromClientName('Pixel 9'), 'android')
  assert.equal(osFromClientName('Steam Deck'), 'linux')
  assert.equal(osFromClientName('Living room TV'), 'tv')
  assert.equal(osFromClientName('Windows PC'), 'windows')
  assert.equal(osFromClientName('My device'), '')
  const mac = starClientFor({ names: ['Pixel 9', 'Studio MacBook'] })
  assert.match(mac.name, /macOS Enhanced/)
  assert.match(mac.url, /moonlight-macos-enhanced/)
  const phone = starClientFor({ names: ['Studio MacBook', 'Pixel 9'] })
  assert.equal(phone.name, 'Moonlight V+', 'the project name, without the system word')
  assert.match(phone.url, /moonlight-vplus$/)
  assert.equal(starClientFor({ names: ['My device'], os: 'windows' }).name, 'Moonlight V+')
  assert.equal(STAR_HOST.name, 'Foundation Sunshine')
})

test('T7: the prompt has the GitHub mark on its buttons and a 以后再说, and the overview shows it only while the star is due', () => {
  const prompt = read('../src/vue/MStarPrompt.vue')
  assert.equal((prompt.match(/<MGithubMark \/>/g) || []).length, 3, 'the host star (while streaming and idle) and the star of the client')
  assert.match(prompt, /emit\('later'\)/)
  assert.match(readDash(), /<MStarPrompt v-else-if="ctx\.star && !edit && !pending"/)
})

test('T7: 关于 has a star row per project, each once, with the GitHub mark', async () => {
  const { starTargets } = await import('../src/vue/starCard.js')
  const list = starTargets()
  assert.equal(list[0].name, 'Foundation Sunshine')
  assert.ok(list.length >= 4)
  assert.equal(new Set(list.map((t) => t.url)).size, list.length)
  assert.ok(list.every((t) => /^https:\/\/github\.com\//.test(t.url) && t.repo && t.name))
  assert.ok(list.some((t) => /macOS Enhanced/.test(t.name)))
  const about = read('../src/vue/MAbout.vue')
  assert.match(about, /v-for="t in STAR_TARGETS"/)
  assert.match(about, /<MGithubMark :size="22" \/>/)
})

test('the star card per stream: the star of the client in use while streaming, the host star and the sponsor entry otherwise, 以后再说 until the next stream; the slot opens and closes in height', () => {
  const p = read('../src/vue/MStarPrompt.vue'), d = readDash(), dock = read('../src/vue/dash/dashDock.js'), slot = read('../src/vue/promptSlot.js'), card = read('../src/vue/starCard.js')
  assert.match(p, /<template v-if="streaming">/); assert.match(p, /<button v-if="client" type="button" class="m-sprompt__btn" data-star="client"/); assert.match(p, /m-sprompt__btn--fill" data-star="host"/); assert.match(p, /data-star="sponsor" @click="emit\('sponsor'\)"/)
  assert.match(dock, /starStreaming = computed\(\(\) => !!props\.ctx\.live\)/); assert.match(dock, /starClientInUse\(\{ clients: props\.ctx\.clientList/)
  assert.match(dock, /emit\('action', \{ card: 'star', type: 'sponsor', value: '' \}\)/, 'the sponsor entry is the one of 关于: the product opens its sponsor sheet')
  assert.match(d, /<Transition :css="false" mode="out-in" @enter="onSlotEnter" @leave="slotOut">/); assert.match(dock, /slotEnter\(el, done\)/, 'a card that comes later opens in height; one drawn in the first frame does not')
  assert.match(slot, /export function slotEnter/); assert.match(slot, /export function slotLeave/); assert.match(slot, /reducedMotion\(\)/)
  assert.match(card, /watch\(\(\) => !!streaming\(\)/); assert.doesNotMatch(card, /dismissed: true/)
  assert.doesNotMatch(p + card, /one-time|never again|for good/i, 'no comment says one-time any more')
})

test('the asks are real buttons: one height and shape, the filled heart and the Bilibili mark at the size of the GitHub mark, a state layer and the spring, 以后再说 quiet at the far right', () => {
  const prompt = read('../src/vue/MStarPrompt.vue'), css = read('../src/css/connect.css'), mark = read('../src/vue/MBilibiliMark.vue')
  assert.match(prompt, /<MBilibiliMark \/>\{\{ texts\.bilibili \}\}/, 'the brand mark, not a Material Symbols stand-in')
  assert.match(prompt, /<MIcon name="favorite" fill \/>\{\{ texts\.sponsor \}\}/)
  assert.match(mark, /viewBox="0 0 24 24"/); assert.match(mark, /fill="currentColor"/); assert.match(mark, /Apache-2\.0/); assert.match(mark, /Richard9394\/MingCute/)
  const rule = (sel) => css.split('\n').filter((l) => l.startsWith(sel)).join('\n')
  const btn = rule('.m-sprompt__btn {')
  assert.match(btn, /height: 40px/); assert.match(btn, /secondary-container/); assert.match(btn, /on-secondary-container/); assert.match(btn, /m-spring-fast-spatial/)
  assert.match(rule('.m-sprompt__btn--fill'), /var\(--md-sys-color-primary\)/)
  assert.match(css, /\.m-sprompt__btn::before \{[^}]*background: currentColor[^}]*opacity: 0/, 'a state layer')
  assert.match(css, /\.m-sprompt__btn:hover::before \{ opacity: 0\.08/); assert.match(css, /\.m-sprompt__btn:active \{ border-radius: 10px; transform: scale\(0\.97\)/)
  assert.match(css, /\.m-sprompt__btn \.m-icon, \.m-sprompt__btn \.m-ghmark, \.m-sprompt__btn \.m-bmark \{[^}]*width: 18px; height: 18px/)
  assert.match(rule('.m-sprompt__later {'), /margin-left: auto/, 'at the far right of its row, also when the row wraps')
  const idx = readFileSync(new URL('../docs/authority/source-index.tsv', import.meta.url), 'utf8')
  assert.match(idx, /m3e-mingcute-bilibili-20261110\t[^\n]*Apache-2\.0/); assert.match(read('../src/assets/brand/README.md'), /Apache-2\.0/)
})

test('the words of the banner have a readable width of their own and the buttons go to a second row when they do not fit beside them (any width, with the star of a client)', () => {
  const connect = readFileSync(new URL('../src/css/connect.css', import.meta.url), 'utf8')
  assert.match(connect, /\.m-sprompt \{ display: flex; flex-wrap: wrap;/)
  assert.match(connect, /\.m-sprompt__text \{ flex: 1 1 13em; min-width: min\(13em, 100%\); \}/)
  assert.match(connect, /\.m-sprompt__btns \{ flex: 0 1 auto; max-width: 100%; margin-inline-start: auto; display: flex; flex-wrap: wrap;/)
  assert.doesNotMatch(connect, /\.m-sprompt \{[^}]*grid-template-columns/)
})
