import { canonicalLocale } from '../locale/texts/resolve.js'
import { TRAY_EXTRA, TRAY_SUPPORT } from './trayLocales.js'

// The words of the tray menu's own layout (not the item labels: those come from the host, which has them in three languages for the native menu - src-tauri/src/tray.rs TrayStrings - so the
// two menus never disagree). zh, en and ja are complete; the other interface languages translate the quick tiles, the editor and the sliders, and anything else stays English. The Chinese set is also what the gallery shows.

const ZH = {
  edit: { open: '编辑', done: '完成', title: '编辑快捷面板', tiles: '快捷砖', sliders: '滑块', add: '添加', reset: '恢复默认', hide: (n) => `隐藏 ${n}`, show: (n) => `显示 ${n}`, handle: '排序', grab: (n) => `已拿起 ${n}`, moved: (n, i, total) => `${n},第 ${i} / ${total}`, drop: (n) => `已放下 ${n}`, cancel: (n) => `${n} 回到原位`, none: '没有' },
  back: '返回', pagesV3: { display: '显示与工具', settings: '设置与帮助' }, pages: { display: '显示器', tools: '工具', settings: '设置', language: '语言', advanced: '高级', help: '帮助', quick: '快捷' },
  vddName: '基地虚拟显示器', host: { idle: '空闲', streaming: '串流中', paused: '串流已暂停', pairing: '等待配对' }, connecting: '正在连接', disconnected: '未连接',
  streams: (n, mbps) => `${n} 路串流 · ${mbps} Mbps`, noStreams: '没有串流', noStreamsDetail: '有客户端连接后在这里显示码率和帧率', streamCount: (n) => `${n} 路`,
  vddOn: (mode) => (mode ? `已创建 · ${mode}` : '已创建'), vddOff: '未创建', running: '运行中', off: '已关闭', on: '开', offShort: '关',
  update: '更新', check: '检查', newVersion: '新版本', newVersionNamed: (v) => `有新版本 ${v}`, upToDate: '已是最新版', upToDateNamed: (v) => (v ? `已是最新版 ${v}` : '已是最新版'),
  groups: { language: '语言', config: '配置', project: '项目' },
  vddTile: '基地显示器', sliders: { resolution: '分辨率', refresh: '刷新率', dpi: '缩放', bitrate: '码率上限', auto: '自动', target: (name) => `调整 ${name}`, none: '没有可调整的显示器', noneHint: '', dpiMax: (max) => `这块屏幕最高 ${max}%，更高需注销`, applying: '正在应用…', failed: (why) => `没有应用:${why}` },
  support: { label: '项目', site: '官网', bilibili: 'B 站', star: '点 Star', sponsor: '赞助', sponsors: '赞助的开发者', back: '收起' },
  ds5: 'DS5', ds5Connected: 'DS5 已连接', mbps: 'Mbps', fps: 'fps', pageDots: '页', display: '显示器设置', closeMenu: '关闭',
}
const EN = {
  edit: { open: 'Edit', done: 'Done', title: 'Edit quick panel', tiles: 'Tiles', sliders: 'Sliders', add: 'Add', reset: 'Reset to default', hide: (n) => `Hide ${n}`, show: (n) => `Show ${n}`, handle: 'Reorder', grab: (n) => `${n} picked up`, moved: (n, i, total) => `${n}, ${i} of ${total}`, drop: (n) => `${n} dropped`, cancel: (n) => `${n} back in place`, none: 'None' },
  back: 'Back', pagesV3: { display: 'Display & tools', settings: 'Settings & help' }, pages: { display: 'Display', tools: 'Tools', settings: 'Settings', language: 'Language', advanced: 'Advanced', help: 'Help', quick: 'Quick' },
  vddName: 'Foundation Virtual Display', host: { idle: 'Idle', streaming: 'Streaming', paused: 'Stream paused', pairing: 'Pairing' }, connecting: 'Connecting', disconnected: 'Disconnected',
  streams: (n, mbps) => `${n} ${n === 1 ? 'stream' : 'streams'} · ${mbps} Mbps`, noStreams: 'No streams', noStreamsDetail: 'Bitrate and frame rate show here once a client connects', streamCount: (n) => `${n}`,
  vddOn: (mode) => (mode ? `On · ${mode}` : 'On'), vddOff: 'Not created', running: 'Running', off: 'Off', on: 'On', offShort: 'Off',
  update: 'Update', check: 'Check', newVersion: 'Update', newVersionNamed: (v) => `Update ${v} available`, upToDate: 'Up to date', upToDateNamed: (v) => (v ? `Up to date · ${v}` : 'Up to date'),
  vddTile: 'Display',
  groups: { language: 'Language', config: 'Configuration', project: 'Project' },
  short: { feedback: 'Feedback', open_main_panel: 'Panel', open_desktop: 'Big screen', connect_device: 'Pair', download_client: 'Clients', open_sunshine: 'Web UI', check_update: 'Update', auto_start: 'Autostart', prevent_sleep: 'Keep awake', vdd_toggle_headless_create: 'Headless', vdd_toggle_keep_enabled: 'Keep display', restart_user_mode: 'User mode', show_toolbar: 'Desktop pet', host_performance: 'Performance', rtss_control: 'RTSS', log_console: 'Logs', reset_display: 'Reset display', vdd_settings: 'Display settings', web_stream: 'Web stream', debug_page: 'Debug', import_config: 'Import', export_config: 'Export', reset_config: 'Reset', clear_cache: 'Clear cache', about: 'About', star_project: 'Project page', visit_project_sunshine: 'Sunshine source', visit_project_moonlight: 'Moonlight source', restart: 'Restart', shutdown: 'Exit' },
  sliders: { resolution: 'Resolution', refresh: 'Refresh rate', dpi: 'Scale', bitrate: 'Bitrate cap', auto: 'Auto', target: (name) => `Changing ${name}`, none: 'No display to change', noneHint: '', dpiMax: (max) => `Up to ${max}% without signing out`, applying: 'Applying…', failed: (why) => `Not applied: ${why}` },
  support: { label: 'Project', site: 'Site', bilibili: 'Bilibili', star: 'Star', sponsor: 'Sponsor', sponsors: 'Developers to sponsor', back: 'Close' },
  ds5: 'DS5', ds5Connected: 'DS5 connected', mbps: 'Mbps', fps: 'fps', pageDots: 'Page', display: 'Display settings', closeMenu: 'Close',
}
const JA = {
  edit: { open: '編集', done: '完了', title: 'パネル編集', tiles: 'タイル', sliders: 'スライダー', add: '追加', reset: '初期設定に戻す', hide: (n) => `${n} を非表示`, show: (n) => `${n} を表示`, handle: '並べ替え', grab: (n) => `${n} を持ち上げました`, moved: (n, i, total) => `${n}、${total} 件中 ${i} 番目`, drop: (n) => `${n} を置きました`, cancel: (n) => `${n} を元の位置に戻しました`, none: 'なし' },
  back: '戻る', pagesV3: { display: 'ディスプレイとツール', settings: '設定とヘルプ' }, pages: { display: 'ディスプレイ', tools: 'ツール', settings: '設定', language: '言語', advanced: '詳細設定', help: 'ヘルプ', quick: 'クイック' },
  vddName: '仮想ディスプレイ', host: { idle: '待機中', streaming: 'ストリーミング中', paused: '一時停止', pairing: 'ペアリング待機中' }, connecting: '接続中', disconnected: '未接続',
  streams: (n, mbps) => `${n} 件のストリーム · ${mbps} Mbps`, noStreams: 'ストリームなし', noStreamsDetail: 'クライアントが接続するとビットレートとフレームレートを表示します', streamCount: (n) => `${n} 件`,
  vddOn: (mode) => (mode ? `作成済み · ${mode}` : '作成済み'), vddOff: '未作成', running: '稼働中', off: 'オフ', on: 'オン', offShort: 'オフ',
  update: '更新', check: '確認', newVersion: '新バージョン', newVersionNamed: (v) => `新バージョン ${v}`, upToDate: '最新です', upToDateNamed: (v) => (v ? `最新です · ${v}` : '最新です'),
  vddTile: '仮想画面',
  groups: { language: '言語', config: '設定ファイル', project: 'プロジェクト' },
  short: { feedback: 'フィード', open_main_panel: 'パネル', open_desktop: '大画面', connect_device: 'ペアリング', download_client: 'クライアント', open_sunshine: 'Web管理', check_update: '更新', auto_start: '自動起動', prevent_sleep: 'スリープ防止', vdd_toggle_headless_create: 'ヘッドレス', vdd_toggle_keep_enabled: '保持', restart_user_mode: 'ユーザー', show_toolbar: 'デスクペット', host_performance: 'ホスト性能', rtss_control: 'RTSS', log_console: 'ログ', reset_display: '表示リセット', vdd_settings: '画面設定', web_stream: 'Web配信', debug_page: 'デバッグ', import_config: 'インポート', export_config: 'エクスポート', reset_config: 'リセット', clear_cache: 'キャッシュ', about: '情報', star_project: 'プロジェクト', visit_project_sunshine: 'Sunshine', visit_project_moonlight: 'Moonlight', restart: '再起動', shutdown: '終了' },
  sliders: { resolution: '解像度', refresh: 'リフレッシュレート', dpi: 'スケール', bitrate: 'ビットレート上限', auto: '自動', target: (name) => `${name} を調整`, none: '調整できるディスプレイがありません', noneHint: '', dpiMax: (max) => `サインアウトなしでは最大 ${max}%`, applying: '適用中…', failed: (why) => `適用できませんでした: ${why}` },
  support: { label: 'プロジェクト', site: '公式', bilibili: 'Bilibili', star: 'スター', sponsor: '支援', sponsors: '支援する開発者', back: '閉じる' },
  ds5: 'DS5', ds5Connected: 'DS5 接続中', mbps: 'Mbps', fps: 'fps', pageDots: 'ページ', display: 'ディスプレイ設定', closeMenu: '閉じる',
}

export const TRAY_TEXTS = Object.freeze({ zh: ZH, en: EN, ja: JA })
function mergeTray(base, extra) {
  const out = { ...base }
  for (const key of Object.keys(extra)) {
    const value = extra[key]
    if (value && typeof value === 'object') out[key] = { ...(base[key] || {}), ...value }
    else out[key] = value
  }
  return out
}

export function trayTexts(locale) {
  if (TRAY_TEXTS[locale]) return TRAY_TEXTS[locale]
  const code = canonicalLocale(locale)
  if (TRAY_TEXTS[code]) return TRAY_TEXTS[code]
  const extra = TRAY_EXTRA[code]
  const base = extra ? mergeTray(EN, extra) : EN
  const support = TRAY_SUPPORT[code]
  return support ? mergeTray(base, { support }) : base
}
