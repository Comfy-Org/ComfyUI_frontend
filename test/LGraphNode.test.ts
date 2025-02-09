import { describe, expect } from "vitest"
import { LGraphNode } from "@/litegraph"
import { NodeInputSlot, NodeOutputSlot } from "@/NodeSlot"
import { lgTest } from "./lgTest"

describe("LGraphNode", () => {
  lgTest("should serialize position/size correctly", () => {
    const node = new LGraphNode("TestNode")
    node.pos = [10, 10]
    expect(node.pos).toEqual(new Float32Array([10, 10]))
    expect(node.serialize().pos).toEqual([10, 10])

    node.size = [100, 100]
    expect(node.size).toEqual(new Float32Array([100, 100]))
    expect(node.serialize().size).toEqual([100, 100])
  })

  lgTest("should configure inputs correctly", () => {
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

  lgTest("should configure outputs correctly", () => {
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
})
