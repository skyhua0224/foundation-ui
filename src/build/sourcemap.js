// Source Map Revision 3 (ECMA-426, https://tc39.es/ecma426/) reading, no dependency: enough to turn a position of a minified bundle into the line of the original source.
//
// A map is {version: 3, sources: [...], names: [...], mappings: "AAAA,SAAS;..."}: `mappings` is generated lines separated by ';', segments separated by ',', and each segment is 1, 4 or 5
// base64-VLQ numbers, relative to the previous segment (the generated column restarts at 0 on every line): generated column, source index, original line, original column, name index.
// Lines and columns inside a map are 0-based; a stack frame (V8) is 1-based, which is the only conversion here.
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const DIGIT = new Map([...BASE64].map((c, i) => [c, i]))

/** The numbers of one segment ("AAgBC" -> [0, 0, 16, 1]). Throws on a character outside the base64 alphabet or a truncated number. */
export function decodeVlq(text) {
  const out = []
  let value = 0
  let shift = 0
  for (const ch of text) {
    const digit = DIGIT.get(ch)
    if (digit === undefined) throw new Error(`not a base64 VLQ character: ${JSON.stringify(ch)}`)
    value += (digit & 31) * 2 ** shift
    if (digit & 32) { shift += 5; continue }
    out.push(value % 2 === 1 ? -(value - 1) / 2 : value / 2)
    value = 0
    shift = 0
  }
  if (shift !== 0) throw new Error('truncated VLQ number')
  return out
}

/** The segments of a map as [line][i] = {column, source, line, col}; segments of one number (no source) are kept as {column} only. */
export function decodeMappings(mappings) {
  const lines = []
  let source = 0
  let origLine = 0
  let origCol = 0
  for (const lineText of String(mappings).split(';')) {
    const segments = []
    let column = 0
    if (lineText) {
      for (const part of lineText.split(',')) {
        const n = decodeVlq(part)
        if (n.length !== 1 && n.length !== 4 && n.length !== 5) throw new Error(`a segment has ${n.length} fields`)
        column += n[0]
        if (n.length === 1) { segments.push({ column }); continue }
        source += n[1]
        origLine += n[2]
        origCol += n[3]
        segments.push({ column, source, line: origLine, col: origCol })
      }
    }
    lines.push(segments)
  }
  return lines
}

/** A map made ready for lookups. Index maps (sections) and anything but version 3 are refused. */
export function loadMap(json) {
  const map = typeof json === 'string' ? JSON.parse(json) : json
  if (!map || map.version !== 3 || !Array.isArray(map.sources) || typeof map.mappings !== 'string') throw new Error('not a source map of version 3')
  return { sources: map.sources, sourceRoot: map.sourceRoot || '', lines: decodeMappings(map.mappings) }
}

/** The original position of a generated one (1-based line, 0-based column like V8 stack frames report after -1; pass what the frame says and `columnBase`), or null. */
export function originalPosition(map, line, column, { columnBase = 1 } = {}) {
  const segments = map.lines[line - 1]
  if (!segments?.length) return null
  const col = column - columnBase
  // the last segment that starts at or before the column
  let lo = 0
  let hi = segments.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segments[mid].column <= col) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  const seg = found >= 0 ? segments[found] : null
  if (!seg || seg.source === undefined) return null
  return { source: map.sources[seg.source], line: seg.line + 1, column: seg.col }
}

/** `../../src/foo/bar.vue`, `webpack://x/./src/a.js`, `/home/me/work/app/src/a.js` -> `src/foo/bar.vue`: from the first `src/` directory on, else the file name; never a drive or home directory. */
export function sourceLabel(source) {
  const clean = String(source).replace(/\\/g, '/').replace(/[?#].*$/, '')
  const at = clean.search(/(^|\/)src\//)
  const rel = at >= 0 ? clean.slice(at).replace(/^\//, '') : clean.split('/').pop()
  return rel.replace(/[^A-Za-z0-9_./@~+-]/g, '_').slice(0, 100)
}

/** The name of a bundle file without the content hash a build adds: `index-AbC123xy.js` -> `index.js` (the same rule as the page's stack mapping in telemetry/fingerprint.js). */
export const unhashed = (file) => String(file || '').replace(/[?#].*$/, '').split('/').pop().replace(/[-.][A-Za-z0-9_]{6,12}(?=\.(?:js|mjs|css)$)/, '').slice(0, 40)

/**
 * Map the frames of a report (`index.js:1:20345`, the form the page sends: the bundle name without its hash, line, column) to `src/file.vue:12`.
 * `maps` is [{file: 'index-AbC123xy.js', map}] of the release. Frames that match no map, or no segment, stay as they are. Several maps with the same unhashed name are tried in order.
 */
export function mapFrames(frames, maps) {
  const prepared = maps.map(({ file, map }) => ({ name: unhashed(file), map: map.lines ? map : loadMap(map) }))
  return frames.map((frame) => {
    const m = /^(.+?):(\d+):(\d+)$/.exec(frame)
    if (!m) return frame
    for (const candidate of prepared) {
      if (candidate.name !== unhashed(m[1])) continue
      const at = originalPosition(candidate.map, Number(m[2]), Number(m[3]))
      if (at) return `${sourceLabel(at.source)}:${at.line}`
    }
    return frame
  })
}
