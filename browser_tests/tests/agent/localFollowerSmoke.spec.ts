import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  attachCanvasScreenshot,
  bindActiveWorkflow,
  localFollowerHealthSchema,
  localFollowerInjectionSchema,
  openLocalAgentPanel
} from '@e2e/fixtures/localFollowerHarnessFixture'

const COMFY_URL = 'http://127.0.0.1:8188'
const FOLLOWER_URL = 'http://127.0.0.1:6255'
const INJECTOR_URL = 'http://127.0.0.1:8199'
const WORKFLOW_ID = 'wf-e2e-local'
const NODE_ID = 970001

test.describe('Local-product follower smoke', { tag: '@local-agent' }, () => {
  test('real applier update visibly changes the canvas', async ({
    comfyPage
  }, testInfo) => {
    const { page } = comfyPage
    const token = process.env.HARNESS_INJECT_TOKEN
    expect(token, 'HARNESS_INJECT_TOKEN must match the injector').toBeTruthy()
    expect(
      comfyPage.url,
      'PLAYWRIGHT_TEST_URL must target the governed follower on :6255'
    ).toBe(FOLLOWER_URL)

    const [comfy, follower, health] = await Promise.all([
      fetch(`${COMFY_URL}/system_stats`),
      fetch(`${FOLLOWER_URL}/`),
      fetch(`${INJECTOR_URL}/__health`)
    ])
    expect(comfy.ok, 'ComfyUI must answer on :8188').toBe(true)
    expect(follower.ok, 'follower Vite must answer on :6255').toBe(true)
    expect(health.ok, 'injector must answer on :8199').toBe(true)
    const identity = localFollowerHealthSchema.parse(await health.json())
    expect(identity.harness).toBe('local-follower-e2e-injector')

    const before = await page.evaluate(() => window.app!.graph._nodes.length)
    await attachCanvasScreenshot(page, testInfo, 'local-follower-before')

    const panelOpened = await openLocalAgentPanel(page)
    expect(panelOpened).toBe(true)
    await expect(page.getByTestId('docked-agent-panel')).toBeVisible()

    const bound = await bindActiveWorkflow(page, WORKFLOW_ID)
    expect(bound, 'active workflow must bind before injection').toBe(true)

    const response = await fetch(
      `${INJECTOR_URL}/__inject?workflow_id=${WORKFLOW_ID}&type=PreviewImage`,
      { headers: { authorization: `Bearer ${token}` } }
    )
    expect(response.ok, 'injector rejected the mutation').toBe(true)
    const injected = localFollowerInjectionSchema.parse(await response.json())
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
    await comfyPage.nextFrame()
    const after = await page.evaluate(() => window.app!.graph._nodes.length)
    expect(after).toBe(before + 1)
    await attachCanvasScreenshot(page, testInfo, 'local-follower-after')
  })
})
