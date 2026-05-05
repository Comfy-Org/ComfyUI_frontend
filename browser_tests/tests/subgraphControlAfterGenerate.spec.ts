import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe(
  'control_after_generate suppression when input is linked',
  { tag: '@subgraph' },
  () => {
    test('control_after_generate does not increment value when widget input has a link', async ({
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

        const sourceWidget = source.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        if (sourceWidget) sourceWidget.value = 42

        source.connect(0, target, 0)

        const targetWidget = target.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        const controlWidget = targetWidget?.linkedWidgets?.find(
          (w: { name: string }) => w.name === 'control_after_generate'
        )
        if (controlWidget) controlWidget.value = 'increment'

        return {
          targetId: String(target.id),
          targetValue: targetWidget?.value as number,
          controlConfigured: Boolean(controlWidget)
        }
      })

      expect(setup, 'Could not create Int nodes').not.toBeNull()
      if (!setup) return

      expect(setup.controlConfigured).toBe(true)

      await comfyPage.nextFrame()

      const valueBefore = await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)
        const w = node?.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        return w?.value as number | undefined
      }, setup.targetId)

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

        source.connect(0, target, 0)

        const targetWidget = target.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        const controlWidget = targetWidget?.linkedWidgets?.find(
          (w: { name: string }) => w.name === 'control_after_generate'
        )
        if (controlWidget) controlWidget.value = 'increment'

        target.disconnectInput(0)

        return {
          targetId: String(target.id),
          controlConfigured: Boolean(controlWidget)
        }
      })

      expect(setup, 'Could not create Int nodes').not.toBeNull()
      if (!setup) return

      expect(setup.controlConfigured).toBe(true)

      await comfyPage.nextFrame()

      const valueBefore = await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)
        const w = node?.widgets?.find(
          (w: { name: string }) => w.name === 'value'
        )
        return w?.value as number | undefined
      }, setup.targetId)

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

      expect(valueAfter).toBe((valueBefore ?? 0) + 1)
    })

    test('promoted subgraph input suppresses control_after_generate when externally linked', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()

      // Select just the KSampler (id 3) and convert to subgraph
      const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
      await ksampler.click('title')
      const subgraphNode = await ksampler.convertToSubgraph()
      await comfyPage.nextFrame()

      expect(await subgraphNode.exists()).toBe(true)

      const setup = await comfyPage.page.evaluate((sgNodeId) => {
        const graph = window.app!.canvas.graph!
        const sgNode = graph.getNodeById(sgNodeId)
        if (!sgNode?.isSubgraphNode?.()) return null

        const subgraph = sgNode.subgraph
        if (!subgraph) return null

        // Find the interior KSampler node
        const interiorNode = subgraph._nodes.find(
          (n: { type?: string }) => n.type === 'KSampler'
        )
        if (!interiorNode) return null

        // Find the seed widget and its control widget
        const seedWidget = interiorNode.widgets?.find(
          (w: { name: string }) => w.name === 'seed'
        )
        const controlWidget = seedWidget?.linkedWidgets?.find(
          (w: { name: string }) => w.name === 'control_after_generate'
        )
        if (controlWidget) controlWidget.value = 'increment'

        // Find the SubgraphNode input index for seed
        const seedInputIndex = sgNode.inputs?.findIndex(
          (inp: { name: string }) => inp.name === 'seed'
        )

        // Create an external Int node and connect it to the SubgraphNode's seed input
        const extSource = window.LiteGraph!.createNode('Int')
        if (!extSource) return null

        extSource.pos = [100, 200]
        graph.add(extSource)

        if (seedInputIndex != null && seedInputIndex >= 0) {
          extSource.connect(0, sgNode, seedInputIndex)
        }

        return {
          interiorNodeId: String(interiorNode.id),
          sgNodeId: String(sgNode.id),
          seedInputIndex: seedInputIndex as number,
          controlConfigured: Boolean(controlWidget),
          hasExternalLink: sgNode.inputs?.[seedInputIndex!]?.link != null
        }
      }, subgraphNode.id)

      expect(setup, 'Could not set up promoted subgraph fixture').not.toBeNull()
      if (!setup) return

      expect(setup.controlConfigured).toBe(true)
      expect(setup.hasExternalLink).toBe(true)

      await comfyPage.nextFrame()

      // Helper to access the interior KSampler via the SubgraphNode
      function getInteriorSeedValue(sgNodeId: string, interiorNodeId: string) {
        return comfyPage.page.evaluate(
          ({ sgId, intId }) => {
            const sgNode = window.app!.canvas.graph!.getNodeById(sgId)
            if (!sgNode?.isSubgraphNode?.()) return undefined
            const interior = sgNode.subgraph?._nodes?.find(
              (n) => String(n.id) === intId
            )
            const w = interior?.widgets?.find(
              (w: { name: string }) => w.name === 'seed'
            )
            return w?.value as number | undefined
          },
          { sgId: sgNodeId, intId: interiorNodeId }
        )
      }

      function triggerAfterQueued(sgNodeId: string, interiorNodeId: string) {
        return comfyPage.page.evaluate(
          ({ sgId, intId }) => {
            const sgNode = window.app!.canvas.graph!.getNodeById(sgId)
            if (!sgNode?.isSubgraphNode?.()) return
            const interior = sgNode.subgraph?._nodes?.find(
              (n) => String(n.id) === intId
            )
            for (const widget of interior?.widgets ?? []) {
              widget.afterQueued?.({})
            }
          },
          { sgId: sgNodeId, intId: interiorNodeId }
        )
      }

      const valueBefore = await getInteriorSeedValue(
        setup.sgNodeId,
        setup.interiorNodeId
      )

      // Trigger afterQueued on the interior node — should be suppressed
      await triggerAfterQueued(setup.sgNodeId, setup.interiorNodeId)

      await comfyPage.nextFrame()

      const valueAfterLinked = await getInteriorSeedValue(
        setup.sgNodeId,
        setup.interiorNodeId
      )

      // Seed should NOT have changed — externally driven through subgraph
      expect(valueAfterLinked).toBe(valueBefore)

      // Disconnect the external link from the SubgraphNode's seed input
      await comfyPage.page.evaluate(
        ({ sgNodeId, seedInputIndex }) => {
          const sgNode = window.app!.canvas.graph!.getNodeById(sgNodeId)
          sgNode?.disconnectInput(seedInputIndex)
        },
        { sgNodeId: setup.sgNodeId, seedInputIndex: setup.seedInputIndex }
      )

      await comfyPage.nextFrame()

      // Trigger afterQueued again — should increment now
      await triggerAfterQueued(setup.sgNodeId, setup.interiorNodeId)

      await comfyPage.nextFrame()

      const valueAfterDisconnect = await getInteriorSeedValue(
        setup.sgNodeId,
        setup.interiorNodeId
      )

      // Seed should have incremented after the external link was removed
      expect(valueAfterDisconnect).toBe((valueBefore ?? 0) + 1)
    })
  }
)
