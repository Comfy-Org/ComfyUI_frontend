import { expect } from '@playwright/test'

import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Graph', { tag: ['@smoke', '@canvas'] }, () => {
  // Should be able to fix link input slot index after swap the input order
  // Ref: https://github.com/Comfy-Org/ComfyUI_frontend/issues/3348
  test('Fix link input slots', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/input_order_swap')
    await expect
      .poll(() =>
        comfyPage.page.evaluate(
          (linkId) => window.app!.graph!.links.get(linkId)?.target_slot,
          toLinkId(1)
        )
      )
      .toBe(1)
  })

  test('Validate workflow links', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Validation.Workflows', true)
    await comfyPage.workflow.loadWorkflow('links/bad_link')
    await expect(comfyPage.toast.visibleToasts).toHaveCount(2)
  })

  // Regression: duplicate links with shifted target_slot (widget-to-input
  // conversion) caused the wrong link to survive during deduplication.
  // Switch(CFG) node 120 connects to both KSamplerAdvanced 85 and 86 (2 links).
  // Links 257 and 276 shared the same tuple (origin=120 → target=85 slot=5).
  // Node 85's input.link was 276 (valid), but the bug kept 257 (stale) and
  // removed 276, breaking the cfg connection on KSamplerAdvanced 85.
  // Ref: https://github.com/Comfy-Org/ComfyUI_frontend/issues/10291
  test('Deduplicates links without breaking connections on slot-drift workflow', async ({
    comfyPage
  }) => {
    await test.step('Load workflow with slot-drifted duplicate links', async () => {
      await comfyPage.workflow.loadWorkflow('links/duplicate_links_slot_drift')
    })

    const nodeIds = {
      switchCfg: toNodeId(120),
      ksampler85: toNodeId(85),
      ksampler86: toNodeId(86)
    } as const

    function evaluateGraph() {
      return comfyPage.page.evaluate((nodeIds) => {
        function findCfgInput<T extends { name: string }>(
          inputs: readonly T[]
        ) {
          return inputs.find((input) => input.name === 'cfg')
        }

        function isLinkValid(
          links: ReadonlyMap<unknown, unknown>,
          linkId: unknown
        ) {
          return linkId != null && links.has(linkId)
        }

        function countDuplicateLinks(
          links: Iterable<{ origin_id: unknown; target_id: unknown }>,
          originId: string,
          targetId: string
        ) {
          return [...links].filter(
            (link) =>
              String(link.origin_id) === originId &&
              String(link.target_id) === targetId
          ).length
        }

        const graph = window.app!.graph!
        const subgraph = graph.subgraphs.values().next().value
        if (!subgraph) return { error: 'No subgraph found' }

        // Node 120 = Switch (CFG), connects to both KSamplerAdvanced 85 and 86
        const switchCfg = subgraph.getNodeById(nodeIds.switchCfg)
        const ksampler85 = subgraph.getNodeById(nodeIds.ksampler85)
        const ksampler86 = subgraph.getNodeById(nodeIds.ksampler86)
        if (!switchCfg || !ksampler85 || !ksampler86)
          return { error: 'Required nodes not found' }

        // Find cfg inputs by name (slot indices shift due to widget-to-input)
        const cfgInput85 = findCfgInput(ksampler85.inputs)
        const cfgInput86 = findCfgInput(ksampler86.inputs)
        const cfg85Linked = cfgInput85?.link != null
        const cfg86Linked = cfgInput86?.link != null

        return {
          cfg85Linked,
          cfg86Linked,
          // Verify the surviving links exist in the subgraph link map
          cfg85LinkValid: isLinkValid(subgraph.links, cfgInput85?.link),
          cfg86LinkValid: isLinkValid(subgraph.links, cfgInput86?.link),
          cfg85LinkId: cfgInput85?.link ?? null,
          cfg86LinkId: cfgInput86?.link ?? null,
          switchOutputLinkIds: [...(switchCfg.outputs[0]?.links ?? [])],
          switchOutputLinkCount: switchCfg.outputs[0]?.links?.length ?? 0,
          // Count links from Switch(CFG) to node 85 cfg (should be 1, not 2)
          cfgLinkToNode85Count: countDuplicateLinks(
            subgraph.links.values(),
            '120',
            '85'
          )
        }
      }, nodeIds)
    }

    await test.step('Verify duplicate links are removed without breaking connections', async () => {
      // Poll graph state once, then assert all properties
      await expect(async () => {
        const r = await evaluateGraph()
        expect(r).toEqual(
          expect.objectContaining({
            // Both KSamplerAdvanced nodes must have their cfg input connected
            cfg85Linked: true,
            cfg86Linked: true,
            // Links must exist in the subgraph link map
            cfg85LinkValid: true,
            cfg86LinkValid: true,
            // Switch(CFG) output has exactly 2 links (one per KSamplerAdvanced)
            switchOutputLinkCount: 2,
            // Only 1 link from Switch(CFG) to node 85 (duplicate removed)
            cfgLinkToNode85Count: 1,
            // Output link IDs must match the input link IDs (source/target integrity)
            switchOutputLinkIds: expect.arrayContaining([
              r.cfg85LinkId,
              r.cfg86LinkId
            ])
          })
        )
      }).toPass({ timeout: 5000 })
    })
  })
})
