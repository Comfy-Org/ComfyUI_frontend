import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

/**
 * Queries graph link map size, per-node slot references, and validates that
 * every link ID referenced by a node slot exists in the link map.
 */
function evaluateGraphLinks(page: Page) {
  return page.evaluate(() => {
    const graph = window.app!.graph!
    const linkMap = graph.links
    const totalLinks = linkMap.size

    const nodeData: Record<
      string,
      {
        inputLinks: (number | null)[]
        outputLinkCounts: number[]
      }
    > = {}

    for (const node of graph._nodes) {
      const inputs = (node.inputs ?? []).map(
        (i: { link: number | null }) => i.link
      )
      const outputs = (node.outputs ?? []).map(
        (o: { links: number[] | null }) => o.links?.length ?? 0
      )
      nodeData[String(node.id)] = {
        inputLinks: inputs,
        outputLinkCounts: outputs
      }
    }

    let orphanedInputRefs = 0
    let orphanedOutputRefs = 0
    for (const node of graph._nodes) {
      for (const input of node.inputs ?? []) {
        if (input.link != null && !linkMap.has(input.link)) {
          orphanedInputRefs++
        }
      }
      for (const output of node.outputs ?? []) {
        for (const linkId of output.links ?? []) {
          if (!linkMap.has(linkId)) orphanedOutputRefs++
        }
      }
    }

    return {
      totalLinks,
      nodeData,
      orphanedInputRefs,
      orphanedOutputRefs
    }
  })
}

