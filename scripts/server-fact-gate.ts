import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import {
  changedRanges,
  findingsInFiles,
  isGatedPath
} from './server-fact-gate-core'
import { SERVER_FACT_CONFIG, lintServerFacts } from './server-fact-oxlint'

function git(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  })
}

function diffArgs(argv: string[]): string[] {
  if (argv.includes('--staged')) return ['--cached']
  const baseIndex = argv.indexOf('--base')
  const base = baseIndex === -1 ? undefined : argv.at(baseIndex + 1)
  if (base === undefined) {
    console.error('Usage: server-fact-gate (--base <ref> | --staged)')
    process.exit(2)
  }
  return [git(['merge-base', base, 'HEAD']).trim()]
}

const diff = git([
  '-c',
  'core.quotePath=false',
  'diff',
  '-U0',
  '--no-color',
  '--no-ext-diff',
  '--diff-filter=ACMR',
  ...diffArgs(process.argv.slice(2))
])
const rangesByFile = new Map(
  [...changedRanges(diff)].filter(([file]) => isGatedPath(file))
)
const lint = lintServerFacts([...rangesByFile.keys()], {
  cwd: process.cwd(),
  config: SERVER_FACT_CONFIG
})
if (!lint.ok) {
  console.error(`server-facts: ${lint.detail}`)
  process.exit(2)
}

const findings = findingsInFiles(rangesByFile, lint.diagnostics, (file) =>
  readFileSync(file, 'utf8')
)

for (const { filename, line, message } of findings) {
  console.error(`${filename}:${line} ${message}`)
}
if (findings.length > 0) process.exit(1)
console.log(
  `server-facts: no findings on changed lines in ${rangesByFile.size} file(s)`
)
