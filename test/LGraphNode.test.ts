import {
  LGraphNode,
} from "../dist/litegraph.es.js";

describe("LGraphNode", () => {
  it("should serialize position correctly", () => {
    const node = new LGraphNode("TestNode");
    node.pos = [10, 10];
    expect(node.pos).toEqual(new Float32Array([10, 10]));
    expect(node.serialize().pos).toEqual(new Float32Array([10, 10]));
  });
});