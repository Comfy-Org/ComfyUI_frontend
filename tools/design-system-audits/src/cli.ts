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

function main(args: string[], repoRoot: string) {
  const write = args.includes('--write')
  const files = readProject(repoRoot)
  const findings = findInheritedClasses(files)
  const byFile = new Map<string, Finding[]>()
  for (const finding of findings)
    byFile.set(finding.file, [...(byFile.get(finding.file) ?? []), finding])
  for (const finding of findings)
    process.stdout.write(
      `${finding.file}:${finding.line}\t<${finding.tag}>\t${finding.tokens.join(' ')}\n`
    )
  if (write)
    for (const [file, list] of byFile)
      writeFileSync(
        path.join(repoRoot, file),
        applyFindings(files.get(file)!, list)
      )
  const count = findings.reduce((sum, f) => sum + f.tokens.length, 0)
  process.stdout.write(
    `${count} inherited classes in ${byFile.size} files${write ? ' removed' : ''}\n`
  )
}

if (import.meta.main)
  main(process.argv.slice(2), path.resolve(import.meta.dirname, '../../..'))
