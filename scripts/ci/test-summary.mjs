// Turns the spec reporter output of one test shard into PR annotations and a job summary.
// The runner options that this reads (the final "failing tests" block of --test-reporter=spec) are
// documented at https://nodejs.org/api/test.html#spec-reporter; annotations are the workflow command
// form documented at https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions.
// Usage: node scripts/ci/test-summary.mjs <runner log> <label>
import fs from 'node:fs'

const [log = '', label = 'tests'] = process.argv.slice(2)
const text = log && fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''
const start = text.lastIndexOf('✖ failing tests:')
const section = start === -1 ? '' : text.slice(start)

const failures = []
let current = null
for (const line of section.split('\n')) {
  const at = line.match(/^test at (.+):(\d+):(\d+)$/)
  if (at) { current = { file: at[1], line: at[2], column: at[3], name: '' }; failures.push(current); continue }
  const name = line.match(/^✖ (.*?)(?: \(\d+(?:\.\d+)?ms\))?$/)
  if (name && current && !current.name) current.name = name[1]
}

const escapeData = (s) => String(s).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
const escapeProp = (s) => escapeData(s).replaceAll(':', '%3A').replaceAll(',', '%2C')

const lines = []
if (failures.length) {
  for (const f of failures) {
    console.log(`::error file=${escapeProp(f.file)},line=${f.line},col=${f.column}::${escapeData(f.name || 'test failed')}`)
  }
  lines.push(`### ${label}: ${failures.length} failing test${failures.length === 1 ? '' : 's'}`, '', '| file | test |', '| --- | --- |')
  for (const f of failures) lines.push(`| \`${f.file}:${f.line}\` | ${(f.name || 'test failed').replaceAll('|', '\\|')} |`)
} else {
  lines.push(`### ${label}`, '', 'No failing test names could be read from the runner log; see the steps above for the error.')
}
lines.push('')

if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'))
else console.log(lines.join('\n'))
