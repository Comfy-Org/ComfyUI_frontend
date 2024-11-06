import { describe, expect } from "vitest"
import { clamp, LGraphCanvas, LiteGraph } from "@/litegraph"
import { LiteGraphGlobal } from "@/LiteGraphGlobal"
import { lgTest } from "./lgTest"

describe.concurrent("Litegraph module", () => {
  lgTest("contains a global export", ({ expect }) => {
    expect(LiteGraph).toBeInstanceOf(LiteGraphGlobal)
    expect(LiteGraph.LGraphCanvas).toBe(LGraphCanvas)
  })

  lgTest("has the same structure", ({ expect }) => {
    const lgGlobal = new LiteGraphGlobal()
    expect(lgGlobal).toMatchSnapshot("minLGraph")
  })

  lgTest("clamps values", () => {
    expect(clamp(-1.124, 13, 24)).toStrictEqual(13)
    expect(clamp(Infinity, 18, 29)).toStrictEqual(29)
  })
})
