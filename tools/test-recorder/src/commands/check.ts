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
import { header } from '../ui/logger'
import type { CheckResult } from '../checks/types'

export async function runChecks(): Promise<{
  results: CheckResult[]
  allPassed: boolean
}> {
  header('Environment Check')

  const results: CheckResult[] = []

  // System checks (sequential — each depends on prior)
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
  results.push(await checkDevServer())

  const requiredFailed = results.filter((r) => !r.ok && !r.optional)
  return { results, allPassed: requiredFailed.length === 0 }
}
