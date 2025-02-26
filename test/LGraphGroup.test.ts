import { describe, expect } from "vitest"

import { LGraphGroup } from "@/litegraph"

import { test } from "./testExtensions"

describe("LGraphGroup", () => {
  test("serializes to the existing format", () => {
    const link = new LGraphGroup("title", 929)
    expect(link.serialize()).toMatchSnapshot("Basic")
  })
})
