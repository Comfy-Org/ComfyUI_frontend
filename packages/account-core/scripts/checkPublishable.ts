/**
 * Per-package CI entry point for the publishable rules:
 * `pnpm -C packages/account-core run check:pack <package directory>`.
 * The smoke test applies the same rules to every tarball it installs; this
 * checks one package without installing anything.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { packPublishable } from './packPublishable'
import { formatViolations } from './publishableTarball'

function main(): void {
  const [target] = process.argv.slice(2)
  if (!target) {
    throw new Error('usage: checkPublishable <package directory>')
  }
  const destination = mkdtempSync(join(tmpdir(), 'comfyorg-check-pack-'))
  try {
    const { manifest, files, violations } = packPublishable(
      resolve(target),
      destination
    )
    if (violations.length > 0) {
      const annotate = process.env.GITHUB_ACTIONS === 'true'
      process.stderr.write(`${formatViolations(violations, { annotate })}\n`)
      process.exitCode = 1
      return
    }
    process.stdout.write(
      `${manifest.name}: ${files.length} packed files are publishable\n`
    )
  } finally {
    rmSync(destination, { recursive: true, force: true })
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
