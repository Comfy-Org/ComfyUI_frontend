import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { expect } from '@playwright/test'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import { toNodeId } from '@/types/nodeId'

test.describe('Subgraph Operations', { tag: ['@slow', '@subgraph'] }, () => {
  test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

  for (const renderer of [
    { name: 'LiteGraph', tag: '@ui' },
    { name: 'Vue', tag: ['@ui', '@vue-nodes'] }
  ]) {
    test.describe(
      `${renderer.name} malformed unpack`,
      { tag: renderer.tag },
      () => {
        test('rejects a missing target slot atomically and keeps the canvas responsive', async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
          const host = await comfyPage.nodeOps.getNodeRefById('2')
          const before = await comfyPage.page.evaluate(
            ([hostId, subgraphOutputId]) => {
              const host = window.app!.rootGraph.getNodeById(hostId)
              if (!host?.isSubgraphNode())
                throw new Error('Expected subgraph host 2')
              const link = [...host.subgraph.links.values()].find(
                ({ target_id }) => target_id !== subgraphOutputId
              )
              if (!link) throw new Error('Expected an interior node link')
              const target = host.subgraph.getNodeById(link.target_id)
              if (!target) throw new Error('Expected the link target')
              link.target_slot = target.inputs.length
              return JSON.stringify(window.app!.rootGraph.serialize())
            },
            [toNodeId(2), SUBGRAPH_OUTPUT_ID] as const
          )
          const consoleErrors = collectConsoleErrors(comfyPage.page)
          try {
            await test.step('rejects the unpack atomically', async () => {
              await expect(comfyPage.toast.toastErrors).toHaveCount(0)
              await host.click('title')
              await expect
                .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
                .toEqual([toNodeId(2)])
              await host.clickContextMenuOption('Unpack Subgraph')
              await expect.poll(() => host.exists()).toBe(true)
              await expect
                .poll(() =>
                  comfyPage.page.evaluate(() =>
                    JSON.stringify(window.app!.rootGraph.serialize())
                  )
                )
                .toBe(before)
            })

            await test.step('keeps the canvas responsive', async () => {
              await comfyPage.canvasOps.clickEmptySpace()
              await expect
                .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
                .toEqual([])
              await host.click('title')
              await expect
                .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
                .toEqual([toNodeId(2)])
            })

            await test.step('reports the refusal once', async () => {
              const reportedErrors = () =>
                consoleErrors.errors.filter((error) =>
                  error.includes(
                    '[Reported error]: error_unpacking_subgraph_link'
                  )
                )
              await expect.poll(reportedErrors).toHaveLength(1)
              expect(reportedErrors()[0]).toContain(
                'Cannot unpack subgraph: unresolvable inner link'
              )
              expect(
                consoleErrors.errors.filter((error) =>
                  error.startsWith('Uncaught page error:')
                )
              ).toEqual([])
              await expect(comfyPage.toast.toastErrors).toHaveCount(1)
            })
          } finally {
            consoleErrors.stop()
          }
        })
      }
    )
  }

  test.describe('Subgraph Clipboard Operations', () => {
    test('Can copy and paste nodes inside a subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialNodeCount = await comfyPage.subgraph.getNodeCount()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const nodes = window.app!.canvas.graph!.nodes
            return nodes.at(0)?.id ?? null
          })
        )
        .not.toBeNull()

      const nodeId = await comfyPage.page.evaluate(() => {
        const nodes = window.app!.canvas.graph!.nodes
        return nodes.at(0)?.id ?? null
      })

      const nodeToClone = await comfyPage.nodeOps.getNodeRefById(String(nodeId))
      await nodeToClone.click('title')

      await comfyPage.keyboard.press('ControlOrMeta+c')

      await comfyPage.keyboard.press('ControlOrMeta+v')

      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialNodeCount + 1)
    })
  })

  test.describe('Subgraph History Operations', () => {
    test('Can undo and redo operations inside a subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.searchBoxV2.addNode('Note')
      await comfyPage.nextFrame()

      const initialCount = await comfyPage.subgraph.getNodeCount()

      await comfyPage.keyboard.undo()
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialCount - 1)

      await comfyPage.keyboard.redo()
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialCount)
    })
  })
})
