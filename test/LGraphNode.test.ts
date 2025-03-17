import { describe, expect } from "vitest"

import { LGraphNode } from "@/litegraph"
import { LGraph } from "@/litegraph"
import { NodeInputSlot, NodeOutputSlot } from "@/NodeSlot"

import { test } from "./testExtensions"

describe("LGraphNode", () => {
  test("should serialize position/size correctly", () => {
    const node = new LGraphNode("TestNode")
    node.pos = [10, 10]
    expect(node.pos).toEqual(new Float32Array([10, 10]))
    expect(node.serialize().pos).toEqual([10, 10])

    node.size = [100, 100]
    expect(node.size).toEqual(new Float32Array([100, 100]))
    expect(node.serialize().size).toEqual([100, 100])
  })

  test("should configure inputs correctly", () => {
    const node = new LGraphNode("TestNode")
    node.configure({
      id: 0,
      inputs: [{ name: "TestInput", type: "number", link: null }],
    })
    expect(node.inputs.length).toEqual(1)
    expect(node.inputs[0].name).toEqual("TestInput")
    expect(node.inputs[0].link).toEqual(null)
    expect(node.inputs[0]).instanceOf(NodeInputSlot)

    // Should not override existing inputs
    node.configure({ id: 1 })
    expect(node.id).toEqual(1)
    expect(node.inputs.length).toEqual(1)
  })

  test("should configure outputs correctly", () => {
    const node = new LGraphNode("TestNode")
    node.configure({
      id: 0,
      outputs: [{ name: "TestOutput", type: "number", links: [] }],
    })
    expect(node.outputs.length).toEqual(1)
    expect(node.outputs[0].name).toEqual("TestOutput")
    expect(node.outputs[0].type).toEqual("number")
    expect(node.outputs[0].links).toEqual([])
    expect(node.outputs[0]).instanceOf(NodeOutputSlot)

    // Should not override existing outputs
    node.configure({ id: 1 })
    expect(node.id).toEqual(1)
    expect(node.outputs.length).toEqual(1)
  })

  describe("Disconnect I/O Slots", () => {
    test("should disconnect input correctly", () => {
      const node1 = new LGraphNode("SourceNode")
      const node2 = new LGraphNode("TargetNode")

      // Configure nodes with input/output slots
      node1.configure({
        id: 1,
        outputs: [{ name: "Output1", type: "number", links: [] }],
      })
      node2.configure({
        id: 2,
        inputs: [{ name: "Input1", type: "number", link: null }],
      })

      // Create a graph and add nodes to it
      const graph = new LGraph()
      graph.add(node1)
      graph.add(node2)

      // Connect the nodes
      const link = node1.connect(0, node2, 0)
      expect(link).not.toBeNull()
      expect(node2.inputs[0].link).toBe(link?.id)
      expect(node1.outputs[0].links).toContain(link?.id)

      // Test disconnecting by slot number
      const disconnected = node2.disconnectInput(0)
      expect(disconnected).toBe(true)
      expect(node2.inputs[0].link).toBeNull()
      expect(node1.outputs[0].links?.length).toBe(0)
      expect(graph._links.has(link?.id ?? -1)).toBe(false)

      // Test disconnecting by slot name
      node1.connect(0, node2, 0)
      const disconnectedByName = node2.disconnectInput("Input1")
      expect(disconnectedByName).toBe(true)
      expect(node2.inputs[0].link).toBeNull()

      // Test disconnecting non-existent slot
      const invalidDisconnect = node2.disconnectInput(999)
      expect(invalidDisconnect).toBe(false)

      // Test disconnecting already disconnected input
      const alreadyDisconnected = node2.disconnectInput(0)
      expect(alreadyDisconnected).toBe(true)
    })

    test("should disconnect output correctly", () => {
      const sourceNode = new LGraphNode("SourceNode")
      const targetNode1 = new LGraphNode("TargetNode1")
      const targetNode2 = new LGraphNode("TargetNode2")

      // Configure nodes with input/output slots
      sourceNode.configure({
        id: 1,
        outputs: [
          { name: "Output1", type: "number", links: [] },
          { name: "Output2", type: "number", links: [] },
        ],
      })
      targetNode1.configure({
        id: 2,
        inputs: [{ name: "Input1", type: "number", link: null }],
      })
      targetNode2.configure({
        id: 3,
        inputs: [{ name: "Input1", type: "number", link: null }],
      })

      // Create a graph and add nodes to it
      const graph = new LGraph()
      graph.add(sourceNode)
      graph.add(targetNode1)
      graph.add(targetNode2)

      // Connect multiple nodes to the same output
      const link1 = sourceNode.connect(0, targetNode1, 0)
      const link2 = sourceNode.connect(0, targetNode2, 0)
      expect(link1).not.toBeNull()
      expect(link2).not.toBeNull()
      expect(sourceNode.outputs[0].links?.length).toBe(2)

      // Test disconnecting specific target node
      const disconnectedSpecific = sourceNode.disconnectOutput(0, targetNode1)
      expect(disconnectedSpecific).toBe(true)
      expect(targetNode1.inputs[0].link).toBeNull()
      expect(sourceNode.outputs[0].links?.length).toBe(1)
      expect(graph._links.has(link1?.id ?? -1)).toBe(false)
      expect(graph._links.has(link2?.id ?? -1)).toBe(true)

      // Test disconnecting by slot name
      const link3 = sourceNode.connect(1, targetNode1, 0)
      expect(link3).not.toBeNull()
      const disconnectedByName = sourceNode.disconnectOutput("Output2", targetNode1)
      expect(disconnectedByName).toBe(true)
      expect(targetNode1.inputs[0].link).toBeNull()
      expect(sourceNode.outputs[1].links?.length).toBe(0)

      // Test disconnecting all connections from an output
      const link4 = sourceNode.connect(0, targetNode1, 0)
      expect(link4).not.toBeNull()
      expect(sourceNode.outputs[0].links?.length).toBe(2)
      const disconnectedAll = sourceNode.disconnectOutput(0)
      expect(disconnectedAll).toBe(true)
      expect(sourceNode.outputs[0].links).toBeNull()
      expect(targetNode1.inputs[0].link).toBeNull()
      expect(targetNode2.inputs[0].link).toBeNull()
      expect(graph._links.has(link2?.id ?? -1)).toBe(false)
      expect(graph._links.has(link4?.id ?? -1)).toBe(false)

      // Test disconnecting non-existent slot
      const invalidDisconnect = sourceNode.disconnectOutput(999)
      expect(invalidDisconnect).toBe(false)

      // Test disconnecting already disconnected output
      const alreadyDisconnected = sourceNode.disconnectOutput(0)
      expect(alreadyDisconnected).toBe(false)
    })
  })

  describe("getInputPos and getOutputPos", () => {
    test("should handle collapsed nodes correctly", () => {
      const node = new LGraphNode("TestNode") as unknown as Omit<LGraphNode, "boundingRect"> & { boundingRect: Float32Array }
      node.pos = [100, 100]
      node.size = [100, 100]
      node.boundingRect[0] = 100
      node.boundingRect[1] = 100
      node.boundingRect[2] = 100
      node.boundingRect[3] = 100
      node.configure({
        id: 1,
        inputs: [{ name: "Input1", type: "number", link: null }],
        outputs: [{ name: "Output1", type: "number", links: [] }],
      })

      // Collapse the node
      node.flags.collapsed = true

      // Get positions in collapsed state
      const inputPos = node.getInputPos(0)
      const outputPos = node.getOutputPos(0)

      expect(inputPos).toEqual([100, 85])
      expect(outputPos).toEqual([180, 85])
    })

    test("should return correct positions for input and output slots", () => {
      const node = new LGraphNode("TestNode")
      node.pos = [100, 100]
      node.size = [100, 100]
      node.configure({
        id: 1,
        inputs: [{ name: "Input1", type: "number", link: null }],
        outputs: [{ name: "Output1", type: "number", links: [] }],
      })

      const inputPos = node.getInputPos(0)
      const outputPos = node.getOutputPos(0)

      expect(inputPos).toEqual([110, 114])
      expect(outputPos).toEqual([191, 114])
    })
  })

  describe("getSlotOnPos", () => {
    test("should return undefined when point is outside node bounds", () => {
      const node = new LGraphNode("TestNode")
      node.pos = [100, 100]
      node.size = [100, 100]
      node.configure({
        id: 1,
        inputs: [{ name: "Input1", type: "number", link: null }],
        outputs: [{ name: "Output1", type: "number", links: [] }],
      })

      // Test point far outside node bounds
      expect(node.getSlotOnPos([0, 0])).toBeUndefined()
      // Test point just outside node bounds
      expect(node.getSlotOnPos([99, 99])).toBeUndefined()
    })

    test("should detect input slots correctly", () => {
      const node = new LGraphNode("TestNode") as unknown as Omit<LGraphNode, "boundingRect"> & { boundingRect: Float32Array }
      node.pos = [100, 100]
      node.size = [100, 100]
      node.boundingRect[0] = 100
      node.boundingRect[1] = 100
      node.boundingRect[2] = 200
      node.boundingRect[3] = 200
      node.configure({
        id: 1,
        inputs: [
          { name: "Input1", type: "number", link: null },
          { name: "Input2", type: "string", link: null },
        ],
      })

      // Get position of first input slot
      const inputPos = node.getInputPos(0)
      // Test point directly on input slot
      const slot = node.getSlotOnPos(inputPos)
      expect(slot).toBeDefined()
      expect(slot?.name).toBe("Input1")

      // Test point near but not on input slot
      expect(node.getSlotOnPos([inputPos[0] - 15, inputPos[1]])).toBeUndefined()
    })

    test("should detect output slots correctly", () => {
      const node = new LGraphNode("TestNode") as unknown as Omit<LGraphNode, "boundingRect"> & { boundingRect: Float32Array }
      node.pos = [100, 100]
      node.size = [100, 100]
      node.boundingRect[0] = 100
      node.boundingRect[1] = 100
      node.boundingRect[2] = 200
      node.boundingRect[3] = 200
      node.configure({
        id: 1,
        outputs: [
          { name: "Output1", type: "number", links: [] },
          { name: "Output2", type: "string", links: [] },
        ],
      })

      // Get position of first output slot
      const outputPos = node.getOutputPos(0)
      // Test point directly on output slot
      const slot = node.getSlotOnPos(outputPos)
      expect(slot).toBeDefined()
      expect(slot?.name).toBe("Output1")

      // Test point near but not on output slot
      const gotslot = node.getSlotOnPos([outputPos[0] + 30, outputPos[1]])
      expect(gotslot).toBeUndefined()
    })

    test("should prioritize input slots over output slots", () => {
      const node = new LGraphNode("TestNode") as unknown as Omit<LGraphNode, "boundingRect"> & { boundingRect: Float32Array }
      node.pos = [100, 100]
      node.size = [100, 100]
      node.boundingRect[0] = 100
      node.boundingRect[1] = 100
      node.boundingRect[2] = 200
      node.boundingRect[3] = 200
      node.configure({
        id: 1,
        inputs: [{ name: "Input1", type: "number", link: null }],
        outputs: [{ name: "Output1", type: "number", links: [] }],
      })

      // Get positions of first input and output slots
      const inputPos = node.getInputPos(0)

      // Test point that could theoretically hit both slots
      // Should return the input slot due to priority
      const slot = node.getSlotOnPos(inputPos)
      expect(slot).toBeDefined()
      expect(slot?.name).toBe("Input1")
    })
  })
})
