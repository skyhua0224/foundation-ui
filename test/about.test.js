import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  CONTRIBUTORS, CREDITS_TAPS, CREDITS_WINDOW_MS, EGG_WINDOW_MS, FOUNDER, FRIENDS, NOTICE_URL, PROJECT_LINKS, SPONSORS, TEAM, TEAM_ORDER, TEAM_PROJECTS, TEAM_SPONSORS, THANKS, VIVI_TAPS,
  LONG_PRESS_MS, aboutTexts, buildDateOf, versionSubline, friendLine, friendSheet, inTeamOrder, parseContributors, parseTeam, resolveLink, tapCounter, versionText,
} from '../src/about/index.js'
import { BODY, FRIEND_FRAMES, FRIEND_HEIGHT, FRIEND_WIDTH, badgeBox, friendFrames } from '../src/about/friends.js'
import { TAPS_NEEDED, TAP_WINDOW_MS } from '../src/vue/useDeveloperMode.js'
import { avatarSources, hdName } from '../src/about/avatarset.js'
import { writeProgress } from '../src/vue/guideModel.js'

const here = dirname(fileURLToPath(import.meta.url))
// width and height of a PNG (IHDR) or a JPEG (the first SOF marker)
const imageSize = (buf) => {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  for (let i = 2; i + 9 < buf.length;) {
    if (buf[i] !== 0xff) return null
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) }
    i += 2 + len
  }
  return null
}
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }

test('build date comes from the stamp of the version only', () => {
  assert.deepEqual(buildDateOf('2026.1101.150529.杂鱼'), { date: '2026-11-01', time: '15:05:29' })
  assert.deepEqual(buildDateOf('v2026.1031.121458'), { date: '2026-10-31', time: '12:14:58' })
  assert.equal(buildDateOf('1.2.3'), null)
  assert.equal(buildDateOf('2026.1301.000000'), null)
  assert.equal(buildDateOf(''), null)
  assert.equal(buildDateOf(undefined), null)
})

test('version text for the copy button', () => {
  assert.equal(versionText({ version: '2026.1101.150529', channel: 'Stable', buildDate: '2026-11-01' }), 'Foundation Sunshine 2026.1101.150529 (Stable, 2026-11-01)')
  assert.equal(versionText({ version: '1.0' }), 'Foundation Sunshine 1.0')
})

