import {
  LGraphES6 as LGraph,
  LGraph as LegacyLGraph,
  LiteGraph,
} from "../dist/litegraph.es.js";

describe("LegacyLGraph Compatibility Layer", () => {
  test("LegacyLGraph can be instantiated", () => {
    const graph = new LegacyLGraph({extra: "TestGraph"});
    expect(graph).toBeInstanceOf(LGraph);
    expect(graph).toBeInstanceOf(LegacyLGraph);
    expect(graph.extra).toBe("TestGraph");
  });

  test("LegacyLGraph can be extended via prototype", () => {
    LegacyLGraph.prototype.newMethod = function () {
      return "New method added via prototype";
    };

    const graph = new LegacyLGraph();
    expect(graph.newMethod()).toBe("New method added via prototype");
  });

  test("Extensions to LegacyLGraph affect LGraph instances", () => {
    LegacyLGraph.prototype.anotherMethod = function () {
      return "Another method";
    };

    const legacyGraph = new LegacyLGraph();
    const normalGraph = new LGraph();

    expect(legacyGraph.anotherMethod()).toBe("Another method");
    expect(normalGraph.anotherMethod()).toBe("Another method");
  });

  test("LegacyLGraph is correctly assigned to LiteGraph", () => {
    expect(LiteGraph.LGraph).toBe(LegacyLGraph);
  });
});
