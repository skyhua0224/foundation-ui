import { canonicalLocale } from '../locale/texts/resolve.js'
// One recommendation per operating system: the first client of that system's list (the team's clients come first), with the one line why, the other clients behind it, and
// whether the client reads the pairing QR of the host. The wording of the lists lives in connectTexts.
import { CLIENT_OS, clientsForOs, osName } from './catalogue.js'

/**
 * Clients that read `moonlight://pair?host=&port=&pin=&name=` from a QR code. Verified in the sources (2026-11-03): Moonlight V+ Android (PcView.kt, handleQrPairResult).
 * Desktop V+ and macOS Enhanced have no QR or URL-scheme handling in their sources; the others were not read and are assumed to pair by PIN only.
 */
export const QR_PAIRING = Object.freeze(['vplus-android'])
export const readsPairQr = (client) => !!client && QR_PAIRING.includes(client.id)

/** The systems of the chips, in the order they are shown: the computers, the phones and tablets, the TVs and the rest. */
export const CONNECT_OS = CLIENT_OS
/** A phone, a tablet or a TV is paired and installed from the other device: its install QR points at the download. */
export const QR_INSTALL_OS = Object.freeze(['android', 'ios', 'harmony'])

/** { client, target, official, others: [{ client, target }] } for a system. `official` is whether the lead client is one of the team's (官方推荐) or a partner's. */
export function recommendForOs(os) {
  const list = clientsForOs(CONNECT_OS.includes(os) ? os : 'android')
  const [lead, ...rest] = list
  // the other clients are other clients: not the lead again for another target of the same system (Android phone, Quest), and each one once
  const seen = new Set([lead.client.id])
  const others = rest.filter((x) => !seen.has(x.client.id) && seen.add(x.client.id))
  return { client: lead.client, target: lead.target, official: lead.client.group === 'first', others }
}

/** The link to the client's download or store page, in the language's store where there is one. */
export const clientUrl = (client, locale = 'en') => (/^zh/i.test(String(locale)) && client.zhUrl ? client.zhUrl : client.url)

const WHY = {
  zh: {
    'vplus-android': '官方安卓客户端，最适合这台主机：自定义模拟按键、体感瞄准、HDR 画面、远程麦克风。',
    'vplus-desktop': '官方桌面客户端（Windows、macOS、Linux）：HDR 画面、双向剪贴板、远程麦克风、主机文件访问。',
    'macos-enhanced': '为 Mac 打造的官方增强客户端：HDR 与色彩调节、Mac 输入法与触控板、耳机与音效调节。',
  },
  en: {
    'vplus-android': 'The official Android client, the best fit for this host: custom on-screen keys, motion aiming, HDR and the remote microphone.',
    'vplus-desktop': 'The official desktop client (Windows, macOS, Linux): HDR, two-way clipboard, remote microphone, host file access.',
    'macos-enhanced': 'The official enhanced client built for the Mac: HDR and colour tuning, Mac input methods and trackpad, headphone and sound tuning.',
  },
}
export const whyOf = (client, locale = 'en') => (WHY[/^zh/i.test(String(locale)) ? 'zh' : 'en'][client.id] || '')

