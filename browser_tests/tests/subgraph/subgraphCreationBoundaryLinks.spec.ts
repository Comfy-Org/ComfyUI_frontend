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
            if (!host) return { error: 'no subgraph node' }

            const links = [...graph.links.values()]
            return {
              rootLinkCount: links.length,
              inputCount: host.inputs.length,
              outputCount: host.outputs.length,
              unconnectedInputs: host.inputs.filter(
                (input) => input.link == null
              ).length,
              sources: links
                .filter((link) => link.target_id === host.id)
                .map((link) => `${link.origin_id}:${link.origin_slot}`)
                .sort(),
              saveImageFedByHost:
                links.find((link) => String(link.target_id) === '9')
                  ?.origin_id === host.id,
              // Diagnostics: printed as context in the assertion diff.
              diagnosticHostId: String(host.id),
              diagnosticNodes: graph.nodes
                .map((node) => `${node.id}:${node.type}`)
                .sort(),
              diagnosticLinks: links
                .map(
                  (link) =>
                    `${link.origin_id}:${link.origin_slot}->${link.target_id}:${link.target_slot}(${link.type})`
                )
                .sort(),
              diagnosticHostSlots: host.inputs
                .map(
                  (input, index) =>
                    `${index} ${input.name}:${input.type}=${input.link ?? 'NULL'}`
                )
                .concat(
                  host.outputs.map(
                    (output, index) =>
                      `out${index} ${output.name}:${output.type}=[${(output.links ?? []).join('|')}]`
                  )
                )
            }
          })
        )
        .toEqual({
          rootLinkCount: 6,
          inputCount: 5,
          outputCount: 1,
          unconnectedInputs: 0,
          sources: ['4:0', '4:2', '5:0', '6:0', '7:0'],
          saveImageFedByHost: true,
          diagnosticHostId: expect.anything(),
          diagnosticNodes: expect.anything(),
          diagnosticLinks: expect.anything(),
          diagnosticHostSlots: expect.anything()
        })
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
