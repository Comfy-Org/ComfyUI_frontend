import { describe, it, expect } from "vitest"
import { serializeSlot } from "@/NodeSlot"
import { INodeInputSlot, INodeOutputSlot } from "@/interfaces"

describe("NodeSlot", () => {
  describe("serializeSlot", () => {
    it("removes _data from serialized slot", () => {
      const slot: INodeOutputSlot = {
        _data: "test data",
        name: "test-id",
        type: "STRING",
        links: [],
      }
      const serialized = serializeSlot(slot)
      expect(serialized).not.toHaveProperty("_data")
    })

    it("removes pos from widget input slots", () => {
      const widgetInputSlot: INodeInputSlot = {
        name: "test-id",
        pos: [10, 20],
        type: "STRING",
        link: null,
        widget: {
          name: "test-widget",
          type: "combo",
          value: "test-value-1",
          options: {
            values: ["test-value-1", "test-value-2"],
          },
        },
      }

      const serialized = serializeSlot(widgetInputSlot)
      expect(serialized).not.toHaveProperty("pos")
    })

    it("preserves pos for non-widget input slots", () => {
      const normalSlot: INodeInputSlot = {
        name: "test-id",
        type: "STRING",
        pos: [10, 20],
        link: null,
      }
      const serialized = serializeSlot(normalSlot)
      expect(serialized).toHaveProperty("pos")
    })
  })
})
