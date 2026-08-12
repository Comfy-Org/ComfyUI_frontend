import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Subgraph creation boundary links',
  { tag: ['@slow', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nodeOps.selectNodes(['KSampler', 'VAE Decode'])
      const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
      await ksampler.convertToSubgraph()
    })

    test('rewires every boundary link onto the new subgraph node', async ({
      comfyPage
    }) => {
      await expect
        .poll(() =>
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
        )
        .toEqual([
          '4:0->HOST:0',
          '4:1->6:0',
          '4:1->7:0',
          '4:2->HOST:4',
          '5:0->HOST:3',
          '6:0->HOST:1',
          '7:0->HOST:2',
          'HOST:0->9:0'
        ])
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
      const serialisedLinks = () =>
        comfyPage.page.evaluate(() =>
          [...window.app!.graph!.links.values()]
            .map(
              (link) =>
                `${link.origin_id}:${link.origin_slot}->${link.target_id}:${link.target_slot}`
            )
            .sort()
        )

      const beforeReload = await serialisedLinks()
      await comfyPage.nodeOps.loadGraph(
        await comfyPage.nodeOps.getSerializedGraph()
      )

      await expect.poll(serialisedLinks).toEqual(beforeReload)
    })
  }
)
