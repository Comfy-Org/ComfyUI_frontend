import { execFileSync, spawnSync } from 'node:child_process'

const files = execFileSync(
  'git',
  ['diff', '--name-only', '-z', '--diff-filter=ACMR', 'HEAD'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter((file) => /\.(?:js|ts|tsx|vue|mts)$/.test(file))
if (files.length > 0) {
  const fix = process.argv.includes('--fix') ? ['--fix'] : []
  run('oxlint', ['--type-aware', ...fix, ...files])
  run('eslint', ['--cache', ...fix, ...files])
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
