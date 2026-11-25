import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { finalizeBundle } from '../src/diagnostics/bundle.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p] })

test('no component takes the name of Sunshine or Moonlight as a default: the Product passes the names it shows', () => {
  const hits = walk(join(root, 'src/vue')).filter((f) => f.endsWith('.vue')).flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l]))
    .filter(([, , l]) => /default:\s*['"`][^'"`]*(sunshine|moonlight)/i.test(l)).map(([f, n]) => `${relative(root, f)}:${n}`)
  assert.deepEqual(hits, [])
})

test('the diagnostics bundle names no product unless the Product gives one', () => {
  const entry = { id: 'log', available: true, file: 'log.txt', text: 'x', size: 1, counts: {} }
  // the bundle is a stored (uncompressed) zip: README.txt is readable in its bytes
  const first = (opts) => Buffer.from(finalizeBundle([entry], ['log'], opts).bytes).toString('utf8').match(/README\.txt([^\n]*diagnostics bundle)\n/)?.[1]
  assert.equal(first(), 'diagnostics bundle')
  assert.equal(first({ product: 'Example' }), 'Example diagnostics bundle')
})
