import { test as baseTest } from "vitest"
import type { ISerialisedGraph, SerialisableGraph } from "../src/types/serialisation"
import { LGraph } from "@/LGraph"
import { basicSerialisableGraph, minimalSerialisableGraph, oldSchemaGraph } from "./assets/testGraphs"
import { LiteGraph } from "@/litegraph"

interface LitegraphFixtures {
  minimalGraph: LGraph
  minimalSerialisableGraph: SerialisableGraph
  oldSchemaGraph: ISerialisedGraph
}

/** These fixtures alter global state, and are difficult to reset. Relies on a single test per-file to reset state. */
interface DirtyFixtures {
  basicSerialisableGraph: SerialisableGraph
}

export const test = baseTest.extend<LitegraphFixtures>({
  minimalGraph: async ({ }, use) => {
    // Before each test function
    const serialisable = structuredClone(minimalSerialisableGraph)
    const lGraph = new LGraph(serialisable)

    // use the fixture value
    await use(lGraph)
  },
  minimalSerialisableGraph: structuredClone(minimalSerialisableGraph),
  oldSchemaGraph: structuredClone(oldSchemaGraph),
})

/** Test that use {@link DirtyFixtures}. One test per file. */
export const dirtyTest = test.extend<DirtyFixtures>({
  basicSerialisableGraph: async ({}, use) => {
    if (!basicSerialisableGraph.nodes) throw new Error("Invalid test object")

    // Register node types
    for (const node of basicSerialisableGraph.nodes) {
      LiteGraph.registerNodeType(node.type!, LiteGraph.LGraphNode)
    }

    await use(structuredClone(basicSerialisableGraph))
  },
})
