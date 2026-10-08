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

        await comfyPage.keyboard.undo()
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

        await comfyPage.keyboard.redo()
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

    test('restores reroute chains and store bindings after delete, undo, and redo', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('reroute/native_reroute')

      const { baseline, parityAtLoad } =
        await test.step('Capture baseline serialization and store parity', async () => {
          const baseline = await comfyPage.page.evaluate(() =>
            window.app!.graph!.serialize()
          )
          const parityAtLoad =
            await comfyPage.canvasOps.getCurrentGraphRerouteParity()

          expect(parityAtLoad.map((entry) => entry.id)).toEqual([1, 2])
          for (const entry of parityAtLoad) {
            expect(
              entry.boundToStore,
              `reroute ${entry.id} chain must be the store-held state`
            ).toBe(true)
          }
          const [floatingReroute, liveReroute] = parityAtLoad
          expect(
            floatingReroute.floatingSlotType,
            'fixture reroute 1 must be floating for this test to cover the floating path'
          ).toBe('output')
          expect(
            liveReroute.linkIds,
            'fixture reroute 2 must carry a live link for this test to cover membership'
          ).toEqual([33])
          return { baseline, parityAtLoad }
        })

      await test.step('Delete everything and verify the store is cleaned up', async () => {
        await comfyPage.keyboard.selectAll()
        await comfyPage.keyboard.delete()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.graph!.reroutes.size)
          )
          .toBe(0)
        expect(
          await comfyPage.canvasOps.probeCurrentGraphRerouteStore([1, 2]),
          'store must not hold chains for deleted reroutes'
        ).toEqual({ 1: false, 2: false })
      })

      await test.step('Undo and verify class state, store state, and serialization agree', async () => {
        await comfyPage.keyboard.undo()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.graph!.serialize())
          )
          .toEqual(baseline)
        expect(
          await comfyPage.canvasOps.getCurrentGraphRerouteParity(),
          'restored reroutes must be re-registered in the store with identical chains and membership'
        ).toEqual(parityAtLoad)
      })

      await test.step('Redo and verify the store does not leak chains', async () => {
        await comfyPage.keyboard.redo()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.graph!.reroutes.size)
          )
          .toBe(0)
        expect(
          await comfyPage.canvasOps.probeCurrentGraphRerouteStore([1, 2]),
          'store must not leak chains after redoing the deletion'
        ).toEqual({ 1: false, 2: false })
      })
    })

    test('keeps subgraph reroute ownership isolated through delete, undo, and redo', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-link-identity-collision'
      )

      const runtimeRerouteIds = await comfyPage.page.evaluate(() =>
        [...window.app!.graph!.subgraphs.values()]
          .map((subgraph) => [...subgraph.reroutes.keys()][0])
          .sort((a, b) => a - b)
      )
      expect(runtimeRerouteIds).toHaveLength(2)
      expect(new Set(runtimeRerouteIds).size).toBe(2)

      await comfyPage.vueNodes.enterSubgraph('1')
      const firstParity =
        await comfyPage.canvasOps.getCurrentGraphRerouteParity()
      expect(firstParity).toHaveLength(1)
      expect(firstParity[0].boundToStore).toBe(true)
      expect(firstParity[0].linkIds).toHaveLength(1)
      const firstRerouteId = firstParity[0].id

      await comfyPage.keyboard.selectAll()
      await comfyPage.keyboard.delete()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => window.app!.canvas.graph!.reroutes.size)
        )
        .toBe(0)
      expect(
        await comfyPage.canvasOps.probeCurrentGraphRerouteStore([
          firstRerouteId
        ])
      ).toEqual({ [firstRerouteId]: false })

      await comfyPage.keyboard.undo()
      await expect
        .poll(() => comfyPage.canvasOps.getCurrentGraphRerouteParity())
        .toEqual(firstParity)

      await comfyPage.keyboard.redo()
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => window.app!.canvas.graph!.reroutes.size)
        )
        .toBe(0)
      expect(
        await comfyPage.canvasOps.probeCurrentGraphRerouteStore([
          firstRerouteId
        ])
      ).toEqual({ [firstRerouteId]: false })

      await comfyPage.keyboard.undo()
      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.vueNodes.enterSubgraph('2')

      const secondParity =
        await comfyPage.canvasOps.getCurrentGraphRerouteParity()
      expect(secondParity).toHaveLength(1)
      expect(secondParity[0].id).not.toBe(firstRerouteId)
      expect(secondParity[0].boundToStore).toBe(true)
      expect(secondParity[0].linkIds).toHaveLength(1)
    })

    test('restores groups after delete, undo, and redo', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('groups/single_group')

      const { baseline, groupsAtLoad } =
        await test.step('Capture baseline serialization and group state', async () => {
          const baseline = await comfyPage.page.evaluate(() =>
            window.app!.graph!.serialize()
          )
          const groupsAtLoad = await comfyPage.page.evaluate(() =>
            window.app!.graph!.groups.map((group) => ({
              title: group.title,
              pos: [...group.pos].map(Number),
              size: [...group.size].map(Number)
            }))
          )
          expect(groupsAtLoad).toHaveLength(1)
          expect(groupsAtLoad[0].title).toBe('Group')
          return { baseline, groupsAtLoad }
        })

      await test.step('Delete everything', async () => {
        await comfyPage.keyboard.selectAll()
        await comfyPage.keyboard.delete()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.graph!.groups.length)
          )
          .toBe(0)
      })

      await test.step('Undo and verify the group and serialization are restored', async () => {
        await comfyPage.keyboard.undo()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.graph!.serialize())
          )
          .toEqual(baseline)
        expect(
          await comfyPage.page.evaluate(() =>
            window.app!.graph!.groups.map((group) => ({
              title: group.title,
              pos: [...group.pos].map(Number),
              size: [...group.size].map(Number)
            }))
          )
        ).toEqual(groupsAtLoad)
      })

      await test.step('Redo the deletion', async () => {
        await comfyPage.keyboard.redo()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.graph!.groups.length)
          )
          .toBe(0)
      })
    })
  }
)
