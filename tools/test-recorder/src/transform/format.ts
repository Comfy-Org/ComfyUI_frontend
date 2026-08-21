import { runCommand } from '../cli/run'

/**
 * Run the repo formatter over a generated file so it lands already
 * satisfying the format gate.
 */
export function formatFile(filePath: string): boolean {
  const result = runCommand('pnpm', ['exec', 'oxfmt', filePath], {
    stdio: 'ignore'
  })
  return result.status === 0
}
