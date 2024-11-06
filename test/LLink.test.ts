import { describe, expect } from "vitest"
import { LLink } from "@/litegraph"
import { lgTest } from "./lgTest"

describe("LLink", () => {
  lgTest("matches previous snapshot", () => {
    const link = new LLink(1, "float", 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot("Basic")
  })

  lgTest("serializes to the previous snapshot", () => {
    const link = new LLink(1, "float", 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot("Basic")
  })
})
