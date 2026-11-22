import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COMMUNITY_CACHE_KEY, COMMUNITY_URLS, applyCommunity, clearCommunityCache, communityUrlsFor, fetchCommunity, isCommunityDocument, parseCommunity } from '../src/community/index.js'
import { PROJECT_LINKS, linkDetail, resolveLink } from '../src/about/index.js'
import * as viaExports from 'foundation-ui/community'

const memory = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }
}
const QQ_README = 'https://qm.qq.com/q/vIVhpjDMic'
const QQ_NEW = 'https://qm.qq.com/cgi-bin/qm/qr?k=NEWKEY&jump_from=webapi'
const doc = (links) => ({ schema: 1, links })
const answer = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
const T = Date.parse('2026-11-10T12:00:00Z')

test('the bundled QQ row is the README join link, not a typed number', () => {
  const qq = PROJECT_LINKS.find((l) => l.id === 'qq')
  assert.equal(qq.url, QQ_README)
  assert.equal(linkDetail(qq, 'zh'), 'qm.qq.com')
})

test('the sample file in the docs is a valid file and says the README values', () => {
  const sample = JSON.parse(readFileSync(new URL('../docs/community.sample.json', import.meta.url), 'utf8'))
  assert.ok(isCommunityDocument(sample))
  const links = parseCommunity(sample)
  assert.equal(links.qq.url, QQ_README)
  assert.deepEqual(Object.keys(links).sort(), ['docs', 'qq'])
})

test('the urls: the .com host first, the .cn mirror first for a Chinese interface, beside the announcements file', () => {
  assert.equal(COMMUNITY_URLS[0], 'https://www.alkaidlab.com/release-metadata/foundation-sunshine-community.json')
  assert.equal(COMMUNITY_URLS[1], 'https://www.alkaidlab.cn/release-metadata/foundation-sunshine-community.json')
  assert.deepEqual(communityUrlsFor('en'), [...COMMUNITY_URLS])
  assert.deepEqual(communityUrlsFor('zh_CN'), [COMMUNITY_URLS[1], COMMUNITY_URLS[0]])
  assert.equal(viaExports.fetchCommunity, fetchCommunity)
})

test('parse: only known ids, https, the QQ host, no credentials, each link on its own', () => {
  const links = parseCommunity(doc({
    qq: { url: QQ_NEW },
    docs: { url: 'http://insecure.example/docs' },
    other: { url: 'https://example.org/' },
  }))
  assert.deepEqual(links, { qq: { url: QQ_NEW } })
  assert.deepEqual(parseCommunity(doc({ qq: { url: 'https://evil.example/qr?k=1' } })), {})
  assert.deepEqual(parseCommunity(doc({ qq: { url: 'https://user:pw@qm.qq.com/x' } })), {})
  assert.deepEqual(parseCommunity(doc({ qq: { url: 'javascript:alert(1)' } })), {})
  assert.deepEqual(parseCommunity(doc({ docs: { url: 'https://www.alkaidlab.com/docs/', zh: 'not a url' } })), { docs: { url: 'https://www.alkaidlab.com/docs/' } })
  assert.deepEqual(parseCommunity({ schema: 2, links: { qq: { url: QQ_NEW } } }), {})
  assert.deepEqual(parseCommunity({ schema: 1 }), {})
  assert.deepEqual(parseCommunity('nope'), {})
  assert.deepEqual(parseCommunity(doc({ qq: { url: `https://qm.qq.com/${'a'.repeat(600)}` } })), {})
})

