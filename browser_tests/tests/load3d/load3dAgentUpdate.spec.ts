import { expect } from '@playwright/test'

import type { Load3dCapture } from '@e2e/fixtures/load3dAgentFixture'
import { load3dAgentTest as test } from '@e2e/fixtures/load3dAgentFixture'

test.describe('Load3D agent updates', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('an agent model_file update refreshes the viewer and capture cache', async ({
    load3dAgent
  }) => {
    const { viewer } = load3dAgent

    const before =
      await test.step('capture the initial agent model', async () => {
        load3dAgent.setModelFromAgent('cube.obj')
        await load3dAgent.expectModel('cube.obj')
        await viewer.waitForModelLoaded()
        return load3dAgent.capture()
      })

    const heldPrompt =
      await test.step('hold the replacement model while the agent swaps it in', async () => {
        const release = load3dAgent.holdModel('workflow.glb')
        load3dAgent.setModelFromAgent('workflow.glb')
        await load3dAgent.expectModel('workflow.glb')
        await expect(load3dAgent.loadingOverlay).toBeVisible()
        const heldPrompt = load3dAgent.queuePrompt()
        release()
        return heldPrompt
      })

    await test.step('the held prompt carries the replacement model', async () => {
      await viewer.waitForModelLoaded()
      const after: Load3dCapture = await load3dAgent.captureFor(heldPrompt)
      expect(after.promptImage).not.toBe(before.promptImage)
      expect(after.imageBytes.byteLength).toBeGreaterThan(0)
      expect(after.imageBytes).not.toEqual(before.imageBytes)
      await expect(viewer.canvas).toBeVisible()
      await test.info().attach('agent-updated-load3d.png', {
        body: await viewer.node.screenshot(),
        contentType: 'image/png'
      })
    })
  })
})
