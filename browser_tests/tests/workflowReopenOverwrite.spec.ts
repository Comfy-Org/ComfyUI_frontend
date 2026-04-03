import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

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

    // Step 3: Modify the seed to a distinct value
    const modifiedSeed = originalSeed === 99999 ? 88888 : 99999
    await comfyPage.page.evaluate((newSeed) => {
      const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')
      const widget = node?.widgets?.find((w) => w.name === 'seed')
      if (widget) widget.value = newSeed
      window.app!.graph.setDirtyCanvas(true, true)
    }, modifiedSeed)
    await comfyPage.nextFrame()

    // Step 4: Re-load the SAME workflow via loadGraphData with the same
    // filename. This mirrors what handleFile() does when the user drags
    // the same file onto the canvas a second time.
    const seedAfterReload = await comfyPage.page.evaluate(async () => {
      const app = window.app!
      const workflow = JSON.parse(JSON.stringify(app.graph.serialize()))

      // Reset the seed back to its original serialized value to simulate
      // re-reading the unmodified file from disk.
      const ksNode = workflow.nodes.find(
        (n: { type: string }) => n.type === 'KSampler'
      )
      if (ksNode?.widgets_values) {
        ksNode.widgets_values[0] = 0
      }

      // This is the exact call handleFile makes — same filename triggers
      // isSameActiveWorkflowLoad in afterLoadNewGraph.
      await app.loadGraphData(workflow, true, true, 'single_ksampler', {})

      // Return the seed value after reload
      const reloadedNode = app.graph.nodes.find((n) => n.type === 'KSampler')
      return reloadedNode?.widgets?.find((w) => w.name === 'seed')
        ?.value as number
    })

    const workflowCount = await comfyPage.workflow.getOpenWorkflowCount()

    // The unsaved edits must not be silently discarded.
    // Acceptable outcomes:
    //   a) The modified seed value is preserved (user stays on modified tab)
    //   b) A new tab was opened for the re-loaded file
    const changesPreserved = seedAfterReload === modifiedSeed
    const newTabOpened = workflowCount > 2

    expect(
      changesPreserved || newTabOpened,
      `Unsaved changes were silently discarded. ` +
        `Seed was ${modifiedSeed} before reload, became ${seedAfterReload} after. ` +
        `Workflow count: ${workflowCount} (expected > 2 if new tab opened).`
    ).toBe(true)
  })
})
