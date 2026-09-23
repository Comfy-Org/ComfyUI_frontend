import { load3dAgentTest as test } from '@e2e/fixtures/load3dAgentFixture'
import { expect } from '@playwright/test'

test.describe('Load3D agent updates', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('retires an incompatible replacement link without blocking the next agent edit', async ({
    load3dAgent
  }) => {
    await load3dAgent.expectRenderedLinks([[9, '1', 0, '2', 0, 'IMAGE']])

    load3dAgent.replaceLinkWithIncompatibleTarget()
    await load3dAgent.expectRenderedLinks([])
    load3dAgent.expectHostLink([9, 1, 0, 3, 0, 'STRING'])

    load3dAgent.setModelFromAgent('cube.obj')
    await load3dAgent.expectModel('cube.obj')
    await expect(load3dAgent.viewer.node).toBeVisible()
  })

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

    const after =
      await test.step('queue after the agent replacement finishes loading', async () => {
        load3dAgent.setModelFromAgent('workflow.glb')
        await load3dAgent.expectModel('workflow.glb')
        await load3dAgent.viewer.waitForModelLoaded()
        return load3dAgent.capture()
      })

    await test.step('the prompt carries the replacement model', async () => {
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
