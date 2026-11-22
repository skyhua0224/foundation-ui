// The shared synonym table of the search, in both languages: a group is words a person may use for one thing (音频, 声音, audio, sound).
// How it is used (index.js): a doc belongs to the groups whose words occur in its title, its other-language label, its keywords or its aliases; a query word
// that is one of the words of a group (or the beginning of one) finds every doc of the group and of the groups below it (`kids`: 音频 also finds the
// speaker and the microphone). A hit through a group ranks after a hit on the words the doc itself carries.
//
// Rules for this file: words are lower case; no word of one character; no word so general that it sits in half of the settings (the path of a setting is not read,
// so 显示 does not pull in every setting of the display page); a word that means two things belongs to none of the groups (a bare `key`).
// The word list is the one place to add what people type: the products add the words of a single setting as `aliases` on its entry instead.
const g = (id, terms, kids = []) => ({ id, terms: terms.split(',').map((t) => t.trim()).filter(Boolean), kids })

export const SYNONYM_GROUPS = Object.freeze([
  // sound
  g('audio', '音频,声音,音量,音效,音质,声道,静音,声响,audio,sound,volume,mute,loudness', ['speaker', 'mic']),
  g('speaker', '扬声器,喇叭,音箱,耳机,耳麦,耳塞,声卡,播放设备,输出设备,音频输出,speaker,speakers,headphone,headphones,headset,earphone,earphones,earbuds,sound card,playback device,output device,audio output,sink'),
  g('mic', '麦克风,话筒,收音,语音输入,录音,mic,microphone,voice input,recording'),
  // picture
  g('video', '视频,画面,画质,图像,画质增强,video,picture,image,image quality,picture quality', ['resolution', 'refresh', 'bitrate', 'codec', 'hdr']),
  g('display', '显示器,屏幕,显示屏,monitor,display,screen', ['vdd']),
  g('resolution', '分辨率,清晰度,resolution,1080p,1440p,720p,4k,2k'),
  g('refresh', '刷新率,帧率,帧数,赫兹,流畅度,fps,hz,refresh rate,frame rate,framerate'),
  g('bitrate', '码率,比特率,码流,带宽,bitrate,bit rate,bandwidth,mbps'),
  g('codec', '编码,编码器,编解码器,解码,视频格式,codec,encoder,encoding,decoder,hevc,h265,h.265,h264,h.264,av1,avc'),
  g('hdr', 'hdr,高动态范围,hdr10,high dynamic range'),
  g('vdd', '虚拟显示器,虚拟屏,虚拟屏幕,虚拟显示,无头,vdd,virtual display,headless,dummy plug'),
  g('gpu', '显卡,显示适配器,gpu,graphics card,graphics adapter,nvidia,amd,intel,geforce,radeon'),
  g('driver', '驱动,驱动程序,driver,drivers'),
  g('capture', '捕获,抓取,录屏,截屏,capture,screen capture,grab'),
  g('vsync', '垂直同步,vsync,vertical sync'),
  // input
  g('gamepad', '手柄,游戏手柄,控制器,摇杆,手把,gamepad,controller,controllers,joystick,joypad,xbox,ps4,ps5,playstation,dualsense,dualshock,ds4,ds5', ['rumble']),
  g('rumble', '震动,振动,触觉,触觉反馈,力反馈,rumble,vibration,haptic,haptics,force feedback'),
  g('keyboard', '键盘,按键,快捷键,热键,keyboard,keys,hotkey,hotkeys,shortcut,shortcuts'),
  g('mouse', '鼠标,光标,指针,mouse,cursor,pointer'),
  g('touch', '触摸,触屏,触控,触摸屏,触控板,触控笔,手写笔,touch,touchscreen,touchpad,trackpad,pen,stylus'),
  g('usb', 'usb,usb 转发,usb forwarding,外设,peripheral,peripherals'),
  g('clipboard', '剪贴板,复制粘贴,clipboard,paste'),
  // network
  g('network', '网络,联网,网速,网卡,network,internet,wifi,wi-fi,ethernet,以太网', ['lan', 'wan', 'port', 'portmap', 'firewall', 'discovery', 'loss']),
  g('lan', '局域网,内网,lan,local network'),
  g('wan', '公网,外网,广域网,远程访问,wan,public network,remote access'),
  g('port', '端口,port'),
  g('portmap', '端口映射,穿透,upnp,nat,port forwarding,port forward'),
  g('firewall', '防火墙,firewall'),
  g('discovery', '发现,局域网发现,mdns,bonjour,discovery'),
  g('loss', '丢包,纠错,fec,packet loss'),
  g('latency', '延迟,时延,卡顿,响应,lag,latency,delay,stutter,ping'),
  g('timeout', '超时,timeout,time out'),
  g('reconnect', '断线,重连,掉线,断开,disconnect,reconnect'),
  // account and safety
  g('password', '密码,口令,登录,账号,用户名,password,login,sign in,credential,credentials,username,account'),
  g('cert', '证书,密钥,私钥,公钥,certificate,cert,private key,public key,ssl,tls'),
  g('encrypt', '加密,安全,encryption,security,secure'),
  g('permission', '权限,允许,访问范围,permission,permissions,allow,access'),
  // the app itself
  g('language', '语言,本地化,中文,英文,language,locale'),
  g('update', '更新,升级,新版本,检查更新,update,upgrade,new version'),
  g('restart', '重启,重新启动,重开,restart,reboot,relaunch'),
  g('reset', '重置,恢复默认,恢复默认设置,恢复出厂,恢复出厂设置,出厂设置,初始化,还原,清除设置,默认值,默认设置,reset,restore,restore defaults,default settings,defaults,factory,factory reset,reinitialize'),
  g('log', '日志,log,logs,logfile'),
  g('diagnose', '诊断,排查,故障,疑难解答,体检,diagnose,diagnostics,troubleshoot,troubleshooting,doctor,health check'),
  g('error', '报错,错误,崩溃,闪退,error,errors,crash,crashes'),
  g('startup', '开机启动,开机自启,自启动,自动启动,autostart,startup,run at startup,launch at login'),
  g('tray', '托盘,系统托盘,通知区域,tray,system tray'),
  g('notify', '通知,提醒,notification,notifications,notify,alert,alerts'),
  g('sleep', '睡眠,休眠,待机,唤醒,sleep,hibernate,standby,wake'),
  g('theme', '主题,外观,配色,深色,浅色,暗色,夜间,黑暗模式,个性化,壁纸,theme,appearance,dark mode,light mode,personalize,wallpaper'),
  g('overview', '概览,首页,主页,总览,home,overview,dashboard'),
  g('tile', '磁贴,卡片,tile,tiles,widget'),
  // what is streamed, and to what
  g('apps', '应用,游戏,程序,app,apps,game,games,application,applications'),
  g('phone', '手机,平板,电视,phone,tablet,tv,android,iphone,ipad'),
  g('client', '客户端,client,clients,moonlight'),
  g('pair', '配对,配对码,pin,pair,pairing'),
  g('steam', 'steam,steam deck,掌机'),
])

