import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

test.describe(
  'ECS migration geometry interactions',
  { tag: ['@canvas', '@node', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await fitToViewInstant(comfyPage)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('slot dots track the node edge while resize is still active', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const handle = node.getResizeHandle('SE')
      const outputDot = node.root.locator('[data-slot-key="3-out-0"]')
      const beforeNode = await node.boundingBox()
      const beforeDot = await outputDot.boundingBox()
      const handleBox = await handle.boundingBox()
      if (!(beforeNode && beforeDot && handleBox)) {
        throw new Error('Resize geometry is unavailable')
      }

      const start = {
        x: handleBox.x + handleBox.width / 2,
        y: handleBox.y + handleBox.height / 2
      }
      await comfyPage.page.mouse.move(start.x, start.y)
      await comfyPage.page.mouse.down()
      try {
        await comfyPage.page.mouse.move(start.x + 160, start.y + 80, {
          steps: 10
        })
        await comfyPage.nextFrame()

        const duringNode = await node.boundingBox()
        const duringDot = await outputDot.boundingBox()
        if (!(duringNode && duringDot)) {
          throw new Error('Live resize geometry disappeared')
        }
        expect(duringNode.width).toBeGreaterThan(beforeNode.width + 120)
        expect(duringDot.x).toBeGreaterThan(beforeDot.x + 120)
        expect(
          Math.abs(
            duringDot.x +
              duringDot.width / 2 -
              (duringNode.x + duringNode.width)
          ),
          'output dot remains on the visible right edge before pointer release'
        ).toBeLessThanOrEqual(2)
      } finally {
        await comfyPage.page.mouse.up()
      }
    })

    for (const vueNodesEnabled of [false, true]) {
      test(`remains interactive after an incompatible link gesture in ${vueNodesEnabled ? 'Nodes 2.0' : 'legacy'} mode`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        if (vueNodesEnabled) {
          await comfyPage.vueNodes.waitForNodes()
        } else {
          await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
        }

        const sampler = await comfyPage.nodeOps.getNodeRefById('3')
        const prompt = await comfyPage.nodeOps.getNodeRefById('6')
        const output = await sampler.getOutput(0)
        const incompatibleInput = await prompt.getInput(0)
        const beforePosition = await sampler.getPosition()

        await comfyPage.canvasOps.dragAndDrop(
          await output.getPosition(),
          await incompatibleInput.getPosition()
        )
        await output.expectLinkCount(1)
        await incompatibleInput.expectLinkCount(1)

        await sampler.dragBy({ x: 80, y: 40 })
        await expect(async () => {
          const afterPosition = await sampler.getPosition()
          expect(afterPosition.x).toBeCloseTo(beforePosition.x + 80, -1)
          expect(afterPosition.y).toBeCloseTo(beforePosition.y + 40, -1)
        }).toPass({ timeout: 5000 })
        await expect(comfyPage.toast.toastErrors).toHaveCount(0)
      })
    }
  }
)
