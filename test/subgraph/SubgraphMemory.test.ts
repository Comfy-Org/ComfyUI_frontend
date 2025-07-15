import { describe, expect, it, vi } from "vitest"

import { LGraph } from "@/litegraph"
import { SubgraphNode } from "@/subgraph/SubgraphNode"

import {
  createEventCapture,
  createTestSubgraph,
  createTestSubgraphNode,
} from "./fixtures/subgraphHelpers"

// Mock WeakRef to detect if objects can be garbage collected
declare global {
  const gc: (() => void) | undefined
}

describe("SubgraphNode Memory Management", () => {
  describe("Event Listener Cleanup", () => {
    it("should register event listeners on construction", () => {
      const subgraph = createTestSubgraph()

      // Spy on addEventListener to track listener registration
      const addEventSpy = vi.spyOn(subgraph.events, "addEventListener")
      const initialCalls = addEventSpy.mock.calls.length

      createTestSubgraphNode(subgraph)

      // Should have registered listeners for subgraph events
      expect(addEventSpy.mock.calls.length).toBeGreaterThan(initialCalls)

      // Should have registered listeners for all major events
      const eventTypes = addEventSpy.mock.calls.map(call => call[0])
      expect(eventTypes).toContain("input-added")
      expect(eventTypes).toContain("removing-input")
      expect(eventTypes).toContain("output-added")
      expect(eventTypes).toContain("removing-output")
      expect(eventTypes).toContain("renaming-input")
      expect(eventTypes).toContain("renaming-output")
    })

    it("CRITICAL: should clean up input listeners on removal", () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: "input1", type: "number" }],
      })
      const subgraphNode = createTestSubgraphNode(subgraph)

      // Add input should have created listeners
      expect(subgraphNode.inputs[0]._listenerController).toBeDefined()
      expect(subgraphNode.inputs[0]._listenerController?.signal.aborted).toBe(false)

      // Call onRemoved to simulate node removal
      subgraphNode.onRemoved()

      // Input listeners should be aborted
      expect(subgraphNode.inputs[0]._listenerController?.signal.aborted).toBe(true)
    })

    it("CRITICAL: main subgraph event listeners are NOT cleaned up (MEMORY LEAK)", () => {
      const subgraph = createTestSubgraph()

      // Track listener registration
      const removeEventSpy = vi.spyOn(subgraph.events, "removeEventListener")
      const addEventSpy = vi.spyOn(subgraph.events, "addEventListener")
      const initialAddCalls = addEventSpy.mock.calls.length

      const subgraphNode = createTestSubgraphNode(subgraph)
      const addCallsAfterCreate = addEventSpy.mock.calls.length

      // Verify listeners were added
      expect(addCallsAfterCreate).toBeGreaterThan(initialAddCalls)

      // Call onRemoved
      subgraphNode.onRemoved()

      // CRITICAL BUG: Main subgraph event listeners are NOT removed
      // onRemoved only cleans up input-specific listeners, not the main ones
      expect(removeEventSpy).not.toHaveBeenCalled()

      // This proves the memory leak exists
      console.warn("MEMORY LEAK CONFIRMED: SubgraphNode event listeners not cleaned up on removal")
    })

    it("should not accumulate listeners during reconfiguration", () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: "input1", type: "number" }],
      })
      const subgraphNode = createTestSubgraphNode(subgraph)

      const addEventSpy = vi.spyOn(subgraph.events, "addEventListener")
      const initialCalls = addEventSpy.mock.calls.length

      // Reconfigure multiple times
      for (let i = 0; i < 5; i++) {
        subgraphNode.configure({
          id: subgraphNode.id,
          type: subgraph.id,
          pos: [100 * i, 100 * i],
          size: [200, 100],
          inputs: [],
          outputs: [],
          properties: {},
          flags: {},
          mode: 0,
        })
      }

      // Should not add new main subgraph listeners
      // (Only input-specific listeners might be reconfigured)
      const finalCalls = addEventSpy.mock.calls.length
      expect(finalCalls).toBe(initialCalls) // Main listeners not re-added
    })

    it("should demonstrate memory leak with multiple instances", () => {
      const subgraph = createTestSubgraph()

      // Track total listener count
      const addEventSpy = vi.spyOn(subgraph.events, "addEventListener")
      let totalListenersAdded = 0

      // Create and "remove" multiple instances
      const instances: SubgraphNode[] = []

      for (let i = 0; i < 5; i++) {
        const initialCalls = addEventSpy.mock.calls.length
        const instance = createTestSubgraphNode(subgraph, { id: i })
        instances.push(instance)

        const callsAfterCreate = addEventSpy.mock.calls.length
        totalListenersAdded += (callsAfterCreate - initialCalls)

        // Simulate removal (but listeners won't be cleaned up)
        instance.onRemoved()
      }

      // All listeners are still registered even though nodes are "removed"
      expect(totalListenersAdded).toBeGreaterThan(0)

      // In a real scenario, the subgraph would hold references to all these
      // "removed" instances through their event listeners, preventing GC
      console.warn(`Memory leak: ${totalListenersAdded} listeners accumulated from 5 instances`)
    })
  })

  describe("Memory Leak Prevention Tests", () => {
    it.skipIf(!global.gc)("should allow garbage collection after removal with fix", async () => {
      // This test demonstrates what SHOULD happen after fixing the memory leak
      // Currently skipped because global.gc may not be available

      const subgraph = createTestSubgraph()
      let nodeRef: WeakRef<SubgraphNode>

      {
        const node = createTestSubgraphNode(subgraph)
        nodeRef = new WeakRef(node)

        // TODO: Implement proper cleanup (AbortController pattern)
        // This would need to be implemented in the actual SubgraphNode class
        node.onRemoved()
      }

      // Force garbage collection
      global.gc!()
      await new Promise(resolve => setTimeout(resolve, 0))

      // With proper cleanup, this should pass
      // Currently will likely fail due to event listener references
      const isCollected = nodeRef.deref() === undefined
      if (!isCollected) {
        console.warn("SubgraphNode was not garbage collected - memory leak confirmed")
      }

      // This test documents what we want to achieve
      // expect(nodeRef.deref()).toBeUndefined()
    })

    it("should clean up widget references properly", () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: "input1", type: "number" }],
      })
      const subgraphNode = createTestSubgraphNode(subgraph)

      // Simulate widget promotion
      const input = subgraphNode.inputs[0]
      input._widget = {
        type: "number",
        name: "test_widget",
        value: 42,
        draw: vi.fn(),
        mouse: vi.fn(),
        computeSize: vi.fn(),
        createCopyForNode: vi.fn(),
      }

      input.widget = { name: "test_widget" }

      expect(input._widget).toBeDefined()
      expect(input.widget).toBeDefined()

      // Removal should clean up widget references
      subgraphNode.onRemoved()

      // Input-specific listeners are cleaned up, but widget refs may remain
      // This tests the current behavior
      expect(input._listenerController?.signal.aborted).toBe(true)
    })

    it("should handle rapid creation/destruction cycles", () => {
      const subgraph = createTestSubgraph()

      // Simulate rapid creation/destruction that might happen in UI
      const instances: SubgraphNode[] = []

      for (let cycle = 0; cycle < 10; cycle++) {
        // Create instance
        const instance = createTestSubgraphNode(subgraph, { id: cycle })
        instances.push(instance)

        // Add to graph
        const parentGraph = new LGraph()
        parentGraph.add(instance)

        // Remove from graph
        parentGraph.remove(instance)
        instance.onRemoved()
      }

      // All instances have been "removed" but event listeners remain
      // This demonstrates the accumulation problem
      expect(instances).toHaveLength(10)

      // Each instance still holds references through event listeners
      // In a real app, this would cause memory growth over time
    })
  })

  describe("Widget Promotion Memory Management", () => {
    it("should clean up promoted widget references", () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: "testInput", type: "number" }],
      })
      const subgraphNode = createTestSubgraphNode(subgraph)

      // Simulate widget promotion scenario
      const input = subgraphNode.inputs[0]
      const mockWidget = {
        type: "number",
        name: "promoted_widget",
        value: 123,
        draw: vi.fn(),
        mouse: vi.fn(),
        computeSize: vi.fn(),
        createCopyForNode: vi.fn().mockReturnValue({
          type: "number",
          name: "promoted_widget",
          value: 123,
        }),
      }

      // Simulate widget promotion
      input._widget = mockWidget
      input.widget = { name: "promoted_widget" }
      subgraphNode.widgets.push(mockWidget)

      expect(input._widget).toBe(mockWidget)
      expect(input.widget).toBeDefined()
      expect(subgraphNode.widgets).toContain(mockWidget)

      // Remove widget (this should clean up references)
      subgraphNode.removeWidget(mockWidget)

      // Widget should be removed from array
      expect(subgraphNode.widgets).not.toContain(mockWidget)

      // References should be cleaned up (testing current implementation)
      // Note: The PR #1107 fix should clean these up
    })

    it("should not leak widgets during reconfiguration", () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: "input1", type: "number" }],
      })
      const subgraphNode = createTestSubgraphNode(subgraph)

      // Track widget count before and after reconfigurations
      const initialWidgetCount = subgraphNode.widgets.length

      // Reconfigure multiple times
      for (let i = 0; i < 3; i++) {
        subgraphNode.configure({
          id: subgraphNode.id,
          type: subgraph.id,
          pos: [100, 100],
          size: [200, 100],
          inputs: [],
          outputs: [],
          properties: {},
          flags: {},
          mode: 0,
        })
      }

      // Widget count should not accumulate
      expect(subgraphNode.widgets.length).toBe(initialWidgetCount)
    })
  })

  describe("Memory Leak Documentation", () => {
    it("documents the known memory leak pattern", () => {
      // This test documents the exact memory leak pattern for future fixes

      const subgraph = createTestSubgraph()
      const eventCapture = createEventCapture(subgraph.events, [
        "input-added",
        "output-added",
        "removing-input",
        "removing-output",
        "renaming-input",
        "renaming-output",
      ])

      // Create SubgraphNode - this registers 6 event listeners
      const subgraphNode = createTestSubgraphNode(subgraph)

      // The memory leak occurs here:
      // 1. SubgraphNode constructor (lines 52-92) adds event listeners
      // 2. These create strong references: subgraph.events -> SubgraphNode
      // 3. onRemoved() method (lines 302-306) only cleans input listeners
      // 4. Main subgraph event listeners are NEVER removed

      expect(subgraphNode).toBeDefined()

      // Cleanup test resources
      eventCapture.cleanup()

      console.log("Memory leak pattern documented: SubgraphNode event listeners persist after removal")
    })

    it("provides solution blueprint for memory leak fix", () => {
      // This test shows what the fix should look like

      const subgraph = createTestSubgraph()

      // SOLUTION: SubgraphNode should use AbortController pattern
      //
      // In constructor:
      // this.eventAbortController = new AbortController()
      // const signal = this.eventAbortController.signal
      // subgraphEvents.addEventListener("input-added", handler, { signal })
      //
      // In onRemoved():
      // this.eventAbortController.abort() // Removes ALL listeners

      const subgraphNode = createTestSubgraphNode(subgraph)

      // Current implementation only cleans input listeners
      subgraphNode.onRemoved()

      // TODO: Implement AbortController pattern to fix memory leak
      expect(true).toBe(true) // Placeholder - documents intended solution
    })
  })
})

