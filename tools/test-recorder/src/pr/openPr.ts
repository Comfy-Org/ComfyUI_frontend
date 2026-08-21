import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import pc from 'picocolors'
import { copyToClipboard } from './clipboard'
import { checkGhAvailable, createPr } from './gh'
import { printManualInstructions } from './manual'
import { info } from '../ui/logger'

interface OpenPrOptions {
  testFilePath: string
  testName: string
  description: string
  projectRoot: string
}

async function fallBackToManualSteps(options: OpenPrOptions): Promise<void> {
  const copied = await copyToClipboard(
    readFileSync(options.testFilePath, 'utf-8')
  )
  if (!copied.ok) {
    info([
      'Could not copy to clipboard. File contents are at:',
      pc.cyan(options.testFilePath)
    ])
  }
  printManualInstructions({
    testFilePath: options.testFilePath,
    testName: options.testName,
    relativePath: relative(options.projectRoot, options.testFilePath)
      .split('\\')
      .join('/'),
    copiedToClipboard: copied.ok
  })
}

/** Opens a PR with gh, falling back to manual steps when that cannot work. */
export async function openPr(options: OpenPrOptions): Promise<void> {
  const gh = await checkGhAvailable()
  if (!gh.available || !gh.authenticated) {
    await fallBackToManualSteps(options)
    return
  }

  const created = await createPr({
    testFilePath: options.testFilePath,
    testName: options.testName,
    description: options.description,
    cwd: options.projectRoot
  })
  if (!created.success && created.needsManualSteps) {
    await fallBackToManualSteps(options)
  }
}
