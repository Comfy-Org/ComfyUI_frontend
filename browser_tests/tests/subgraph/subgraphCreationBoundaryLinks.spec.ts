import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

/**
 * Converting {KSampler, VAE Decode} out of the default workflow leaves the two
 * `CheckpointLoaderSimple -> CLIP` links untouched — they sit wholly outside the
 * selection — so eight links remain in the root graph.
 */
const EXPECTED_ROOT_LINKS = [
  '4:0->HOST:0',
  '4:1->6:0',
  '4:1->7:0',
  '4:2->HOST:4',
  '5:0->HOST:3',
  '6:0->HOST:1',
  '7:0->HOST:2',
  'HOST:0->9:0'
]

const readRootLinks = (comfyPage: ComfyPage) =>
  comfyPage.page.evaluate(() => {
    const graph = window.app!.graph!
    const host = graph.nodes.find((node) => node.isSubgraphNode())
    if (!host) return ['no subgraph node']

    const label = (id: string | number) =>
      id === host.id ? 'HOST' : String(id)

    return [...graph.links.values()]
      .map(
        (link) =>
          `${label(link.origin_id)}:${link.origin_slot}->${label(link.target_id)}:${link.target_slot}`
      )
      .sort()
  })

const selectedNodeIds = (comfyPage: ComfyPage) =>
  comfyPage.page.evaluate(() =>
    [...(window.app!.canvas.selectedItems ?? [])]
      .map((item) => String((item as { id?: unknown }).id))
      .sort()
  )

test.describe(
  'Subgraph creation boundary links',
  { tag: ['@slow', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.workflow.loadWorkflow('default')

      // VAE Decode sits past the right edge of the 1280px canvas at the default
      // view, so clicking its title silently misses and the selection is left
      // holding KSampler alone.
      await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
      const [vaeDecode] =
        await comfyPage.nodeOps.getNodeRefsByTitle('VAE Decode')
      const canvasWidth = (await comfyPage.canvas.boundingBox())!.width
      let previousX = Number.NaN
      await expect
        .poll(async () => {
          const { x } = await vaeDecode.getTitlePosition()
          const settledInView = x === previousX && x < canvasWidth
          previousX = x
          return settledInView
        })
        .toBe(true)

      await comfyPage.nodeOps.selectNodes(['KSampler', 'VAE Decode'])
      expect(
        await selectedNodeIds(comfyPage),
        'both nodes must be selected, or the conversion under test is not the one being asserted'
      ).toEqual(['3', '8'])

      const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
      await ksampler.convertToSubgraph()
    })

    test('rewires every boundary link onto the new subgraph node', async ({
      comfyPage
    }) => {
      await expect
        .poll(() => readRootLinks(comfyPage))
        .toEqual(EXPECTED_ROOT_LINKS)
    })

    test('lands each boundary link on a type-compatible slot', async ({
      comfyPage
    }) => {
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const graph = window.app!.graph!
            const host = graph.nodes.find((node) => node.isSubgraphNode())
            if (!host) return ['no subgraph node']

            return [...graph.links.values()]
              .filter((link) => link.target_id === host.id)
              .filter(
                (link) => host.inputs[link.target_slot]?.type !== link.type
              )
              .map(
                (link) =>
                  `${link.type} link landed on slot ${link.target_slot} typed ${host.inputs[link.target_slot]?.type}`
              )
          })
        )
        .toEqual([])
    })

    test('preserves the rewiring across a save and reload', async ({
      comfyPage
    }) => {
      await expect
        .poll(() => readRootLinks(comfyPage))
        .toEqual(EXPECTED_ROOT_LINKS)

      await comfyPage.nodeOps.loadGraph(
        await comfyPage.nodeOps.getSerializedGraph()
      )

      await expect
        .poll(() => readRootLinks(comfyPage))
        .toEqual(EXPECTED_ROOT_LINKS)
    })
  }
)
