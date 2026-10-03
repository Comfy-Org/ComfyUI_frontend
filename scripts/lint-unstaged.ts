import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'

import { isEslintFile } from './eslintScope'

const require = createRequire(import.meta.url)
const qualityEntry = path.join(
  path.dirname(require.resolve('@comfyorg/code-quality/package.json')),
  'dist/cli.js'
)

const changedFiles = execFileSync(
  'git',
  ['diff', '--name-only', '-z', '--diff-filter=ACMR', 'HEAD'],
  { encoding: 'utf8' }
).split('\0')
const oxlintFiles = changedFiles.filter((file) =>
  /\.(?:js|ts|tsx|vue|mts)$/.test(file)
)
const eslintFiles = changedFiles.filter(isEslintFile)

if (oxlintFiles.length > 0 || eslintFiles.length > 0) {
  const fix = process.argv.includes('--fix') ? ['--fix'] : []
  const oxlintStatus =
    oxlintFiles.length > 0
      ? run('oxlint', ['--type-aware', ...fix, ...oxlintFiles])
      : 0
  const eslintStatus =
    eslintFiles.length > 0
      ? run('eslint', ['--cache', ...fix, ...eslintFiles])
      : 0
  process.exit(Math.max(oxlintStatus, eslintStatus))
}

function run(tool: 'oxlint' | 'eslint', args: string[]): number {
  const result = spawnSync(
    process.execPath,
    [qualityEntry, 'exec', tool, ...args],
    {
      stdio: 'inherit',
      windowsHide: true
    }
  )
  if (result.error) throw result.error
  return result.status ?? 1
}
