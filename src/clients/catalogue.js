// The client list: one data source for the download page, the home's download card, the guide's install step and the Web setup wizard.
// Four clients are works of the Foundation team and official (`group: 'first'`, tagged 官方): Moonlight V+ for the desktop (the Qt client), Moonlight V+ for Android, Moonlight macOS Enhanced and
// Moonlight V+ for HarmonyOS. Every other client is a partner's (`group: 'partner'`, tagged 合作): VoidLink, 王冠版, 包子版. The order of the list is fixed and follows the order of ProjectCompute's
// CEND page (V+ desktop, V+ Android, V+ Harmony, VoidLink) with the team's rule on top: macOS Enhanced is third among the team's clients in the full list (it is the first only where the list
// is the one of macOS); the clients of the team come before the partners'.
//
// `name` is what a row with a system label next to it shows (the home card), `label` the whole name where there is no such label (the download page).
// A client has targets: where it runs (`os`), which platform card of the download page it opens (`platform`), and the device types of the home card.

export const CLIENT_OS = Object.freeze(['windows', 'macos', 'linux', 'android', 'ios', 'harmony', 'tv'])
export const CLIENT_TYPES = Object.freeze(['phone', 'tablet', 'computer', 'tv'])

export const CLIENTS = Object.freeze([
  { id: 'vplus-desktop', group: 'first', name: 'Moonlight V+', label: 'Moonlight V+ Desktop', guideName: 'Moonlight V+ for PC', icon: 'desktop_windows', guide: 'moonlight-pc', url: 'https://github.com/qiin2333/moonlight-qt',
    links: { project: 'https://github.com/qiin2333/moonlight-qt', releases: 'https://github.com/qiin2333/moonlight-qt/releases', host: 'github' }, product: 'moonlight-vplus-pc',
    targets: [{ os: 'windows', platform: 'windows', types: ['computer'] }, { os: 'macos', platform: 'macos', types: ['computer'] }, { os: 'linux', platform: 'linux', types: ['computer'] }, { os: 'tv', platform: 'steam', types: ['computer'] }] },
  { id: 'vplus-android', group: 'first', name: 'Moonlight V+', label: 'Moonlight V+ Android', icon: 'android', guide: 'moonlight-vplus', url: 'https://github.com/qiin2333/moonlight-vplus',
    links: { project: 'https://github.com/qiin2333/moonlight-vplus', releases: 'https://github.com/qiin2333/moonlight-vplus/releases', host: 'github' }, product: 'moonlight-vplus',
    targets: [{ os: 'android', platform: 'android', types: ['phone', 'tablet'] }, { os: 'tv', platform: 'android-tv', types: ['tv'] }, { os: 'android', platform: 'quest', types: ['tv'] }] },
  { id: 'macos-enhanced', group: 'first', name: 'Moonlight macOS Enhanced', icon: 'laptop_mac', guide: 'moonlight-macos', url: 'https://github.com/skyhua0224/moonlight-macos-enhanced',
    links: { project: 'https://github.com/skyhua0224/moonlight-macos-enhanced', releases: 'https://github.com/skyhua0224/moonlight-macos-enhanced/releases', host: 'github' }, product: 'moonlight-macos-enhanced',
    targets: [{ os: 'macos', platform: 'macos', client: 'macos-enhanced', types: ['computer'] }] },
  { id: 'vplus-harmony', group: 'first', name: 'Moonlight V+', label: 'Moonlight V+ HarmonyOS', guideName: 'Moonlight V+ (HarmonyOS)', icon: 'mobile', guide: 'harmony', url: 'https://appgallery.huawei.com/app/detail?id=com.alkaidlab.sdream', project: 'https://github.com/AlkaidLab/moonlight-harmony',
    links: { project: 'https://github.com/AlkaidLab/moonlight-harmony', releases: 'https://github.com/AlkaidLab/moonlight-harmony/releases', host: 'github' },
    targets: [{ os: 'harmony', platform: 'harmony', types: ['phone', 'tablet'] }] },
  { id: 'voidlink', group: 'partner', recommended: true, name: 'VoidLink', icon: 'mobile', guide: 'voidlink', url: 'https://apps.apple.com/us/app/voidlink-extreme/id6755103808', zhUrl: 'https://apps.apple.com/cn/app/voidlink/id6747717070',
    links: { project: 'https://github.com/The-Fried-Fish/VoidLink-previously-moonlight-zwm', releases: 'https://github.com/The-Fried-Fish/VoidLink-previously-moonlight-zwm/releases', host: 'github' },
    targets: [{ os: 'ios', platform: 'ios', types: ['phone', 'tablet'] }, { os: 'tv', platform: 'apple-tv', types: ['tv'] }] },
  { id: 'crown', group: 'partner', name: '王冠版', icon: 'android', url: 'https://github.com/WACrown/moonlight-android/releases',
    links: { project: 'https://github.com/WACrown/moonlight-android', releases: 'https://github.com/WACrown/moonlight-android/releases', host: 'github' },
    targets: [{ os: 'android', platform: 'crown', types: ['phone', 'tablet'] }] },
  { id: 'baozi', group: 'partner', name: '包子版', icon: 'mobile', url: 'https://gitee.com/smdsbz/moonlight-ohos',
    links: { project: 'https://gitee.com/smdsbz/moonlight-ohos', releases: 'https://gitee.com/smdsbz/moonlight-ohos/releases', host: 'gitee' },
    targets: [{ os: 'harmony', platform: 'baozi', types: ['phone', 'tablet'] }] },
])

