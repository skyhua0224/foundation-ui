import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULTS, normalize, imageSource } from '../src/appearance/appearance.js'
import { WALLPAPERS, autoPick, autoPictures, colourPictureId, registerWallpapers, wallpaperIds, wallpaperSources } from '../src/appearance/wallpaper.js'
import { MASCOT, VIVI, hasMascot, registerMascot, viviClip, viviImage } from '../src/about/mascot.js'
import { moreCatalogue } from '../src/vue/homeCatalogueMore.js'
import { clearArt, registerFakeArt } from './fakeArt.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p] })

test('the library holds no picture of the mascot or her wallpapers, and no code names one', () => {
  const files = walk(join(root, 'src')).map((p) => relative(root, p))
  assert.deepEqual(files.filter((f) => /vivi|lion[-.]|brand-assets/i.test(f)), [])
  const named = files.filter((f) => /\.(js|vue|css|mjs)$/.test(f) && !f.includes('/locale/')).filter((f) => /(assets\/vivi|brand-assets|vivi-(logo|avatar|clip|wallpaper|bg|loading)|lion-\d)/.test(readFileSync(join(root, f), 'utf8')))
  assert.deepEqual(named, [])
  // the art is its own directory with its own licence, loaded only by a Product that imports it
  const exported = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).exports
  assert.deepEqual(Object.entries(exported).filter(([k, v]) => /brand|vivi|mascot/i.test(k) || /brand-assets/.test(v)), [['./brand-assets', './brand-assets/index.js']])
  assert.match(readFileSync(join(root, 'brand-assets/LICENSE'), 'utf8'), /CC BY-NC-ND 4\.0/)
  assert.match(readFileSync(join(root, 'TRADEMARKS.md'), 'utf8'), /2\.3/)
})

test('as shipped the engine offers the gradient, a file and a web address, and nothing draws a mascot', () => {
  clearArt()
  assert.deepEqual(wallpaperSources(), ['auto', 'gradient', 'file', 'url'])
  assert.equal(autoPictures(), null)
  assert.equal(autoPick(null, 1600, 1000), null)
  assert.equal(colourPictureId('auto', null), null)
  assert.equal(DEFAULTS.source, 'auto')
  assert.equal(normalize(null).source, 'gradient') // Auto has no pictures to choose from
  assert.equal(normalize({ source: 'vivi1' }).source, 'gradient') // a picture this Product did not register
  assert.equal(imageSource(normalize(null)), 'gradient')
  assert.equal(imageSource({ ...normalize(null), source: 'auto' }), 'gradient')
  assert.equal(hasMascot(), false)
  assert.deepEqual(viviImage(64, 2), { src: '', srcset: '', size: 0 })
  assert.equal(viviClip(32, 1), '')
  assert.equal(VIVI.bg, ''); assert.equal(VIVI.logo[192], undefined); assert.equal(MASCOT[256], '')
  assert.equal(moreCatalogue({}, {}).vivi, null)
})

test('registered art comes back through the same calls', () => {
  registerFakeArt()
  assert.deepEqual(wallpaperSources(), ['auto', 'vivi1', 'vivi2', 'gradient', 'file', 'url'])
  assert.equal(normalize(null).source, 'auto'); assert.equal(normalize({ source: 'vivi1' }).source, 'vivi1')
  assert.equal(imageSource(normalize({ source: 'vivi2' })), WALLPAPERS.vivi2.url)
  assert.equal(colourPictureId('auto', null), 'vivi2')
  assert.equal(hasMascot(), true)
  assert.equal(viviImage(48, 1).src, 'fake:logo-48'); assert.equal(viviImage(300, 1).src, 'fake:avatar-384')
  assert.equal(MASCOT[256], 'fake:avatar-256'); assert.equal(VIVI.bg, 'fake:bg')
  assert.equal(moreCatalogue({}, {}).vivi.image, 'fake:avatar-256')
  clearArt()
  assert.equal(wallpaperIds().length, 0)
})

test('registration refuses ids and pictures that cannot work', () => {
  clearArt()
  const pic = { id: 'a', url: 'x', w: 10, h: 10, focus: { x: 0.5, y: 0.5 } }
  for (const id of ['auto', 'default', 'gradient', 'file', 'url', '', 'a b', '1x']) assert.throws(() => registerWallpapers([{ ...pic, id }]), /not usable/, id)
  assert.throws(() => registerWallpapers([{ ...pic, w: 0 }]), /incomplete/)
  for (const bad of [{ w: NaN }, { h: Infinity }, { focus: {} }, { focus: { x: 2, y: 0.5 } }, { focus: { x: 0.5, y: -0.1 } }]) assert.throws(() => registerWallpapers([{ ...pic, ...bad }]), /incomplete/, JSON.stringify(bad))
  assert.throws(() => registerWallpapers([], { auto: { narrow: toString, wide: constructor, colour: hasOwnProperty } }), /Auto/)
  assert.throws(() => registerWallpapers([pic], { auto: { narrow: 'a', wide: 'b', colour: 'a' } }), /Auto/)
  clearArt()
  registerMascot({ logo: { 24: 'l' }, avatar: { 256: 'a' }, clip: {}, buttons: {} })
  assert.equal(viviImage(24, 1).src, 'l'); assert.equal(viviImage(100, 1).src, 'a')
  clearArt()
})
