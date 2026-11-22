import test from 'node:test'
import assert from 'node:assert/strict'
import { csrfCookieName, csrfCookieNames, readCsrfToken, servicePortOf, sessionCookieName, CSRF_COOKIE, authError, authTexts, createAuthClient, deviceLabel, endsAt, loginUrl, normalizeSession, normalizeSessions, passwordIssues, readCookie, safeNext, spanText, agoText, fill } from '../src/auth/index.js'
import { forgetAuthSession, useAuthSession } from '../src/vue/useAuthSession.js'

test('a return path is followed only when it stays on this origin', () => {
  for (const ok of ['/', '/config', '/config?tab=network', '/a/b#c']) assert.equal(safeNext(ok), ok)
  for (const bad of ['', 'config', '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/%2F%2Fevil.example', '/%5Cevil.example', '/a\nb', '/a\u0000b', '/%zz', null, undefined, 5]) assert.equal(safeNext(bad), '/', String(bad))
  assert.equal(safeNext('//x', '/home'), '/home')
  assert.equal(safeNext('/' + 'a'.repeat(3000)), '/')
})
test('the login address carries the return path encoded, and only a same-origin one', () => {
  assert.equal(loginUrl('/config?tab=network'), '/login?next=%2Fconfig%3Ftab%3Dnetwork')
  assert.equal(loginUrl('//evil.example'), '/login'); assert.equal(loginUrl('/'), '/login'); assert.equal(loginUrl(), '/login')
})

test('a session answer is read as documented and anything else is signed out', () => {
  const s = normalizeSession({ authenticated: true, username: 'alice', session_id: 'ab12', created_at: '2026-11-03T10:00:00Z', last_seen: '2026-11-03T10:05:00Z', expires_at: '2026-11-03T10:35:00Z', absolute_expires_at: '2026-11-03T22:00:00Z', remember: true, csrf_token: 'tok', local: false, setup_required: false })
  assert.equal(s.authenticated, true); assert.equal(s.username, 'alice'); assert.equal(s.remember, true); assert.equal(s.csrf, 'tok')
  assert.equal(s.expiresAt, Date.parse('2026-11-03T10:35:00Z')); assert.equal(endsAt(s), Date.parse('2026-11-03T10:35:00Z'))
  assert.equal(endsAt({ expiresAt: 0, absoluteExpiresAt: 0 }), 0)
  assert.equal(normalizeSession({ authenticated: true, local: true, username: 'alice' }).local, true)
  assert.equal(normalizeSession({ setup_required: true }).setupRequired, true)
  for (const junk of [null, undefined, 'x', 5, [], {}]) assert.equal(normalizeSession(junk).authenticated, false)
  assert.equal(normalizeSession({ authenticated: 'true' }).authenticated, false, 'only the boolean true counts')
})
test('the session list puts this device first, then the newest used; entries without an id are dropped', () => {
  const r = normalizeSessions({ current: 'b', sessions: [{ id: 'a', last_seen: '2026-11-03T10:00:00Z' }, { id: 'b', last_seen: '2026-11-03T09:00:00Z', client_ip: '192.168.1.x' }, { id: 'c', last_seen: '2026-11-03T11:00:00Z' }, { last_seen: 'x' }, null] })
  assert.deepEqual(r.sessions.map((s) => s.id), ['b', 'c', 'a']); assert.equal(r.sessions[0].current, true); assert.equal(r.sessions[0].ip, '192.168.1.x')
  assert.deepEqual(normalizeSessions(null).sessions, [])
})

