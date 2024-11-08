import { describe } from "vitest"
import { LGraph, LiteGraph } from "@/litegraph"
import { lgTest } from "./lgTest"

describe.concurrent("LGraph", () => {
  lgTest("can be instantiated", ({ expect }) => {
    // @ts-expect-error Intentional - extra holds any / all consumer data that should be serialised
    const graph = new LGraph({ extra: "TestGraph" })
    expect(graph).toBeInstanceOf(LGraph)
    expect(graph.extra).toBe("TestGraph")
    expect(graph.extra).toBe("TestGraph")
  })

  lgTest("populates optional values", ({ expect, minimalSerialisableGraph }) => {
    const dGraph = new LGraph(minimalSerialisableGraph)
    expect(dGraph.links).toBeInstanceOf(Map)
    expect(dGraph.nodes).toBeInstanceOf(Array)
    expect(dGraph.groups).toBeInstanceOf(Array)
  })

  lgTest("matches previous snapshot", ({ expect, minimalSerialisableGraph, basicSerialisableGraph }) => {
    const minLGraph = new LGraph(minimalSerialisableGraph)
    expect(minLGraph).toMatchSnapshot("minLGraph")
    const basicLGraph = new LGraph(basicSerialisableGraph)
    expect(basicLGraph).toMatchSnapshot("basicLGraph")
  })

  lgTest("supports schema v0.4 graphs", ({ expect, oldSchemaGraph }) => {
    const fromOldSchema = new LGraph(oldSchemaGraph)
    expect(fromOldSchema).toMatchSnapshot("oldSchemaGraph")
  })
})

describe.concurrent("Legacy LGraph Compatibility Layer", () => {
  lgTest("can be extended via prototype", ({ expect, minimalGraph }) => {
    // @ts-expect-error Should always be an error.
    LGraph.prototype.newMethod = function () {
      return "New method added via prototype"
    }
    // @ts-expect-error Should always be an error.
    expect(minimalGraph.newMethod()).toBe("New method added via prototype")
  })

  lgTest("is correctly assigned to LiteGraph", ({ expect }) => {
    expect(LiteGraph.LGraph).toBe(LGraph)
  })
})
