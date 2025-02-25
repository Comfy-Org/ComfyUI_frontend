import type { ISerialisedGraph, SerialisableGraph } from "@/litegraph"

export const oldSchemaGraph: ISerialisedGraph = {
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

export const minimalSerialisableGraph: SerialisableGraph = {
  version: 1,
  config: {},
  state: {
    lastNodeId: 0,
    lastLinkId: 0,
    lastGroupId: 0,
    lastRerouteId: 0,
  },
  nodes: [],
  links: [],
  groups: [],
}

export const basicSerialisableGraph: SerialisableGraph = {
  version: 1,
  config: {},
  state: {
    lastNodeId: 0,
    lastLinkId: 0,
    lastGroupId: 0,
    lastRerouteId: 0,
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
      type: "mustBeSet",
    },
  ],
  links: [],
}
