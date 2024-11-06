import { describe, expect } from "vitest"
import { LGraphGroup } from "@/litegraph"
import { lgTest } from "./lgTest"

describe("LGraphGroup", () => {
  lgTest("serializes to the existing format", () => {
    const link = new LGraphGroup("title", 929)
    expect(link.serialize()).toMatchSnapshot("Basic")
  })
})