const ZH = {
  title: '连接设备', tabs: { pair: '配对', install: '安装客户端' },
  chips: { windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS / iPadOS', harmony: 'HarmonyOS', tv: '电视 · 其他' },
  official: '官方推荐', officialShort: '官方', recommendedPartner: '推荐', maintained: '由 AlkaidLab 维护', others: '其他客户端', partners: '合作客户端', partner: '合作', download: '下载', github: 'GitHub', releases: '发布页',
  scanInstall: '扫码安装', scanPair: '用客户端扫码', pinLine: '或在客户端点「添加电脑」，输入它显示的 4 位数字', pinLead: '在客户端点「添加电脑」，输入它显示的 4 位数字', pinOnly: '该客户端使用 PIN 配对',
  pairGo: '配对', deviceName: '设备名称', deviceNameHint: '设备名称（例如：iPhone 15 Pro）', copyLink: '复制链接', switchTo: '换成 {os}', more: '更多', copyCnb: '复制 CNB 链接', copyGithub: '复制 GitHub 链接', share: '分享', shareScan: '用手机或另一台电脑扫码下载', shareSystem: '系统分享…', releasesPage: '发布页', pendingTitle: '「{name}」请求配对', pendingHint: '输入客户端上显示的 PIN', pendingLeft: '剩余时间', reject: '拒绝', noClient: '还没装客户端？', pinSent: '已发送配对', pinFailed: '配对失败，请检查 PIN', pinIncorrect: '配对失败：PIN 不对', pinTimeout: '请求超时，请检查网络后再试一次', pinNetwork: '连接不上服务，请确认 Sunshine 正在运行', pinNotReady: '服务还没准备好，请稍等', pinLabel: 'PIN', paired: '{n} 台已配对', latest: '最近：{name}', none: '还没有客户端', expired: '二维码已过期', refresh: '重新生成', done: '已配对',
  stale: '很久没有新设备了，可以把这张卡片移出概览。', moveOut: '移出概览',
  steps: ['选系统', '安装客户端', '配对', '完成'], next: '继续', back: '返回', installed: '我已安装', finish: '完成', dismiss: '关闭', journey: '连接新设备', pairedNow: '已配对：{name}', pairedMany: '设备已连接',
  stepDevice: '要连接的设备是什么系统？', stepInstall: '安装官方客户端', stepPair: '配对', stepDone: '完成', moreOthers: '全部客户端与下载页', moreDownloads: '更多下载方式', onlyOne: '这个系统目前只有这一个客户端', osChoice: '设备的系统',
  files: '安装包', allFiles: '全部文件与校验', recommendedTag: '推荐', fromMirror: '从 {host} 下载', copySha: '复制 SHA-256', copied: '已复制', sha: 'SHA-256', loadingFiles: '正在读取下载信息…', noFiles: '这个客户端通过商店或项目页安装', openPage: '打开下载页', version: '版本',
}
const EN = {
  title: 'Connect a device', tabs: { pair: 'Pair', install: 'Install a client' },
  chips: { windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS / iPadOS', harmony: 'HarmonyOS', tv: 'TV & other' },
  official: 'Recommended', officialShort: 'Official', recommendedPartner: 'Recommended', maintained: 'Maintained by AlkaidLab', others: 'Other clients', partners: 'Partner clients', partner: 'Partner', download: 'Download', github: 'GitHub', releases: 'Releases',
  scanInstall: 'Scan to install', scanPair: 'Scan with the client', pinLine: 'Or tap “Add computer” in the client and type the 4 digits it shows', pinLead: 'Tap “Add computer” in the client and type the 4 digits it shows', pinOnly: 'This client pairs with a PIN',
  pairGo: 'Pair', deviceName: 'Device name', deviceNameHint: 'Device name (for example: iPhone 15 Pro)', copyLink: 'Copy link', switchTo: 'Switch to {os}', more: 'More', copyCnb: 'Copy CNB link', copyGithub: 'Copy GitHub link', share: 'Share', shareScan: 'Scan with a phone or another computer to download', shareSystem: 'Share…', releasesPage: 'Releases', pendingTitle: '“{name}” wants to pair', pendingHint: 'Type the PIN the client shows', pendingLeft: 'Time left', reject: 'Reject', noClient: 'No client installed yet?', pinSent: 'Pairing sent', pinFailed: 'Pairing failed: check the PIN', pinIncorrect: 'Pairing failed: incorrect PIN', pinTimeout: 'Request timed out. Check your network connection or try again later.', pinNetwork: 'Cannot connect to the service. Make sure Sunshine is running.', pinNotReady: 'The service is not ready yet. Please wait.', pinLabel: 'PIN', paired: '{n} paired', latest: 'Latest: {name}', none: 'No client yet', expired: 'The code expired', refresh: 'New code', done: 'Paired',
  stale: 'No new device for a while: you can take this card off the Overview.', moveOut: 'Remove from Overview',
  steps: ['System', 'Install', 'Pair', 'Done'], next: 'Continue', back: 'Back', installed: 'I installed it', finish: 'Done', dismiss: 'Close', journey: 'Connect a new device', pairedNow: 'Paired: {name}', pairedMany: 'Your device is connected',
  stepDevice: 'What system does the device run?', stepInstall: 'Install the official client', stepPair: 'Pair', stepDone: 'Done', moreOthers: 'All clients and the download page',  moreDownloads: 'More download options', onlyOne: 'This is the only client for this system', osChoice: 'System of the device',
  files: 'Downloads', allFiles: 'All files and checksums', recommendedTag: 'Best', fromMirror: 'Download from {host}', copySha: 'Copy SHA-256', copied: 'Copied', sha: 'SHA-256', loadingFiles: 'Reading the download list…', noFiles: 'This client is installed from its store or project page', openPage: 'Open the download page', version: 'Version',
}
const CARD = {
  "zh_TW": {
    "files": "安裝包",
    "allFiles": "全部檔案與校驗",
    "recommendedTag": "推薦",
    "loadingFiles": "正在讀取下載資訊…",
    "noFiles": "這個用戶端透過商店或專案頁安裝",
    "download": "下載",
    "more": "更多",
    "copyLink": "複製連結",
    "share": "分享",
    "shareScan": "用手機或另一台電腦掃碼下載",
    "shareSystem": "系統分享…",
    "copied": "已複製"
  },
  "en_GB": {
    "files": "Downloads",
    "allFiles": "All files and checksums",
    "recommendedTag": "Best",
    "loadingFiles": "Reading the download list…",
    "noFiles": "This client is installed from its store or project page",
    "download": "Download",
    "more": "More",
    "copyLink": "Copy link",
    "share": "Share",
    "shareScan": "Scan with a phone or another computer to download",
    "shareSystem": "Share…",
    "copied": "Copied"
  },
  "en_US": {
    "files": "Downloads",
    "allFiles": "All files and checksums",
    "recommendedTag": "Best",
    "loadingFiles": "Reading the download list…",
    "noFiles": "This client is installed from its store or project page",
    "download": "Download",
    "more": "More",
    "copyLink": "Copy link",
    "share": "Share",
    "shareScan": "Scan with a phone or another computer to download",
    "shareSystem": "Share…",
    "copied": "Copied"
  },
  "de": {
    "files": "Downloads",
    "allFiles": "Alle Dateien und Prüfsummen",
    "recommendedTag": "Beste",
    "loadingFiles": "Downloadliste wird gelesen…",
    "noFiles": "Dieser Client kommt aus dem Store oder von der Projektseite",
    "download": "Herunterladen",
    "more": "Mehr",
    "copyLink": "Link kopieren",
    "share": "Teilen",
    "shareScan": "Mit einem Handy oder einem anderen Computer scannen",
    "shareSystem": "Teilen…",
    "copied": "Kopiert"
  },
  "fr": {
    "files": "Fichiers",
    "allFiles": "Tous les fichiers et sommes",
    "recommendedTag": "Meilleur",
    "loadingFiles": "Lecture de la liste…",
    "noFiles": "Ce client s'installe depuis sa boutique ou sa page",
    "download": "Télécharger",
    "more": "Plus",
    "copyLink": "Copier le lien",
    "share": "Partager",
    "shareScan": "Scannez avec un téléphone ou un autre ordinateur",
    "shareSystem": "Partager…",
    "copied": "Copié"
  },
  "es": {
    "files": "Archivos",
    "allFiles": "Todos los archivos y sumas",
    "recommendedTag": "Mejor",
    "loadingFiles": "Leyendo la lista…",
    "noFiles": "Este cliente se instala desde su tienda o su página",
    "download": "Descargar",
    "more": "Más",
    "copyLink": "Copiar enlace",
    "share": "Compartir",
    "shareScan": "Escanea con un teléfono u otro ordenador",
    "shareSystem": "Compartir…",
    "copied": "Copiado"
  },
  "it": {
    "files": "File",
    "allFiles": "Tutti i file e le somme",
    "recommendedTag": "Migliore",
    "loadingFiles": "Lettura dell'elenco…",
    "noFiles": "Questo client si installa dallo store o dalla pagina",
    "download": "Scarica",
    "more": "Altro",
    "copyLink": "Copia link",
    "share": "Condividi",
    "shareScan": "Scansiona con un telefono o un altro computer",
    "shareSystem": "Condividi…",
    "copied": "Copiato"
  },
  "ja": {
    "files": "ファイル",
    "allFiles": "すべてのファイルとチェックサム",
    "recommendedTag": "推奨",
    "loadingFiles": "ダウンロード一覧を読み取り中…",
    "noFiles": "このクライアントはストアまたはプロジェクトページからインストールします",
    "download": "ダウンロード",
    "more": "その他",
    "copyLink": "リンクをコピー",
    "share": "共有",
    "shareScan": "スマホか別のパソコンでスキャン",
    "shareSystem": "共有…",
    "copied": "コピーしました"
  },
  "ko": {
    "files": "파일",
    "allFiles": "모든 파일과 체크섬",
    "recommendedTag": "권장",
    "loadingFiles": "다운로드 목록을 읽는 중…",
    "noFiles": "이 클라이언트는 스토어 또는 프로젝트 페이지에서 설치합니다",
    "download": "다운로드",
    "more": "더보기",
    "copyLink": "링크 복사",
    "share": "공유",
    "shareScan": "휴대폰이나 다른 컴퓨터로 스캔",
    "shareSystem": "공유…",
    "copied": "복사됨"
  },
  "ru": {
    "files": "Файлы",
    "allFiles": "Все файлы и контрольные суммы",
    "recommendedTag": "Лучший",
    "loadingFiles": "Чтение списка загрузок…",
    "noFiles": "Этот клиент ставится из магазина или со страницы проекта",
    "download": "Скачать",
    "more": "Ещё",
    "copyLink": "Копировать ссылку",
    "share": "Поделиться",
    "shareScan": "Сканируйте телефоном или другим компьютером",
    "shareSystem": "Поделиться…",
    "copied": "Скопировано"
  },
  "pt_BR": {
    "files": "Arquivos",
    "allFiles": "Todos os arquivos e somas",
    "recommendedTag": "Melhor",
    "loadingFiles": "Lendo a lista de download…",
    "noFiles": "Este cliente é instalado pela loja ou pela página do projeto",
    "download": "Baixar",
    "more": "Mais",
    "copyLink": "Copiar link",
    "share": "Compartilhar",
    "shareScan": "Escaneie com um celular ou outro computador",
    "shareSystem": "Compartilhar…",
    "copied": "Copiado"
  },
  "pt": {
    "files": "Ficheiros",
    "allFiles": "Todos os ficheiros e somas",
    "recommendedTag": "Melhor",
    "loadingFiles": "A ler a lista de transferência…",
    "noFiles": "Este cliente instala-se pela loja ou pela página do projeto",
    "download": "Transferir",
    "more": "Mais",
    "copyLink": "Copiar ligação",
    "share": "Partilhar",
    "shareScan": "Digitalize com um telemóvel ou outro computador",
    "shareSystem": "Partilhar…",
    "copied": "Copiado"
  },
  "bg": {
    "files": "Файлове",
    "allFiles": "Всички файлове и суми",
    "recommendedTag": "Най-добър",
    "loadingFiles": "Четене на списъка…",
    "noFiles": "Този клиент се инсталира от магазина или от страницата",
    "download": "Изтегляне",
    "more": "Още",
    "copyLink": "Копиране на връзката",
    "share": "Споделяне",
    "shareScan": "Сканирайте с телефон или друг компютър",
    "shareSystem": "Споделяне…",
    "copied": "Копирано"
  },
  "cs": {
    "files": "Soubory",
    "allFiles": "Všechny soubory a součty",
    "recommendedTag": "Nejlepší",
    "loadingFiles": "Načítání seznamu…",
    "noFiles": "Tento klient se instaluje z obchodu nebo ze stránky projektu",
    "download": "Stáhnout",
    "more": "Více",
    "copyLink": "Kopírovat odkaz",
    "share": "Sdílet",
    "shareScan": "Naskenujte telefonem nebo jiným počítačem",
    "shareSystem": "Sdílet…",
    "copied": "Zkopírováno"
  },
  "pl": {
    "files": "Pliki",
    "allFiles": "Wszystkie pliki i sumy",
    "recommendedTag": "Najlepszy",
    "loadingFiles": "Odczyt listy…",
    "noFiles": "Ten klient instaluje się ze sklepu lub ze strony projektu",
    "download": "Pobierz",
    "more": "Więcej",
    "copyLink": "Kopiuj link",
    "share": "Udostępnij",
    "shareScan": "Zeskanuj telefonem lub innym komputerem",
    "shareSystem": "Udostępnij…",
    "copied": "Skopiowano"
  },
  "sv": {
    "files": "Filer",
    "allFiles": "Alla filer och kontrollsummor",
    "recommendedTag": "Bäst",
    "loadingFiles": "Läser listan…",
    "noFiles": "Den här klienten installeras från butiken eller projektsidan",
    "download": "Hämta",
    "more": "Mer",
    "copyLink": "Kopiera länk",
    "share": "Dela",
    "shareScan": "Skanna med en telefon eller en annan dator",
    "shareSystem": "Dela…",
    "copied": "Kopierat"
  },
  "tr": {
    "files": "Dosyalar",
    "allFiles": "Tüm dosyalar ve sağlama toplamları",
    "recommendedTag": "En iyi",
    "loadingFiles": "Liste okunuyor…",
    "noFiles": "Bu istemci mağazadan veya proje sayfasından kurulur",
    "download": "İndir",
    "more": "Diğer",
    "copyLink": "Bağlantıyı kopyala",
    "share": "Paylaş",
    "shareScan": "Telefon veya başka bir bilgisayarla tarayın",
    "shareSystem": "Paylaş…",
    "copied": "Kopyalandı"
  },
  "uk": {
    "files": "Файли",
    "allFiles": "Усі файли й контрольні суми",
    "recommendedTag": "Найкращий",
    "loadingFiles": "Читання списку…",
    "noFiles": "Цей клієнт встановлюється з крамниці або зі сторінки проєкту",
    "download": "Завантажити",
    "more": "Більше",
    "copyLink": "Копіювати посилання",
    "share": "Поділитися",
    "shareScan": "Скануйте телефоном або іншим комп'ютером",
    "shareSystem": "Поділитися…",
    "copied": "Скопійовано"
  }
}

export const connectTexts = (locale = 'en') => {
  const code = canonicalLocale(locale)
  const base = code === 'zh' || code === 'zh_TW' ? ZH : EN
  const extra = CARD[code]
  if (!extra) return base
  return { ...base, ...extra }
}
export const osLabel = (os, locale = 'en') => osName(os, locale)

/** The title of the list of the other clients of a system: the partners' when every one of them is a partner (the section is named after its tag), else the plain "other clients". */
export const othersTitle = (others, T) => (others.length && others.every((x) => x.client.group !== 'first') ? T.partners : T.others)
