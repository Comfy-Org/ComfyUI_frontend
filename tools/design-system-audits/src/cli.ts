import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { applyFindings, findInheritedClasses } from './inheritedClasses'
import type { Finding } from './inheritedClasses'

const SOURCE_ROOTS = ['src', 'apps/billing-web', 'packages']

function readProject(repoRoot: string) {
  const listed = execFileSync(
    'git',
    ['ls-files', '--', ...SOURCE_ROOTS, 'components.d.ts'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28 }
  )
  const files = listed
    .split('\n')
    .filter((file) => /\.(vue|css|ts)$/.test(file))
    .filter((file) => !file.endsWith('.d.ts') || file === 'components.d.ts')
  return new Map(
    files.map((file) => [file, readFileSync(path.join(repoRoot, file), 'utf8')])
  )
}

function groupByFile(findings: Finding[]) {
  const byFile = new Map<string, Finding[]>()
  for (const finding of findings)
    byFile.set(finding.file, [...(byFile.get(finding.file) ?? []), finding])
  return byFile
}

function formatFinding({ file, line, tag, tokens }: Finding) {
  return `${file}:${line}\t<${tag}>\t${tokens.join(' ')}\n`
}

function removeFindings(
  repoRoot: string,
  files: ReadonlyMap<string, string>,
  byFile: ReadonlyMap<string, Finding[]>
) {
  for (const [file, list] of byFile)
    writeFileSync(
      path.join(repoRoot, file),
      applyFindings(files.get(file)!, list)
    )
}

function summarize(findings: Finding[], fileCount: number, write: boolean) {
  const count = findings.reduce((sum, f) => sum + f.tokens.length, 0)
  const suffix = write ? ' removed' : ''
  return `${count} inherited classes in ${fileCount} files${suffix}\n`
}

function main(args: string[], repoRoot: string) {
  const write = args.includes('--write')
  const files = readProject(repoRoot)
  const findings = findInheritedClasses(files)
  process.stdout.write(findings.map(formatFinding).join(''))
  const counted = write ? findings.filter((finding) => finding.edit) : findings
  const byFile = groupByFile(counted)
  if (write) removeFindings(repoRoot, files, byFile)
  process.stdout.write(summarize(counted, byFile.size, write))
}

if (import.meta.main)
  main(process.argv.slice(2), path.resolve(import.meta.dirname, '../../..'))
