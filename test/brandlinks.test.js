import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BILIBILI, SITE_LINK, SPONSORS, brandUrl, PROJECT_LINKS, aboutTexts } from '../src/about/index.js'
import { ITEMS, SUPPORT_ROW, V1, V2, V3, VARIANTS, rowIds, tx } from '../src/tray/trayModel.js'
import { trayTexts } from '../src/tray/trayTexts.js'
import { ICONS } from '../src/icons/icons.js'
import { homeTexts } from '../src/vue/homeModel.js'
import { starPromptTexts } from '../src/vue/homeCards.js'
import { guideTexts } from '../src/vue/guideTexts.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('brand links: the site follows the language (.cn for Chinese), the Bilibili channel is one address', () => {
  assert.equal(SITE_LINK.id, 'site')
  assert.equal(brandUrl('site', 'zh'), 'https://www.alkaidlab.cn/')
  assert.equal(brandUrl('site', 'zh-CN'), 'https://www.alkaidlab.cn/')
  assert.equal(brandUrl('site', 'en'), 'https://www.alkaidlab.com/')
  assert.equal(brandUrl('site', 'ja'), 'https://www.alkaidlab.com/')
  for (const l of ['zh', 'en', 'ja', 'de']) assert.equal(brandUrl('bilibili', l), 'https://space.bilibili.com/3690974838524514')
  assert.ok(ICONS[BILIBILI.icon], 'the channel icon is drawn')
  assert.equal(PROJECT_LINKS.filter((l) => l.id === 'site').length, 1, 'the site row is still the one the community file overrides')
})

test('home banner: 关注 B 站 next to the stars, in both languages, opening the channel', () => {
  assert.equal(starPromptTexts(homeTexts('zh')).bilibili, '关注 B 站')
  assert.ok(starPromptTexts(homeTexts('en')).bilibili)
  const prompt = read('../src/vue/MStarPrompt.vue')
  assert.match(prompt, /data-star="bilibili"[^>]*@click="emit\('open', BILIBILI\.url\)"/)
  assert.match(read('../src/vue/MHomeDash.vue'), /bilibili: T\.starBilibili/)
})

test('about: 官网 and B 站 are two cards under the top area; the site is no longer a row of the list', () => {
  const about = read('../src/vue/MAbout.vue')
  assert.match(about, /class="m-about__brand"/)
  assert.match(about, /\[\['docs', 'changelog'\], \['github', 'issues', 'qq'\]\]/)
  assert.ok(about.indexOf('m-about__brand"') < about.indexOf('m-about__versionsection'), 'before the version')
  assert.equal(aboutTexts('zh').bilibili, 'B 站')
  assert.equal(aboutTexts('zh').site, '官网')
  assert.ok(aboutTexts('en').bilibili)
  // the channel card is pink in both schemes, the site card is the product's colour; no logo is drawn
  const css = read('../src/css/about.css')
  assert.match(css, /\.m-about__brandcard\.is-bilibili \{[^}]*#fb7299/)
  assert.match(css, /\[data-theme='dark'\] \.m-about__brandcard\.is-bilibili/)
})

test('guide: the last page ends with one line, 关注我们：B 站 · 官网', () => {
  const zh = guideTexts('zh'), en = guideTexts('en')
  assert.equal(zh.follow, '关注我们：')
  assert.equal(zh.followBilibili, 'B 站')
  assert.equal(zh.followSite, '官网')
  assert.ok(en.follow && en.followBilibili && en.followSite)
  const flow = read('../src/vue/MGuideFlow.vue')
  assert.match(flow, /<p v-if="isLast\(flow, idx\) && !sub" class="m-guide__follow"/)
  assert.match(flow, /brandUrl\('site', locale\)/)
})

test('tray: the support row closes the 帮助 page of V1 and V2 and the 设置与帮助 page of V3, and appears nowhere else', () => {
  for (const [name, model] of Object.entries(VARIANTS)) {
    const helpPage = name === 'v3' ? 'settings' : 'help' // the quick panel has three pages: its help is the end of 设置与帮助
    for (const [pageName, pg] of Object.entries(model.pages)) {
      const at = pg.rows.findIndex((r) => r.t === 'support')
      if (pageName === helpPage) assert.equal(at, pg.rows.length - 1, `${name}: last row of ${helpPage}`)
      else assert.equal(at, -1, `${name}: ${pageName} has no support row`)
    }
  }
  // not on the first page of V3 and not above the operational rows of V1 and V2
  assert.equal(V3.order[0], 'quick')
  assert.ok(!V3.pages.quick.rows.some((r) => r.t === 'support'))
  for (const m of [V1, V2]) assert.ok(!m.pages.root.rows.some((r) => r.t === 'support'))
})

test('tray: the support chips run one id each, 赞助 is a chooser of the three developers of the sponsor list', () => {
  assert.deepEqual([...SUPPORT_ROW.chips], ['visit_site', 'visit_bilibili', 'star_github'])
  assert.equal(SUPPORT_ROW.sponsors.length, 5)
  assert.deepEqual(rowIds({ t: 'support' }), [...SUPPORT_ROW.chips, ...SUPPORT_ROW.sponsors])
  // the same people in the same order as the about page's list (the Panel's config/sponsors.js is tested against it)
  assert.deepEqual(SUPPORT_ROW.sponsors.map((id) => ITEMS[id].label), SPONSORS.map((s) => s.login))
  for (const id of [...SUPPORT_ROW.chips, ...SUPPORT_ROW.sponsors]) assert.ok(ITEMS[id] && ICONS[ITEMS[id].icon], id)
  for (const locale of ['zh', 'en', 'ja']) for (const k of ['site', 'bilibili', 'star', 'sponsor', 'sponsors', 'label']) assert.ok(trayTexts(locale).support[k], `${locale}.${k}`)
  assert.equal(tx({ locale: 'zh' }).support.star, '点 Star')
})

test('tray: the row reads as a quiet line - neutral chips, no brand colour, badge, counter, animation or "please"', () => {
  const css = read('../src/css/tray.css')
  const rules = css.split('\n').filter((l) => /^\.m-tray__sup/.test(l))
  assert.ok(rules.length >= 6)
  const joined = rules.join('\n')
  assert.doesNotMatch(joined, /#[0-9a-f]{3,8}\b|animation|keyframes|gradient|primary-container|tertiary/i)
  assert.match(joined, /surface-container-high/)
  for (const l of ['zh', 'en', 'ja']) assert.doesNotMatch(JSON.stringify(trayTexts(l).support), /请|please|お願い/i)
  const row = read('../src/vue/MTrayRow.vue')
  assert.match(row, /v-else-if="row\.t === 'support'"/)
  assert.doesNotMatch(row.split("row.t === 'support'")[1].split("row.t === 'divider'")[0], /badge|<MBadge/)
})
