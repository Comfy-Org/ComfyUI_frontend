import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe(
  'control_after_generate suppression when input is linked',
  { tag: '@subgraph' },
  () => {
    test('control_after_generate does not increment value when widget input has a link', async ({
      comfyPage
    }) => {
      // Set up two Int nodes: source drives target's value
      const setup = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const LiteGraph = window.LiteGraph!

        const source = LiteGraph.createNode('Int')
        const target = LiteGraph.createNode('Int')
        if (!source || !target) return null

        source.pos = [100, 200]
        target.pos = [400, 200]
        graph.add(source)
        graph.add(target)

        // Set source value to a known value
        const sourceWidget = source.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        if (sourceWidget) sourceWidget.value = 42

        // Connect source INT output to target value input
        source.connect(0, target, 0)

        // Find the target's control widget and set it to increment
        const targetWidget = target.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        const controlWidget = targetWidget?.linkedWidgets?.find(
          (w: { name: string }) => w.name === 'control_after_generate'
        )
        if (controlWidget) controlWidget.value = 'increment'

        return {
          targetId: String(target.id),
          targetValue: targetWidget?.value as number
        }
      })

      if (!setup) {
        test.skip(true, 'Could not create Int nodes')
        return
      }

      await comfyPage.nextFrame()

      // Record the target widget value before queuing
      const valueBefore = await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)
        const w = node?.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        return w?.value as number | undefined
      }, setup.targetId)

      // Simulate the afterQueued callback (which runs applyWidgetControl)
      await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)
        for (const widget of node?.widgets ?? []) {
          widget.afterQueued?.({})
        }
      }, setup.targetId)

      await comfyPage.nextFrame()

      // The value should NOT have changed because the input is linked
      const valueAfter = await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)
        const w = node?.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        return w?.value as number | undefined
      }, setup.targetId)

      expect(valueAfter).toBe(valueBefore)
    })

    test('control_after_generate resumes after link is disconnected', async ({
      comfyPage
    }) => {
      const setup = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const LiteGraph = window.LiteGraph!

        const source = LiteGraph.createNode('Int')
        const target = LiteGraph.createNode('Int')
        if (!source || !target) return null

        source.pos = [100, 200]
        target.pos = [400, 200]
        graph.add(source)
        graph.add(target)

        // Connect then disconnect
        source.connect(0, target, 0)

        // Set control to increment
        const targetWidget = target.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        const controlWidget = targetWidget?.linkedWidgets?.find(
          (w: { name: string }) => w.name === 'control_after_generate'
        )
        if (controlWidget) controlWidget.value = 'increment'

        // Disconnect
        target.disconnectInput(0)

        return { targetId: String(target.id) }
      })

      if (!setup) {
        test.skip(true, 'Could not create Int nodes')
        return
      }

      await comfyPage.nextFrame()

      const valueBefore = await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)
        const w = node?.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        return w?.value as number | undefined
      }, setup.targetId)

      // Trigger afterQueued — should increment now since link is gone
      await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)
        for (const widget of node?.widgets ?? []) {
          widget.afterQueued?.({})
        }
      }, setup.targetId)

      await comfyPage.nextFrame()

      const valueAfter = await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)
        const w = node?.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        return w?.value as number | undefined
      }, setup.targetId)

      // Value should have incremented since the link was removed
      expect(valueAfter).toBe((valueBefore ?? 0) + 1)
    })
  }
)
