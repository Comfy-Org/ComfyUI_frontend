// @vitest-environment jsdom
// happy-dom (the repo default) resolves @playwright/test's absolute import
// against http://localhost:3000 and dumps an unhandled ECONNREFUSED.
import type { PlaywrightTestConfig } from '@playwright/test'
import { describe, expect, it, vi } from 'vitest'

// The cloud env seeds a real Firebase session, and page.evaluate arguments are
// recorded verbatim in a trace that CI uploads as a public artifact. Tracing
// must therefore be off under CUSTOM_NODES_ENV=cloud - the one invariant in
// this suite whose failure leaks a credential rather than reddening a test.
async function customNodesTrace(
  customNodesEnv: string | undefined
): Promise<unknown> {
  vi.resetModules()
  vi.stubEnv('CUSTOM_NODES_ENV', customNodesEnv)
  try {
    const config = (await import('../playwright.config')).default
    const project = config.projects?.find(
      (candidate) => candidate.name === 'custom-nodes'
    )
    if (!project) throw new Error('custom-nodes project is gone')
    return (project.use as PlaywrightTestConfig['use'])?.trace
  } finally {
    vi.unstubAllEnvs()
  }
}

describe('custom-nodes Playwright tracing', () => {
  it('is off under the cloud env, so a seeded session cannot reach an artifact', async () => {
    expect(await customNodesTrace('cloud')).toBe('off')
  })

  it('is retained on failure everywhere else, so a red core run stays debuggable', async () => {
    expect(await customNodesTrace(undefined)).toBe('retain-on-failure')
    expect(await customNodesTrace('core')).toBe('retain-on-failure')
  })
})
