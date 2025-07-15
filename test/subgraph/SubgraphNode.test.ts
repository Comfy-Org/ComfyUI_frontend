/**
 * SubgraphNode Tests
 *
 * Tests for SubgraphNode instances including construction,
 * IO synchronization, and edge cases.
 */

import { describe, expect, it } from "vitest"

import { LGraph } from "@/litegraph"

import { subgraphTest } from "./fixtures/subgraphFixtures"
import {
  createTestSubgraph,
  createTestSubgraphNode,
} from "./fixtures/subgraphHelpers"

describe("SubgraphNode Construction", () => {
  it("should create a SubgraphNode from a subgraph definition", () => {
    const subgraph = createTestSubgraph({
      name: "Test Definition",
      inputs: [{ name: "input", type: "number" }],
      outputs: [{ name: "output", type: "number" }],
    })

    const subgraphNode = createTestSubgraphNode(subgraph)

    expect(subgraphNode).toBeDefined()
    expect(subgraphNode.subgraph).toBe(subgraph)
    expect(subgraphNode.type).toBe(subgraph.id)
    expect(subgraphNode.isVirtualNode).toBe(true)
  })

  subgraphTest("should synchronize slots with subgraph definition", ({ subgraphWithNode }) => {
    const { subgraph, subgraphNode } = subgraphWithNode

    // SubgraphNode should have same number of inputs/outputs as definition
    expect(subgraphNode.inputs).toHaveLength(subgraph.inputs.length)
    expect(subgraphNode.outputs).toHaveLength(subgraph.outputs.length)
  })

  subgraphTest("should update slots when subgraph definition changes", ({ subgraphWithNode }) => {
    const { subgraph, subgraphNode } = subgraphWithNode

    const initialInputCount = subgraphNode.inputs.length

    // Add an input to the subgraph definition
    subgraph.addInput("new_input", "string")

    // SubgraphNode should automatically update (this tests the event system)
    expect(subgraphNode.inputs).toHaveLength(initialInputCount + 1)
  })
})

describe("SubgraphNode Integration", () => {
  it("should be addable to a parent graph", () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const parentGraph = new LGraph()

    parentGraph.add(subgraphNode)

    expect(parentGraph.nodes).toContain(subgraphNode)
    expect(subgraphNode.graph).toBe(parentGraph)
  })

  subgraphTest("should maintain reference to root graph", ({ subgraphWithNode }) => {
    const { subgraphNode } = subgraphWithNode

    // For this test, parentGraph should be the root, but in nested scenarios
    // it would traverse up to find the actual root
    expect(subgraphNode.rootGraph).toBeDefined()
  })
})

describe("Foundation Test Utilities", () => {
  it("should create test SubgraphNodes with custom options", () => {
    const subgraph = createTestSubgraph()
    const customPos: [number, number] = [500, 300]
    const customSize: [number, number] = [250, 120]

    const subgraphNode = createTestSubgraphNode(subgraph, {
      pos: customPos,
      size: customSize,
    })

    expect(Array.from(subgraphNode.pos)).toEqual(customPos)
    expect(Array.from(subgraphNode.size)).toEqual(customSize)
  })

  subgraphTest("fixtures should provide properly configured SubgraphNode", ({ subgraphWithNode }) => {
    const { subgraph, subgraphNode, parentGraph } = subgraphWithNode

    expect(subgraph).toBeDefined()
    expect(subgraphNode).toBeDefined()
    expect(parentGraph).toBeDefined()
    expect(parentGraph.nodes).toContain(subgraphNode)
  })
})
