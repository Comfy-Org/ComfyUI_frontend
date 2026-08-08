import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { WorkspaceStore } from '../types/globals'

test.describe('Workflow reopen overwrites unsaved changes', () => {
  test('Re-loading same workflow file should not silently discard unsaved edits', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'Issue #10766 — dragging the same workflow file again overwrites unsaved changes without warning'
    })

    // Step 1: Load a workflow from file (establishes a "source" filename)
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nextFrame()

    // Step 2: Read the original KSampler seed value
    const originalSeed = await comfyPage.page.evaluate(() => {
      const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')
      return node?.widgets?.find((w) => w.name === 'seed')?.value as number
    })

    // Step 3: Modify the seed to a distinct value and trigger change tracking
    const modifiedSeed = originalSeed === 99999 ? 88888 : 99999
    await comfyPage.page.evaluate((newSeed) => {
      const app = window.app!
      const node = app.graph.nodes.find((n) => n.type === 'KSampler')
      const widget = node?.widgets?.find((w) => w.name === 'seed')
      if (widget) widget.value = newSeed
      app.graph.setDirtyCanvas(true, true)

      // Trigger change tracking so isModified reflects the edit — this is
      // what happens on mouseup / keyup during normal user interaction.
      const store = (app.extensionManager as WorkspaceStore).workflow
      store.activeWorkflow?.changeTracker?.checkState?.()
    }, modifiedSeed)
    await comfyPage.nextFrame()

    // Capture workflow count before reload for relative comparison
    const countBeforeReload = await comfyPage.workflow.getOpenWorkflowCount()

    // Step 4: Re-load the SAME workflow via loadGraphData with the same
    // filename. This mirrors what handleFile() does when the user drags
    // the same file onto the canvas a second time.
    const seedAfterReload = await comfyPage.page.evaluate(async (seed) => {
      const app = window.app!
      const workflow = JSON.parse(JSON.stringify(app.graph.serialize()))

      // Find seed widget index by name rather than hardcoding position
      const liveNode = app.graph.nodes.find((n) => n.type === 'KSampler')
      const seedIndex =
        liveNode?.widgets?.findIndex((w) => w.name === 'seed') ?? 0
      const ksNode = workflow.nodes.find(
        (n: { type: string }) => n.type === 'KSampler'
      )
      if (ksNode?.widgets_values) {
        ksNode.widgets_values[seedIndex] = seed
      }

      // This is the exact call handleFile makes — same filename triggers
      // isSameActiveWorkflowLoad in afterLoadNewGraph.
      await app.loadGraphData(workflow, true, true, 'single_ksampler', {})

      const reloadedNode = app.graph.nodes.find((n) => n.type === 'KSampler')
      return reloadedNode?.widgets?.find((w) => w.name === 'seed')
        ?.value as number
    }, originalSeed)

    const countAfterReload = await comfyPage.workflow.getOpenWorkflowCount()

    // The unsaved edits must not be silently discarded.
    // Acceptable outcomes:
    //   a) The modified seed value is preserved (user stays on modified tab)
    //   b) A new tab was opened for the re-loaded file
    const changesPreserved = seedAfterReload === modifiedSeed
    const newTabOpened = countAfterReload === countBeforeReload + 1

    expect(
      changesPreserved || newTabOpened,
      `Unsaved changes were silently discarded. ` +
        `Seed was ${modifiedSeed} before reload, became ${seedAfterReload} after. ` +
        `Tabs before: ${countBeforeReload}, after: ${countAfterReload}.`
    ).toBe(true)
  })
})