/** The two sections of the full list: the clients of the team, then the partners' (the fixed order of CLIENTS inside each). */
export const clientSections = () => ({ first: CLIENTS.filter((c) => c.group === 'first'), partner: CLIENTS.filter((c) => c.group === 'partner') })

const flatten = (match) => CLIENTS.flatMap((client) => client.targets.filter(match).map((target) => ({ client, target })))
// on a system whose own client is the better start, that client leads its group (macOS: Enhanced, then the desktop client)
const OS_LEAD = Object.freeze({ macos: 'macos-enhanced', tv: 'vplus-android' })
const lead = (os, list) => { const id = OS_LEAD[os]; return id ? [...list.filter((x) => x.client.id === id), ...list.filter((x) => x.client.id !== id)] : list }

/** One list for an operating system: the team's clients first, then the partners', each in the fixed order. [{ client, target }] */
export const clientsForOs = (os) => { const all = lead(os, flatten((t) => t.os === os)); return [...all.filter((x) => x.client.group === 'first'), ...all.filter((x) => x.client.group !== 'first')] }
/** The same for a device type of the home card (phone, tablet, computer, tv). */
export const clientsForType = (type) => flatten((t) => t.types.includes(type))

export const OS_ICON = Object.freeze({ windows: 'desktop_windows', macos: 'laptop_mac', linux: 'terminal', android: 'android', ios: 'mobile', harmony: 'devices_other', tv: 'tv' })
const OS_NAME = { windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS', harmony: 'HarmonyOS' }
// the chip of a system in every list that picks one (the connect dialog, the journey, the download tile and page): iOS also names iPadOS, the last chip is the TVs and the rest
const OS_CHIP = { zh: { ios: 'iOS / iPadOS', tv: '电视 · 其他' }, en: { ios: 'iOS / iPadOS', tv: 'TV & other' } }
export const osChipName = (os, locale = 'en') => OS_CHIP[/^zh/i.test(String(locale)) ? 'zh' : 'en'][os] || OS_NAME[os] || os
const TEXTS = {
  en: { all: 'All', first: 'Recommended', firstBy: 'Maintained by AlkaidLab', partner: 'Partner clients', partnerBadge: 'Partner', tagOfficial: 'Official', tagPartner: 'Partner', tv: 'TV', os: 'Operating system', releases: 'Releases', scan: 'Scan to download' },
  zh: { all: '全部', first: '官方推荐', firstBy: '由 AlkaidLab 维护', partner: '合作客户端', partnerBadge: '合作', tagOfficial: '官方', tagPartner: '合作', tv: '电视', os: '操作系统', releases: '发布页', scan: '扫码下载' },
}
/** Whether a client is official (a work of the team) or a partner's: the tag every client card and row carries. */
export const isOfficial = (client) => !!client && client.group === 'first'
export const clientTexts = (locale = 'en') => (/^zh/i.test(String(locale)) ? TEXTS.zh : TEXTS.en)
export const osName = (os, locale = 'en') => (os === 'tv' ? clientTexts(locale).tv : OS_NAME[os] || os)
/** The operating systems of a client, in the order of the list ("Windows · macOS · Linux"). */
export const osOfClient = (client) => [...new Set(client.targets.map((t) => t.os))]
