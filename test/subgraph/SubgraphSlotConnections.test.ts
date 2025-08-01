import { describe, expect, it } from "vitest"

import { LGraphNode } from "@/litegraph"
import { NodeInputSlot } from "@/node/NodeInputSlot"
import { NodeOutputSlot } from "@/node/NodeOutputSlot"
import { isSubgraphInput, isSubgraphOutput } from "@/subgraph/subgraphUtils"

import { createTestSubgraph, createTestSubgraphNode } from "./fixtures/subgraphHelpers"

describe("Subgraph slot connections", () => {
  describe("SubgraphInput connections", () => {
    it("should connect to compatible regular input slots", () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: "test_input", type: "number" }],
      })

      const subgraphInput = subgraph.inputs[0]

      const node = new LGraphNode("TestNode")
      node.addInput("compatible_input", "number")
      node.addInput("incompatible_input", "string")
      subgraph.add(node)

      const compatibleSlot = node.inputs[0] as NodeInputSlot
      const incompatibleSlot = node.inputs[1] as NodeInputSlot

      expect(compatibleSlot.isValidTarget(subgraphInput)).toBe(true)
      expect(incompatibleSlot.isValidTarget(subgraphInput)).toBe(false)
    })

    // "not implemented" yet, but the test passes in terms of type checking
    // it("should connect to compatible SubgraphOutput", () => {
    //   const subgraph = createTestSubgraph({
    //     inputs: [{ name: "test_input", type: "number" }],
    //     outputs: [{ name: "test_output", type: "number" }],
    //   })

    //   const subgraphInput = subgraph.inputs[0]
    //   const subgraphOutput = subgraph.outputs[0]

    //   expect(subgraphOutput.isValidTarget(subgraphInput)).toBe(true)
    // })

    it("should not connect to another SubgraphInput", () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: "input1", type: "number" },
          { name: "input2", type: "number" },
        ],
      })

      const subgraphInput1 = subgraph.inputs[0]
      const subgraphInput2 = subgraph.inputs[1]

      expect(subgraphInput2.isValidTarget(subgraphInput1)).toBe(false)
    })

    it("should not connect to output slots", () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: "test_input", type: "number" }],
      })

      const subgraphInput = subgraph.inputs[0]

      const node = new LGraphNode("TestNode")
      node.addOutput("test_output", "number")
      subgraph.add(node)
      const outputSlot = node.outputs[0] as NodeOutputSlot

      expect(outputSlot.isValidTarget(subgraphInput)).toBe(false)
    })
  })

  describe("SubgraphOutput connections", () => {
    it("should connect from compatible regular output slots", () => {
      const subgraph = createTestSubgraph()
      const node = new LGraphNode("TestNode")
      node.addOutput("out", "number")
      subgraph.add(node)

      const subgraphOutput = subgraph.addOutput("result", "number")
      const nodeOutput = node.outputs[0]

      expect(subgraphOutput.isValidTarget(nodeOutput)).toBe(true)
    })

    it("should connect from SubgraphInput", () => {
      const subgraph = createTestSubgraph()

      const subgraphInput = subgraph.addInput("value", "number")
      const subgraphOutput = subgraph.addOutput("result", "number")

      expect(subgraphOutput.isValidTarget(subgraphInput)).toBe(true)
    })

    it("should not connect to another SubgraphOutput", () => {
      const subgraph = createTestSubgraph()

      const subgraphOutput1 = subgraph.addOutput("result1", "number")
      const subgraphOutput2 = subgraph.addOutput("result2", "number")

      expect(subgraphOutput1.isValidTarget(subgraphOutput2)).toBe(false)
    })
  })

  describe("Type compatibility", () => {
    it("should respect type compatibility for SubgraphInput connections", () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: "number_input", type: "number" }],
      })

      const subgraphInput = subgraph.inputs[0]

      const node = new LGraphNode("TestNode")
      node.addInput("number_slot", "number")
      node.addInput("string_slot", "string")
      node.addInput("any_slot", "*")
      node.addInput("boolean_slot", "boolean")
      subgraph.add(node)

      const numberSlot = node.inputs[0] as NodeInputSlot
      const stringSlot = node.inputs[1] as NodeInputSlot
      const anySlot = node.inputs[2] as NodeInputSlot
      const booleanSlot = node.inputs[3] as NodeInputSlot

      expect(numberSlot.isValidTarget(subgraphInput)).toBe(true)
      expect(stringSlot.isValidTarget(subgraphInput)).toBe(false)
      expect(anySlot.isValidTarget(subgraphInput)).toBe(true)
      expect(booleanSlot.isValidTarget(subgraphInput)).toBe(false)
    })

    it("should respect type compatibility for SubgraphOutput connections", () => {
      const subgraph = createTestSubgraph()
      const node = new LGraphNode("TestNode")
      node.addOutput("out", "string")
      subgraph.add(node)

      const subgraphOutput = subgraph.addOutput("result", "number")
      const nodeOutput = node.outputs[0]

      expect(subgraphOutput.isValidTarget(nodeOutput)).toBe(false)
    })

    it("should handle wildcard SubgraphInput", () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: "any_input", type: "*" }],
      })

      const subgraphInput = subgraph.inputs[0]

      const node = new LGraphNode("TestNode")
      node.addInput("number_slot", "number")
      subgraph.add(node)

      const numberSlot = node.inputs[0] as NodeInputSlot

      expect(numberSlot.isValidTarget(subgraphInput)).toBe(true)
    })
  })

  describe("Type guards", () => {
    it("should correctly identify SubgraphInput", () => {
      const subgraph = createTestSubgraph()
      const subgraphInput = subgraph.addInput("value", "number")
      const node = new LGraphNode("TestNode")
      node.addInput("in", "number")

      expect(isSubgraphInput(subgraphInput)).toBe(true)
      expect(isSubgraphInput(node.inputs[0])).toBe(false)
      expect(isSubgraphInput(null)).toBe(false)
      // eslint-disable-next-line unicorn/no-useless-undefined
      expect(isSubgraphInput(undefined)).toBe(false)
      expect(isSubgraphInput({})).toBe(false)
    })

    it("should correctly identify SubgraphOutput", () => {
      const subgraph = createTestSubgraph()
      const subgraphOutput = subgraph.addOutput("result", "number")
      const node = new LGraphNode("TestNode")
      node.addOutput("out", "number")

      expect(isSubgraphOutput(subgraphOutput)).toBe(true)
      expect(isSubgraphOutput(node.outputs[0])).toBe(false)
      expect(isSubgraphOutput(null)).toBe(false)
      // eslint-disable-next-line unicorn/no-useless-undefined
      expect(isSubgraphOutput(undefined)).toBe(false)
      expect(isSubgraphOutput({})).toBe(false)
    })
  })

  describe("Nested subgraphs", () => {
    it("should handle dragging from SubgraphInput in nested subgraphs", () => {
      const parentSubgraph = createTestSubgraph({
        inputs: [{ name: "parent_input", type: "number" }],
        outputs: [{ name: "parent_output", type: "number" }],
      })

      const nestedSubgraph = createTestSubgraph({
        inputs: [{ name: "nested_input", type: "number" }],
        outputs: [{ name: "nested_output", type: "number" }],
      })

      const nestedSubgraphNode = createTestSubgraphNode(nestedSubgraph)
      parentSubgraph.add(nestedSubgraphNode)

      const regularNode = new LGraphNode("TestNode")
      regularNode.addInput("test_input", "number")
      nestedSubgraph.add(regularNode)

      const nestedSubgraphInput = nestedSubgraph.inputs[0]
      const regularNodeSlot = regularNode.inputs[0] as NodeInputSlot

      expect(regularNodeSlot.isValidTarget(nestedSubgraphInput)).toBe(true)
    })

    it("should handle multiple levels of nesting", () => {
      const level1 = createTestSubgraph({
        inputs: [{ name: "level1_input", type: "string" }],
      })

      const level2 = createTestSubgraph({
        inputs: [{ name: "level2_input", type: "string" }],
      })

      const level3 = createTestSubgraph({
        inputs: [{ name: "level3_input", type: "string" }],
        outputs: [{ name: "level3_output", type: "string" }],
      })

      const level2Node = createTestSubgraphNode(level2)
      level1.add(level2Node)

      const level3Node = createTestSubgraphNode(level3)
      level2.add(level3Node)

      const deepNode = new LGraphNode("DeepNode")
      deepNode.addInput("deep_input", "string")
      level3.add(deepNode)

      const level3Input = level3.inputs[0]
      const deepNodeSlot = deepNode.inputs[0] as NodeInputSlot

      expect(deepNodeSlot.isValidTarget(level3Input)).toBe(true)

      const level3Output = level3.outputs[0]
      expect(level3Output.isValidTarget(level3Input)).toBe(true)
    })

    it("should maintain type checking across nesting levels", () => {
      const outer = createTestSubgraph({
        inputs: [{ name: "outer_number", type: "number" }],
      })

      const inner = createTestSubgraph({
        inputs: [
          { name: "inner_number", type: "number" },
          { name: "inner_string", type: "string" },
        ],
      })

      const innerNode = createTestSubgraphNode(inner)
      outer.add(innerNode)

      const node = new LGraphNode("TestNode")
      node.addInput("number_slot", "number")
      node.addInput("string_slot", "string")
      inner.add(node)

      const innerNumberInput = inner.inputs[0]
      const innerStringInput = inner.inputs[1]
      const numberSlot = node.inputs[0] as NodeInputSlot
      const stringSlot = node.inputs[1] as NodeInputSlot

      expect(numberSlot.isValidTarget(innerNumberInput)).toBe(true)
      expect(numberSlot.isValidTarget(innerStringInput)).toBe(false)
      expect(stringSlot.isValidTarget(innerNumberInput)).toBe(false)
      expect(stringSlot.isValidTarget(innerStringInput)).toBe(true)
    })
  })
})
