import { test } from "vitest"
import type { ISerialisedGraph } from "../src/types/serialisation"
import { LGraph } from "@/LGraph"

const minimalSerialisableGraph: ISerialisedGraph = {
  version: 1,
  config: {},
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
}

const basicSerialisableGraph: ISerialisedGraph = {
  version: 1,
  config: {},
  last_node_id: 0,
  last_link_id: 0,
  groups: [
    {
      id: 123,
      bounding: [20, 20, 1, 3],
      color: "#6029aa",
      font_size: 14,
      title: "A group to test with",
    },
  ],
  nodes: [
    {
      id: 1,
    },
  ],
  links: [],
}

interface LitegraphFixtures {
  minimalGraph: LGraph
  minimalSerialisableGraph: ISerialisedGraph
  basicSerialisableGraph: ISerialisedGraph
}

export const lgTest = test.extend<LitegraphFixtures>({
  minimalGraph: async ({}, use) => {
    // Before each test function
    const serialisable = structuredClone(minimalSerialisableGraph)
    const lGraph = new LGraph(serialisable)

    // use the fixture value
    await use(lGraph)

    // After each test function
  },
  basicSerialisableGraph: structuredClone(basicSerialisableGraph),
  minimalSerialisableGraph: structuredClone(minimalSerialisableGraph),
})
