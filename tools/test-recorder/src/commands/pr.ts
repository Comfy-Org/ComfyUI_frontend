import { existsSync, readFileSync } from 'node:fs'
import { basename, isAbsolute, join, relative } from 'node:path'
import pc from 'picocolors'
import { findProjectRoot } from '../recorder/runner'
import { checkGhAvailable, createPr } from '../pr/gh'
import { printManualInstructions } from '../pr/manual'
import { copyToClipboard } from '../pr/clipboard'
import { header, info } from '../ui/logger'

/**
 * Opens a PR for a spec that was already generated — the follow-up path when
 * `record` could not prompt, or when someone comes back to it later.
 */
export async function runPr(
  filePath: string,
  description?: string
): Promise<void> {
  header('Create Pull Request')

  const projectRoot = findProjectRoot()
  const absolute = isAbsolute(filePath)
    ? filePath
    : join(process.cwd(), filePath)

  if (!existsSync(absolute)) {
    console.log(pc.red(`  No such file: ${absolute}`))
    process.exit(1)
  }

  const testName = basename(absolute).replace(/\.spec\.ts$/, '')

  const gh = await checkGhAvailable()
  if (gh.available && gh.authenticated) {
    await createPr({
      testFilePath: absolute,
      testName,
      description: description ?? `Adds the ${testName} browser test.`
    })
    return
  }

  const copied = await copyToClipboard(readFileSync(absolute, 'utf-8'))
  if (!copied.ok) {
    info([
      'Could not copy to clipboard. File contents are at:',
      pc.cyan(absolute)
    ])
  }
  printManualInstructions({
    testFilePath: absolute,
    testName,
    relativePath: relative(projectRoot, absolute).split('\\').join('/')
  })
}
