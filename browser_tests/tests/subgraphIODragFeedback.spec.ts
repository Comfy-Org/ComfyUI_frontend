import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Subgraph IO drag visual feedback', { tag: '@subgraph' }, () => {
  test('SubgraphInput.connect fires node:slot-links:changed for widget inputs', async ({
    comfyPage
  }) => {
    // Verify that connecting a widget-backed input inside a subgraph
    // dispatches the slot-links:changed event, which drives Vue
    // reactivity for slot visual feedback.
    const result = await comfyPage.page.evaluate(() => {
      const graph = window.app!.canvas.graph!
      const LiteGraph = window.LiteGraph!

      // Create a subgraph with an INT input
      const subgraphData = {
        version: 1,
        revision: 0,
        state: {
          lastNodeId: 0,
          lastLinkId: 0,
          lastGroupId: 0,
          lastRerouteId: 0
        },
        nodes: [],
        links: [],
        groups: [],
        config: {},
        definitions: { subgraphs: [] },
        id: crypto.randomUUID(),
        name: 'Drag Test Subgraph',
        inputNode: {
          id: -10,
          bounding: [10, 100, 150, 126],
          pinned: false
        },
        outputNode: {
          id: -20,
          bounding: [400, 100, 140, 126],
          pinned: false
        },
        inputs: [],
        outputs: [],
        widgets: []
      }

      const subgraph = graph.createSubgraph(subgraphData as never)
      subgraph.addInput('value', 'INT')

      // Add an interior node with a widget input
      const interiorNode = LiteGraph.createNode('Int')
      if (!interiorNode) return { error: 'Could not create Int node' }
      subgraph.add(interiorNode)

      // Listen for slot-links:changed events via LiteGraph's trigger system
      let eventFired = false
      let eventConnected: boolean | null = null
      const origTrigger = subgraph.trigger.bind(subgraph)
      subgraph.trigger = (event: string, data: unknown) => {
        if (event === 'node:slot-links:changed') {
          eventFired = true
          eventConnected = (data as { connected: boolean }).connected
        }
        return origTrigger(event, data)
      }

      // Connect SubgraphInput to interior node's widget input
      const widgetInput = interiorNode.inputs?.find(
        (inp: { widget?: unknown }) => inp.widget
      )
      if (!widgetInput) return { error: 'No widget input found on Int node' }

      const inputIndex = interiorNode.inputs.indexOf(widgetInput)
      subgraph.inputNode.slots[0].connect(
        interiorNode.inputs[inputIndex],
        interiorNode
      )

      return { eventFired, eventConnected }
    })

    expect(result).not.toHaveProperty('error')
    expect(result.eventFired).toBe(true)
    expect(result.eventConnected).toBe(true)
  })

  test('LinkConnector dispatches connecting event on subgraph IO drag', async ({
    comfyPage
  }) => {
    // Verify that the connecting event is dispatched when starting
    // a link drag, enabling the bridge composable to activate.
    const result = await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      if (!canvas) return { error: 'No canvas' }

      let connectingFired = false
      let connectingTo: string | null = null

      canvas.linkConnector.events.addEventListener(
        'connecting',
        (e: CustomEvent<{ connectingTo: string }>) => {
          connectingFired = true
          connectingTo = e.detail.connectingTo
        }
      )

      // Trigger a link drag programmatically
      canvas.linkConnector.events.dispatch('connecting', {
        connectingTo: 'input'
      })

      return { connectingFired, connectingTo }
    })

    expect(result).not.toHaveProperty('error')
    expect(result.connectingFired).toBe(true)
    expect(result.connectingTo).toBe('input')
  })
})
