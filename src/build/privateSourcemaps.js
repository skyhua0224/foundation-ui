// Source maps of a release build stay OUT of what is shipped. The bundle is built with `sourcemap: 'hidden'` (the maps are written, the bundle carries no `//# sourceMappingURL` comment, so a browser or
// WebView never asks for them), and after the build the .map files are moved to a folder of their own that CI keeps as a private artifact (a private release asset). Error reports carry the minified position
// of a frame (`index.js:1:20345`); the private pipeline maps it back to `src/file.vue:12` with sourcemap.js. The shipped files are the same bytes with or without this plugin, except that no map is among them.
//
// Off unless a folder is given, so a local or development build is unchanged:  privateSourcemaps({ dir: process.env.SOURCEMAP_DIR })
// Primary sources: ECMA-426 Source Map (hidden maps are the build tools' reading of "a map without a reference"); Vite `build.sourcemap` ('hidden').
import fs from 'node:fs'
import path from 'node:path'

/** All files under `dir` whose name ends with `suffix`, recursively. */
function walk(dir, suffix, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, suffix, out)
    else if (entry.name.endsWith(suffix)) out.push(full)
  }
  return out
}

/** Move every .map file of `from` to `to` (same relative path), and remove a leftover `sourceMappingURL` comment from the js and css files. -> the files moved. */
export function moveMaps(from, to) {
  const moved = []
  for (const file of walk(from, '.map')) {
    const target = path.join(to, path.relative(from, file))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(file, target)
    fs.unlinkSync(file)
    moved.push(target)
  }
  for (const suffix of ['.js', '.mjs', '.css']) {
    for (const file of walk(from, suffix)) {
      const text = fs.readFileSync(file, 'utf8')
      const cleaned = text.replace(/\n?\/[*/]# sourceMappingURL=[^\n]*(?:\*\/)?\s*$/, '\n')
      if (cleaned !== text) fs.writeFileSync(file, cleaned)
    }
  }
  return moved
}

export function privateSourcemaps({ dir } = {}) {
  let outDir = ''
  return {
    name: 'foundation-private-sourcemaps',
    apply: 'build',
    config() { return dir ? { build: { sourcemap: 'hidden' } } : undefined },
    configResolved(resolved) { outDir = path.resolve(resolved.root, resolved.build.outDir) },
    closeBundle() { if (dir && outDir) moveMaps(outDir, path.resolve(dir)) },
  }
}
