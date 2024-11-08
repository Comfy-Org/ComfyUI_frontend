import { test } from "vitest"
import type { ISerialisedGraph, SerialisableGraph } from "../src/types/serialisation"
import { LGraph } from "@/LGraph"

const oldSchemaGraph: ISerialisedGraph = {
  version: 0.4,
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

const minimalSerialisableGraph: SerialisableGraph = {
  version: 1,
  config: {},
  state: {
    lastNodeId: 0,
    lastLinkId: 0,
    lastGroupId: 0,
    lastRerouteId: 0
  },
  nodes: [],
  links: [],
  groups: [],
}

const basicSerialisableGraph: SerialisableGraph = {
  version: 1,
  config: {},
  state: {
    lastNodeId: 0,
    lastLinkId: 0,
    lastGroupId: 0,
    lastRerouteId: 0
  },
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
  minimalSerialisableGraph: SerialisableGraph
  basicSerialisableGraph: SerialisableGraph
  oldSchemaGraph: ISerialisedGraph
}

export const lgTest = test.extend<LitegraphFixtures>({
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
