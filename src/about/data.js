// Facts of the about page. Every link is one of the host repository's own: README.md and the Web UI's config/resources.js
// (a test in the Web UI compares them). Nothing here is invented: a person is on the page because the README names them.

export const PRODUCT = Object.freeze({ name: 'Foundation Sunshine', repo: 'https://github.com/AlkaidLab/foundation-sunshine' })

const REPO = PRODUCT.repo

/** Project rows. `zh` is the address used when the interface is Chinese (the mirror of the site). */
export const PROJECT_LINKS = Object.freeze([
  { id: 'site', icon: 'public', url: 'https://www.alkaidlab.com/', zh: 'https://www.alkaidlab.cn/' },
  { id: 'docs', icon: 'menu_book', url: 'https://www.alkaidlab.com/docs/', zh: 'https://www.alkaidlab.cn/docs/' },
  { id: 'github', icon: 'code', url: REPO },
  { id: 'changelog', icon: 'history', url: `${REPO}/releases` },
  { id: 'license', icon: 'balance', url: `${REPO}/blob/master/LICENSE` },
  { id: 'qq', icon: 'groups', url: 'https://qm.qq.com/q/vIVhpjDMic' },
  { id: 'issues', icon: 'bug_report', url: `${REPO}/issues` },
])

/**
 * The two doors to the project outside GitHub: the website (the 'site' row above, .cn for Chinese) and the Bilibili channel (linked from the alkaidlab.cn home page, checked 2026-11-09).
 * No Bilibili brand rules could be read from an official source, so no logo is drawn: the neutral video icon `play_circle` stands for the channel.
 */
export const BILIBILI = Object.freeze({ id: 'bilibili', icon: 'play_circle', url: 'https://space.bilibili.com/3690974838524514', host: 'space.bilibili.com' })
export const SITE_LINK = PROJECT_LINKS.find((l) => l.id === 'site')

/** The README thanks these projects by name. */
export const THANKS = Object.freeze([
  { id: 'sunshine', name: 'LizardByte/Sunshine', icon: 'favorite', url: 'https://github.com/LizardByte/Sunshine' },
  { id: 'moonlight', name: 'Moonlight', icon: 'cast_connected', url: 'https://moonlight-stream.org/' },
  { id: 'zako', name: 'ZakoDisplay', icon: 'desktop_windows', url: 'https://github.com/qiin2333/zako-vdd' },
])
/** The fonts the interface ships (src/fonts/FONTS.md), all under the SIL Open Font License 1.1. */
export const FONTS = Object.freeze([
  { id: 'google-sans-flex', name: 'Google Sans Flex', url: 'https://fonts.google.com/specimen/Google+Sans+Flex' },
  { id: 'roboto-flex', name: 'Roboto Flex', url: 'https://fonts.google.com/specimen/Roboto+Flex' },
  { id: 'fraunces', name: 'Fraunces', url: 'https://fonts.google.com/specimen/Fraunces' },
  { id: 'caveat', name: 'Caveat', url: 'https://fonts.google.com/specimen/Caveat' },
  { id: 'mashanzheng', name: 'Ma Shan Zheng', url: 'https://fonts.google.com/specimen/Ma+Shan+Zheng' },
])
export const NOTICE_URL = `${REPO}/blob/master/NOTICE`
export const CONTRIBUTORS_URL = `${REPO}/graphs/contributors`

/**
 * Projects that the README links under a team member's own account (the only statement about what a member works on).
 * The README gives no role for anyone: all four are "基地开发团队成员" (AlkaidLab development team).
 */
export const TEAM_PROJECTS = Object.freeze({
  qiin2333: [
    { name: 'Moonlight V+', url: 'https://github.com/qiin2333/moonlight-qt' },
    { name: 'ZakoDisplay', url: 'https://github.com/qiin2333/zako-vdd' },
  ],
  skyhua0224: [{ name: 'Moonlight macOS Enhanced', url: 'https://github.com/skyhua0224/moonlight-macos-enhanced' }],
})

/**
 * The team in the order the team set (the README team table keeps the same order). Everyone is equal and carries no role; the one tag is 创始人, for the founder.
 * `TEAM_SPONSORS` is each member's own 爱发电 page; the sponsor rows of both products list the same people in the same order.
 */
