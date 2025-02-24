import { test as baseTest } from "vitest"
import type { ISerialisedGraph, SerialisableGraph } from "../src/types/serialisation"
import { LGraph } from "@/LGraph"
import { basicSerialisableGraph, minimalSerialisableGraph, oldSchemaGraph } from "./assets/testGraphs"

interface LitegraphFixtures {
  minimalGraph: LGraph
  minimalSerialisableGraph: SerialisableGraph
  basicSerialisableGraph: SerialisableGraph
  oldSchemaGraph: ISerialisedGraph
}

export const test = baseTest.extend<LitegraphFixtures>({
  minimalGraph: async ({ }, use) => {
    // Before each test function
    const serialisable = structuredClone(minimalSerialisableGraph)
    const lGraph = new LGraph(serialisable)

    // use the fixture value
    await use(lGraph)

    // After each test function
  },
  basicSerialisableGraph: structuredClone(basicSerialisableGraph),
  minimalSerialisableGraph: structuredClone(minimalSerialisableGraph),
  oldSchemaGraph: structuredClone(oldSchemaGraph),
})
