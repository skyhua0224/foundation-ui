import assert from 'node:assert/strict'
import test from 'node:test'
import { statSync } from 'node:fs'
import { buildIndex, search, suggest } from '../src/search/index.js'
import { hasHan, initialsOf, pinyinMatch, pinyinString, pinyinUnits, syllablesOf, uncoveredHan } from '../src/search/pinyin.js'
import { SYNONYM_GROUPS, groupsOfText, groupsOfWord, synonymsOf } from '../src/search/synonyms.js'
import { settingDocs, tileDocs } from '../src/search/docs.js'
import { actionDocs, searchTexts } from '../src/search/texts.js'
import { buildSettingsEntries } from '../src/settings/search.js'
import { provideSettingsData, settingsDataProblems } from '../src/settings/provider.js'
import { SETTINGS_CATEGORIES } from '../src/settings/model.js'
import './helpers/settingsFixture.js'
import { getSearchIndex, labelOf } from '../src/settings/provider.js'

// a small made-up product: audio, a microphone, a display, a gamepad, a reset page, with the aliases a product would carry
const doc = (id, title, extra = {}) => ({ id: `setting:${id}`, type: 'setting', title, path: '', keywords: id.replace(/_/g, ' '), key: id, ...extra })
const DOCS = [
  doc('stream_audio', '启用串流音频', { keywords: 'stream_audio enable audio streaming', aliases: ['声音', '静音', 'mute'] }),
  doc('audio_sink', '采集哪个扬声器', { keywords: 'audio_sink speaker to capture', aliases: ['喇叭', '耳机', 'headphones'] }),
  doc('stream_mic', '启用串流麦克风', { keywords: 'stream_mic enable microphone streaming', aliases: ['话筒', '语音聊天'] }),
  doc('resolution_change', '分辨率', { keywords: 'resolution_change resolution', aliases: ['清晰度', '4k'] }),
  doc('output_name', '输出显示器', { keywords: 'output_name output display', aliases: ['屏幕', '副屏', 'second monitor'] }),
  doc('gamepad', '模拟游戏手柄类型', { keywords: 'gamepad emulated gamepad type', aliases: ['xbox', 'ps5'] }),
  doc('max_bitrate', '最大码率', { keywords: 'max_bitrate maximum bitrate' }),
  doc('hdr_prep', '串流时自动开启系统 HDR', { keywords: 'hdr_prep turn on system hdr while streaming' }),
  { id: 'page:audio', type: 'page', title: '音频', path: '', keywords: 'Audio' },
  { id: 'page:audio-output', type: 'page', title: '音频输出', path: '音频', keywords: 'Audio output' },
  { id: 'action:reset', type: 'action', title: '恢复默认设置', path: '', keywords: 'reset restore defaults factory 重置 还原', tier: 1 },
  { id: 'action:restart', type: 'action', title: '重启 Sunshine', path: '', keywords: 'restart reboot 重新启动', tier: 3 },
]
const index = buildIndex(DOCS)
const top = (q, n = 3) => search(index, q).flat.slice(0, n).map((d) => d.id)

test('pinyin: the table gives the syllables of a character, a character read two ways has both', () => {
  assert.deepEqual(syllablesOf('音'), ['yin'])
  assert.equal(pinyinString('音频输出'), 'yinpinshuchu')
  assert.ok(syllablesOf('重').includes('zhong') && syllablesOf('重').includes('chong'))
  assert.ok(syllablesOf('率').includes('lu') && syllablesOf('率').includes('shuai'), 'ü is written u: lǜ is lu')
  assert.equal(syllablesOf('乂'), null)
  assert.ok(hasHan('a音') && !hasHan('abc'))
})

test('pinyin: whole syllables, initials, or a mix, and the last syllable may be unfinished', () => {
  const u = pinyinUnits('音频输出')
  for (const q of ['yinpinshuchu', 'yinpin', 'yp', 'ypsc', 'yinp', 'yinpi', 'ypshu', 'pin', 'shuchu', 'sc']) assert.ok(pinyinMatch(u, q), q)
  assert.equal(pinyinMatch(u, 'yinpinshuchux'), null)
  assert.equal(pinyinMatch(u, 'ypx'), null)
  assert.equal(pinyinMatch(u, 'yinnpin'), null)
  assert.equal(pinyinMatch(pinyinUnits('音频输出'), 'yp').start, 0)
  assert.equal(pinyinMatch(u, 'pin').start, 1, 'a match inside the title starts later')
  // zh, ch and sh are one initial; v and u are the same letter
  assert.ok(pinyinMatch(pinyinUnits('串流声音'), 'chlsy') && pinyinMatch(pinyinUnits('串流声音'), 'chuanliushengyin'))
  assert.ok(pinyinMatch(pinyinUnits('码率'), 'malv') && pinyinMatch(pinyinUnits('码率'), 'malu'))
  // either reading of a character
  assert.ok(pinyinMatch(pinyinUnits('重启'), 'zhongqi') && pinyinMatch(pinyinUnits('重启'), 'chongqi'))
  // letters and digits stand for themselves
  assert.ok(pinyinMatch(pinyinUnits('HDR 模式'), 'hdrms') && pinyinMatch(pinyinUnits('HDR 模式'), 'hdrmoshi'))
  assert.equal(initialsOf('码率')[0].s, 'ml')
})

