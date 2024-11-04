import {
  LGraphNode,
} from "../src/litegraph"

describe("LGraphNode", () => {
  it("should serialize position/size correctly", () => {
    const node = new LGraphNode("TestNode")
    node.pos = [10, 10]
    expect(node.pos).toEqual(new Float32Array([10, 10]))
    expect(node.serialize().pos).toEqual([10, 10])

    node.size = [100, 100]
    expect(node.size).toEqual(new Float32Array([100, 100]))
    expect(node.serialize().size).toEqual([100, 100])
  })
})