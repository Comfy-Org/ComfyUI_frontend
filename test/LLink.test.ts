import { describe, expect } from "vitest"

import { LLink } from "@/litegraph"

import { test } from "./testExtensions"

describe("LLink", () => {
  test("matches previous snapshot", () => {
    const link = new LLink(1, "float", 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot("Basic")
  })

  test("serializes to the previous snapshot", () => {
    const link = new LLink(1, "float", 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot("Basic")
  })
})
