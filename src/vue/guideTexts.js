import { textTable } from '../locale/texts/index.js'
// Text of the guided first run. Package-side tables like the home dashboard's: Chinese and English, every other language falls back to
// English. A product may override single entries (the Web welcome page passes its translated credential-form texts).

const EN = {
  guide: 'Getting started', close: 'Close', back: 'Back', next: 'Next', skipThis: 'Skip this step', finishTools: 'Finish and open the test tools', finish: 'Finish', follow: 'Follow us: ', followBilibili: 'Bilibili', followSite: 'Website', stepOf: 'Step {n} of {total}', steps: 'Steps',
  openSource: { title: 'Free and open source', text: 'Foundation Sunshine is open source (GPL-3.0). This project has not authorised any individual, business or media account to sell it.', link: 'View on GitHub' },
  intro: { followSystem: 'Follow system', moreLanguages: 'More languages', fewerLanguages: 'Fewer languages', start: 'Start' },
  later: 'Not now', language: 'Language', saved: 'Saved', retry: 'Try again', working: 'Working…', unavailable: 'Not available here',
  open: 'Open', copy: 'Copy', copied: 'Copied', helpRow: 'Go through setup, installing a client, pairing and the first connection again.',
  titles: { channel: 'Update channel', done: 'Ready', hostdone: 'This computer is set up', whatsnew: 'What is new', intro: 'Welcome', account: 'Set up the WebUI panel account', appearance: 'Appearance', motion: 'Animations', setup: 'Graphics card and display', install: 'Install a client', address: 'Pair from an installed client', pair: 'Connect and pair', webaccess: 'Phone and other devices', remote: 'Remote access', connect: 'Try it', apps: 'Add games', update: 'Update method' },
  leads: {
    whatsnew: 'Steps you have already done are left out.',
    intro: '',
    account: 'Used to sign in to the WebUI panel in a browser.',
    setup: '',
    appearance: '',
    motion: '',
    install: '',
    address: 'On one network the client finds this computer by itself; else type an address.',
    pair: 'Scan the code, or type the PIN the client shows.',
    webaccess: 'Optional. Pick who may open the WebUI panel; nothing changes unless you choose.',
    remote: 'Only needed to stream to this computer from outside your home; most people do not need it.',
    connect: 'In the client, open this computer and choose Desktop.',
    apps: 'Optional. You can add them later on the apps page.',
    update: '',
    channel: '',
    done: '',
    hostdone: 'Now the device you will play on: install a client, pair it, connect.',
  },
  hostdone: { done: 'This computer is ready to stream.', download: 'Get the client for the device you will play on', note: 'The next steps install it, pair it and make the first connection.' },
  whatsnew: { items: [{ icon: 'sports_esports', title: 'A first stream you can check', text: 'Sound, mouse, keyboard and picture tests, and the latency clock, are in the guide and in Test tools.' }, { icon: 'download', title: 'One install view', text: 'The same client list, files and QR code in the guide, in Connect a device and on the download page.' }, { icon: 'public', title: 'Remote access, checked', text: 'The guide tests whether this computer can be reached from outside and what to change.' }, { icon: 'system_update_alt', title: 'Update method', text: 'Choose where updates come from; a MirrorChyan CDK is optional.' }], note: 'This window opens once for each new version. You can skip it.' },
  welcome: { modes: { system: 'Follow system', light: 'Light', dark: 'Dark' } },
  channel: { channel: 'Update channel', stable: 'Stable (recommended)', stableText: 'Tested, right for most people.', beta: 'Beta', betaText: 'Get new features and fixes earlier; there may be small problems.', source: 'Where updates come from', failed: 'This was not saved. Try again.' },
  trynow: { more: 'More download options' },
  pairing: { found: 'When the client finds this computer, type the PIN it shows.', pinCard: 'Pair with the PIN' },
  done: {
    library: 'Game library', scanning: 'Scanning the game libraries in the background…', found: '{n} games found. Tick the ones to add.', addPicked: 'Add the {n} selected', added: '{n} added.', none: 'No games were found. You can add them later on the Apps page.', failed: 'The game libraries could not be scanned.', rescan: 'Scan again', unsupported: 'This host cannot scan game libraries yet.',
    unavailable: 'Not available now', reasons: { setup: 'No display was read from this host.', webaccess: 'This page is already the Web UI of the host.', remote: 'This host cannot check its network yet. Update the host.' },
    start: 'Start using', save: 'Save', optional: 'Optional: set up when you need it', optionalNote: 'None of these is required. You can start without them.', advanced: 'Advanced', back: 'Done', open: 'Set up',
    items: {
      appearance: { title: 'Theme colour & background', text: 'Wallpaper, theme colour and blur' }, motion: { title: 'Animations', text: 'How strong the interface animations are' }, setup: { title: 'Display and HDR', text: 'Graphics card, the display to stream, HDR' },
      webaccess: { title: 'Web management', text: 'Manage this computer from a browser on another device' }, remote: { title: 'Remote streaming and networking', text: 'Only needed to stream to this computer from outside your home; most people do not need it.' },
    },
  },
  remoteGuide: {
    checkTitle: 'Network check', checking: 'Checking this computer\'s network…', again: 'Check again', recommend: 'Recommended', other: 'Other ways',
    facts: { publicYes: 'Public address: reachable from outside', publicNo: 'Public address: none (the provider shares one)', publicPossible: 'Public address: the router has one; ports must be opened', publicUnknown: 'Public address: not detected yet', upnpOn: 'Router opens ports itself (UPnP): on', upnpOff: 'Router opens ports itself (UPnP): off', meshYes: 'Mesh tool: {name} installed', meshNo: 'Mesh tool: not installed yet' },
    recMesh: 'Connect back over a mesh network', recMeshText: 'This computer has no public address to connect to; a mesh network does not need one.', recDirect: 'Direct connection works', recDirectText: 'This computer can be reached from outside. A mesh network works too.', homeOnly: 'If you only play at home, there is nothing to set up.',
  },
  account: { username: 'User name', password: 'Password', confirm: 'Confirm password', create: 'Save account', goNow: 'Go now', missing: 'Fill in the user name and the password twice.', mismatch: 'The passwords do not match.', match: 'The passwords match.', note: 'The password is not shown again. Both are stored on this computer only.', local: '', done: 'Account created.', exists: 'An account already exists.' },
  setup: { hdrState: { UNKNOWN: 'HDR: unknown', ENABLED: 'HDR: on now', DISABLED: 'HDR: off' }, hdrWin10: 'On Windows 10 the Foundation Virtual Display has no HDR (Windows 11 22H2 and later). HDR is offered to a client that asks for it when the display and the encoder can do it.', preps: { no_operation: 'No change', ensure_active: 'Activate this display', ensure_primary: 'Set as main display', ensure_only_display: 'Use only this display', ensure_secondary: 'Extend displays' }, prep: 'Display configuration', prepNote: '', language: 'Language', gpu: 'Graphics card', auto: 'Choose automatically', display: 'Display to stream', virtual: 'Foundation Virtual Display', virtualNote: 'Needs the display driver', physical: '', vddNeeded: 'The Foundation Virtual Display driver is not ready. Install it from the desktop control panel, or pick a physical display.', save: 'Save and continue', saving: 'Saving…', skipped: 'Skipped. The setup wizard stays available in the help page.', error: 'Could not save', zh: '简体中文', en: 'English', none: 'No graphics card was reported by this host.', noDisplays: 'No physical display was reported.' },
  install: { device: 'Which device is it?', recommended: 'Recommended client', download: 'Open the download page', scan: 'Scan with the device to open the page', permission: 'On first start the system asks for access to the local network. Allow it, or the client cannot find this computer.', project: 'Project page', devices: { windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android', ios: 'iPhone / iPad', harmony: 'HarmonyOS', tv: 'TV' }, notes: { windows: '', macos: 'If the first start is blocked, follow the project notes.', linux: '', android: '', ios: 'From the App Store.', harmony: 'From AppGallery.', tv: 'Android TV: the Moonlight V+ APK.' } },
  address: { listed: 'The client lists “{name}” by itself. Click it.', listedNoName: 'The client lists this computer by itself. Click it.', notShowing: 'Not showing up?', typeThis: 'In the client, add a computer and type:', scan: 'Or scan this in the client', usual: 'Usual causes: the phone is on a guest Wi-Fi, or a proxy or VPN is on. Join this computer\'s Wi-Fi and turn the proxy or VPN off.', portKept: 'Keep :{port}. This computer\'s port is not the default.', others: 'Other ways to connect', othersHelp: 'On these networks, type the address that belongs to the network the client is on.', kinds: { lan: 'Local network', zerotier: 'ZeroTier', tailscale: 'Tailscale', easytier: 'EasyTier', public: 'Public address', other: 'Other network' }, none: 'This computer reported no network address.', recheck: 'Check again', checking: 'Checking…', diagnostics: 'Open diagnostics', port: { title: 'Advanced: port', show: 'Show', hide: 'Hide', lead: 'Every port is counted from the base port. Forward these in a router or firewall.', base: 'Base port', roles: { https: 'Pairing', http: 'Client address', web: 'WebUI panel', rtsp: 'Stream setup', video: 'Video', control: 'Control', audio: 'Audio', microphone: 'Microphone' }, tcp: 'TCP', udp: 'UDP', optional: 'not needed to stream', field: 'New base port', save: 'Save port', saved: 'Saved', same: 'That is the port in use.', format: 'Digits only.', range: 'Use {min} to {max}.', pendingTitle: 'Restart to use {port}.', pendingText: 'Until then the host listens on {active}. After it, clients type {address} and the WebUI panel moves to port {web}.', restart: 'Restart now', restarting: 'Restarting…', taken: 'If another program holds one of these ports, 体检 names it after the restart.', check: 'Check the ports', checking: 'Checking…', checkAgain: 'Check again', checkUnsupported: 'This host has no port check yet. Open the diagnostics once it is updated.', checkFailed: 'The check could not run.', checkNone: 'The check found nothing to report on the ports.', checkOpen: 'Open the diagnostics', failed: 'Could not save the port.' } },
  pair: { showQr: 'Show a code for another device to scan', scanHow: 'In the client choose “Scan”, then point it at this code.', qr: 'Scan with the client', qrNote: 'The code works only while this step is open, for a few minutes.', qrRefresh: 'New code', qrExpired: 'The code expired.', qrLoading: 'Opening a pairing window…', qrError: 'No code could be made. Use the PIN.', qrPaired: 'Paired with the code.', qrSeconds: '{n} s left', or: 'or', byPin: 'Type the PIN', name: 'Device name', pin: 'PIN', send: 'Pair', waiting: 'Waiting for the client to finish pairing…', ok: '{name} is paired.', error: 'Pairing failed', nameMissing: 'Give the device a name first.', hint: 'The client shows a four digit PIN after you click this computer.', already: 'Paired devices', another: 'Pair another', unavailable: 'The paired client list could not be read.' },
  connect: { waiting: 'Waiting for a client to start streaming…', live: '{line} is streaming', noDetect: 'Live detection works on the host computer only.', check: 'Check that', checks: { picture: 'The picture appears', mouse: 'The mouse moves and clicks', keyboard: 'The keyboard types', sound: 'The sound plays' }, hints: { picture: 'Colour bars and the near-black steps below show it.', mouse: 'Move it over the test area and press its buttons.', keyboard: 'Hold a few keys in the test area.', sound: 'Press a channel: only it should play.' }, tryTitle: 'Test tools', tryText: 'The tests run in this window. Check them in the stream.', clock: 'Latency clock', noDesktop: 'No Desktop in the client list?', restore: 'Restore built-in apps', restoring: 'Restoring…', restored: 'Built-in apps restored.', restoredNone: 'The built-in apps are already there.', restoreFailed: 'Could not restore the built-in apps', restoreNote: 'Brings back the default entries; back up any you changed.', openApps: 'Open the apps page', refreshClient: 'Then refresh the client\'s list.' },
  apps: { sources: 'Libraries to scan', start: 'Scan', again: 'Scan again', found: '{n} games found', none: 'No games were found in these libraries.', busy: 'A scan is already running. Try again in a moment.', scanFailed: 'The scan failed.', addPicked: 'Add {n} selected', added: '{n} added to the apps list.', addFailed: 'They could not be added.', nameLabel: 'Name', cmdLabel: 'Main program', cmdHint: 'The command or the path of the program; it can stay empty.', addOne: 'Add', backToGuide: 'Back to the guide', scan: 'Scan game libraries', scanText: 'Steam, Epic, GOG, Xbox, EA, Ubisoft, Battle.net, Riot, HoYoPlay and WeGame. Sparxie is included when that component is installed. Review the result, then add.', launchTouch: 'Touch', launchPc: 'Keyboard, mouse and gamepad', scanOnly: 'This host cannot scan game libraries yet: update the host.', manual: 'Add by hand', manualText: 'A name and the main program.', skip: 'Not now', done: 'You are set', doneText: '', open: 'Open', warnings: { "steam.not_found": "Steam was not found on this computer.", "steam.empty": "Steam has no games to add.", "epic.unsupported": "The Epic library is scanned on Windows only.", "epic.not_found": "The Epic Games launcher was not found on this computer.", "epic.empty": "Epic has no games to add.", "gog.unsupported": "The GOG library is scanned on Windows only.", "gog.unavailable": "The registry could not be read, so GOG was not scanned.", "gog.not_found": "GOG was not found on this computer.", "gog.empty": "GOG has no games to add.", "directory.symlinks": "Symbolic links were skipped.", "directory.depth": "The directory scan stopped at the depth limit.", "directory.time": "The directory scan stopped at the time limit.", "directory.unreadable": "Some folders could not be read.", "xbox.unsupported": "The Xbox library is scanned on Windows only.", "xbox.not_found": "No Xbox games were found on this computer.", "xbox.empty": "The Xbox games folder has no games to add.", "ea.unsupported": "The EA library is scanned on Windows only.", "ea.not_found": "The EA app was not found on this computer.", "ea.empty": "The EA app has no games to add.", "ubisoft.unsupported": "The Ubisoft library is scanned on Windows only.", "ubisoft.not_found": "Ubisoft Connect was not found on this computer.", "ubisoft.empty": "Ubisoft Connect has no games to add.", "battlenet.unsupported": "The Battle.net library is scanned on Windows only.", "battlenet.not_found": "Battle.net was not found on this computer.", "battlenet.empty": "Battle.net has no games to add.", "riot.unsupported": "The Riot library is scanned on Windows only.", "riot.not_found": "The Riot Client was not found on this computer.", "riot.empty": "The Riot Client has no games to add.", "hoyoplay.unsupported": "The HoYoPlay library is scanned on Windows only.", "hoyoplay.not_found": "No HoYoPlay games were found on this computer.", "hoyoplay.empty": "HoYoPlay has no games to add.", "wegame.unsupported": "The WeGame library is scanned on Windows only.", "wegame.not_found": "WeGame was not found on this computer.", "wegame.empty": "WeGame has no games to add.", "sparxie.unsupported": "The touch component is scanned on Windows only.", "sparxie.absent": "The touch component is not installed, so it was skipped.", "sparxie.empty": "The touch component has no game profiles yet.", "sparxie.unreadable": "The touch component configuration could not be read.", "user.absent": "Nobody is signed in, so only machine-wide libraries were scanned.", "unknown": "One library could not be scanned." } },
}

const ZH = {
  guide: '新手引导', close: '关闭', back: '上一步', next: '下一步', skipThis: '跳过这一步', finishTools: '完成并打开测试工具', finish: '完成', follow: '关注我们：', followBilibili: 'B 站', followSite: '官网', stepOf: '第 {n} 步，共 {total} 步', steps: '步骤',
  intro: { followSystem: '跟随系统', moreLanguages: '更多语言', fewerLanguages: '收起', start: '开始' },
  later: '以后再说', language: '语言', saved: '已保存', retry: '重试', working: '处理中…', unavailable: '这里不可用',
  openSource: { title: '免费与开源', text: 'Foundation Sunshine 以 GPL-3.0 开源。本项目未授权任何个人、商家或自媒体账号售卖。', link: '在 GitHub 查看' },
  open: '打开', copy: '复制', copied: '已复制', helpRow: '重新走一遍设置、安装客户端、配对和第一次连接。',
  titles: { channel: '更新通道', done: '已就绪', hostdone: '这台电脑已设置好', whatsnew: '新版本有什么变化', intro: '欢迎', account: '设置 WebUI 面板账号', appearance: '外观', motion: '动画', setup: '显卡与显示器', install: '安装客户端', address: '在已安装的客户端与此设备配对', pair: '连接并配对', webaccess: '手机和其他设备访问', remote: '远程串流与组网', connect: '试一下', apps: '添加游戏', update: '更新方式' },
  leads: {
    whatsnew: '已经做过的步骤会跳过。',
    account: '用于在浏览器中登录 WebUI 面板',
    intro: '',
    setup: '',
    appearance: '',
    motion: '',
    install: '',
    address: '在同一网络里客户端会自动发现；发现不了就手动填一个地址。',
    pair: '扫描二维码，或输入客户端显示的 PIN',
    webaccess: '可选。选谁能打开 WebUI 面板，不选就保持现状。',
    remote: '出门在外串流回这台电脑时才需要；多数人不用设置。',
    connect: '在客户端里打开这台电脑，选择 Desktop',
    apps: '可选，以后也可以在应用页添加',
    update: '',
    channel: '',
    done: '',
    hostdone: '接下来是你要玩游戏的设备：安装客户端、配对、连接。',
  },
  hostdone: { done: '这台电脑已经可以串流了。', download: '下载你要玩游戏的设备上的客户端', note: '后面几步会安装它、配对，并完成第一次连接。' },
  whatsnew: { items: [{ icon: 'sports_esports', title: '首次串流可以自己检查', text: '声音、鼠标、键盘、画面测试和延迟时钟，引导里和测试工具里都有。' }, { icon: 'download', title: '统一的安装视图', text: '引导、连接设备、下载页用同一套客户端列表、安装包和二维码。' }, { icon: 'public', title: '远程访问能检测', text: '引导会检测这台电脑能不能从外网访问，以及要改什么。' }, { icon: 'system_update_alt', title: '更新方式', text: '选择更新从哪里来；Mirror酱 CDK 可选。' }], note: '每个新版本只弹出一次，可以跳过。' },
  welcome: { modes: { system: '跟随系统', light: '浅色', dark: '深色' } },
  channel: { channel: '更新通道', stable: '稳定版（推荐）', stableText: '经过测试，适合大多数人。', beta: '测试版', betaText: '更早拿到新功能和修复，可能有小问题。', source: '更新来源', failed: '没能保存，请再试一次。' },
  trynow: { more: '更多下载方式' },
  pairing: { found: '客户端找到这台电脑后，输入它显示的 PIN。', pinCard: '输入 PIN 配对' },
  done: {
    library: '游戏库', scanning: '正在后台扫描游戏库…', found: '找到 {n} 个游戏，勾选要添加的。', addPicked: '添加所选的 {n} 个', added: '已添加 {n} 个。', none: '没有找到游戏，之后可在「应用」页添加。', failed: '没能扫描游戏库。', rescan: '重新扫描', unsupported: '这台主机还不能扫描游戏库。',
    unavailable: '暂不可用', reasons: { setup: '没有读到这台主机的显示器。', webaccess: '现在打开的就是主机的网页界面。', remote: '这台主机还不能检测网络，更新主机后可用。' },
    start: '开始使用', save: '保存', optional: '可选：需要时再设置', optionalNote: '都不是必须的，不设置也能直接使用。', advanced: '高级', back: '完成', open: '设置', 
    items: {
      appearance: { title: '主题色与背景', text: '壁纸、主题色和背景模糊' }, motion: { title: '动效', text: '界面动画的强弱' }, setup: { title: '显示与 HDR', text: '显卡、串流用的显示器、HDR' },
      webaccess: { title: '网页远程管理', text: '在其他设备的浏览器里管理这台电脑' }, remote: { title: '远程串流与组网', text: '出门在外串流回这台电脑时才需要；多数人不用设置。' },
    },
  },
  remoteGuide: {
    checkTitle: '网络检测', checking: '正在检测这台电脑的网络…', again: '重新检测', recommend: '推荐', other: '其他办法',
    facts: { publicYes: '公网地址：可以从外面访问', publicNo: '公网地址：没有（运营商共用地址）', publicPossible: '公网地址：路由器有公网 IP，需要放行端口', publicUnknown: '公网地址：还没有检测到', upnpOn: '路由器自动开放端口（UPnP）：已开启', upnpOff: '路由器自动开放端口（UPnP）：未开启', meshYes: '组网工具：已装 {name}', meshNo: '组网工具：还没有安装' },
    recMesh: '用组网连回来', recMeshText: '这台电脑没有可直连的公网地址，组网不需要。', recDirect: '公网直连可用', recDirectText: '检测到外面能连到这台电脑；也可以用组网。', homeOnly: '只在家里玩的话，不用设置。',
  },
  account: { username: '用户名', password: '密码', confirm: '确认密码', create: '保存账号', goNow: '立即跳转', missing: '请填写用户名，并输入两次密码。', mismatch: '两次输入的密码不一致。', match: '两次密码一致。', note: '密码之后不会再显示，账号只保存在这台电脑上。', local: '', done: '账号已创建。', exists: '已经有账号了。' },
  setup: { hdrState: { UNKNOWN: 'HDR：未知', ENABLED: 'HDR：当前已启用', DISABLED: 'HDR：未启用' }, hdrWin10: 'Windows 10 上基地虚拟显示器不支持 HDR（Windows 11 22H2 及以上才支持）。客户端请求 HDR 时，显示器和编码器能做到就会自动提供。', preps: { no_operation: '不更改', ensure_active: '激活此显示器', ensure_primary: '设为主显示器', ensure_only_display: '仅使用此显示器', ensure_secondary: '扩展显示器' }, prep: '显示器配置', prepNote: '', language: '语言', gpu: '显卡', auto: '自动选择', display: '串流的显示器', virtual: '基地虚拟显示器', virtualNote: '需要显示器驱动', physical: '', vddNeeded: '基地虚拟显示器驱动还没就绪。请在桌面控制面板里安装，或改选物理显示器。', save: '保存并继续', saving: '正在保存…', skipped: '已跳过。设置向导仍可在帮助页重新打开。', error: '保存失败', zh: '简体中文', en: 'English', none: '这台主机没有报告显卡。', noDisplays: '没有报告物理显示器。' },
  install: { device: '是哪种设备？', recommended: '推荐的客户端', download: '打开下载页', scan: '用设备扫码打开下载页', permission: '首次启动时，系统会询问“本地网络”权限。请选择允许，否则客户端找不到这台电脑。', project: '项目主页', devices: { windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android', ios: 'iPhone / iPad', harmony: '鸿蒙', tv: '电视' }, notes: { windows: '', macos: '首次打开被拦截时，按项目说明放行。', linux: '', android: '', ios: '在 App Store 下载。', harmony: '在华为应用市场下载。', tv: 'Android TV：Moonlight V+ 的 APK。' } },
  address: { listed: '客户端会自己列出“{name}”，点它即可。', listedNoName: '客户端会自己列出这台电脑，点它即可。', notShowing: '没出现？', typeThis: '在客户端里添加电脑，填：', scan: '或在客户端里扫这个码', usual: '常见原因：手机连的是访客 Wi-Fi，或开着代理、VPN。换到这台电脑的 Wi-Fi，并关掉代理或 VPN。', portKept: '端口 :{port} 要一起填，这台电脑的端口不是默认值。', others: '其他连接方式', othersHelp: '客户端在哪个网络，就填那个网络对应的地址。', kinds: { lan: '局域网', zerotier: 'ZeroTier', tailscale: 'Tailscale', easytier: 'EasyTier', public: '公网地址', other: '其他网络' }, none: '这台电脑没有报告网络地址。', recheck: '重新检测', checking: '检测中…', diagnostics: '打开体检', port: { title: '高级：端口', show: '展开', hide: '收起', lead: '所有端口都从基础端口数起。路由器或防火墙里按这些放行。', base: '基础端口', roles: { https: '配对', http: '客户端地址', web: 'WebUI 面板', rtsp: '串流协商', video: '视频', control: '控制', audio: '音频', microphone: '麦克风' }, tcp: 'TCP', udp: 'UDP', optional: '串流不需要', field: '新的基础端口', save: '保存端口', saved: '已保存', same: '这就是正在使用的端口。', format: '只能填数字。', range: '请填 {min} 到 {max}。', pendingTitle: '重启后改用 {port}。', pendingText: '重启前主机仍监听 {active}。重启后客户端填 {address}，WebUI 面板移到端口 {web}。', restart: '立即重启', restarting: '重启中…', taken: '如果别的程序占用了其中一个端口，重启后体检会指出来。', check: '检测端口', checking: '正在检测…', checkAgain: '再检测一次', checkUnsupported: '这台主机还没有端口检测，更新后可以在诊断里查看。', checkFailed: '检测没能运行。', checkNone: '检测没有发现端口方面的问题。', checkOpen: '打开诊断', failed: '保存端口失败。' } },
  pair: { showQr: '显示二维码，给另一台设备扫', scanHow: '在客户端里选「扫码」，对准这个二维码。', qr: '用客户端扫描', qrNote: '二维码只在这一步打开期间有效，几分钟后失效。', qrRefresh: '换一个码', qrExpired: '二维码已失效。', qrLoading: '正在打开配对窗口…', qrError: '没能生成二维码，请用 PIN 配对。', qrPaired: '已通过二维码配对。', qrSeconds: '还剩 {n} 秒', or: '或', byPin: '输入 PIN', name: '设备名称', pin: 'PIN', send: '配对', waiting: '等待客户端完成配对…', ok: '{name} 已配对。', error: '配对失败', nameMissing: '请先给设备起个名字。', hint: '点开这台电脑后，客户端会显示四位 PIN。', already: '已配对的设备', another: '再配一台', unavailable: '读取不到已配对客户端的列表。' },
  connect: { waiting: '等待客户端开始串流…', live: '{line} 正在串流', noDetect: '实时检测只在主机这台电脑上可用。', check: '请确认', checks: { picture: '画面出现了', mouse: '鼠标能移动和点击', keyboard: '键盘能输入', sound: '声音能播放' }, hints: { picture: '看下面的色条和近黑阶。', mouse: '在测试区里移动鼠标、按各个按键。', keyboard: '在测试区里同时按几个键。', sound: '点一个声道，只有它应该出声。' }, tryTitle: '测试工具', tryText: '测试在这个窗口里运行，在串流画面里查看。', clock: '延迟时钟', noDesktop: '客户端列表里没有 Desktop？', restore: '还原内置应用', restoring: '正在还原…', restored: '内置应用已还原。', restoredNone: '内置应用已经在了。', restoreFailed: '还原内置应用失败', restoreNote: '恢复默认项目；改过的请先备份。', openApps: '打开应用页', refreshClient: '然后刷新客户端的列表。' },
  apps: { sources: '要扫描的游戏库', start: '开始扫描', again: '重新扫描', found: '找到 {n} 个游戏', none: '这些游戏库里没有找到游戏。', busy: '已经有一次扫描在运行，请稍后再试。', scanFailed: '扫描失败。', addPicked: '添加所选的 {n} 个', added: '已添加 {n} 个到应用列表。', addFailed: '没能添加。', nameLabel: '名称', cmdLabel: '主程序', cmdHint: '命令或程序的路径；可以留空。', addOne: '添加', backToGuide: '回到引导', scan: '扫描游戏库', scanText: 'Steam、Epic、GOG、Xbox、EA、育碧、Battle.net、Riot、HoYoPlay 和 WeGame。装了触控组件时也会扫它。检查结果后再添加。', launchTouch: '触控', launchPc: '键鼠与手柄', scanOnly: '这台主机还不支持扫描游戏库，请更新主机。', manual: '手动添加', manualText: '填一个名称和主程序。', skip: '先不加', done: '都设置好了', doneText: '', open: '打开', warnings: { "steam.not_found": "这台电脑上没有找到 Steam。", "steam.empty": "Steam 里没有找到可添加的游戏。", "epic.unsupported": "Epic 游戏库只在 Windows 上扫描。", "epic.not_found": "这台电脑上没有找到 Epic 游戏启动器。", "epic.empty": "Epic 里没有找到可添加的游戏。", "gog.unsupported": "GOG 游戏库只在 Windows 上扫描。", "gog.unavailable": "无法读取这台电脑的注册表，GOG 没有扫描。", "gog.not_found": "这台电脑上没有找到 GOG。", "gog.empty": "GOG 里没有找到可添加的游戏。", "directory.symlinks": "跳过了符号链接。", "directory.depth": "目录太深，提前停了。", "directory.time": "扫描时间到了，提前停了。", "directory.unreadable": "有些文件夹无法读取。", "xbox.unsupported": "Xbox 游戏库只在 Windows 上扫描。", "xbox.not_found": "这台电脑上没有找到 Xbox 游戏。", "xbox.empty": "Xbox 游戏文件夹里没有找到可添加的游戏。", "ea.unsupported": "EA 游戏库只在 Windows 上扫描。", "ea.not_found": "这台电脑上没有找到 EA app。", "ea.empty": "EA app 里没有找到可添加的游戏。", "ubisoft.unsupported": "育碧游戏库只在 Windows 上扫描。", "ubisoft.not_found": "这台电脑上没有找到 Ubisoft Connect。", "ubisoft.empty": "Ubisoft Connect 里没有找到可添加的游戏。", "battlenet.unsupported": "Battle.net 游戏库只在 Windows 上扫描。", "battlenet.not_found": "这台电脑上没有找到 Battle.net。", "battlenet.empty": "Battle.net 里没有找到可添加的游戏。", "riot.unsupported": "Riot 游戏库只在 Windows 上扫描。", "riot.not_found": "这台电脑上没有找到 Riot Client。", "riot.empty": "Riot Client 里没有找到可添加的游戏。", "hoyoplay.unsupported": "HoYoPlay 游戏库只在 Windows 上扫描。", "hoyoplay.not_found": "这台电脑上没有找到 HoYoPlay 的游戏。", "hoyoplay.empty": "HoYoPlay 里没有找到可添加的游戏。", "wegame.unsupported": "WeGame 游戏库只在 Windows 上扫描。", "wegame.not_found": "这台电脑上没有找到 WeGame。", "wegame.empty": "WeGame 里没有找到可添加的游戏。", "sparxie.unsupported": "触控组件只在 Windows 上扫描。", "sparxie.absent": "没有安装触控组件，已跳过。", "sparxie.empty": "触控组件里还没有游戏配置。", "sparxie.unreadable": "触控组件的配置读不了。", "user.absent": "没有人登录这台电脑，只扫描了不需要登录的部分。", "unknown": "有一个游戏库没有扫完。" } },
}

const merge = (base, extra) => {
  if (!extra || typeof extra !== 'object') return base
  const out = { ...base }
  for (const key of Object.keys(extra)) {
    const value = extra[key]
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object') out[key] = merge(base[key], value)
    else if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}

export const GUIDE_TEXTS_EN = EN
export const GUIDE_TEXTS_ZH = ZH

/** The text table of a language (zh*, everything else English) with the product's overrides on top. */
export const guideTexts = (locale = 'en', overrides = null) => merge(textTable('guide', locale, EN, ZH), overrides)

/** Replaces {name} placeholders. */
export const fillText = (text, values = {}) => String(text).replace(/\{(\w+)\}/g, (_, key) => (values[key] ?? `{${key}}`))