test.describe(
  'Link operations and integrity',
  { tag: ['@canvas', '@node'] },
  () => {
    test.describe('Link removal via node deletion', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('default')
      })

      test('Deleting a connected node removes its links from the graph', async ({
        comfyPage
      }) => {
        const before = await evaluateGraphLinks(comfyPage.page)
        expect(before.totalLinks).toBeGreaterThan(0)
        expect(before.orphanedInputRefs).toBe(0)
        expect(before.orphanedOutputRefs).toBe(0)

        const clipNodes =
          await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
        expect(clipNodes.length).toBeGreaterThanOrEqual(1)
        await clipNodes[0].delete()

        await expect
          .poll(
            async () => (await evaluateGraphLinks(comfyPage.page)).totalLinks
          )
          .toBeLessThan(before.totalLinks)

        await expect
          .poll(() => evaluateGraphLinks(comfyPage.page))
          .toMatchObject({
            orphanedInputRefs: 0,
            orphanedOutputRefs: 0
          })
      })

      test('Deleting a hub node with multiple output links removes all of them', async ({
        comfyPage
      }) => {
        const checkpointNodes = await comfyPage.nodeOps.getNodeRefsByType(
          'CheckpointLoaderSimple'
        )
        expect(checkpointNodes.length).toBeGreaterThanOrEqual(1)

        const before = await evaluateGraphLinks(comfyPage.page)
        const checkpointId = String(checkpointNodes[0].id)
        const checkpointOutputLinks =
          before.nodeData[checkpointId]?.outputLinkCounts ?? []
        const totalOutputLinks = checkpointOutputLinks.reduce(
          (a, b) => a + b,
          0
        )
        expect(totalOutputLinks).toBeGreaterThanOrEqual(3)

        await checkpointNodes[0].delete()

        await expect
          .poll(
            async () => (await evaluateGraphLinks(comfyPage.page)).totalLinks
          )
          .toBeLessThanOrEqual(before.totalLinks - totalOutputLinks)

        await expect
          .poll(() => evaluateGraphLinks(comfyPage.page))
          .toMatchObject({
            orphanedInputRefs: 0,
            orphanedOutputRefs: 0
          })
      })
    })

    test.describe('Link disconnect and reconnect integrity', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('default')
      })

      test('Disconnecting an input removes the link from the graph link map', async ({
        comfyPage
      }) => {
        const clipNodes =
          await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
        expect(clipNodes.length).toBeGreaterThanOrEqual(1)

        const input = await clipNodes[0].getInput(0)
        await expect.poll(() => input.getLinkCount()).toBe(1)

        const before = await evaluateGraphLinks(comfyPage.page)

        await input.removeLinks()

        await expect.poll(() => input.getLinkCount()).toBe(0)

        await expect
          .poll(
            async () => (await evaluateGraphLinks(comfyPage.page)).totalLinks
          )
          .toBe(before.totalLinks - 1)

        await expect
          .poll(() => evaluateGraphLinks(comfyPage.page))
          .toMatchObject({
            orphanedInputRefs: 0,
            orphanedOutputRefs: 0
          })
      })

      test('Disconnecting an output removes all its links from the graph', async ({
        comfyPage
      }) => {
        const checkpointNodes = await comfyPage.nodeOps.getNodeRefsByType(
          'CheckpointLoaderSimple'
        )
        expect(checkpointNodes.length).toBeGreaterThanOrEqual(1)

        const clipOutput = await checkpointNodes[0].getOutput(1)
        await expect.poll(() => clipOutput.getLinkCount()).toBe(2)

        const before = await evaluateGraphLinks(comfyPage.page)

        await clipOutput.removeLinks()

        await expect.poll(() => clipOutput.getLinkCount()).toBe(0)

        await expect
          .poll(
            async () => (await evaluateGraphLinks(comfyPage.page)).totalLinks
          )
          .toBe(before.totalLinks - 2)

        await expect
          .poll(() => evaluateGraphLinks(comfyPage.page))
          .toMatchObject({
            orphanedInputRefs: 0,
            orphanedOutputRefs: 0
          })
      })

      test('Reconnecting after disconnect restores the same edge', async ({
        comfyPage
      }) => {
        const clipNodes =
          await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
        expect(clipNodes.length).toBeGreaterThanOrEqual(1)
        const clipInput = await clipNodes[0].getInput(0)

        const originalLink = await comfyPage.page.evaluate(
          ([nodeId]) => {
            const graph = window.app!.graph!
            const node = graph.getNodeById(nodeId)
            if (!node) return null
            const linkId = node.inputs[0]?.link
            if (linkId == null) return null
            const link = graph.links.get(linkId)
            if (!link) return null
            return {
              originId: link.origin_id,
              originSlot: link.origin_slot,
              targetId: link.target_id,
              targetSlot: link.target_slot
            }
          },
          [clipNodes[0].id] as const
        )
        expect(originalLink).not.toBeNull()

        await comfyPage.canvasOps.disconnectEdge()
        await expect.poll(() => clipInput.getLinkCount()).toBe(0)

        await comfyPage.canvasOps.connectEdge()
        await expect.poll(() => clipInput.getLinkCount()).toBe(1)

        await expect
          .poll(async () => {
            return comfyPage.page.evaluate(
              ([nodeId]) => {
                const graph = window.app!.graph!
                const node = graph.getNodeById(nodeId)
                if (!node) return null
                const linkId = node.inputs[0]?.link
                if (linkId == null) return null
                const link = graph.links.get(linkId)
                if (!link) return null
                return {
                  originId: link.origin_id,
                  originSlot: link.origin_slot,
                  targetId: link.target_id,
                  targetSlot: link.target_slot
                }
              },
              [clipNodes[0].id] as const
            )
          })
          .toMatchObject(originalLink!)

        await expect
          .poll(() => evaluateGraphLinks(comfyPage.page))
          .toMatchObject({
            orphanedInputRefs: 0,
            orphanedOutputRefs: 0
          })
      })
    })

    test.describe('Link deduplication', () => {
      test('Duplicate links are removed on workflow load', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'links/duplicate_links_slot_drift'
        )

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => {
              const subgraph = window
                .app!.graph!.subgraphs.values()
                .next().value
              if (!subgraph) return false

              const tuples = new Set<string>()
              for (const [, link] of subgraph.links) {
                tuples.add(
                  `${link.origin_id}\0${link.origin_slot}\0${link.target_id}\0${link.target_slot}`
                )
              }
              return subgraph.links.size === tuples.size
            })
          )
          .toBe(true)
      })

      test('Programmatically injected duplicate links are deduplicated on configure', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')

        const injected = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph!
          const firstLink = graph.links.values().next().value
          if (!firstLink) return null

          const dupeId = graph.last_link_id + 1
          const dupe = {
            ...firstLink,
            id: dupeId
          }
          graph.links.set(dupeId, dupe as typeof firstLink)
          graph.last_link_id = dupeId

          const originNode = graph.getNodeById(firstLink.origin_id)
          const output = originNode?.outputs?.[firstLink.origin_slot]
          if (output?.links) {
            output.links.push(dupeId)
          }

          return {
            originalId: firstLink.id,
            dupeId,
            linksBeforeInject: graph.links.size - 1,
            linksAfterInject: graph.links.size
          }
        })

        expect(injected).not.toBeNull()
        expect(injected!.linksAfterInject).toBe(injected!.linksBeforeInject + 1)

        await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph!
          const data = graph.serialize()
          graph.configure(data)
        })

        await expect
          .poll(async () => {
            const state = await evaluateGraphLinks(comfyPage.page)
            return {
              totalLinks: state.totalLinks,
              orphanedInputRefs: state.orphanedInputRefs,
              orphanedOutputRefs: state.orphanedOutputRefs
            }
          })
          .toMatchObject({
            totalLinks: injected!.linksBeforeInject,
            orphanedInputRefs: 0,
            orphanedOutputRefs: 0
          })
      })
    })

    test.describe('Output link array and link map consistency', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('default')
      })

      test('Output links array IDs are a subset of graph link map keys', async ({
        comfyPage
      }) => {
        const result = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph!
          const mismatches: string[] = []

          for (const node of graph._nodes) {
            for (let i = 0; i < (node.outputs?.length ?? 0); i++) {
              const output = node.outputs[i]
              for (const linkId of output.links ?? []) {
                if (!graph.links.has(linkId)) {
                  mismatches.push(
                    `Node ${node.id} output[${i}] references link ${linkId} not in map`
                  )
                }
              }
            }
          }

          return mismatches
        })

        expect(result).toEqual([])
      })

      test('Every link in the map is referenced by exactly one input and one output', async ({
        comfyPage
      }) => {
        const result = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph!
          const inputRefs = new Map<number, number>()
          const outputRefs = new Map<number, number>()

          for (const node of graph._nodes) {
            for (const input of node.inputs ?? []) {
              if (input.link != null) {
                inputRefs.set(input.link, (inputRefs.get(input.link) ?? 0) + 1)
              }
            }
            for (const output of node.outputs ?? []) {
              for (const linkId of output.links ?? []) {
                outputRefs.set(linkId, (outputRefs.get(linkId) ?? 0) + 1)
              }
            }
          }

          const errors: string[] = []
          for (const [linkId] of graph.links) {
            const iCount = inputRefs.get(linkId) ?? 0
            const oCount = outputRefs.get(linkId) ?? 0
            if (iCount !== 1) {
              errors.push(
                `Link ${linkId}: referenced by ${iCount} inputs (expected 1)`
              )
            }
            if (oCount !== 1) {
              errors.push(
                `Link ${linkId}: referenced by ${oCount} outputs (expected 1)`
              )
            }
          }

          return errors
        })

        expect(result).toEqual([])
      })
    })
  }
)