import { pinyinString } from './pinyin.js'

const BY_ID = new Map(SYNONYM_GROUPS.map((x, i) => [x.id, i]))
const KIDS = SYNONYM_GROUPS.map((x) => x.kids.map((k) => BY_ID.get(k)).filter((i) => i !== undefined))
const isLatin = (t) => /^[a-z0-9]/.test(t)
const flat = (s) => ` ${String(s).replace(/[^a-z0-9一-鿿]+/g, ' ').trim()} `

// every word with the group that owns it
const WORDS = []
SYNONYM_GROUPS.forEach((x, gi) => { for (const t of x.terms) WORDS.push({ t, gi, latin: isLatin(t), f: isLatin(t) ? flat(t) : t }) })
// the Han words in pinyin (a person who types yinliang asks for 音量): built on first use
let spoken = null
const speak = () => spoken ||= WORDS.filter((w) => !w.latin).map((w) => ({ gi: w.gi, py: pinyinString(w.t) }))

const memo = new Map()
/** The groups (indexes) a text belongs to: the groups with a word that occurs in it. `text` is lower case. */
export function groupsOfText(text) {
  const hit = memo.get(text)
  if (hit) return hit
  const f = flat(text)
  const found = new Set()
  for (const w of WORDS) {
    if (found.has(w.gi)) continue
    if (w.latin ? (f.includes(w.f) || f.includes(w.f.replace(/ $/, 's '))) : text.includes(w.t)) found.add(w.gi)
  }
  const out = [...found]
  if (memo.size > 4000) memo.clear()
  memo.set(text, out)
  return out
}

/**
 * The groups a query word asks for: { direct, below }. `direct` are the groups with the word (or a word it begins: three letters, two characters; or, for letters,
 * the pinyin of a Han word); `below` are the groups under them (音频 also asks for the speaker and the microphone).
 */
export function groupsOfWord(word) {
  const direct = new Set(), below = new Set()
  const latin = /^[a-z0-9]/.test(word)
  if (word.length >= 2) {
    const f = latin ? word.replace(/[^a-z0-9]+/g, ' ').trim() : word
    const take = (gi) => { direct.add(gi); for (const k of KIDS[gi]) below.add(k) }
    for (const w of WORDS) {
      if (w.latin !== latin) continue
      const t = latin ? w.f.trim() : w.t
      if (t === f || (f.length >= (latin ? 3 : 2) && t.startsWith(f))) take(w.gi)
    }
    // the letters of a Han word: yinliang, shengyin
    if (latin && f.length >= 4) for (const s of speak()) if (s.py.startsWith(f.replace(/v/g, 'u'))) take(s.gi)
    for (const gi of direct) below.delete(gi)
  }
  return { direct, below }
}

/** The words of the groups a query word belongs to: what "did you mean" can offer and what the tests read. */
export function synonymsOf(word) {
  const out = new Set()
  const { direct, below } = groupsOfWord(String(word).toLowerCase())
  for (const gi of [...direct, ...below]) for (const t of SYNONYM_GROUPS[gi].terms) out.add(t)
  return [...out]
}