test('pinyin: every Han character of what the package lets people search for is in the table (run scripts/gen-pinyin.mjs when this fails)', () => {
  const own = [JSON.stringify(SYNONYM_GROUPS), JSON.stringify(searchTexts('zh')), JSON.stringify(searchTexts('en')), JSON.stringify(tileDocs('zh')), JSON.stringify(SETTINGS_CATEGORIES)].join('\n')
  assert.deepEqual(uncoveredHan(own), [])
})

test('the table is small: the generated file stays under 10 KB', () => {
  assert.ok(statSync(new URL('../src/search/pinyinTable.js', import.meta.url)).size < 10 * 1024)
})

test('synonyms: the groups are tidy (no one-character word, no word in two groups, every kid exists, lower case)', () => {
  const ids = new Set(SYNONYM_GROUPS.map((g) => g.id))
  assert.equal(ids.size, SYNONYM_GROUPS.length)
  const owner = new Map()
  for (const g of SYNONYM_GROUPS) {
    for (const k of g.kids) assert.ok(ids.has(k), `${g.id}: kid ${k}`)
    for (const t of g.terms) {
      assert.ok(Array.from(t).length >= 2, `${g.id}: "${t}" is one character`)
      assert.equal(t, t.toLowerCase(), t)
      assert.ok(!owner.has(t), `"${t}" is in ${owner.get(t)} and ${g.id}`)
      owner.set(t, g.id)
    }
  }
})

test('synonyms: a word asks for its group and the groups below it; a doc belongs to the groups of its words', () => {
  assert.ok(synonymsOf('声音').includes('speaker') && synonymsOf('声音').includes('mic'), '音频 reaches the speaker and the microphone')
  assert.ok(!synonymsOf('扬声器').includes('mic'), 'and not the other way round')
  assert.ok(synonymsOf('micro').includes('microphone'), 'the beginning of a word')
  assert.ok(synonymsOf('yinliang').includes('audio'), 'the letters of a Han word')
  assert.deepEqual(synonymsOf('x'), [])
  assert.ok(groupsOfText('enable audio streaming').length > 0)
  assert.equal(groupsOfText('dynamic resolution').length, 1, 'resolution only: `mic` of dynamic is not a microphone')
  assert.ok(groupsOfWord('声音').direct.size > 0 && groupsOfWord('声音').below.size > 0)
})

test('aliases: a word a doc carries finds it, ahead of the shared table', () => {
  assert.equal(top('喇叭')[0], 'setting:audio_sink')
  assert.equal(top('headphones')[0], 'setting:audio_sink')
  assert.equal(top('话筒')[0], 'setting:stream_mic')
  assert.equal(top('second monitor')[0], 'setting:output_name')
  assert.equal(top('声音')[0], 'setting:stream_audio', 'the alias 声音 is the doc\'s own word: before the speaker and the microphone it only shares a group with')
  const r = search(index, '耳机', { perGroup: 9 })
  assert.equal(r.groups[0].items[0].tier, 4.05, 'an alias that is the whole word')
})

test('the synonym table: sound, speakers, microphones, picture words, controllers', () => {
  assert.ok(top('音量').includes('setting:stream_audio'))
  assert.ok(top('sound').includes('setting:stream_audio'))
  assert.ok(top('扬声器')[0] === 'setting:audio_sink')
  assert.ok(top('speaker').includes('setting:audio_sink'))
  assert.ok(top('mic')[0] === 'setting:stream_mic')
  assert.ok(top('码流').includes('setting:max_bitrate') && top('bandwidth').includes('setting:max_bitrate'))
  assert.ok(top('controller').includes('setting:gamepad') && top('手把').includes('setting:gamepad'))
  assert.ok(top('帧率').length === 0 || !top('帧率').includes('setting:resolution_change'), 'a group does not pull in a neighbour')
})

