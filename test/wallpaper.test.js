import test from 'node:test'
import assert from 'node:assert/strict'
import { AUTO_ASPECT, WALLPAPERS, autoPick, freeGaps, wallpaperBox } from '../src/appearance/wallpaper.js'
import { DEFAULTS, normalize, imageSource } from '../src/appearance/appearance.js'
import { registerFakeArt } from './fakeArt.js'
registerFakeArt()

test('auto: the wide picture for wide windows, with hysteresis near the middle', () => {
  assert.equal(autoPick(null, 1600, 1000), 'vivi2') // 1.6
  assert.equal(autoPick(null, 1440, 900), 'vivi2')
  assert.equal(autoPick(null, 1024, 700), 'vivi1')
  assert.equal(autoPick(null, 720, 700), 'vivi1')
  assert.equal(autoPick(null, 480, 800), 'vivi1')
  assert.equal(autoPick(null, 3440, 1440), 'vivi2')
  // resizing slowly back and forth around 1.6 never flips it
  let pick = autoPick(null, 1600, 1000)
  const seen = new Set()
  for (const w of [1600, 1560, 1520, 1500, 1510, 1580, 1620, 1660, 1600]) { pick = autoPick(pick, w, 1000); seen.add(pick) }
  assert.deepEqual([...seen], ['vivi2']) 
})
test('auto: leaving the wide picture needs under 1.5, entering it needs over 1.7', () => {
  assert.equal(autoPick('vivi2', 1499, 1000), 'vivi1')
  assert.equal(autoPick('vivi2', 1500, 1000), 'vivi2')
  assert.equal(autoPick('vivi1', 1700, 1000), 'vivi1')
  assert.equal(autoPick('vivi1', 1701, 1000), 'vivi2')
  assert.equal(AUTO_ASPECT.toNormal < AUTO_ASPECT.first && AUTO_ASPECT.first < AUTO_ASPECT.toWide, true)
  assert.equal(autoPick('vivi1', 100, 0), 'vivi1')
})
test('gaps are what no pane covers', () => {
  assert.deepEqual(freeGaps(1440, [{ left: 0, right: 440 }, { left: 581, right: 1301 }]), [{ a: 440, b: 581 }, { a: 1301, b: 1440 }])
  assert.deepEqual(freeGaps(480, [{ left: -10, right: 600 }]), [])
  assert.deepEqual(freeGaps(100, []), [{ a: 0, b: 100 }])
})
test('the face stays on screen at every window size, with and without panes', () => {
  const sizes = [[480, 800], [720, 700], [1024, 700], [1440, 900], [1600, 1000], [2560, 1080], [3440, 1440], [5120, 1440]]
  for (const id of ['vivi1', 'vivi2']) {
    const pic = WALLPAPERS[id]
    for (const [W, H] of sizes) {
      for (const covered of [[], [{ left: 0, right: 440 }, { left: Math.round(W / 2 - 360), right: Math.round(W / 2 + 360) }]]) {
        const b = wallpaperBox(pic, { width: W, height: H }, covered)
        assert.ok(b.size >= W - 0.5 && b.size * (pic.h / pic.w) >= H - 0.5, `${id} covers ${W}x${H}`)
        assert.ok(b.left <= 0.5 && b.left + b.size >= W - 0.5, `${id} ${W}x${H} edges`)
        assert.ok(b.face.x > 0 && b.face.x < W && b.face.y > 0 && b.face.y < H, `${id} face inside ${W}x${H}: ${Math.round(b.face.x)},${Math.round(b.face.y)}`)
      }
    }
  }
})
test('with room beside the panes the face moves into the free gap, at most 1.5 x cover, and never shows less of her than plain cover', () => {
  const pic = WALLPAPERS.vivi2
  for (const [W, H, covered] of [
    [1440, 900, [{ left: 96, right: 408 }]], // the page without a list pane: a column of 720 with a gap on each side
    [1440, 900, [{ left: 96, right: 440 }, { left: 581, right: 1301 }]],
    [1600, 1000, [{ left: 96, right: 456 }, { left: 640, right: 1360 }]],
    [2560, 1080, [{ left: 96, right: 456 }, { left: 1000, right: 1720 }]],
  ]) {
    const plain = wallpaperBox(pic, { width: W, height: H }, [], { minGap: 1e9 })
    const placed = wallpaperBox(pic, { width: W, height: H }, covered)
    assert.ok(placed.zoom >= 1 - 1e-9 && placed.zoom <= 1.5 + 1e-9, `zoom ${placed.zoom}`)
    assert.ok(placed.visible >= wallpaperBox(pic, { width: W, height: H }, covered, { minGap: 1e9 }).visible - 1e-9, `${W}x${H} shows no less of her`)
    assert.ok(plain.zoom === 1)
  }
  // the roomy case: the face lands in the right gap and most of it is visible
  const roomy = wallpaperBox(pic, { width: 1440, height: 900 }, [{ left: 96, right: 408 }, { left: 408, right: 1128 }])
  assert.ok(roomy.face.x > 1128 || roomy.face.x < 96 || roomy.visible > 0.5)
})
test('with `whole` the picture is shown small and whole in the widest gap beside the content, inside the view, no face cut by the window or a pane', () => {
  for (const id of ['vivi1', 'vivi2']) {
    const pic = WALLPAPERS[id]
    for (const [W, H, covered] of [
      [1344, 860, [{ left: 312, right: 1032 }]], // 1440 x 900 less the rail and the caption bar, one column of 720
      [1504, 960, [{ left: 392, right: 1112 }]], // 1600 x 1000
    ]) {
      const b = wallpaperBox(pic, { width: W, height: H }, covered, { whole: 240 })
      const h = b.size * pic.h / pic.w
      assert.equal(b.whole, true)
      assert.ok(b.left >= 0 && b.left + b.size <= W + 1e-6 && b.top >= 0 && b.top + h <= H + 1e-6, `${id} ${W}x${H} inside the view`)
      assert.ok(b.left >= 1112 - 392 + 392 - 1 || b.left + b.size <= 312 + 1e-6 || b.left >= 1032 - 1e-6, 'in a gap, not under the column')
      assert.equal(b.visible, 1)
    }
  }
  // no gap wide enough: the plain placement, not marked whole
  assert.ok(!wallpaperBox(WALLPAPERS.vivi1, { width: 1344, height: 860 }, [{ left: 0, right: 1200 }], { whole: 240 }).whole)
  // not asked for: never whole
  assert.ok(!wallpaperBox(WALLPAPERS.vivi1, { width: 1344, height: 860 }, [{ left: 312, right: 1032 }]).whole)
})
test('the default is Auto, and the old default source means Auto', () => {
  assert.equal(DEFAULTS.source, 'auto')
  assert.equal(normalize({ source: 'default' }).source, 'auto')
  for (const s of ['auto', 'vivi1', 'vivi2', 'gradient', 'file', 'url']) assert.equal(normalize({ source: s }).source, s)
  assert.equal(normalize({ source: 'nope' }).source, 'auto')
  assert.equal(imageSource(normalize({ source: 'vivi1' })), WALLPAPERS.vivi1.url)
  assert.equal(imageSource(normalize({ source: 'vivi2' })), WALLPAPERS.vivi2.url)
  assert.equal(imageSource(normalize({ source: 'auto' })), 'auto')
  assert.equal(imageSource(normalize({ source: 'gradient' })), 'gradient')
  assert.equal(imageSource(normalize({ background: 'solid' })), null)
})
