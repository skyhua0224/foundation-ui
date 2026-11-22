// The parts of a host version for the 版本 tile, by information level: the date of the build is the hero (it is what makes a version newer or older), the build number and whatever follows it
// (「.杂鱼」, a commit, a channel) are the second line. A version is YYYY.MDD.HMMSS, unpadded (CI tag 2026.1103.21122) or zero-padded (a local build 2026.1112.025657) of up to 9 digits;
// manual-YYYYMMDD-HHMMSS[-dev] is a build from a person's machine. The same rules as the Panel's version_compare.rs and the host's version_compare.h: anything after the third part never takes part
// in a comparison, so it never takes the hero's room. A text that is none of these is shown as it is (the tile shrinks it to fit).
const DATE = /^(\d{4})\.(\d{1,4})\.(\d{1,9})(?:[\s.\-_·]*(.*))?$/
const MANUAL = /^manual-(\d{4})(\d{2})(\d{2})-(\d{6})(?:-(.+))?$/i

/** { main: ['2026.', '1116'] | [text], build: '.22909', rest: '杂鱼', sub: '.22909 · 杂鱼', key: [y, md, build] | null }: the build number goes small after the hero's second line, what follows it is a line of its own */
export function versionParts(raw) {
  const v = String(raw ?? '').trim().replace(/^v(?=\d|manual)/i, '')
  let m = DATE.exec(v)
  if (m) {
    const rest = String(m[4] || '').trim()
    return { main: [`${m[1]}.`, m[2]], build: `.${m[3]}`, rest, sub: [`.${m[3]}`, rest].filter(Boolean).join(' · '), key: [+m[1], +m[2], +m[3]] }
  }
  m = MANUAL.exec(v)
  if (m) { const rest = ['manual', m[4], m[5]].filter(Boolean).join(' · '); return { main: [`${m[1]}.`, `${m[2]}${m[3]}`], build: '', rest, sub: rest, key: [+m[1], +(m[2] + m[3]), +m[4]] } }
  return { main: [v], build: '', rest: '', sub: '', key: null }
}

/** Whether a text is a version (the Panel's update field is a label like 「有更新」, a catalogue's is a version). */
export const isVersionLike = (text) => versionParts(text).key !== null
