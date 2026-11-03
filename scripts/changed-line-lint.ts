import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { changedRanges, findingsInFiles } from './server-fact-gate-core'
import { lintFiles, lintSnapshot } from './server-fact-oxlint'

function git(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  })
}

function stagedDiffArgs(): string[] {
  try {
    return ['--cached', git(['rev-parse', '--verify', 'MERGE_HEAD']).trim()]
  } catch {
    return ['--cached']
  }
}

function diffArgs(argv: string[]): string[] {
  if (argv.includes('--staged')) return stagedDiffArgs()
  const baseIndex = argv.indexOf('--base')
  const base = baseIndex === -1 ? undefined : argv.at(baseIndex + 1)
  if (base === undefined) {
    console.error('Expected --base <ref> or --staged')
    process.exit(2)
  }
  return [git(['merge-base', base, 'HEAD']).trim()]
}

export function runChangedLineLint({
  name,
  config,
  isGatedPath,
  includeDeletions = false
}: {
  name: string
  config: string
  isGatedPath: (file: string) => boolean
  includeDeletions?: boolean
}) {
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
    [...changedRanges(diff)]
      .filter(([file]) => isGatedPath(file))
      .map(([file, ranges]) => [
        file,
        ranges.filter((range) => includeDeletions || range.kind === 'added')
      ])
  )
  const staged = process.argv.includes('--staged')
  const textOf = (file: string) =>
    staged ? git(['show', `:${file}`]) : readFileSync(file, 'utf8')
  const files = [...rangesByFile.keys()]
  const lint = staged
    ? lintSnapshot(new Map(files.map((file) => [file, textOf(file)])), config)
    : lintFiles(files, { cwd: process.cwd(), config })
  if (!lint.ok) {
    console.error(`${name}: ${lint.detail}`)
    process.exit(2)
  }

  const findings = findingsInFiles(rangesByFile, lint.diagnostics, textOf)

  for (const { filename, line, message } of findings) {
    console.error(`${filename}:${line} ${message}`)
  }
  if (findings.length > 0) process.exit(1)
  console.log(
    `${name}: no findings on changed lines in ${rangesByFile.size} file(s)`
  )
}