test('reset words: the product\'s action is found by the usual ways to say it', () => {
  for (const q of ['恢复默认', '重置', '恢复出厂设置', '初始化', '还原', 'reset', 'restore defaults', 'factory reset', 'default settings', 'huifumoren', 'reset all settings', 'restor defaults']) assert.equal(top(q)[0], 'action:reset', q)
})

test('pinyin: whole words, initials and a mix find the title and rank like a prefix when they spell it from the start', () => {
  assert.equal(top('yinpin')[0], 'page:audio')
  assert.ok(top('yinpinshuchu').includes('page:audio-output') && top('yinpinshuchu')[0] === 'page:audio-output')
  assert.ok(top('yp').includes('page:audio'))
  assert.ok(top('shengyin').includes('setting:stream_audio'), 'the pinyin of an alias')
  assert.ok(top('yinliang').includes('setting:stream_audio'), 'the pinyin of a word of the table')
  assert.ok(top('maikefeng').includes('setting:stream_mic'))
  assert.ok(top('fenbianlv')[0] === 'setting:resolution_change')
  assert.ok(top('mkf').includes('setting:stream_mic'))
})

test('slips: a letter wrong, missing, extra or swapped, a character left out or added, a homophone', () => {
  assert.ok(top('sepaker').includes('setting:audio_sink'))
  assert.ok(top('headphnes').includes('setting:audio_sink'))
  assert.ok(top('microfone').includes('setting:stream_mic'))
  assert.ok(top('resolutoin').includes('setting:resolution_change'))
  assert.ok(top('bitrat').includes('setting:max_bitrate'))
  assert.ok(top('麦风').includes('setting:stream_mic'), 'a character left out')
  assert.ok(top('启用串流音频频').includes('setting:stream_audio'), 'a character added')
  assert.ok(top('音平')[0] === 'page:audio' || top('音平').includes('page:audio'), 'a homophone: 平 for 频')
  assert.ok(top('麦克凤').includes('setting:stream_mic'))
  assert.ok(top('yinpn').includes('page:audio'), 'a letter missing in pinyin')
})

test('words in another order, full-width letters, capitals, filler words', () => {
  assert.ok(top('启用音频').includes('setting:stream_audio') && top('音频启用').includes('setting:stream_audio'))
  assert.ok(top('streaming audio enable').includes('setting:stream_audio') && top('audio enable').includes('setting:stream_audio'))
  assert.ok(top('ＨＤＲ').includes('setting:hdr_prep') && top('Hdr').includes('setting:hdr_prep'))
  assert.ok(top('ＳＰＥＡＫＥＲ').includes('setting:audio_sink'))
  assert.ok(top('没有声音').includes('setting:stream_audio') && top('没声音').includes('setting:stream_audio'))
  assert.ok(top('麦克风没声音').includes('setting:stream_mic'))
  assert.ok(top('怎么调分辨率').includes('setting:resolution_change'))
  assert.ok(top('how to change the speaker').includes('setting:audio_sink'))
  assert.ok(top('mic not working').includes('setting:stream_mic'))
  assert.ok(top('no sound').includes('setting:stream_audio'))
})

test('ranking: the title itself, its start, then its own words, then the table, then pinyin, the place, and slips', () => {
  const tiers = (q) => search(index, q, { perGroup: 9 }).groups.flatMap((g) => g.items).map((i) => [i.doc.id, i.tier])
  assert.equal(tiers('音频')[0][1], 0)
  assert.ok(tiers('音频输出').find(([id]) => id === 'page:audio-output')[1] === 0)
  const sound = Object.fromEntries(tiers('音频'))
  assert.ok(sound['page:audio'] < sound['setting:stream_audio'], 'the page called 音频 before a setting that has the word inside')
  const hitTiers = (q) => tiers(q).map(([, t]) => t)
  assert.ok(hitTiers('耳机').every((t) => t >= 4 && t < 5), 'an alias is between the title and the pinyin')
  assert.ok(hitTiers('yp').every((t) => t >= 5), 'initials rank after any words of the doc')
})

test('a short Latin word has to start a word: `mic` is not in `dynamic`, `yp` is not in `type`', () => {
  const docs = buildIndex([doc('dynamic_resolution', '动态分辨率', { keywords: 'dynamic_resolution dynamic resolution type' }), ...DOCS])
  assert.ok(!search(docs, 'mic').flat.some((d) => d.id === 'setting:dynamic_resolution'))
  assert.ok(!search(docs, 'yp').flat.some((d) => d.id === 'setting:dynamic_resolution'))
  assert.ok(search(docs, 'dynamic').flat.some((d) => d.id === 'setting:dynamic_resolution'))
})