test('every failure is one kind, and the host never says which of user or password was wrong', () => {
  assert.equal(authError(0).kind, 'network')
  assert.deepEqual(authError(429, { ok: false }, '45'), { status: 429, message: '', kind: 'throttled', retryAfter: 45 })
  assert.equal(authError(429, {}, undefined).retryAfter, 30); assert.equal(authError(429, {}, 'soon').retryAfter, 30); assert.equal(authError(429, {}, '999999999').retryAfter, 86400)
  assert.equal(authError(401, { ok: false, error: 'Invalid username or password' }).kind, 'invalid')
  assert.equal(authError(401, { status: false, code: 'unauthenticated' }).kind, 'signed-out')
  assert.equal(authError(403, {}).kind, 'csrf'); assert.equal(authError(409, {}).kind, 'setup-done'); assert.equal(authError(400, {}).kind, 'bad-request'); assert.equal(authError(413, {}).kind, 'bad-request'); assert.equal(authError(500, {}).kind, 'server')
  const T = authTexts('zh')
  for (const kind of ['invalid', 'throttled', 'csrf', 'signed-out', 'setup-done', 'bad-request', 'network', 'server']) assert.ok(T.errors[kind], kind)
  assert.doesNotMatch(T.errors.invalid, /用户名不存在|密码错误/, 'one sentence for both')
})
test('password limits are the host\'s: 12 to 128 characters, not the user name, and both entries equal', () => {
  assert.deepEqual(passwordIssues('a'.repeat(12)), []); assert.deepEqual(passwordIssues('a'.repeat(11)), ['too-short']); assert.deepEqual(passwordIssues('a'.repeat(129)), ['too-long'])
  assert.deepEqual(passwordIssues('Alice-Alice-123', { username: 'alice-alice-123' }), ['same-as-username'])
  assert.deepEqual(passwordIssues('a'.repeat(12), { confirm: 'b' }), ['mismatch']); assert.deepEqual(passwordIssues('a'.repeat(12), { confirm: 'a'.repeat(12) }), [])
})
test('a device reads as browser and system; a span and an age read in whole units', () => {
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'), 'Chrome · Windows')
  assert.equal(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605 Version/18 Safari/604.1'), 'Safari · iOS')
  assert.equal(deviceLabel('curl/8.5.0'), 'curl'); assert.equal(deviceLabel(''), ''); assert.equal(deviceLabel('weird agent'), 'weird agent')
  const T = authTexts('en')
  assert.equal(spanText(1000, T), '1 s'); assert.equal(spanText(30 * 60 * 1000, T), '30 min'); assert.equal(spanText(5 * 3600 * 1000, T), '5 h'); assert.equal(spanText(7 * 86400000, T), '7 days'); assert.equal(spanText(0, T), '1 s')
  const now = Date.parse('2026-11-03T12:00:00Z')
  assert.equal(agoText(now - 10000, now, T), 'just now'); assert.equal(agoText(now - 5 * 60000, now, T), '5 min ago'); assert.equal(agoText(0, now, T), 'never')
  assert.equal(fill('{a} and {b}', { a: 1 }), '1 and {b}')
})

function fake(answers) {
  const calls = []
  const request = async (method, path, { body, headers }) => {
    calls.push({ method, path, body, headers })
    const a = typeof answers === 'function' ? answers(method, path, body) : answers[`${method} ${path}`]
    if (a instanceof Error) throw a
    return { status: a.status, headers: { get: (k) => a.headers?.[k] ?? null }, json: async () => a.body }
  }
  return { request, calls }
}
test('the client sends the session token only on state-changing calls and never throws', async () => {
  const f = fake({
    'GET /api/auth/session': { status: 200, body: { authenticated: true, username: 'a', csrf_token: 'T1' } },
    'POST /api/auth/logout': { status: 200, body: { status: true } },
    'DELETE /api/auth/sessions/abc%2F1': { status: 200, body: { status: true, revoked: 1 } },
    'DELETE /api/auth/sessions?all=1': { status: 200, body: { status: true, revoked: 3 } },
    'POST /api/auth/password': { status: 401, body: { ok: false, error: 'Invalid username or password' } },
  })
  const c = createAuthClient({ request: f.request, cookie: () => '' })
  assert.equal((await c.session()).data.csrf, 'T1'); assert.equal(f.calls[0].headers['X-CSRF-Token'], undefined, 'a read carries no token')
  assert.equal((await c.logout()).ok, true); assert.equal(f.calls[1].headers['X-CSRF-Token'], 'T1')
  await c.revoke('abc/1'); assert.equal(f.calls[2].path, '/api/auth/sessions/abc%2F1')
  await c.revokeAll(); assert.equal(f.calls[3].path, '/api/auth/sessions?all=1')
  const pw = await c.changePassword({ current: 'x', next: 'y', confirm: 'y' })
  assert.deepEqual(f.calls[4].body, { current_password: 'x', new_password: 'y', confirm_password: 'y' }); assert.equal(pw.ok, false); assert.equal(pw.error.kind, 'invalid')
  const down = await createAuthClient({ request: async () => { throw new Error('offline') } }).session()
  assert.equal(down.ok, false); assert.equal(down.error.kind, 'network')
})
test('the CSRF cookie wins over the remembered token; login and setup need none', async () => {
  const f = fake({ 'POST /api/auth/login': { status: 200, body: { status: true, authenticated: true, username: 'a', csrf_token: 'T2' } }, 'POST /api/auth/logout': { status: 200, body: { status: true } } })
  const c = createAuthClient({ request: f.request, cookie: () => `x=1; ${CSRF_COOKIE}=FROMCOOKIE; y=2` })
  await c.login({ username: 'a', password: 'p', remember: true }); assert.equal(f.calls[0].headers['X-CSRF-Token'], undefined); assert.deepEqual(f.calls[0].body, { username: 'a', password: 'p', remember: true })
  await c.logout(); assert.equal(f.calls[1].headers['X-CSRF-Token'], 'FROMCOOKIE')
  assert.equal(readCookie('a=1; b=%7B', 'b'), '{'); assert.equal(readCookie('a=1', 'z'), '')
})
test('a wrong login is not a success even when the answer is 200 with ok:false, and 429 carries the wait', async () => {
  const f = fake({ 'POST /api/auth/login': { status: 200, body: { ok: false, error: 'no' } }, 'POST /api/auth/setup': { status: 429, headers: { 'Retry-After': '60' }, body: { ok: false } } })
  const c = createAuthClient({ request: f.request })
  assert.equal((await c.login({ username: 'a', password: 'b' })).ok, false)
  const t = await c.setup({ username: 'a', password: 'b' }); assert.equal(t.error.kind, 'throttled'); assert.equal(t.error.retryAfter, 60)
  assert.throws(() => createAuthClient({}), TypeError)
})
test('the session state moves through loading, ready, signed out, and an older host reads as unavailable', async () => {
  const f = fake((m, p) => {
    if (p === '/api/auth/session') return { status: 200, body: { authenticated: true, username: 'a', session_id: 's1', csrf_token: 'T' } }
    if (p === '/api/auth/sessions' && m === 'GET') return { status: 200, body: { status: true, current: 's1', sessions: [{ id: 's1', current: true }, { id: 's2' }] } }
    if (m === 'DELETE') return { status: 200, body: { status: true, revoked: 1 } }
    return { status: 200, body: { status: true } }
  })
  const a = useAuthSession(createAuthClient({ request: f.request, cookie: () => '' }))
  assert.equal(a.state.value, 'loading'); assert.equal(await a.load(), true); assert.equal(a.state.value, 'ready'); assert.equal(a.list.sessions.length, 2)
  assert.equal((await a.revoke('s2')).ok, true)
  assert.equal((await a.signOut()).ok, true); assert.equal(a.signedIn.value, false)
  const old = useAuthSession(createAuthClient({ request: fake({ 'GET /api/auth/session': { status: 404, body: {} } }).request }))
  assert.equal(await old.load(), false); assert.equal(old.state.value, 'unavailable')
  const closed = useAuthSession(createAuthClient({ request: fake({ 'GET /api/auth/session': { status: 444, body: {} } }).request }))
  assert.equal(await closed.load(), false); assert.equal(closed.state.value, 'unavailable') // the host closes the connection (444) on a route it does not have
  const down = useAuthSession(createAuthClient({ request: async () => { throw new Error('x') } }))
  await down.load(); assert.equal(down.state.value, 'error')
})

test('a reset without the old password is a POST of the new one to the local-only route; the words name the Panel path and no website', async () => {
  const f = fake({ 'POST /api/auth/password/reset': { status: 200, body: { status: true } } })
  const c = createAuthClient({ request: f.request, cookie: () => '' })
  assert.equal((await c.resetPassword({ next: 'a long new passphrase', confirm: 'a long new passphrase' })).ok, true)
  assert.equal(f.calls[0].path, '/api/auth/password/reset')
  assert.deepEqual(f.calls[0].body, { new_password: 'a long new passphrase', confirm_password: 'a long new passphrase' })
  for (const l of ['zh', 'en']) {
    const T = authTexts(l)
    assert.ok(!/https?:|www\./.test(T.forgotHint), l)
    assert.match(T.forgotHint, /Panel/); assert.match(T.forgotHint, l === 'zh' ? /主机设置 › 安全与登录 › 重置密码/ : /Host settings › Security and sign-in › Reset password/)
    assert.ok(T.resetTitle && T.resetText && T.resetUnsupported && T.resetForbidden)
  }
  assert.match(authTexts('zh').forgotHint, /手机或其他设备上的网页不能重置/); assert.match(authTexts('en').forgotHint, /phone or another device cannot reset/)
  assert.match(authTexts('zh').signInLead, /WebUI 面板/); assert.ok(!/本机/.test(authTexts('zh').signInLead + authTexts('zh').setupLead))
})
test('the sign-in page fills the window: no body margin, safe-area insets, a sheet for a phone held sideways', async () => {
  const fs = await import('node:fs')
  const css = fs.readFileSync(new URL('../src/css/auth.css', import.meta.url), 'utf8')
  assert.match(css, /html:has\(\.m-login\), html:has\(\.m-login\) body \{ margin: 0;/)
  assert.match(css, /safe-area-inset-top/); assert.match(css, /safe-area-inset-bottom/); assert.match(css, /safe-area-inset-left/); assert.match(css, /safe-area-inset-right/)
  assert.match(css, /min-height: 100dvh/); assert.match(css, /@media \(max-height: 520px\) and \(orientation: landscape\)/)
})

test('the signed-out page distinguishes a first installation from a stale sign-in; the account form still asks for the current password', async () => {
  const fs = await import('node:fs')
  const page = fs.readFileSync(new URL('../src/vue/MSecurityLogin.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /resetPassword|resetSupported|const reset = /, 'the old-password-free reset is not part of the page')
  assert.match(page, /<MFieldItem v-model="current" :label="T\.current" type="password" name="current" autocomplete="current-password" required :error="passwordError" data-sec="current" \/>/)
  assert.match(page, /<MFieldItem v-model="username" :label="T\.username"/)
  assert.match(page, /const canChange = computed\(\(\) => current\.value !== '' && \(next\.value !== '' \|\| renamed\.value\)/)
  // a sign-in button needs somewhere to go: with no `signedOut` it is not drawn (a control that does nothing is a bug)
  assert.match(page, /:title="setupRequired \? T\.setupTitle : T\.signedOutTitle"/)
  assert.match(page, /:text="setupRequired \? T\.setupLead : T\.signedOutText"/)
  assert.match(page, /<MButton v-if="signedOut" :icon="setupRequired \? 'person_add' : 'login'" @click="signedOut\(\)">\{\{ setupRequired \? T\.create : T\.signIn \}\}<\/MButton>/)
  // signing every device out never sends the control panel to a sign-in page
  assert.match(page, /if \(auth\.local\.value\) \{ say\(T\.value\.revokedAll\); await auth\.loadSessions\(\) \}/)
  const texts = authTexts('zh'); assert.equal(texts.change, '修改用户名和密码'); assert.equal(authTexts('en').change, 'Change user name and password')
})
test('a local session is signed in and trusted: no sign-out row, the old password is sent and a wrong one is the inline error; a rename sends the new name', async () => {
  const f = fake((m, p, body) => {
    if (p === '/api/auth/session') return { status: 200, body: { authenticated: true, local: true, username: 'zako', setup_required: false } }
    if (p === '/api/auth/sessions') return { status: 200, body: { current: '', sessions: [] } }
    if (p === '/api/auth/password') return body.current_password === 'right-password-1' ? { status: 200, body: { status: true } } : { status: 401, body: { status: false, error: 'Invalid current password' } }
    return { status: 404, body: {} }
  })
  const a = useAuthSession(createAuthClient({ request: f.request, cookie: () => '' })); await a.load()
  assert.equal(a.signedIn.value, true); assert.equal(a.local.value, true); assert.equal(a.session.value.username, 'zako')
  assert.ok(!f.calls.some((c) => c.path === '/api/auth/password/reset'), 'nothing is probed that could change the password')
  const wrong = await a.changePassword({ current: 'nope', next: 'a-new-long-password' }); assert.equal(wrong.ok, false); assert.equal(a.error.value.kind, 'invalid')
  const ok = await a.changePassword({ current: 'right-password-1', next: 'a-new-long-password', confirm: 'a-new-long-password', username: 'zako2' }); assert.equal(ok.ok, true)
  const sent = f.calls.filter((c) => c.path === '/api/auth/password').at(-1).body
  assert.deepEqual(sent, { current_password: 'right-password-1', new_password: 'a-new-long-password', new_username: 'zako2', confirm_password: 'a-new-long-password' })
  const rename = await a.changePassword({ current: 'right-password-1', next: '', username: 'zako3' }); assert.equal(rename.ok, true)
  assert.deepEqual(f.calls.filter((c) => c.path === '/api/auth/password').at(-1).body, { current_password: 'right-password-1', new_username: 'zako3' }, 'a rename keeps the password: none is sent')
})

test('the cookie names follow the host\'s service port (the Web UI port minus one); the default port keeps the plain name', () => {
  assert.equal(servicePortOf('57990'), 57989); assert.equal(servicePortOf(47990), 47989)
  assert.equal(servicePortOf(''), 0); assert.equal(servicePortOf('x'), 0); assert.equal(servicePortOf(1), 0)
  assert.equal(csrfCookieName('47990'), '__Host-sunshine_csrf'); assert.equal(csrfCookieName('57990'), '__Host-sunshine_csrf_57989'); assert.equal(csrfCookieName(''), '__Host-sunshine_csrf')
  assert.equal(sessionCookieName('57990'), '__Host-sunshine_session_57989')
  assert.deepEqual(csrfCookieNames('a=1; __Host-sunshine_csrf_57989=x; __Host-sunshine_csrf=y; __Host-sunshine_csrf_x=z; __Host-sunshine_session=s'), ['__Host-sunshine_csrf_57989', '__Host-sunshine_csrf'])
})

test('readCsrfToken: the host\'s own cookie by the page port, else the only CSRF cookie there is, else nothing', () => {
  assert.equal(readCsrfToken('__Host-sunshine_csrf_57989=T', '57990'), 'T')
  assert.equal(readCsrfToken('__Host-sunshine_csrf_57989=T', ''), 'T', 'a page without a port takes the only one')
  assert.equal(readCsrfToken('__Host-sunshine_csrf_1=A; __Host-sunshine_csrf_2=B', '57990'), '')
  assert.equal(readCsrfToken('__Host-sunshine_csrf_58000=A; __Host-sunshine_csrf_57989=B', '57990'), 'B')
  assert.equal(readCsrfToken('', '57990'), '')
})

test('the auth client sends the token of a host on another port, by the page port', async () => {
  const f = fake({ 'POST /api/auth/logout': { status: 200, body: { status: true } } })
  const c = createAuthClient({ request: f.request, cookie: () => 'x=1; __Host-sunshine_csrf_57989=PORT; __Host-sunshine_csrf=DEF', webPort: () => '57990' })
  await c.logout(); assert.equal(f.calls[0].headers['X-CSRF-Token'], 'PORT')
})

test('opening 安全与登录 again draws the kept account at once and the host answer replaces it', async () => {
  forgetAuthSession()
  const f = fake({ 'GET /api/auth/session': { status: 200, body: { authenticated: true, username: 'alice', local: true } }, 'GET /api/auth/sessions': { status: 200, body: { current: 'a', sessions: [] } } })
  const first = useAuthSession(createAuthClient({ request: f.request, cookie: () => '' }))
  assert.equal(first.state.value, 'loading', 'nothing kept on the first visit')
  await first.load()
  const again = useAuthSession(createAuthClient({ request: f.request, cookie: () => '' }))
  assert.equal(again.state.value, 'ready'); assert.equal(again.session.value.username, 'alice')
  await again.signOut()
  const after = useAuthSession(createAuthClient({ request: f.request, cookie: () => '' }))
  assert.equal(after.state.value, 'loading', 'a sign-out drops the kept account')
  forgetAuthSession()
})
