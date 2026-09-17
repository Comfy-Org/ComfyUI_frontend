import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expectLargeWorkflowLandmarksPainted } from '@e2e/fixtures/utils/largeWorkflowPaintProof'

test.describe(
  'Large workflow readiness',
  { tag: ['@workflow', '@smoke'] },
  () => {
    test('legacy canvas loads, navigates, and executes its CPU branch', async ({
      comfyPage
    }, testInfo) => {
      expect(
        await comfyPage.settings.getSetting<boolean>('Comfy.VueNodes.Enabled')
      ).toBe(false)
      await comfyPage.workflow.loadWorkflow(
        'ecs-qa-007-large-workflow-readiness'
      )

      const graphSummary = await comfyPage.page.evaluate(() => ({
        nodeCount: window.app!.graph.nodes.length,
        groupCount: window.app!.graph.groups.length,
        nodeTitles: window.app!.graph.nodes.map((node) => node.title),
        groupTitles: window.app!.graph.groups.map((group) => group.title),
        offset: [...window.app!.canvas.ds.offset]
      }))
      expect(graphSummary.nodeCount).toBe(247)
      expect(graphSummary.groupCount).toBe(3)
      expect(graphSummary.nodeTitles).toEqual(
        expect.arrayContaining(['CPU Output Input', 'CPU Output Landmark'])
      )
      expect(graphSummary.groupTitles).toEqual(
        expect.arrayContaining([
          'First Pipeline Landmark',
          'Middle Pipeline Landmark',
          'CPU Output Branch Landmark'
        ])
      )

      const paintedLandmarks = await expectLargeWorkflowLandmarksPainted(
        comfyPage.page
      )
      await testInfo.attach('painted-landmarks', {
        body: JSON.stringify(paintedLandmarks),
        contentType: 'application/json'
      })
      const canvasBox = await comfyPage.canvas.boundingBox()
      expect(canvasBox).not.toBeNull()
      if (!canvasBox) throw new Error('Canvas bounding box not available')
      const canvasCenter = {
        x: canvasBox.x + canvasBox.width / 2,
        y: canvasBox.y + canvasBox.height / 2
      }
      await comfyPage.page.mouse.move(canvasCenter.x, canvasCenter.y)
      await comfyPage.page.mouse.down({ button: 'middle' })
      await comfyPage.page.mouse.move(canvasCenter.x + 120, canvasCenter.y + 80)
      await comfyPage.page.mouse.up({ button: 'middle' })
      await comfyPage.nextFrame()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => [...window.app!.canvas.ds.offset])
        )
        .not.toEqual(graphSummary.offset)

      const initialScale = await comfyPage.canvasOps.getScale()
      await comfyPage.page.mouse.move(canvasCenter.x, canvasCenter.y)
      await comfyPage.page.mouse.wheel(0, -100)
      await comfyPage.nextFrame()
      await expect
        .poll(() => comfyPage.canvasOps.getScale())
        .toBeGreaterThan(initialScale)

      const output = await comfyPage.nodeOps.getNodeRefById(247)
      expect(await (await output.getWidget(0)).getValue()).not.toBe(
        'large-workflow-ready'
      )

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      await expect
        .poll(async () => (await output.getWidget(0)).getValue(), {
          timeout: 10_000
        })
        .toBe('large-workflow-ready')
    })
  }
)
