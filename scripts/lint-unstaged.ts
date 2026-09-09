import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'

const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')
const eslintEntry = path.resolve('node_modules/eslint/bin/eslint.js')

const files = execFileSync(
  'git',
  ['diff', '--name-only', '-z', '--diff-filter=ACMR', 'HEAD'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter((file) => /\.(?:js|ts|tsx|vue|mts)$/.test(file))

if (files.length > 0) {
  const fix = process.argv.includes('--fix') ? ['--fix'] : []
  run(oxlintEntry, ['--type-aware', ...fix, ...files])
  run(eslintEntry, ['--cache', ...fix, ...files])
}

function run(entry: string, args: string[]) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    stdio: 'inherit',
    windowsHide: true
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
