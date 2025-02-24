import { describe, expect } from "vitest"
import { clamp, LGraphCanvas, LiteGraph } from "@/litegraph"
import { LiteGraphGlobal } from "@/LiteGraphGlobal"
import { test } from "./testExtensions"

describe.concurrent("Litegraph module", () => {
  test("contains a global export", ({ expect }) => {
    expect(LiteGraph).toBeInstanceOf(LiteGraphGlobal)
    expect(LiteGraph.LGraphCanvas).toBe(LGraphCanvas)
  })

  test("has the same structure", ({ expect }) => {
    const lgGlobal = new LiteGraphGlobal()
    expect(lgGlobal).toMatchSnapshot("minLGraph")
  })

  test("clamps values", () => {
    expect(clamp(-1.124, 13, 24)).toStrictEqual(13)
    expect(clamp(Infinity, 18, 29)).toStrictEqual(29)
  })
})
