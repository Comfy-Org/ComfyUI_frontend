import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const COMFY_URL = 'http://127.0.0.1:8188'
const FOLLOWER_URL = 'http://127.0.0.1:5175'
const INJECTOR_URL = 'http://127.0.0.1:8199'
const WORKFLOW_ID = 'wf-e2e-local'
const NODE_ID = 970001

interface HarnessHealth {
  harness: string
  upstream?: string
}

interface InjectResult {
  applied: boolean
  delivered: number
  node_id: number
  projected_nodes: number
  update_bytes: number
}

interface HarnessStore {
  activeWorkflow?: { path?: string }
  bind?: (workflowId: string, path: string) => void
  enabled?: boolean
  isOpen?: boolean
  workflowIdFor?: (path: string) => string | undefined
}

interface HarnessPinia {
  _s: Map<string, HarnessStore>
}

interface HarnessVueApp {
  config: { globalProperties: { $pinia?: HarnessPinia } }
}

test.describe('Local-product follower smoke', { tag: '@local-agent' }, () => {
  test('real applier update visibly changes the canvas', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const token = process.env.HARNESS_INJECT_TOKEN
    expect(token, 'HARNESS_INJECT_TOKEN must match the injector').toBeTruthy()

    const [comfy, follower, health] = await Promise.all([
      fetch(`${COMFY_URL}/system_stats`),
      fetch(`${FOLLOWER_URL}/`),
      fetch(`${INJECTOR_URL}/__health`)
    ])
    expect(comfy.ok, 'ComfyUI must answer on :8188').toBe(true)
    expect(follower.ok, 'follower Vite must answer on :5175').toBe(true)
    expect(health.ok, 'injector must answer on :8199').toBe(true)
    const identity: HarnessHealth = await health.json()
    expect(identity.harness).toBe('local-follower-e2e-injector')

    const before = await page.evaluate(() => window.app!.graph._nodes.length)
    await expect(page.locator('#graph-canvas')).toHaveScreenshot(
      'local-follower-before.png'
    )

    const panelOpened = await page.evaluate(() => {
      const root = document.getElementById('vue-app') as HTMLElement & {
        __vue_app__?: HarnessVueApp
      }
      const store =
        root.__vue_app__?.config.globalProperties.$pinia?._s.get('agentPanel')
      if (!store) return false
      store.enabled = true
      store.isOpen = true
      return true
    })
    expect(panelOpened).toBe(true)
    await expect(page.getByTestId('docked-agent-panel')).toBeVisible()

    const bound = await page.evaluate((workflowId) => {
      const root = document.getElementById('vue-app') as HTMLElement & {
        __vue_app__?: HarnessVueApp
      }
      const stores = root.__vue_app__?.config.globalProperties.$pinia?._s
      const binding = stores?.get('agentWorkflowTabBinding')
      const path = stores?.get('workflow')?.activeWorkflow?.path
      if (!binding?.bind || typeof path !== 'string') return false
      binding.bind(workflowId, path)
      return binding.workflowIdFor?.(path) === workflowId
    }, WORKFLOW_ID)
    expect(bound, 'active workflow must bind before injection').toBe(true)

    const response = await fetch(
      `${INJECTOR_URL}/__inject?workflow_id=${WORKFLOW_ID}&type=PreviewImage`,
      { headers: { authorization: `Bearer ${token}` } }
    )
    expect(response.ok, 'injector rejected the mutation').toBe(true)
    const injected: InjectResult = await response.json()
    expect(injected).toMatchObject({
      applied: true,
      node_id: NODE_ID,
      projected_nodes: 1
    })
    expect(injected.delivered).toBeGreaterThanOrEqual(1)
    expect(injected.update_bytes).toBeGreaterThanOrEqual(150)

    await expect
      .poll(
        () =>
          page.evaluate(
            (nodeId) =>
              window.app!.graph._nodes.some(
                (node) => Number(node.id) === nodeId
              ),
            NODE_ID
          ),
        { timeout: 15000 }
      )
      .toBe(true)
    const after = await page.evaluate(() => window.app!.graph._nodes.length)
    expect(after).toBe(before + 1)
    await expect(page.locator('#graph-canvas')).toHaveScreenshot(
      'local-follower-after.png'
    )
  })
})
