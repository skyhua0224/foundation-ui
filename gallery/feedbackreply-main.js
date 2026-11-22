// The developers' answers to the feedback of this window, in the caption bar's status button (useFeedbackReplies): the same caption, bell and report host as the products.
// ?locale=en, ?theme=dark|black, ?none=1 (no answer yet: the button rests), ?open=bell|reply|fixed (what the page shows when it is up; the QA robot opens them by hand too).
// The server is a stub in this page: it answers once with a reply and a fixed message for the two reports the page seeds into its own storage.
import { createApp, h, nextTick } from 'vue'
import '../src/css/all.css'
import { applyTheme } from '../src/tokens/theme.js'
import { MCaption, MBrand, MStatusBell, MFeedbackButton, DevReportHost, MPage, MSection, MGroup, MItem, useFeedbackReplies } from '../src/vue/index.js'
import { rememberReport } from '../src/feedback/replies.js'

const q = new URLSearchParams(location.search)
applyTheme(document.documentElement, { black: q.get('theme') === 'black' })
const locale = q.get('locale') || 'zh'
const zh = locale === 'zh'
const NOW = Date.now()
const K1 = 'rk_' + 'a1b2c3d4e5f60718'.repeat(2)
const K2 = 'rk_' + '0f1e2d3c4b5a6978'.repeat(2)
try { localStorage.removeItem('foundation-ui.feedback.replies') } catch { /* a page without storage shows nothing */ }
rememberReport({ key: K1, title: zh ? '米塔 AI 的 API 地址输不进 https://' : 'The AI address box will not take https://', product: 'panel' }, { now: () => NOW - 3 * 3_600_000 })
rememberReport({ key: K2, title: zh ? '网卡磁贴能不能切换网卡' : 'Can the network tile switch adapters', product: 'panel' }, { now: () => NOW - 5 * 3_600_000 })
const REPLY = zh
  ? '感谢反馈！问题已经找到并修复：在输入框里输入 / 时会误触发搜索快捷键并抢走焦点，所以 https:// 后面的内容输不进去。\n修复会随下一个测试版发布。'
  : 'Thanks for the report! We found it: typing / in a text box triggered the search shortcut and took the focus, so everything after https:// could not be typed.\nThe fix ships with the next beta.'
const answer = { v: 1, replies: q.get('none') === '1' ? [] : [
  { key: K1, id: 'c4102', kind: 'reply', text: REPLY, version: '', at: NOW - 2 * 3_600_000 },
  { key: K2, id: 'fixed:1.0.8', kind: 'fixed', text: '', version: '1.0.8', at: NOW - 3_600_000 },
] }
const fetchFn = async () => ({ ok: true, status: 200, json: async () => answer })

createApp({
  setup() {
    const replies = useFeedbackReplies({ locale, fetchFn, startDelayMs: 1e9, tickMs: 1e9 })
    replies.refresh(true).then(async () => {
      await nextTick()
      const open = q.get('open')
      if (open === 'bell') document.querySelector('.m-statusbell button')?.click()
      if (open === 'reply' || open === 'fixed') {
        document.querySelector('.m-statusbell button')?.click()
        await nextTick()
        const want = open === 'fixed' ? 1 : 0
        ;[...document.querySelectorAll('.m-srow button')].filter((b) => b.textContent.trim() === (zh ? '查看' : 'View'))[want]?.click()
      }
    })
    return () => h('div', { class: 'm-app m-root', style: 'min-height:100vh' }, [
      h(MCaption, { bem: 'gal-caption' }, {
        brand: () => h(MBrand, { name: 'Foundation Sunshine' }),
        announcements: () => [h(MStatusBell, { locale }), h(MFeedbackButton, { locale })],
      }),
      h(MPage, { title: zh ? '概览' : 'Overview' }, () => [h(MSection, null, () => [h(MGroup, null, () => [h(MItem, { icon: 'tune', title: zh ? '串流设置' : 'Stream settings' }), h(MItem, { icon: 'health_and_safety', title: zh ? '开始体检' : 'Start health check' })])])]),
      h(DevReportHost, { locale }),
    ])
  },
}).mount('#app')
