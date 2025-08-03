import { beforeEach, describe, expect, vi } from "vitest"

import { clamp, LGraphCanvas, LiteGraph } from "@/litegraph"
import { LiteGraphGlobal } from "@/LiteGraphGlobal"

import { test } from "./testExtensions"

describe("Litegraph module", () => {
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

describe("Import order dependency", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  test("Imports without error when entry point is imported first", async ({ expect }) => {
    async function importNormally() {
      const entryPointImport = await import("@/litegraph")
      const directImport = await import("@/LGraph")

      // Sanity check that imports were cleared.
      expect(Object.is(LiteGraph, entryPointImport.LiteGraph)).toBe(false)
      expect(Object.is(LiteGraph.LGraph, directImport.LGraph)).toBe(false)
    }

    await expect(importNormally()).resolves.toBeUndefined()
  })
})
