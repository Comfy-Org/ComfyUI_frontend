import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test.describe(
  'ECS bridge history',
  { tag: ['@slow', '@subgraph', '@vue-nodes'] },
  () => {
    test.slow()

    test('restores promoted subgraph state after delete, undo, and redo', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const { baseline, interiorLinkCount, promotedText } =
        await test.step('Capture the initial promoted subgraph state', async () => {
          const baseline = await comfyPage.page.evaluate(() =>
            window.app!.graph!.serialize()
          )
          const interiorLinkCount = await comfyPage.page.evaluate((id) => {
            const host = window.app!.graph!.getNodeById(id)
            if (!host?.isSubgraphNode()) {
              throw new Error(`Host node ${id} is not a SubgraphNode`)
            }
            return host.subgraph.links.size
          }, toNodeId('11'))
          const promotedText = comfyPage.vueNodes
            .getNodeLocator('11')
            .getByRole('textbox', { name: 'text' })
          await expect(promotedText).toBeVisible()
          return { baseline, interiorLinkCount, promotedText }
        })

      await test.step('Delete the subgraph', async () => {
        const host = await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
        await host.title.click()
        await comfyPage.keyboard.delete()

        await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
        await expect(promotedText).toBeHidden()
      })

      await test.step('Undo and verify the restored subgraph', async () => {
        await comfyPage.keyboard.undo()
        await comfyPage.vueNodes.waitForNodes()

        await expect(comfyPage.vueNodes.nodes).toHaveCount(1)
        await expect(promotedText).toBeVisible()
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.graph!.serialize())
          )
          .toEqual(baseline)

        await comfyPage.vueNodes.enterSubgraph('11')
        await expect(comfyPage.vueNodes.nodes).toHaveCount(2)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.canvas.graph!.links.size)
          )
          .toBe(interiorLinkCount)

        const interiorGeometry = await comfyPage.canvasOps.getNodeGeometry(
          toNodeId('10')
        )
        comfyPage.canvasOps.expectSlotsOnNode(
          interiorGeometry,
          'after restoring the subgraph'
        )

        await comfyPage.subgraph.exitViaBreadcrumb()
      })

      await test.step('Redo the deletion', async () => {
        await comfyPage.keyboard.redo()
        await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
      })
    })

    test('preserves geometry through navigation, renderer toggle, and history', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const nodeId = toNodeId('11')

      const { before, moved } =
        await test.step('Move the subgraph and capture its geometry', async () => {
          const before = await comfyPage.canvasOps.getNodeGeometry(nodeId)
          expect(
            before.inputs.length + before.outputs.length,
            'fixture node must have slots for this test to mean anything'
          ).toBeGreaterThan(0)
          const { header } =
            await comfyPage.vueNodes.getFixtureByTitle('New Subgraph')
          const headerBox = await header.boundingBox()
          if (!headerBox) throw new Error('Subgraph header not found')

          const start = {
            x: headerBox.x + headerBox.width / 2,
            y: headerBox.y + headerBox.height / 2
          }
          await comfyPage.canvasOps.dragAndDrop(start, {
            x: start.x + 120,
            y: start.y + 90
          })
          await comfyPage.nextFrame()

          const moved = await comfyPage.canvasOps.getNodeGeometry(nodeId)
          comfyPage.canvasOps.expectSlotsTrackedNode(moved, before)
          await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
          return { before, moved }
        })

      await test.step('Verify geometry while navigating the subgraph', async () => {
        await comfyPage.subgraph.enterSubgraphWithFallback(String(nodeId))
        const interiorGeometry = await comfyPage.canvasOps.getNodeGeometry(
          toNodeId('10')
        )
        comfyPage.canvasOps.expectSlotsOnNode(
          interiorGeometry,
          'while navigating the subgraph'
        )
        await comfyPage.subgraph.exitViaBreadcrumb()
      })

      await test.step('Undo and redo in the legacy renderer', async () => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
        await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
        await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)

        await comfyPage.command.executeCommand('Comfy.Undo')
        await expect(async () => {
          const undone = await comfyPage.canvasOps.getNodeGeometry(nodeId)
          expect(undone.pos[0]).toBeCloseTo(before.pos[0], 0)
          expect(undone.pos[1]).toBeCloseTo(before.pos[1], 0)
          expect(undone.size).toEqual(before.size)
          comfyPage.canvasOps.expectSlotsOnNode(
            undone,
            'after undo in the legacy renderer'
          )
        }).toPass({ timeout: 5000 })

        await comfyPage.command.executeCommand('Comfy.Redo')
        await expect(async () => {
          const redone = await comfyPage.canvasOps.getNodeGeometry(nodeId)
          expect(redone.pos[0]).toBeCloseTo(moved.pos[0], 0)
          expect(redone.pos[1]).toBeCloseTo(moved.pos[1], 0)
          expect(redone.size).toEqual(moved.size)
          comfyPage.canvasOps.expectSlotsOnNode(
            redone,
            'after redo in the legacy renderer'
          )
        }).toPass({ timeout: 5000 })
      })

      await test.step('Restore Vue nodes and reload the workflow', async () => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.vueNodes.waitForNodes()
        await expect(
          comfyPage.vueNodes
            .getNodeLocator(nodeId)
            .getByRole('textbox', { name: 'text' })
        ).toBeVisible()

        await comfyPage.subgraph.serializeAndReload()
        comfyPage.canvasOps.expectNodeGeometryPreserved(
          await comfyPage.canvasOps.getNodeGeometry(nodeId),
          moved,
          'after serialization and reload'
        )
      })
    })
  }
)
