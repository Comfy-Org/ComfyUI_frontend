import { findProjectRoot } from '../recorder/runner'
import { checkPlatform } from '../checks/platform'
import { checkXcode } from '../checks/xcode'
import { checkGit } from '../checks/git'
import { checkNode } from '../checks/node'
import { checkPnpm } from '../checks/pnpm'
import { checkPython } from '../checks/python'
import { checkPlaywright } from '../checks/playwright'
import { checkGh } from '../checks/gh'
import { checkDevServer } from '../checks/devServer'
import { checkBackend } from '../checks/backend'
import { checkModels } from '../checks/models'
import { header } from '../ui/logger'
import type { CheckResult } from '../checks/types'

export async function runChecks(
  projectRoot?: string,
  options: { showHeader?: boolean } = {}
): Promise<{
  results: CheckResult[]
  allPassed: boolean
}> {
  if (options.showHeader !== false) header('Environment Check')

  let root = projectRoot
  if (!root) {
    try {
      root = findProjectRoot()
    } catch {
      // Outside the repo the dev-server identity probe is skipped.
    }
  }

  const results: CheckResult[] = []

  results.push(checkPlatform())
  results.push(await checkXcode())
  results.push(await checkGit())
  results.push(await checkNode())
  results.push(await checkPnpm())
  results.push(await checkPython())
  results.push(await checkPlaywright())
  results.push(await checkGh())

  header('Services Check')

  results.push(await checkBackend())
  results.push(await checkModels())
  results.push(await checkDevServer(undefined, root))

  const requiredFailed = results.filter((r) => !r.ok && !r.optional)
  return { results, allPassed: requiredFailed.length === 0 }
}