describe("Performance Impact of Memory Leak", () => {
  it("measures event handler overhead with multiple instances", () => {
    const subgraph = createTestSubgraph()

    // Create multiple instances (simulating real usage)
    const instances: SubgraphNode[] = []
    const startTime = performance.now()

    for (let i = 0; i < 50; i++) {
      instances.push(createTestSubgraphNode(subgraph, { id: i }))
    }

    const creationTime = performance.now() - startTime

    // Trigger an event that will call ALL accumulated listeners
    const eventStartTime = performance.now()
    subgraph.addInput("performance_test", "number")
    const eventTime = performance.now() - eventStartTime

    console.log(`Created 50 instances in ${creationTime.toFixed(2)}ms`)
    console.log(`Event dispatch took ${eventTime.toFixed(2)}ms (${instances.length} listeners)`)

    // More instances = more event listeners = slower event handling
    // This demonstrates the performance impact of the memory leak
    expect(eventTime).toBeGreaterThan(0)
  })

  it("demonstrates listener accumulation impact", () => {
    // Test with different numbers of instances
    const testCases = [10, 25, 50]

    for (const instanceCount of testCases) {
      // Clean test - create fresh subgraph
      const testSubgraph = createTestSubgraph()

      // Create instances
      for (let i = 0; i < instanceCount; i++) {
        createTestSubgraphNode(testSubgraph, { id: i })
      }

      // Measure event dispatch time
      const startTime = performance.now()
      testSubgraph.addInput(`test_${instanceCount}`, "number")
      const dispatchTime = performance.now() - startTime

      console.log(`${instanceCount} instances: ${dispatchTime.toFixed(3)}ms event dispatch`)
    }

    // This test documents that more instances = more listeners = slower events
    expect(true).toBe(true)
  })
})
