import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

const rendererName = (enabled: boolean) => (enabled ? 'Nodes 2.0' : 'legacy')

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
        const originalOutputLink = await output.getLink()
        const originalInputLink = await incompatibleInput.getLink()
        expect(originalOutputLink).not.toBeNull()
        expect(originalInputLink).not.toBeNull()

        await comfyPage.canvasOps.dragAndDrop(
          await output.getPosition(),
          await incompatibleInput.getPosition()
        )
        await output.expectLinkCount(1)
        await incompatibleInput.expectLinkCount(1)
        expect(await output.getLink()).toEqual(originalOutputLink)
        expect(await incompatibleInput.getLink()).toEqual(originalInputLink)

        await sampler.dragBy({ x: 80, y: 40 })
        await expect(async () => {
          const afterPosition = await sampler.getPosition()
          expect(afterPosition.x).toBeCloseTo(beforePosition.x + 80, -1)
          expect(afterPosition.y).toBeCloseTo(beforePosition.y + 40, -1)
        }).toPass({ timeout: 5000 })
        await expect(comfyPage.toast.toastErrors).toHaveCount(0)
      })
    }

    for (const vueNodesEnabled of [false, true]) {
      test(`reroute position and parent survive reload in ${rendererName(vueNodesEnabled)}`, async ({
        comfyPage
      }) => {
        test.slow()
        await comfyPage.workflow.loadWorkflow(
          'reroute/single-native-reroute-default-workflow'
        )
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await fitToViewInstant(comfyPage)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.graph.reroutes.size)
          )
          .toBe(1)
        const saved = await comfyPage.page.evaluate(() => {
          const reroute = window.app!.graph.reroutes.values().next().value
          if (!reroute) throw new Error('Reroute was not created')
          return {
            id: reroute.id,
            parentId: reroute.parentId,
            pos: [...reroute.pos]
          }
        })

        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.canvasOps.expectRootReroutePositions({
          [toRerouteId(saved.id)]: { x: saved.pos[0], y: saved.pos[1] }
        })
        await expect
          .poll(() =>
            comfyPage.page.evaluate((id) => {
              const reroute = window.app!.graph.reroutes.get(id)
              return reroute?.parentId ?? null
            }, saved.id)
          )
          .toBe(saved.parentId ?? null)
      })

      test(`recovers from empty link search and malformed clipboard in ${rendererName(vueNodesEnabled)}`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        const sampler = await comfyPage.nodeOps.getNodeRefById('3')
        const output = await sampler.getOutput(0)
        const beforePosition = await sampler.getPosition()
        const outputPosition = await output.getPosition()
        await comfyPage.canvasOps.dragAndDrop(outputPosition, {
          x: 1000,
          y: 600
        })
        const linkDropSearch = comfyPage.page.locator(
          '.litecontextmenu:visible, .litemenu:visible, [role="search"]:visible'
        )
        await expect(linkDropSearch).toBeVisible()
        await comfyPage.canvas.click({ position: { x: 900, y: 100 } })
        await expect(linkDropSearch).toBeHidden()

        await sampler.dragBy({ x: 30, y: 15 })
        await expect
          .poll(() => sampler.getPosition())
          .toEqual({
            x: expect.closeTo(beforePosition.x + 30, -1),
            y: expect.closeTo(beforePosition.y + 15, -1)
          })
        const afterLinkSearchPosition = await sampler.getPosition()

        await comfyPage.page
          .context()
          .grantPermissions(['clipboard-read', 'clipboard-write'])
        await comfyPage.page.evaluate(async () => {
          await navigator.clipboard.writeText('{ malformed workflow')
        })
        const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
        await comfyPage.page.keyboard.press('Control+V')
        await comfyPage.page.keyboard.press('Escape')
        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBe(nodeCount)
        await sampler.dragBy({ x: 60, y: 30 })
        await expect
          .poll(() => sampler.getPosition())
          .toEqual({
            x: expect.closeTo(afterLinkSearchPosition.x + 60, -1),
            y: expect.closeTo(afterLinkSearchPosition.y + 30, -1)
          })
        await expect(comfyPage.toast.toastErrors).toHaveCount(0)
      })
    }

    test(
      'overlapping multiline text remains clipped to each node',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        await comfyPage.page.evaluate((nodeId) => {
          const sampler = window.app!.graph.getNodeById(nodeId)
          if (!sampler) throw new Error('KSampler is unavailable')
          const seed = sampler.widgets?.find((widget) => widget.name === 'seed')
          if (!seed) throw new Error('Seed widget is unavailable')
          seed.value = 123456789
          sampler.setDirtyCanvas(true, true)
        }, toNodeId('3'))
        for (const vueNodesEnabled of [false, true]) {
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            vueNodesEnabled
          )
          await fitToViewInstant(comfyPage)
          const first = await comfyPage.nodeOps.getNodeRefById('6')
          const second = await comfyPage.nodeOps.getNodeRefById('7')
          const firstPosition = await first.getPosition()
          const secondPosition = await second.getPosition()
          await second.dragBy({
            x: firstPosition.x - secondPosition.x + 100,
            y: firstPosition.y - secondPosition.y + 70
          })
          await comfyPage.nextFrame()
          await expect(comfyPage.canvas).toHaveScreenshot(
            `ecs-overlapping-text-${vueNodesEnabled ? 'vue' : 'legacy'}.png`
          )
        }
      }
    )

    test(
      'node title and widget labels remain rendered at text zoom extremes',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        const sampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)
          if (!node) throw new Error('KSampler is unavailable')
          const seed = node.widgets?.find((widget) => widget.name === 'seed')
          if (!seed) throw new Error('Seed widget is unavailable')
          seed.value = 123456789
          node.setDirtyCanvas(true, true)
        }, toNodeId('3'))
        await comfyPage.vueNodes.selectNode('3')
        for (const zoom of [0.5, 2]) {
          await comfyPage.page.evaluate(
            ([scale, nodeId]) => {
              const canvas = window.app!.canvas
              const node = window.app!.graph.getNodeById(nodeId)
              if (!node) throw new Error('KSampler is unavailable')
              const [x, y, width, height] = node.boundingRect
              canvas.ds.scale = scale
              canvas.ds.offset = [
                canvas.canvas.width / 2 / scale - (x + width / 2),
                canvas.canvas.height / 2 / scale - (y + height / 2)
              ]
              canvas.setDirty(true, true)
            },
            [zoom, toNodeId('3')] as const
          )
          await comfyPage.nextFrame()
          await expect(sampler.title).toBeVisible()
          const seedLabel = sampler.root.getByText('seed', { exact: true })
          await expect(seedLabel).toBeVisible()
          await expect(sampler.title).toHaveScreenshot(
            `ecs-title-zoom-${zoom * 100}.png`
          )
          await expect(seedLabel).toHaveScreenshot(
            `ecs-seed-label-zoom-${zoom * 100}.png`
          )
        }
      }
    )
  }
)
