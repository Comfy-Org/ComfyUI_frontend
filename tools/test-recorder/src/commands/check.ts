import { checkBackend } from '../checks/backend'
import { checkDevServer } from '../checks/devServer'
import { checkGh } from '../checks/gh'
import { checkGit } from '../checks/git'
import { checkModels } from '../checks/models'
import { checkNode } from '../checks/node'
import { checkPlatform } from '../checks/platform'
import { checkPlaywright } from '../checks/playwright'
import { checkPnpm } from '../checks/pnpm'
import { checkPython } from '../checks/python'
import type { CheckResult } from '../checks/types'
import { checkXcode } from '../checks/xcode'
import type { Distribution } from '../devserver/distributions'
import { fetchEnvInfo } from '../devserver/envInfo'
import { findProjectRoot } from '../recorder/runner'
import { alert, header, pass, info } from '../ui/logger'

export async function runChecks(
  distribution: Distribution,
  projectRoot?: string,
  options: { showHeader?: boolean } = {}
): Promise<{
  results: CheckResult[]
  allPassed: boolean
}> {
  if (options.showHeader !== false) header('Environment Check')

  if (distribution.backendUrl && distribution.id !== 'local') {
    const env = await fetchEnvInfo(distribution.backendUrl)
    if (env.ok) {
      info([
        `${env.deployEnvironment}: backend ${env.cloudVersion}, ComfyUI ${env.comfyuiVersion}`
      ])
    } else {
      info(['Environment version information is currently unavailable.'])
    }
  }

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

  if (distribution.needsLocalBackend) {
    results.push(await checkBackend())
    results.push(await checkModels())
  } else {
    pass('Backend', 'skipped (cloud backend)')
    pass('Models', 'skipped (cloud backend)')
  }
  results.push(await checkDevServer(undefined, root, distribution.script))

  const requiredFailed = results.filter((r) => !r.ok && !r.optional)

  // Each failure already printed a one-line `fail()` as it ran, but across
  // ~10 checks that line scrolls off screen. Re-surface every blocking
  // failure loudly, right before control returns to the caller.
  for (const result of requiredFailed) {
    alert(`${result.name} must be fixed before recording`, [
      ...(result.installInstructions ?? []),
      '',
      'The rest of the flow is blocked until this is resolved.'
    ])
  }

  return { results, allPassed: requiredFailed.length === 0 }
}
