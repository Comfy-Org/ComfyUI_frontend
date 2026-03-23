import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Graph', { tag: ['@smoke', '@canvas'] }, () => {
  // Should be able to fix link input slot index after swap the input order
  // Ref: https://github.com/Comfy-Org/ComfyUI_frontend/issues/3348
  test('Fix link input slots', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('inputs/input_order_swap')
    expect(
      await comfyPage.page.evaluate(() => {
        return window.app!.graph!.links.get(1)?.target_slot
      })
    ).toBe(1)
  })

  test('Validate workflow links', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Validation.Workflows', true)
    await comfyPage.workflow.loadWorkflow('links/bad_link')
    await expect.poll(() => comfyPage.toast.getVisibleToastCount()).toBe(2)
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
    await comfyPage.workflow.loadWorkflow('links/duplicate_links_slot_drift')

    const result = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!

      const subgraph = graph.subgraphs.values().next().value
      if (!subgraph) return { error: 'No subgraph found' }

      // Node 120 = Switch (CFG), connects to both KSamplerAdvanced 85 and 86
      const switchCfg = subgraph.getNodeById(120)
      const ksampler85 = subgraph.getNodeById(85)
      const ksampler86 = subgraph.getNodeById(86)
      if (!switchCfg || !ksampler85 || !ksampler86)
        return { error: 'Required nodes not found' }

      // Find cfg inputs by name (slot indices shift due to widget-to-input)
      const cfgInput85 = ksampler85.inputs.find(
        (i: { name: string }) => i.name === 'cfg'
      )
      const cfgInput86 = ksampler86.inputs.find(
        (i: { name: string }) => i.name === 'cfg'
      )
      const cfg85Linked = cfgInput85?.link != null
      const cfg86Linked = cfgInput86?.link != null

      // Verify the surviving links exist in the subgraph link map
      const cfg85LinkValid =
        cfg85Linked && subgraph.links.has(cfgInput85!.link!)
      const cfg86LinkValid =
        cfg86Linked && subgraph.links.has(cfgInput86!.link!)

      // Switch(CFG) output should have exactly 2 links (one to each KSampler)
      const switchOutputLinkCount = switchCfg.outputs[0]?.links?.length ?? 0

      // Count links from Switch(CFG) to node 85 cfg (should be 1, not 2)
      let cfgLinkToNode85Count = 0
      for (const link of subgraph.links.values()) {
        if (link.origin_id === 120 && link.target_id === 85)
          cfgLinkToNode85Count++
      }

      return {
        cfg85Linked,
        cfg86Linked,
        cfg85LinkValid,
        cfg86LinkValid,
        cfg85LinkId: cfgInput85?.link ?? null,
        cfg86LinkId: cfgInput86?.link ?? null,
        switchOutputLinkIds: [...(switchCfg.outputs[0]?.links ?? [])],
        switchOutputLinkCount,
        cfgLinkToNode85Count
      }
    })

    expect(result).not.toHaveProperty('error')
    // Both KSamplerAdvanced nodes must have their cfg input connected
    expect(result.cfg85Linked).toBe(true)
    expect(result.cfg86Linked).toBe(true)
    // Links must exist in the subgraph link map
    expect(result.cfg85LinkValid).toBe(true)
    expect(result.cfg86LinkValid).toBe(true)
    // Switch(CFG) output has exactly 2 links (one per KSamplerAdvanced)
    expect(result.switchOutputLinkCount).toBe(2)
    // Only 1 link from Switch(CFG) to node 85 (duplicate removed)
    expect(result.cfgLinkToNode85Count).toBe(1)
    // Output link IDs must match the input link IDs (source/target integrity)
    expect(result.switchOutputLinkIds).toEqual(
      expect.arrayContaining([result.cfg85LinkId, result.cfg86LinkId])
    )
  })
})
