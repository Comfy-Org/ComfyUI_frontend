import { runCommand } from '../cli/run'

/** Formats a generated file so it lands satisfying the format gate. */
export function formatFile(filePath: string): boolean {
  const result = runCommand('pnpm', ['exec', 'oxfmt', filePath], {
    stdio: 'ignore'
  })
  return result.status === 0
}
