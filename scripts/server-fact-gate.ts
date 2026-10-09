import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  changedRanges,
  findingsOnChangedLines,
  isGatedPath,
  oxlintReportSchema
} from './server-fact-gate-core'

const CONFIG = 'tools/oxlint-plugins/serverFacts.oxlintrc.json'
const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')

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

function lint(files: string[]) {
  const result = spawnSync(
    process.execPath,
    [oxlintEntry, '-c', CONFIG, '--format', 'json', ...files],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true }
  )
  if (result.error) throw result.error
  const report: unknown = JSON.parse(result.stdout)
  return oxlintReportSchema.parse(report).diagnostics
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
const files = [...rangesByFile.keys()]
const diagnostics = files.length === 0 ? [] : lint(files)

const findings = files.flatMap((file) =>
  findingsOnChangedLines(
    diagnostics.filter((diagnostic) => diagnostic.filename === file),
    rangesByFile.get(file) ?? [],
    readFileSync(file, 'utf8')
  )
)

for (const { filename, line, message } of findings) {
  console.error(`${filename}:${line} ${message}`)
}
if (findings.length > 0) process.exit(1)
console.log(
  `server-facts: no findings on changed lines in ${files.length} file(s)`
)
