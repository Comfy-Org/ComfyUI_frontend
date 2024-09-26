import {
  LGraphNode,
} from "../dist/litegraph.es.js";

describe("LGraphNode", () => {
  it("should serialize position correctly", () => {
    const node = new LGraphNode("TestNode");
    // @ts-expect-error Expected - not a TS class yet.
    node.pos = [10, 10];
    // @ts-expect-error JS tests in TS format
    expect(node.pos).toEqual(new Float32Array([10, 10]));
    expect(node.serialize().pos).toEqual(new Float32Array([10, 10]));
  });
});