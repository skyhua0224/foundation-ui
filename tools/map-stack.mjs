#!/usr/bin/env node
// Maps the minified frames of an error report to source lines, with the private source maps of the release (the step of the private report workflow).
//
//   node tools/map-stack.mjs --maps <folder with the .map files of that release> [--report report.json | -]
//
// The report is the JSON a Worker stores for an error group (or any object with a `frames` array): {"frames": ["index.js:1:20345", "sunshine.exe+0x10", ...]}.
// Prints the same object with `frames` mapped to `src/file.vue:12` (frames that are not bundle positions, or have no map, are unchanged) and `mapped` = the number of frames that changed.
// The maps stay private: they are read from the folder CI downloaded from the private release asset; this tool never uploads and never prints a map.
import fs from 'node:fs'
import path from 'node:path'
import { mapFrames } from '../src/build/sourcemap.js'

const args = process.argv.slice(2)
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined }
const mapsDir = value('--maps')
const reportPath = value('--report') ?? '-'
if (!mapsDir) { console.error('usage: map-stack.mjs --maps <folder> [--report report.json | -]'); process.exit(64) }

const maps = []
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name.endsWith('.map')) {
      try { maps.push({ file: entry.name.replace(/\.map$/, ''), map: JSON.parse(fs.readFileSync(full, 'utf8')) }) } catch { /* a damaged map maps nothing */ }
    }
  }
}
walk(path.resolve(mapsDir))

const text = reportPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(reportPath, 'utf8')
const report = JSON.parse(text)
const frames = Array.isArray(report.frames) ? report.frames.map(String) : []
const mapped = mapFrames(frames, maps)
console.log(JSON.stringify({ ...report, frames: mapped, mapped: mapped.filter((f, i) => f !== frames[i]).length }, null, 2))