export const TEAM_ORDER = Object.freeze(['qiin2333', 'Yundi339', 'skyhua0224', 'ShadowLemoon'])
export const FOUNDER = 'qiin2333'
export const TEAM_SPONSORS = Object.freeze({
  qiin2333: 'https://www.ifdian.net/a/qiin2333',
  Yundi339: 'https://www.ifdian.net/a/Yundi339',
  skyhua0224: 'https://ifdian.net/a/skyhua',
})
/** Sponsor links shared by the products, including the official website options. */
export const SPONSORS = Object.freeze([...TEAM_ORDER.filter((login) => TEAM_SPONSORS[login]).map((login) => Object.freeze({ login, url: TEAM_SPONSORS[login] })), Object.freeze({ login: '微信赞赏 / WeChat', url: 'https://www.alkaidlab.com/en/#sponsors', zh: 'https://www.alkaidlab.cn/#sponsors' }), Object.freeze({ login: 'GitHub Sponsors', url: 'https://github.com/sponsors/qiin2333' })])
const rank = (login) => { const i = TEAM_ORDER.indexOf(login); return i < 0 ? TEAM_ORDER.length : i }
/** People in team order; anyone the order does not name keeps their place after the named ones. */
export const inTeamOrder = (people) => [...people].sort((a, b) => rank(a.login) - rank(b.login))

export const resolveLink =(link, locale = 'en') => (/^zh/i.test(String(locale)) && link.zh ? link.zh : link.url)
/** The address of a brand door for an interface language: the site follows the language, the channel is one address for every language. */
export const brandUrl = (id, locale = 'en') => (id === 'bilibili' ? BILIBILI.url : resolveLink(SITE_LINK, locale))

/**
 * The short destination of a link, the second line of its card: the host and path of a site ("alkaidlab.com/docs"), "GitHub owner/repo" for the
 * repository and "GitHub owner/repo/releases" for its pages, the licence by name, the host of the QQ group link (the sources carry no group number).
 */
export function linkDetail(link, locale = 'en') {
  if (link.id === 'license') return 'GPL-3.0'
  let url
  try { url = new URL(resolveLink(link, locale)) } catch { return '' }
  const host = url.host.replace(/^www\./, '')
  const path = url.pathname.replace(/\/$/, '')
  if (host === 'github.com') {
    const parts = path.split('/').filter(Boolean)
    const page = { releases: 'Releases', issues: 'Issues' }[parts[2]]
    return page ? `GitHub ${page}` : `GitHub ${parts.slice(0, 2).join('/')}`
  }
  if (link.id === 'qq') return host
  return `${host}${path}`
}

/**
 * The build date the version carries. The host stamps non-release builds "YYYY.MMDD.HHMMSS[.suffix]" at compile time (cmake
 * `string(TIMESTAMP ... "%Y.%m%d.%H%M%S")`), release builds keep that stamp. A version without a stamp has no build date here.
 * @returns {{ date: string, time: string } | null}
 */
export function buildDateOf(version) {
  const m = /^[vV]?(\d{4})\.(\d{2})(\d{2})\.(\d{2})(\d{2})(\d{2})(?:\D|$)/.exec(String(version || '').trim())
  if (!m) return null
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null
  const pad = (n) => String(n).padStart(2, '0')
  return { date: `${year}-${pad(month)}-${pad(day)}`, time: `${pad(hour)}:${pad(minute)}:${pad(second)}` }
}

/** The second line of the 版本 row: the version, then the channel and the build date when there are any ("2026.1104.120000 · 测试版 · 构建 2026-11-04 12:00:00"). */
export const versionSubline = ({ version, channel, built } = {}) => [version, channel, built].filter(Boolean).join(' · ')
/** How long a press on the 版本 row must last to copy the version instead of counting a tap (the long press of Android: 500 ms; a little more for a mouse). */
export const LONG_PRESS_MS = 550

/** The plain text the copy button puts on the clipboard. */
export function versionText({ version, channel, buildDate } = {}) {
  const parts = [version, channel, buildDate].filter(Boolean)
  return `${PRODUCT.name} ${parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(', ')})` : parts[0] || ''}`.trim()
}
