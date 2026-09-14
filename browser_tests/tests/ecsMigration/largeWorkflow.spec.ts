import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Large workflow readiness',
  { tag: ['@workflow', '@smoke'] },
  () => {
    test('legacy canvas loads, navigates, and executes its CPU branch', async ({
      comfyPage
    }) => {
      expect(
        await comfyPage.settings.getSetting<boolean>('Comfy.VueNodes.Enabled')
      ).toBe(false)
      await comfyPage.workflow.loadWorkflow(
        'ecs-qa-007-large-workflow-readiness'
      )

      const graphSummary = await comfyPage.page.evaluate(() => ({
        nodeCount: window.app!.graph.nodes.length,
        nodeTitles: window.app!.graph.nodes.map((node) => node.title),
        groupTitles: window.app!.graph.groups.map((group) => group.title),
        offset: [...window.app!.canvas.ds.offset]
      }))
      expect(graphSummary.nodeCount).toBeGreaterThanOrEqual(100)
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

      const paintedLandmarks = await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        const landmarkTitles = [
          'First Pipeline Landmark',
          'Middle Pipeline Landmark',
          'CPU Output Branch Landmark',
          'CPU Output Input',
          'CPU Output Landmark'
        ]
        const painted = new Set<string>()
        const fillText = CanvasRenderingContext2D.prototype.fillText
        const initialScale = canvas.ds.scale
        const initialOffset = [...canvas.ds.offset]
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          fillText.call(this, text, ...args)
          if (landmarkTitles.includes(text)) painted.add(text)
        }

        try {
          canvas.ds.scale = 1
          for (const title of landmarkTitles) {
            const node = canvas.graph!.nodes.find(
              (node) => node.title === title
            )
            if (node) {
              canvas.centerOnNode(node)
            } else {
              const group = canvas.graph!.groups.find(
                (group) => group.title === title
              )
              if (!group) throw new Error(`Landmark ${title} not found`)
              const dpi = window.devicePixelRatio || 1
              canvas.ds.offset[0] =
                -group.pos[0] + canvas.canvas.width / (4 * dpi)
              canvas.ds.offset[1] =
                -group.pos[1] + canvas.canvas.height / (4 * dpi)
            }
            canvas.draw(true, true)
          }
        } finally {
          CanvasRenderingContext2D.prototype.fillText = fillText
          canvas.ds.scale = initialScale
          canvas.ds.offset[0] = initialOffset[0]
          canvas.ds.offset[1] = initialOffset[1]
          canvas.setDirty(true, true)
        }

        return [...painted]
      })
      expect(paintedLandmarks).toEqual(
        expect.arrayContaining([
          'First Pipeline Landmark',
          'Middle Pipeline Landmark',
          'CPU Output Branch Landmark',
          'CPU Output Input',
          'CPU Output Landmark'
        ])
      )

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
