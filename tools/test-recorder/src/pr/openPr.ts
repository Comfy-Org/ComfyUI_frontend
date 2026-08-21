import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { confirm, isCancel } from '@clack/prompts'
import pc from 'picocolors'
import { copyToClipboard } from './clipboard'
import { checkGhAvailable, createPr, switchBranch } from './gh'
import { printManualInstructions } from './manual'
import { info, warn } from '../ui/logger'

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
  if (!created.success) {
    if (created.needsManualSteps) {
      await fallBackToManualSteps(options)
    }
    return
  }

  if (created.originalBranch && created.currentBranch) {
    const goBack = await confirm({
      message: `Switch back to ${created.originalBranch}?`,
      initialValue: true
    })
    if (!isCancel(goBack) && goBack) {
      const switched = switchBranch(created.originalBranch, {
        cwd: options.projectRoot
      })
      if (!switched.success) {
        warn(
          `Could not switch back to ${created.originalBranch}`,
          switched.error
        )
        info([
          `You're still on ${created.currentBranch} — switch manually:`,
          '',
          `  git checkout ${created.originalBranch}`
        ])
      }
    }
  }
}
