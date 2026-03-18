import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Subgraph IO drag visual feedback', { tag: '@subgraph' }, () => {
  test('SubgraphInput.connect fires node:slot-links:changed for widget inputs', async ({
    comfyPage
  }) => {
    // Load a workflow with a subgraph that has a promoted text widget,
    // then connect a new interior node to verify the event fires.
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    const result = await comfyPage.page.evaluate(() => {
      const graph = window.app!.canvas.graph!

      // Find the SubgraphNode and navigate into its subgraph
      const subgraphNode = graph._nodes.find(
        (n: { isSubgraphNode?: () => boolean }) => n.isSubgraphNode?.()
      ) as
        | {
            subgraph?: {
              addInput: (name: string, type: string) => void
              add: (node: unknown) => void
              inputNode: {
                slots: Array<{
                  name: string
                  connect: (...args: unknown[]) => void
                }>
              }
              trigger: (event: string, data: unknown) => unknown
            }
          }
        | undefined
      if (!subgraphNode?.subgraph) return { error: 'No subgraph node found' }

      const subgraph = subgraphNode.subgraph
      const LiteGraph = window.LiteGraph!

      // Add a new INT input to the subgraph
      subgraph.addInput('test_int', 'INT')

      // Add an interior node with a widget input
      const interiorNode = LiteGraph.createNode('Int')
      if (!interiorNode) return { error: 'Could not create Int node' }
      subgraph.add(interiorNode)

      // Listen for slot-links:changed
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
      const newSlot = subgraph.inputNode.slots.find(
        (s: { name: string }) => s.name === 'test_int'
      )
      if (!newSlot) return { error: 'Could not find test_int slot' }

      newSlot.connect(interiorNode.inputs[inputIndex], interiorNode)

      return { eventFired, eventConnected }
    })

    expect(result).not.toHaveProperty('error')
    expect(result.eventFired).toBe(true)
    expect(result.eventConnected).toBe(true)
  })

  test('dragNewFromSubgraphInput dispatches connecting event', async ({
    comfyPage
  }) => {
    // Verify that starting a link drag from a SubgraphInput slot
    // dispatches the 'connecting' event on the LinkConnector.
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )
    await comfyPage.nextFrame()

    interface TestSubgraph {
      inputNode: { slots: Array<unknown> }
    }
    interface TestSubgraphNode {
      subgraph?: TestSubgraph
    }

    const result = await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      if (!canvas) return { error: 'No canvas' }

      const sgNode = canvas.graph!._nodes.find(
        (n: { isSubgraphNode?: () => boolean }) => n.isSubgraphNode?.()
      ) as unknown as TestSubgraphNode | undefined
      if (!sgNode?.subgraph) return { error: 'No subgraph node found' }

      canvas.openSubgraph(
        sgNode.subgraph as unknown as Parameters<typeof canvas.openSubgraph>[0],
        sgNode as unknown as Parameters<typeof canvas.openSubgraph>[1]
      )

      const subgraph = canvas.graph as unknown as TestSubgraph | null
      if (!subgraph || !('inputNode' in subgraph))
        return { error: 'Not in subgraph' }

      let connectingFired = false
      let connectingTo: string | null = null

      function onConnecting(e: CustomEvent<{ connectingTo: string }>) {
        connectingFired = true
        connectingTo = e.detail.connectingTo
      }

      canvas.linkConnector.events.addEventListener('connecting', onConnecting)

      const inputSlot = subgraph.inputNode.slots[0]
      if (!inputSlot) return { error: 'No input slot' }

      type DragFn = typeof canvas.linkConnector.dragNewFromSubgraphInput
      try {
        ;(canvas.linkConnector.dragNewFromSubgraphInput as DragFn)(
          subgraph as unknown as Parameters<DragFn>[0],
          subgraph.inputNode as unknown as Parameters<DragFn>[1],
          inputSlot as unknown as Parameters<DragFn>[2]
        )
      } finally {
        canvas.linkConnector.events.removeEventListener(
          'connecting',
          onConnecting
        )
        canvas.linkConnector.reset()
      }

      return { connectingFired, connectingTo }
    })

    expect(result).not.toHaveProperty('error')
    expect(result.connectingFired).toBe(true)
    expect(result.connectingTo).toBe('input')
  })
})
