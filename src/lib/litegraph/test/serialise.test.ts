import type { ISerialisedGraph } from "@/types/serialisation"

import { describe } from "vitest"

import { LGraph, LGraphGroup, LGraphNode } from "@/litegraph"

import { test } from "./testExtensions"

describe("LGraph Serialisation", () => {
  test("can (de)serialise node / group titles", ({ expect, minimalGraph }) => {
    const nodeTitle = "Test Node"
    const groupTitle = "Test Group"

    minimalGraph.add(new LGraphNode(nodeTitle))
    minimalGraph.add(new LGraphGroup(groupTitle))

    expect(minimalGraph.nodes.length).toBe(1)
    expect(minimalGraph.nodes[0].title).toEqual(nodeTitle)

    expect(minimalGraph.groups.length).toBe(1)
    expect(minimalGraph.groups[0].title).toEqual(groupTitle)

    const serialised = JSON.stringify(minimalGraph.serialize())
    const deserialised = JSON.parse(serialised) as ISerialisedGraph

    const copied = new LGraph(deserialised)
    expect(copied.nodes.length).toBe(1)
    expect(copied.groups.length).toBe(1)
  })
})