test('did you mean: when nothing matches the nearest settings, pages and actions are offered, and nonsense gets nothing', () => {
  const r = search(index, '音频输入输出设备')
  assert.equal(r.total, 0)
  assert.ok(r.suggest.length > 0 && r.suggest.length <= 3)
  assert.ok(r.suggest.some((x) => x.doc.id === 'page:audio-output'))
  assert.ok(r.suggest.every((x) => x.score >= 0.4 && x.doc.type !== 'tile'))
  assert.deepEqual(search(index, 'zzzqqq').suggest, [])
  assert.deepEqual(search(index, '').suggest, [])
  assert.deepEqual(search(index, '音频').suggest, [], 'nothing is suggested while there are results')
  assert.ok(suggest(index, 'speakers volume mixer').some((x) => x.doc.id === 'setting:audio_sink'))
})

test('the results object keeps its shape: groups, flat in display order, total, query', () => {
  const r = search(index, 'audio')
  assert.deepEqual(r.flat, r.groups.flatMap((g) => g.items.map((i) => i.doc)))
  assert.equal(r.query, 'audio')
  assert.ok(r.total >= r.flat.length)
})

test('provider: aliases are a table of strings or lists of strings, and reach the docs through the entries', () => {
  assert.deepEqual(settingsDataProblems({ searchIndex: getSearchIndex(), labels: { en: {} }, aliases: { stream_audio: ['声音'], hevc_mode: 'h265' } }), [])
  assert.match(settingsDataProblems({ searchIndex: [], labels: { en: {} }, aliases: { a: [1] } })[0], /aliases\.a/)
  assert.match(settingsDataProblems({ searchIndex: [], labels: { en: {} }, aliases: [] })[0], /aliases is not an object/)
  const entries = buildSettingsEntries({ index: getSearchIndex(), label: (k) => labelOf('zh', k), altLabel: (k) => labelOf('en', k), aliases: { stream_audio: ['声音', 'mute'] } })
  const docs = settingDocs(entries)
  assert.deepEqual(docs.find((d) => d.id === 'setting:stream_audio').aliases, ['声音', 'mute'])
  assert.equal(docs.find((d) => d.id === 'setting:hevc_mode').aliases, undefined)
})

test('provider: the other language of the places above a row is searched like the place, after the words of the row', () => {
  const entries = buildSettingsEntries({ index: getSearchIndex(), label: (k) => labelOf('zh', k), altLabel: (k) => labelOf('en', k) })
  const e = entries.find((x) => x.id === 'hevc_mode')
  assert.ok(!/display|encoder/i.test(e.keywords), 'the words of a place are not the words of the row')
  assert.match(e.pathAlt, /Display/)
  const idx = buildIndex(settingDocs(entries))
  const r = search(idx, 'encoders', { perGroup: 20 })
  assert.ok(r.groups[0].items.every((i) => i.tier >= 7 || /encoder/i.test(i.doc.title + i.doc.keywords)))
})

test('speed: a keystroke over the real-sized index is far below a frame, and so is a slip', () => {
  const entries = buildSettingsEntries({ index: getSearchIndex(), label: (k) => labelOf('zh', k), altLabel: (k) => labelOf('en', k) })
  const docs = [...settingDocs(entries), ...actionDocs('zh', { restart() {}, pair() {} }, 'x'), ...tileDocs('zh'), ...DOCS]
  const many = Array.from({ length: 3 }, (_, k) => docs.map((d) => ({ ...d, id: `${d.id}#${k}` }))).flat() // about 400 docs: more than the products have
  const built = performance.now()
  const big = buildIndex(many)
  const buildMs = performance.now() - built
  const queries = ['声', '声音', 'yinpin', 'yp', 'sepaker', 'mic', 'headphones', '没有声音', '麦克风没声音', '音平', 'bitr', 'hevc_mode', 'zzzzqq', '启用音频', 'second monitor', '串流设置 编码器']
  for (const q of queries) search(big, q)
  const times = []
  for (let round = 0; round < 15; round++) for (const q of queries) { const t = performance.now(); search(big, q); times.push(performance.now() - t) }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)], p95 = times[Math.floor(times.length * 0.95)]
  console.log(`  ${many.length} docs: build ${buildMs.toFixed(1)} ms, keystroke median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms, worst ${times.at(-1).toFixed(3)} ms`)
  // the budget is 5 ms on the slowest device the products run on; a build machine is several times faster, and shared, so the check leaves room for that
  assert.ok(p95 < 5, `p95 ${p95.toFixed(2)} ms`)
})
