import { appendFileSync } from 'node:fs'

/**
 * Writes one step output, falling back to stdout so a script stays runnable
 * outside Actions. Values here are shas, run ids and booleans; a value that
 * could contain a newline would need the heredoc form instead.
 */
export function setOutput(name: string, value: string) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) {
    process.stdout.write(`${name}=${value}\n`)
    return
  }
  appendFileSync(file, `${name}=${value}\n`)
}
