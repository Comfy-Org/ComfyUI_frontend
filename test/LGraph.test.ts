import { describe } from "vitest"

import { LGraph, LiteGraph } from "@/litegraph"

import { test } from "./testExtensions"

describe("LGraph", () => {
  test("can be instantiated", ({ expect }) => {
    // @ts-expect-error Intentional - extra holds any / all consumer data that should be serialised
    const graph = new LGraph({ extra: "TestGraph" })
    expect(graph).toBeInstanceOf(LGraph)
    expect(graph.extra).toBe("TestGraph")
    expect(graph.extra).toBe("TestGraph")
  })

  test("is exactly the same type", async ({ expect }) => {
    const directImport = await import("@/LGraph")
    const entryPointImport = await import("@/litegraph")

    expect(LiteGraph.LGraph).toBe(directImport.LGraph)
    expect(LiteGraph.LGraph).toBe(entryPointImport.LGraph)
  })

  test("populates optional values", ({ expect, minimalSerialisableGraph }) => {
    const dGraph = new LGraph(minimalSerialisableGraph)
    expect(dGraph.links).toBeInstanceOf(Map)
    expect(dGraph.nodes).toBeInstanceOf(Array)
    expect(dGraph.groups).toBeInstanceOf(Array)
  })

  test("supports schema v0.4 graphs", ({ expect, oldSchemaGraph }) => {
    const fromOldSchema = new LGraph(oldSchemaGraph)
    expect(fromOldSchema).toMatchSnapshot("oldSchemaGraph")
  })

  describe("Reroutes", () => {
    test("Floating reroute should be removed when node and link are removed", ({ expect, floatingLinkGraph }) => {
      const graph = new LGraph(floatingLinkGraph)
      expect(graph.nodes.length).toBe(1)
      graph.remove(graph.nodes[0])
      expect(graph.nodes.length).toBe(0)
      expect(graph.links.size).toBe(0)
      expect(graph.floatingLinks.size).toBe(0)
      expect(graph.reroutes.size).toBe(0)
    })
  })
})

describe("Legacy LGraph Compatibility Layer", () => {
  test("can be extended via prototype", ({ expect, minimalGraph }) => {
    // @ts-expect-error Should always be an error.
    LGraph.prototype.newMethod = function () {
      return "New method added via prototype"
    }
    // @ts-expect-error Should always be an error.
    expect(minimalGraph.newMethod()).toBe("New method added via prototype")
  })

  test("is correctly assigned to LiteGraph", ({ expect }) => {
    expect(LiteGraph.LGraph).toBe(LGraph)
  })
})
