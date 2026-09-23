import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'

import { isEslintFile } from './eslintScope'

const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')
const eslintEntry = path.resolve('node_modules/eslint/bin/eslint.js')

const files = execFileSync(
  'git',
  ['diff', '--name-only', '-z', '--diff-filter=ACMR', 'HEAD'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter((file) => /\.(?:js|ts|tsx|vue|mts)$/.test(file))
const eslintFiles = files.filter(isEslintFile)

if (files.length > 0) {
  const fix = process.argv.includes('--fix') ? ['--fix'] : []
  const oxlintStatus = run(oxlintEntry, ['--type-aware', ...fix, ...files])
  const eslintStatus =
    eslintFiles.length > 0
      ? run(eslintEntry, ['--cache', ...fix, ...eslintFiles])
      : 0
  process.exit(Math.max(oxlintStatus, eslintStatus))
}

function run(entry: string, args: string[]): number {
  const result = spawnSync(process.execPath, [entry, ...args], {
    stdio: 'inherit',
    windowsHide: true
  })
  if (result.error) throw result.error
  return result.status ?? 1
}