test('apply: the file replaces the address of its row only; a url without zh drops the old zh', () => {
  const rows = applyCommunity(PROJECT_LINKS, { qq: { url: QQ_NEW }, docs: { url: 'https://docs.example/' } })
  assert.equal(rows.find((l) => l.id === 'qq').url, QQ_NEW)
  const docs = rows.find((l) => l.id === 'docs')
  assert.equal(docs.url, 'https://docs.example/')
  assert.equal(resolveLink(docs, 'zh'), 'https://docs.example/')
  assert.equal(rows.find((l) => l.id === 'site').url, PROJECT_LINKS.find((l) => l.id === 'site').url)
  assert.equal(applyCommunity(PROJECT_LINKS, {}).length, PROJECT_LINKS.length)
  assert.equal(PROJECT_LINKS.find((l) => l.id === 'qq').url, QQ_README, 'the bundled rows are not changed')
})

test('fetch: the first usable answer wins, it is cached and not asked again inside the time', async () => {
  clearCommunityCache()
  const storage = memory()
  let calls = 0
  const fetch = async (url, init) => {
    calls += 1
    assert.equal(init.credentials, 'omit')
    assert.equal(init.referrerPolicy, 'no-referrer')
    assert.equal(init.cache, 'default')
    return answer(doc({ qq: { url: QQ_NEW } }))
  }
  assert.deepEqual(await fetchCommunity({ fetch, storage, now: T }), { qq: { url: QQ_NEW } })
  assert.deepEqual(await fetchCommunity({ fetch, storage, now: T + 60000 }), { qq: { url: QQ_NEW } })
  assert.equal(calls, 1)
  assert.ok(storage.getItem(COMMUNITY_CACHE_KEY))
})

test('fetch: the mirror is asked when the first host fails, not when it says 404; failures are {} and never throw', async () => {
  clearCommunityCache()
  const urls = []
  const down = async (url) => { urls.push(url); if (url.includes('.com/')) throw new Error('offline'); return answer(doc({ docs: { url: 'https://docs.example/' } })) }
  assert.deepEqual(await fetchCommunity({ fetch: down, storage: memory(), now: T }), { docs: { url: 'https://docs.example/' } })
  assert.equal(urls.length, 2)

  clearCommunityCache()
  urls.length = 0
  const missing = async (url) => { urls.push(url); return answer('', 404) }
  assert.deepEqual(await fetchCommunity({ fetch: missing, storage: memory(), now: T }), {})
  assert.equal(urls.length, 1)

  clearCommunityCache()
  assert.deepEqual(await fetchCommunity({ fetch: async () => answer('<html>not json</html>'), storage: memory(), now: T }), {})
  clearCommunityCache()
  assert.deepEqual(await fetchCommunity({ fetch: async () => { throw new Error('x') }, storage: memory(), now: T }), {})
  clearCommunityCache()
  assert.deepEqual(await fetchCommunity({ fetch: undefined, urls: [], storage: memory(), now: T }), {})
})

test('fetch: after a failure the last good copy is kept for a day', async () => {
  clearCommunityCache()
  const storage = memory()
  await fetchCommunity({ fetch: async () => answer(doc({ qq: { url: QQ_NEW } })), storage, now: T })
  clearCommunityCache()
  const failing = async () => { throw new Error('offline') }
  assert.deepEqual(await fetchCommunity({ fetch: failing, storage, now: T + 2 * 3600e3, force: true }), { qq: { url: QQ_NEW } })
  clearCommunityCache()
  assert.deepEqual(await fetchCommunity({ fetch: failing, storage, now: T + 25 * 3600e3, force: true }), {})
})

test('fetch: developer mode may use a local source, an ordinary run may not', async () => {
  clearCommunityCache()
  const storage = memory()
  storage.setItem('foundation-ui.community.source', 'http://127.0.0.1:9/community.json')
  const seen = []
  const fetch = async (url) => { seen.push(url); return answer(doc({})) }
  await fetchCommunity({ fetch, storage, now: T })
  assert.ok(seen.every((u) => u.startsWith('https://www.alkaidlab.')), 'the source is ignored without developer mode')
  clearCommunityCache()
  seen.length = 0
  storage.setItem('foundation-ui.dev', '1')
  await fetchCommunity({ fetch, storage, now: T, force: true })
  assert.deepEqual(seen, ['http://127.0.0.1:9/community.json'])
})
