import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expectLargeWorkflowLandmarkTitlesPainted } from '@e2e/fixtures/utils/largeWorkflowPaintProof'

test.describe(
  'Large workflow readiness',
  { tag: ['@workflow', '@smoke'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('legacy canvas loads, navigates, and executes its CPU branch', async ({
      comfyPage,
      comfyMouse
    }, testInfo) => {
      await test.step('loads the exact legacy graph and landmarks', async () => {
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
          groupTitles: window.app!.graph.groups.map((group) => group.title)
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
      })

      await test.step('paints every landmark title', async () => {
        const paintedLandmarks = await expectLargeWorkflowLandmarkTitlesPainted(
          comfyPage.page
        )
        await testInfo.attach('painted-landmarks', {
          body: JSON.stringify(paintedLandmarks),
          contentType: 'application/json'
        })
      })

      await test.step('pans and zooms the loaded graph', async () => {
        const initialOffset = await comfyPage.canvasOps.getOffset()
        await comfyMouse.middleDragFromCenter(comfyPage.canvas, {
          x: 120,
          y: 80
        })
        await expect
          .poll(() => comfyPage.canvasOps.getOffset())
          .not.toEqual(initialOffset)

        const initialScale = await comfyPage.canvasOps.getScale()
        await comfyPage.canvas.hover()
        await comfyPage.page.mouse.wheel(0, -100)
        await comfyPage.nextFrame()
        await expect
          .poll(() => comfyPage.canvasOps.getScale())
          .toBeGreaterThan(initialScale)
      })

      await test.step('executes the CPU output branch', async () => {
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
    })
  }
)