test('every link is https and has a text in both languages', () => {
  const urls = [...PROJECT_LINKS.flatMap((l) => [l.url, l.zh]), ...THANKS.map((t) => t.url), NOTICE_URL].filter(Boolean)
  for (const url of urls) assert.match(url, /^https:\/\//)
  const en = aboutTexts('en')
  const zh = aboutTexts('zh-CN')
  for (const link of PROJECT_LINKS) { assert.ok(en[link.id], link.id); assert.ok(zh[link.id], link.id) }
  assert.equal(resolveLink(PROJECT_LINKS[0], 'zh'), 'https://www.alkaidlab.cn/')
  assert.equal(resolveLink(PROJECT_LINKS[0], 'en'), 'https://www.alkaidlab.com/')
  assert.equal(aboutTexts('de').slogan, en.slogan)
  assert.equal(zh.slogan, '让游戏串流更优雅')
})

test('people: the team is the four named in the README, avatars are bundled, bots are left out', () => {
  assert.deepEqual(TEAM.map((p) => p.login), ['qiin2333', 'Yundi339', 'skyhua0224', 'ShadowLemoon'])
  assert.ok(CONTRIBUTORS.length > 100)
  assert.ok(CONTRIBUTORS.every((p) => !p.bot && !/\[bot\]$/.test(p.login)))
  for (const person of [...TEAM, ...CONTRIBUTORS]) {
    assert.ok(person.avatar, `${person.login} has no avatar`)
    assert.ok(existsSync(join(here, '..', 'src', 'about', 'avatars', person.avatar)), person.avatar)
    assert.match(person.url, /^https:\/\/github\.com\//)
  }
  for (const login of Object.keys(TEAM_PROJECTS)) assert.ok(TEAM.some((p) => p.login === login))
})

test('README parsing', () => {
  const readme = `## 基地开发团队成员\n\n| [![a](https://avatars.githubusercontent.com/u/1?s=80)](https://github.com/a) | [![b](https://avatars.githubusercontent.com/u/2?s=80)](https://github.com/b) |\n\n## 其他贡献者\n<!-- CONTRIBUTORS:START -->\n<a href="https://github.com/c"><img src="https://avatars.githubusercontent.com/u/3?v=4&amp;s=80" alt="c"></a>\n<a href="https://github.com/apps/dependabot"><img src="https://avatars.githubusercontent.com/in/9?v=4&amp;s=80" alt="dependabot[bot]"></a>\n<a href="https://github.com/c"><img src="https://avatars.githubusercontent.com/u/3?v=4&amp;s=80" alt="c"></a>\n<!-- CONTRIBUTORS:END -->`
  assert.deepEqual(parseTeam(readme).map((p) => [p.login, p.id, p.url]), [['a', '1', 'https://github.com/a'], ['b', '2', 'https://github.com/b']])
  const list = parseContributors(readme)
  assert.deepEqual(list.map((p) => [p.login, p.id, p.bot]), [['c', '3', false], ['dependabot[bot]', '9', true]])
  assert.deepEqual(parseContributors('nothing'), [])
  assert.deepEqual(parseTeam(''), [])
})

test('the data matches the host README when the host checkout is next to this repository', { skip: !process.env.HOST_README }, () => {
  const readme = readFileSync(process.env.HOST_README, 'utf8')
  assert.deepEqual(parseTeam(readme).map((p) => p.id), TEAM.map((p) => p.id))
  assert.deepEqual(parseContributors(readme).filter((p) => !p.bot && !TEAM.some((t) => t.id === p.id)).map((p) => p.id), CONTRIBUTORS.map((p) => p.id))
  const urls = [...PROJECT_LINKS.flatMap((l) => [l.url, l.zh]), ...THANKS.map((t) => t.url), NOTICE_URL].filter(Boolean)
  const resources = readFileSync(join(dirname(process.env.HOST_README), 'src_assets/common/assets/web/config/resources.js'), 'utf8')
  const known = (url) => readme.includes(url) || resources.includes(url) || readme.includes(url.replace(/#readme$/, '')) || /github\.com\/AlkaidLab\/foundation-sunshine\/(releases|blob\/master\/(LICENSE|NOTICE))$/.test(url) || url === 'https://www.alkaidlab.com/docs/' || url === 'https://www.alkaidlab.cn/docs/'
  for (const url of urls) assert.ok(known(url), `${url} is neither in the README nor in resources.js`)
})

test("link cards: the second line is the short destination, from the data only", async () => {
  const { PROJECT_LINKS, linkDetail } = await import("../src/about/index.js")
  const by = (id, locale) => linkDetail(PROJECT_LINKS.find((l) => l.id === id), locale)
  assert.equal(by("site", "en"), "alkaidlab.com"); assert.equal(by("site", "zh"), "alkaidlab.cn")
  assert.equal(by("docs", "en"), "alkaidlab.com/docs")
  assert.equal(by("github"), "GitHub AlkaidLab/foundation-sunshine")
  assert.equal(by("changelog"), "GitHub Releases"); assert.equal(by("issues"), "GitHub Issues")
  assert.equal(by("license"), "GPL-3.0"); assert.equal(by("qq"), "qm.qq.com")
  for (const l of PROJECT_LINKS) assert.ok(linkDetail(l, "en").length > 0, l.id)
})

test('team order: the team\'s order, everyone equal, the founder the one tag', () => {
  assert.deepEqual(TEAM_ORDER, ['qiin2333', 'Yundi339', 'skyhua0224', 'ShadowLemoon'])
  assert.deepEqual(TEAM.map((p) => p.login), TEAM_ORDER)
  assert.equal(FOUNDER, 'qiin2333')
  // the order holds whatever order the README gives; people it does not name keep their place after the team
  const shuffled = [{ login: 'ShadowLemoon' }, { login: 'someone' }, { login: 'skyhua0224' }, { login: 'qiin2333' }, { login: 'Yundi339' }]
  assert.deepEqual(inTeamOrder(shuffled).map((p) => p.login), [...TEAM_ORDER, 'someone'])
  const en = aboutTexts('en'), zh = aboutTexts('zh-CN')
  assert.equal(zh.founder, '创始人'); assert.equal(zh.follow, '在 GitHub 关注'); assert.equal(zh.credits, '制作人员')
  for (const key of ['founder', 'follow', 'sponsorAfdian', 'credits', 'creditsTeam', 'creditsSponsors', 'creditsUpstream', 'creditsContributors', 'creditsEnd', 'viviFound', 'friendsLabel']) { assert.ok(en[key], key); assert.ok(zh[key], key) }
})

test('sponsors include the team and website options', () => {
  assert.deepEqual(SPONSORS.map((s) => [s.login, s.url]), [
    ['qiin2333', 'https://www.ifdian.net/a/qiin2333'],
    ['Yundi339', 'https://www.ifdian.net/a/Yundi339'],
    ['skyhua0224', 'https://ifdian.net/a/skyhua'],
    ['微信赞赏 / WeChat', 'https://www.alkaidlab.com/en/#sponsors'],
    ['GitHub Sponsors', 'https://github.com/sponsors/qiin2333'],
  ])
  for (const login of Object.keys(TEAM_SPONSORS)) assert.ok(TEAM_ORDER.includes(login), login)
  const wechat = SPONSORS.find((s) => s.login === '微信赞赏 / WeChat')
  assert.equal(resolveLink(wechat, 'zh-CN'), 'https://www.alkaidlab.cn/#sponsors')
  assert.equal(resolveLink(wechat, 'zh-TW'), 'https://www.alkaidlab.cn/#sponsors')
  assert.equal(resolveLink(wechat, 'en'), 'https://www.alkaidlab.com/en/#sponsors')
})

test('easter eggs: seven quick taps on the version (with developer mode), six on 薇薇', () => {
  assert.equal(CREDITS_TAPS, 7)
  assert.equal(CREDITS_TAPS, TAPS_NEEDED)
  assert.equal(CREDITS_WINDOW_MS, TAP_WINDOW_MS)
  assert.equal(VIVI_TAPS, 6)
  const quick = (counter, n, gap) => Array.from({ length: n }, (_, i) => counter.tap(1000 + i * gap))
  assert.deepEqual(quick(tapCounter(CREDITS_TAPS, CREDITS_WINDOW_MS), 7, 400), [false, false, false, false, false, false, true])
  assert.deepEqual(quick(tapCounter(VIVI_TAPS), 6, 200), [false, false, false, false, false, true])
  // a slow tap starts again at one; after the egg the count starts again
  const c = tapCounter(VIVI_TAPS)
  for (let i = 0; i < 5; i++) c.tap(i * 200)
  assert.equal(c.tap(800 + EGG_WINDOW_MS + 1), false)
  assert.equal(c.count, 1)
  const d = tapCounter(3, 1000)
  assert.deepEqual([d.tap(0), d.tap(100), d.tap(200), d.tap(300)], [false, false, true, false])
})

test('pixel friends: one per member in team order, the shared original body, the member\'s own avatar as the head (96 and 256 px files)', () => {
  assert.deepEqual(FRIENDS.map((f) => f.login), TEAM_ORDER)
  const frames = friendFrames()
  assert.equal(frames.length, FRIEND_FRAMES)
  assert.deepEqual(BODY.map((f) => f.dy), [1, 0, 1, 0])
  const letters = new Set()
  for (const rows of frames) {
    assert.equal(rows.length, FRIEND_HEIGHT)
    for (const row of rows) { assert.equal(row.length, FRIEND_WIDTH, row); for (const ch of row) if (ch !== '.') letters.add(ch) }
  }
  // the badge sits on the body: inside the canvas, centred over it, its lower edge on the scarf (row 22 + dy)
  const b = badgeBox(1)
  assert.ok(b.left >= 0 && b.left + b.size <= FRIEND_WIDTH && b.top >= 0)
  assert.equal(b.left + b.size / 2, FRIEND_WIDTH / 2)
  assert.ok(Math.abs(b.top + b.size - (22 + BODY[0].dy)) <= 1.5)
  assert.deepEqual(badgeBox(2), { left: b.left * 2, top: b.top * 2, size: b.size * 2, ring: 2, inner: b.inner * 2 })
  for (const f of FRIENDS) {
    for (const ch of letters) assert.ok(f.palette[ch], `${f.login}: no colour for ${ch}`)
    const person = TEAM.find((p) => p.login === f.login)
    assert.equal(f.avatar.sd, person.avatar, `${f.login} uses the avatar of the about page`)
    assert.match(f.avatar.hd, new RegExp(`^${person.id}-256\\.(jpg|png|webp)$`))
    for (const [file, least] of [[f.avatar.sd, 96], [f.avatar.hd, 192]]) {
      const path = join(here, '..', 'src', 'about', 'avatars', file)
      assert.ok(existsSync(path), file)
      const size = imageSize(readFileSync(path))
      assert.ok(size && size.w >= least && size.w === size.h, `${file}: ${JSON.stringify(size)}`)
    }
    // the avatar is never part of the drawn sprite: the strip is the body alone, in this member's colours
    const url = friendSheet(f)
    assert.match(url, /^data:image\/svg\+xml,/)
    assert.ok(!/<image|href=/.test(decodeURIComponent(url)))
    assert.ok(decodeURIComponent(url).includes(f.palette.b))
    assert.equal(friendSheet(f), url)
    assert.notEqual(friendSheet(f, { halo: '#fff' }), url)
    assert.ok(f.lines.length >= 2)
    for (const line of f.lines) { assert.ok(line.zh && line.en); assert.ok(line.zh.length <= 20, line.zh); assert.ok(line.en.length <= 48, line.en) }
    assert.equal(friendLine(f, 'zh-CN', 0), f.lines[0].zh)
    assert.equal(friendLine(f, 'en', f.lines.length), f.lines[0].en)
  }
})

test('pixel friends: the badge bobs in step with the frames, and every motion of a friend is a transform', () => {
  const css = readFileSync(join(here, '..', 'src', 'css', 'about.css'), 'utf8')
  const anim = (cls) => new RegExp(`\\.${cls} \\{[^}]*animation: (m-friend-[a-z]+) (\\d+)ms`).exec(css)
  const strip = anim('m-friend__strip'), badge = anim('m-friend__badge')
  assert.ok(strip && badge)
  assert.equal(badge[2], strip[2])
  assert.match(css, /animation: m-friend-step 640ms steps\(4\)/)
  for (const name of ['m-friend-walk', 'm-friend-turn', 'm-friend-step', 'm-friend-bob']) {
    const frames = new RegExp(`@keyframes ${name} \\{(.*)\\}`).exec(css)
    assert.ok(frames, name)
    for (const prop of frames[1].matchAll(/([a-z-]+):/g)) assert.equal(prop[1], 'transform', `${name} animates ${prop[1]}`)
  }
  // the avatar is outside the part that turns, and never pixelated
  const vue = readFileSync(join(here, '..', 'src', 'vue', 'MPixelFriends.vue'), 'utf8')
  assert.ok(vue.indexOf('m-friend__badge') > vue.indexOf('</span>', vue.indexOf('m-friend__face')))
  assert.ok(!/\.m-friend__badge[^{]*\{[^}]*pixelated/.test(css))
})

test('版本 is its own row: the version, then the channel and the build date on its second line; the top is the name and the mascot only', () => {
  assert.equal(versionSubline({ version: '2026.1104.120000', channel: '测试版', built: '构建 2026-11-04 12:00:00' }), '2026.1104.120000 · 测试版 · 构建 2026-11-04 12:00:00')
  assert.equal(versionSubline({ version: '1.2.3' }), '1.2.3')
  assert.equal(versionSubline({ version: '1.2.3', channel: '', built: '' }), '1.2.3')
  assert.ok(LONG_PRESS_MS >= 500 && LONG_PRESS_MS <= 800)
  const vue = readFileSync(join(here, '..', 'src', 'vue', 'MAbout.vue'), 'utf8')
  const top = /<MProductHero[\s\S]*?<\/section>/.exec(vue)[0]
  assert.ok(!/T\.version|shownVersion|tapVersion|copyVersion|versionLine/.test(top), 'the top area carries no version')
  const row = /<div class="m-item m-about__verrow"[\s\S]*?<\/MGroup>/.exec(vue)[0]
  assert.match(row, /@click="onVersionClick"/)
  assert.match(row, /@pointerdown="pressStart"/)
  assert.match(row, /@click="copyVersion"/)
  // two buttons side by side in the row, never one inside the other
  const tap = /<button[^>]*m-about__vertap[\s\S]*?<\/button>/.exec(row)[0]
  assert.ok(!/<MIconButton|<MButton|<button[\s\S]*<button/.test(tap.slice(7)))
})

test('avatars: the team shows the 256 px file where a slot needs more than 96 device pixels, the 96 px file stays the fallback', () => {
  const dir = join(here, '..', 'src', 'about', 'avatars')
  const lookup = (name) => (name && existsSync(join(dir, name)) ? `/a/${name}` : '')
  for (const person of TEAM) {
    const hd = hdName(person.avatar, lookup)
    assert.match(hd, new RegExp(`^${person.id}-256\\.(jpg|png|webp)$`), person.login)
    assert.equal(hd, FRIENDS.find((f) => f.login === person.login).avatar.hd)
    assert.deepEqual(avatarSources(person.avatar, lookup), { src: `/a/${person.avatar}`, srcset: `/a/${person.avatar} 96w, /a/${hd} 256w` })
  }
  // a contributor has the 96 px file only: no srcset; nothing bundled: nothing
  const other = CONTRIBUTORS[0]
  assert.deepEqual(avatarSources(other.avatar, lookup), { src: `/a/${other.avatar}`, srcset: '' })
  assert.deepEqual(avatarSources('', lookup), { src: '', srcset: '' })
  assert.equal(hdName('not-a-file', lookup), '')
  // the team cards, the credits and the pixel friends ask for the two widths with the width they draw
  const vue = (f) => readFileSync(join(here, '..', 'src', 'vue', f), 'utf8')
  assert.match(vue('MAbout.vue'), /m-about__portrait" :src="avatarImage\(person\.avatar\)\.src" :srcset="avatarImage\(person\.avatar\)\.srcset \|\| undefined" sizes="88px"/)
  assert.match(vue('MCredits.vue'), /:srcset="avatarImage\(p\.avatar\)\.srcset \|\| undefined" sizes="48px"/)
  assert.match(vue('MPixelFriends.vue'), /avatarImage\(friend\.avatar\.sd\)/)
})

test('更新通道 sits under 版本 in the same list, a two-way choice that the product handles; the 版本 row shares the surface of the page\'s cards', () => {
  const vue = readFileSync(join(here, '..', 'src', 'vue', 'MAbout.vue'), 'utf8')
  const group = /<MGroup>\s*<div class="m-item m-about__verrow"[\s\S]*?<\/MGroup>/.exec(vue)[0]
  assert.match(group, /<MItem v-if="updateChannel" class="m-about__channel"[^>]*:title="T\.updateChannel" :text="T\.channelNote"/)
  assert.match(group, /<MSeg size="sm"[^>]*:model-value="updateChannel"[^>]*@update:model-value="\(value\) => emit\('channel-change', value\)"/)
  assert.match(vue, /defineEmits\(\[[^\]]*'channel-change'/)
  assert.match(vue, /channelOptions = computed\(\(\) => \[\{ value: 'stable', label: T\.value\.stable \}, \{ value: 'prerelease', label: T\.value\.prerelease \}\]\)/)
  for (const locale of ['en', 'zh-CN']) { const t = aboutTexts(locale); for (const key of ['updateChannel', 'channelNote', 'channelFailed', 'stable', 'prerelease']) assert.ok(t[key], `${locale} ${key}`) }
  assert.equal(aboutTexts('zh-CN').updateChannel, '更新通道')
  const css = readFileSync(join(here, '..', 'src', 'css', 'about.css'), 'utf8')
  // the row is an .m-item: the same --m-card surface as the cards above; its own rules set no other background, and hover waits for a pointer that hovers
  assert.ok(!/\.m-about__ver(row|tap)(?![^{]*::before)[^{]*\{[^}]*background(-color)?:/.test(css))
  assert.match(css, /@media \(hover: hover\) \{ \.m-about__verrow:has\(\.m-about__vertap:hover\)::before/)
})
