import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { nextTick, ref } from 'vue'
import { useDrawnPoints } from '../src/vue/useOnScreen.js'

const src = (f) => fs.readFileSync(new URL(`../src/vue/${f}`, import.meta.url), 'utf8')

test('a chart draws new samples only while it is seen, and not again when they are the same', async () => {
  const pts = ref([1, 2, 3]); const on = ref(true)
  const drawn = useDrawnPoints(() => pts.value, on)
  const first = drawn.value
  pts.value = [1, 2, 3]; await nextTick(); assert.equal(drawn.value, first, 'the same samples: the drawn list is kept (no new path)')
  pts.value = [2, 3, 4]; await nextTick(); assert.deepEqual(drawn.value, [2, 3, 4])
  on.value = false; pts.value = [3, 4, 5]; await nextTick(); assert.deepEqual(drawn.value, [2, 3, 4], 'off screen or the page hidden: frozen')
  on.value = true; await nextTick(); assert.deepEqual(drawn.value, [3, 4, 5], 'seen again: the latest')
})

test('the live numbers of the tiles patch their text in place: the rolling number keeps its last digit and decimals still, the small tile its value and second line', () => {
  const roll = src('MRoll.vue')
  assert.match(roll, /v-for="\(ch, i\) in chars" :key="i"/, 'every character keeps its node: keyed by its place')
  assert.match(roll, /<MText :text="ch" \/>/, 'its text is patched in place')
  assert.match(roll, /\* 0\.15\) return/, 'the jitter of a live number does not roll')
  assert.match(roll, /el\.animate\?\.\(/, 'a real change rolls by the Web Animations API, no DOM change')
  const small = src('MDashSmall.vue')
  assert.match(small, /<span><MText :text="small\.value \|\| small\.title" \/><\/span>/)
  assert.match(small, /class="m-dsmall__sub"><span v-for="\(p, i\) in parts" :key="i" class="m-dsmall__part"><MText :text="p" \/><\/span>/)
  for (const f of ['MDashCurve.vue', 'MDashSpark.vue']) assert.match(src(f), /useDrawnPoints\(\(\) => props\.points, useOnScreen\(root\)\)/, f)
})
