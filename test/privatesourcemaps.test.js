import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { privateSourcemaps, moveMaps } from '../src/build/privateSourcemaps.js'
import { loadMap, mapFrames } from '../src/build/sourcemap.js'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fui-psm-'))
const files = (dir) => fs.readdirSync(dir, { recursive: true }).map(String).sort()

function project() {
  const root = tmp()
  fs.mkdirSync(path.join(root, 'src'))
  fs.writeFileSync(path.join(root, 'src', 'util.js'), [
    '// a comment line so that the marker is not on line 1',
    'export function explode(value) {',
    '  const parts = String(value).split(",")',
    '  if (parts.length > 2) throw new Error("boom-marker")',
    '  return parts',
    '}',
    '',
  ].join('\n'))
  fs.writeFileSync(path.join(root, 'src', 'main.js'), 'import { explode } from "./util.js"\nwindow.run = (v) => explode(v)\n')
  return root
}

const buildWith = async (root, plugins) => build({
  root, logLevel: 'silent', configFile: false, plugins,
  build: { lib: { entry: path.join(root, 'src', 'main.js'), formats: ['es'], fileName: 'index' }, minify: true, outDir: path.join(root, 'dist'), emptyOutDir: true },
})

test('a release build ships no map and no reference to one; the maps are in the private folder', async () => {
  const root = project()
  const priv = path.join(tmp(), 'private-maps')
  await buildWith(root, [privateSourcemaps({ dir: priv })])
  const shipped = files(path.join(root, 'dist'))
  assert.deepEqual(shipped.filter((f) => f.endsWith('.map')), [], `shipped: ${shipped}`)
  for (const f of shipped.filter((x) => /\.m?js$/.test(x))) assert.doesNotMatch(fs.readFileSync(path.join(root, 'dist', f), 'utf8'), /sourceMappingURL/)
  const kept = files(priv)
  assert.equal(kept.length, 1)
  assert.match(kept[0], /\.m?js\.map$/)
})

test('a stack position of the shipped bundle maps back to the line of the source', async () => {
  const root = project()
  const priv = path.join(tmp(), 'private-maps')
  await buildWith(root, [privateSourcemaps({ dir: priv })])
  const bundleName = files(path.join(root, 'dist')).find((f) => f.endsWith('.js') || f.endsWith('.mjs'))
  const bundle = fs.readFileSync(path.join(root, 'dist', bundleName), 'utf8')
  const at = bundle.indexOf('boom-marker')
  assert.ok(at > 0)
  const before = bundle.slice(0, at).split('\n')
  const line = before.length
  const column = before.at(-1).length + 1 // V8 columns are 1-based
  const mapFile = files(priv)[0]
  const out = mapFrames([`${bundleName}:${line}:${column}`], [{ file: mapFile.replace(/\.map$/, ''), map: JSON.parse(fs.readFileSync(path.join(priv, mapFile), 'utf8')) }])
  assert.deepEqual(out, ['src/util.js:4'], `frame ${line}:${column}`)
  assert.ok(loadMap(JSON.parse(fs.readFileSync(path.join(priv, mapFile), 'utf8'))).sources.length >= 1)
})

test('without a folder the build is the ordinary one: nothing moves and no map is made', async () => {
  const root = project()
  await buildWith(root, [privateSourcemaps({})])
  assert.deepEqual(files(path.join(root, 'dist')).filter((f) => f.endsWith('.map')), [])
})

test('moveMaps removes a leftover reference from js and css and keeps the folder layout', () => {
  const from = tmp()
  const to = path.join(tmp(), 'out')
  fs.mkdirSync(path.join(from, 'assets'))
  fs.writeFileSync(path.join(from, 'assets', 'a-12345678.js'), 'console.log(1)\n//# sourceMappingURL=a-12345678.js.map\n')
  fs.writeFileSync(path.join(from, 'assets', 'a-12345678.js.map'), '{}')
  fs.writeFileSync(path.join(from, 'assets', 'b.css'), 'a{b:c}\n/*# sourceMappingURL=b.css.map */\n')
  assert.equal(moveMaps(from, to).length, 1)
  assert.deepEqual(files(to), ['assets', 'assets/a-12345678.js.map'])
  assert.equal(fs.readFileSync(path.join(from, 'assets', 'a-12345678.js'), 'utf8'), 'console.log(1)\n')
  assert.equal(fs.readFileSync(path.join(from, 'assets', 'b.css'), 'utf8'), 'a{b:c}\n')
})

test('the command line maps the frames of a report with the private maps and leaves the others', async () => {
  const { execFileSync } = await import('node:child_process')
  const root = project()
  const priv = path.join(tmp(), 'private-maps')
  await buildWith(root, [privateSourcemaps({ dir: priv })])
  const bundleName = files(path.join(root, 'dist')).find((f) => /\.m?js$/.test(f))
  const bundle = fs.readFileSync(path.join(root, 'dist', bundleName), 'utf8')
  const before = bundle.slice(0, bundle.indexOf('boom-marker')).split('\n')
  const frame = `${bundleName}:${before.length}:${before.at(-1).length + 1}`
  const report = { component: 'web', fingerprint: 'a1b2c3d4e5f60718', frames: [frame, 'sunshine.exe+0x10'] }
  const out = JSON.parse(execFileSync(process.execPath, [new URL('../tools/map-stack.mjs', import.meta.url).pathname, '--maps', priv, '--report', '-'], { input: JSON.stringify(report), encoding: 'utf8' }))
  assert.deepEqual(out.frames, ['src/util.js:4', 'sunshine.exe+0x10'])
  assert.equal(out.mapped, 1)
  assert.equal(out.fingerprint, report.fingerprint)
})
