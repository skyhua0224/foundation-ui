// The downloadable files of a client, read from the release metadata the website publishes (www.alkaidlab.com/release-metadata/<product>.json). Every asset has a type
// (windows-x64-installer, macos-universal-dmg, linux-arm64-appimage, android-apk, steam-link-zip, ...), a url on cnb.cool (the mirror that is fast in China), a fallbackUrl
// on GitHub, a size and a sha256. Pure functions; the product fetches the metadata (see useReleaseAssets).
//
// What the website does, and what we do the same: it reads the `latest` channel of the product and only when that release is not a prerelease; it hides nothing by
// itself because it shows one file per system. For the Chinese interface the CNB url is the main one and GitHub the other; for the other languages GitHub is the main one.
// What we do differently: we show every architecture and format of the system the person picked (the website shows the one best file), and we hide the files that are not
// for people (zsync update data, the `-alias` copies, the appcast and the checksum list).
import { CLIENTS } from './catalogue.js'

export const RELEASE_BASE = 'https://www.alkaidlab.com/release-metadata'
/** client id -> the product of its release metadata (the stores and the partners' own pages have none). */
export const RELEASE_PRODUCT = Object.freeze(Object.fromEntries(CLIENTS.filter((c) => c.product).map((c) => [c.id, c.product])))
export const releaseUrlOf = (product) => `${RELEASE_BASE}/${product}.json`

const SHOWN = /^(windows|macos|linux)-(x64|arm64|universal)-(installer|portable|dmg|appimage)$|^android-apk$|^steam-link-zip$/
/** Types that are not for people: update data, the `-alias` copies, the appcast and the checksum list. */
export const isDownloadable = (asset) => !!asset && typeof asset.type === 'string' && SHOWN.test(asset.type)
/** The best file per system, as the website picks it (and the one marked 推荐 in the list). */
export const RECOMMENDED_TYPE = Object.freeze({ windows: 'windows-x64-installer', macos: 'macos-universal-dmg', linux: 'linux-x64-appimage', android: 'android-apk', tv: 'steam-link-zip' })

const OS_OF_TYPE = (type) => (type === 'steam-link-zip' ? 'tv' : type === 'android-apk' ? 'android' : type.split('-')[0])
// the order a system lists its files in: the best first, then the other architectures, installers before portable builds
const ORDER = {
  windows: ['windows-x64-installer', 'windows-x64-portable', 'windows-arm64-portable'],
  macos: ['macos-universal-dmg', 'macos-arm64-dmg', 'macos-x64-dmg'],
  linux: ['linux-x64-appimage', 'linux-arm64-appimage'],
  android: ['android-apk'],
  tv: ['steam-link-zip'],
}
const ARCH = { zh: { x64: 'x64', arm64: 'ARM64', universal: '通用' }, en: { x64: 'x64', arm64: 'ARM64', universal: 'Universal' } }
const MAC = { zh: { arm64: 'Apple 芯片', x64: 'Intel', universal: '通用（Apple 芯片 + Intel）' }, en: { arm64: 'Apple silicon', x64: 'Intel', universal: 'Universal (Apple silicon + Intel)' } }
const FORMAT = { zh: { installer: '安装程序 .exe', portable: '便携版 .zip', dmg: '.dmg', appimage: 'AppImage', apk: '.apk', zip: '.zip' }, en: { installer: 'Installer .exe', portable: 'Portable .zip', dmg: '.dmg', appimage: 'AppImage', apk: '.apk', zip: '.zip' } }

/** "12.3 MB" from a byte count. */
export function sizeLabel(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`
}

/**
 * The files of a system for one client, best first: [{ type, os, arch, archLabel, format, formatLabel, label, name, size, sizeLabel, sha256, cnbUrl, githubUrl, url, mirrorUrl, recommended }].
 * `url` is the main download for the language (CNB for Chinese, GitHub otherwise), `mirrorUrl` the other. `assets` are the assets of the product's `latest` channel.
 */
export function releaseRows(assets, os, locale = 'en') {
  const lang = /^zh/i.test(String(locale)) ? 'zh' : 'en'
  const order = ORDER[os] || []
  return (assets || []).filter(isDownloadable).filter((a) => OS_OF_TYPE(a.type) === os)
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    .map((a) => {
      const [, arch = '', format = ''] = a.type.match(/^[a-z]+-(x64|arm64|universal)-([a-z]+)$/) || []
      const kind = a.type === 'android-apk' ? 'apk' : a.type === 'steam-link-zip' ? 'zip' : format
      const archLabel = os === 'macos' ? MAC[lang][arch] || '' : ARCH[lang][arch] || ''
      const formatLabel = FORMAT[lang][kind] || ''
      const label = a.type === 'steam-link-zip' ? `Steam Link · ${formatLabel}` : [archLabel, formatLabel].filter(Boolean).join(' · ')
      const cnb = a.url || '', github = a.fallbackUrl || ''
      return { type: a.type, os, arch, archLabel, format: kind, formatLabel, label, name: a.name || '', size: Number(a.size) || 0, sizeLabel: sizeLabel(a.size), sha256: a.sha256 || '', cnbUrl: cnb, githubUrl: github,
        url: lang === 'zh' ? cnb || github : github || cnb, mirrorUrl: lang === 'zh' ? (cnb ? github : '') : (github ? cnb : ''), recommended: a.type === RECOMMENDED_TYPE[os] }
    })
}

/** The version as a tile shows it: without the build part after a +, and at most `max` characters (the last one an ellipsis when it is cut; the full text is the tooltip). */
export const shortVersion = (version, max = 11) => { const v = String(version ?? '').trim().split('+')[0]; return v.length > max ? `${v.slice(0, max - 1)}…` : v }

/** What the secondary link says: the other host than the main one. */
export const mirrorName = (locale = 'en') => (/^zh/i.test(String(locale)) ? 'GitHub' : 'CNB')

/** The system a target's files are listed under: Android TV and Quest take the Android file, Steam Link its own zip, the others their system. */
export const assetOsOf = (target) => (target.platform === 'steam' ? 'tv' : ['android', 'android-tv', 'quest'].includes(target.platform) ? 'android' : target.os)

/**
 * What the copy menu offers for one download: the link of the 下载 button first (exactly that URL, labelled with its host), then the other host. `row` needs `url`, `cnbUrl`, `githubUrl`;
 * `texts` gives `copyCnb` and `copyGithub`. A single host gives a single choice (no menu).
 */
export function copyChoices(row, texts) {
  const label = (u) => (u === row.cnbUrl ? texts.copyCnb : u === row.githubUrl ? texts.copyGithub : texts.copyLink)
  const list = [{ id: 'main', url: row.url, label: label(row.url) }]
  for (const [id, u] of [['cnb', row.cnbUrl], ['github', row.githubUrl]]) if (u && u !== row.url) list.push({ id, url: u, label: label(u) })
  return list.filter((c) => c.url)
}
