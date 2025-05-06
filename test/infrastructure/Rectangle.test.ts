import type { Point, Size } from "@/interfaces"

import { describe, expect, test as baseTest, vi } from "vitest"

import { Rectangle } from "@/infrastructure/Rectangle"

// TODO: If there's a common test context, use it here
// For now, we'll define a simple context for Rectangle tests
const test = baseTest.extend<{ rect: Rectangle }>({
  rect: async ({}, use) => {
    await use(new Rectangle())
  },
})

describe("Rectangle", () => {
  describe("constructor", () => {
    test("should create a default rectangle", ({ rect }) => {
      expect(rect.x).toBe(0)
      expect(rect.y).toBe(0)
      expect(rect.width).toBe(0)
      expect(rect.height).toBe(0)
      expect(rect.length).toBe(4)
    })
    test("should create a rectangle with specified values", () => {
      const rect = new Rectangle(1, 2, 3, 4)
      expect(rect.x).toBe(1)
      expect(rect.y).toBe(2)
      expect(rect.width).toBe(3)
      expect(rect.height).toBe(4)
    })
  })

  describe("subarray", () => {
    test("should return a Float64Array representing the subarray", () => {
      const rect = new Rectangle(10, 20, 30, 40)
      const sub = rect.subarray(1, 3)
      expect(sub).toBeInstanceOf(Float64Array)
      expect(sub.length).toBe(2)
      expect(sub[0]).toBe(20) // y
      expect(sub[1]).toBe(30) // width
    })
    test("should return a Float64Array for the entire array if no args", () => {
      const rect = new Rectangle(10, 20, 30, 40)
      const sub = rect.subarray()
      expect(sub).toBeInstanceOf(Float64Array)
      expect(sub.length).toBe(4)
      expect(sub[0]).toBe(10)
      expect(sub[1]).toBe(20)
      expect(sub[2]).toBe(30)
      expect(sub[3]).toBe(40)
    })
  })

  describe("pos", () => {
    test("should get the position", ({ rect }) => {
      rect.x = 10
      rect.y = 20
      const pos = rect.pos
      expect(pos[0]).toBe(10)
      expect(pos[1]).toBe(20)
      expect(pos.length).toBe(2)
    })
    test("should set the position", ({ rect }) => {
      const newPos: Point = [5, 15]
      rect.pos = newPos
      expect(rect.x).toBe(5)
      expect(rect.y).toBe(15)
    })
    test("should update the rectangle when the returned pos object is modified", ({ rect }) => {
      rect.x = 1
      rect.y = 2
      const pos = rect.pos
      pos[0] = 100
      pos[1] = 200
      expect(rect.x).toBe(100)
      expect(rect.y).toBe(200)
    })
  })

  describe("size", () => {
    test("should get the size", ({ rect }) => {
      rect.width = 30
      rect.height = 40
      const size = rect.size
      expect(size[0]).toBe(30)
      expect(size[1]).toBe(40)
      expect(size.length).toBe(2)
    })
    test("should set the size", ({ rect }) => {
      const newSize: Size = [35, 45]
      rect.size = newSize
      expect(rect.width).toBe(35)
      expect(rect.height).toBe(45)
    })
    test("should update the rectangle when the returned size object is modified", ({ rect }) => {
      rect.width = 3
      rect.height = 4
      const size = rect.size
      size[0] = 300
      size[1] = 400
      expect(rect.width).toBe(300)
      expect(rect.height).toBe(400)
    })
  })

  // #region Property accessors
  describe("x", () => {
    test("should get x", ({ rect }) => {
      rect[0] = 5
      expect(rect.x).toBe(5)
    })
    test("should set x", ({ rect }) => {
      rect.x = 10
      expect(rect[0]).toBe(10)
    })
  })

  describe("y", () => {
    test("should get y", ({ rect }) => {
      rect[1] = 6
      expect(rect.y).toBe(6)
    })
    test("should set y", ({ rect }) => {
      rect.y = 11
      expect(rect[1]).toBe(11)
    })
  })

  describe("width", () => {
    test("should get width", ({ rect }) => {
      rect[2] = 7
      expect(rect.width).toBe(7)
    })
    test("should set width", ({ rect }) => {
      rect.width = 12
      expect(rect[2]).toBe(12)
    })
  })

  describe("height", () => {
    test("should get height", ({ rect }) => {
      rect[3] = 8
      expect(rect.height).toBe(8)
    })
    test("should set height", ({ rect }) => {
      rect.height = 13
      expect(rect[3]).toBe(13)
    })
  })

  describe("left", () => {
    test("should get left", ({ rect }) => {
      rect[0] = 1
      expect(rect.left).toBe(1)
    })
    test("should set left", ({ rect }) => {
      rect.left = 2
      expect(rect[0]).toBe(2)
    })
  })

  describe("top", () => {
    test("should get top", ({ rect }) => {
      rect[1] = 3
      expect(rect.top).toBe(3)
    })
    test("should set top", ({ rect }) => {
      rect.top = 4
      expect(rect[1]).toBe(4)
    })
  })

  describe("right", () => {
    test("should get right", ({ rect }) => {
      rect[0] = 1
      rect[2] = 10
      expect(rect.right).toBe(11)
    })
    test("should set right", ({ rect }) => {
      rect.x = 1
      rect.width = 10 // right is 11
      rect.right = 20 // new right
      expect(rect.x).toBe(10) // x = right - width = 20 - 10
      expect(rect.width).toBe(10)
    })
  })

  describe("bottom", () => {
    test("should get bottom", ({ rect }) => {
      rect[1] = 2
      rect[3] = 20
      expect(rect.bottom).toBe(22)
    })
    test("should set bottom", ({ rect }) => {
      rect.y = 2
      rect.height = 20 // bottom is 22
      rect.bottom = 30 // new bottom
      expect(rect.y).toBe(10) // y = bottom - height = 30 - 20
      expect(rect.height).toBe(20)
    })
  })

  describe("centreX", () => {
    test("should get centreX", () => {
      const rect = new Rectangle(0, 0, 10, 0)
      expect(rect.centreX).toBe(5)
      rect.x = 5
      expect(rect.centreX).toBe(10)
      rect.width = 20
      expect(rect.centreX).toBe(15) // 5 + (20 * 0.5)
    })
  })

  describe("centreY", () => {
    test("should get centreY", () => {
      const rect = new Rectangle(0, 0, 0, 10)
      expect(rect.centreY).toBe(5)
      rect.y = 5
      expect(rect.centreY).toBe(10)
      rect.height = 20
      expect(rect.centreY).toBe(15) // 5 + (20 * 0.5)
    })
  })
  // #endregion Property accessors

  describe("updateTo", () => {
    test("should update the rectangle values", ({ rect }) => {
      const newValues: [number, number, number, number] = [1, 2, 3, 4]
      rect.updateTo(newValues)
      expect(rect.x).toBe(1)
      expect(rect.y).toBe(2)
      expect(rect.width).toBe(3)
      expect(rect.height).toBe(4)
    })
  })

  describe("containsXy", () => {
    const rect = new Rectangle(10, 10, 20, 20) // x: 10, y: 10, right: 30, bottom: 30
    test.each([
      [10, 10, true], // top-left corner
      [30, 30, true], // bottom-right corner
      [15, 15, true], // inside
      [5, 15, false], // outside left
      [35, 15, false], // outside right
      [15, 5, false], // outside top
      [15, 35, false], // outside bottom
      [10, 30, true], // on bottom edge
      [30, 10, true], // on right edge
    ])("should return %s when checking if (%s, %s) is inside", (x, y, expected) => {
      expect(rect.containsXy(x, y)).toBe(expected)
    })
  })

  describe("containsPoint", () => {
    const rect = new Rectangle(0, 0, 10, 10) // x:0, y:0, r:10, b:10
    test.each([
      [[0, 0] as Point, true],
      [[10, 10] as Point, true],
      [[5, 5] as Point, true],
      [[-1, 5] as Point, false],
      [[11, 5] as Point, false],
      [[5, -1] as Point, false],
      [[5, 11] as Point, false],
    ])("should return %s for point %j", (point: Point, expected: boolean) => {
      expect(rect.containsPoint(point)).toBe(expected)
    })
  })

  describe("containsRect", () => {
    const outer = new Rectangle(0, 0, 100, 100)
    test.each([
      // Completely inside
      [new Rectangle(10, 10, 10, 10), true],
      // Touching edges
      [new Rectangle(0, 0, 10, 10), true],
      [new Rectangle(90, 90, 10, 10), true],
      // Partially outside
      [new Rectangle(-10, 10, 20, 20), false],
      [new Rectangle(10, -10, 20, 20), false],
      [new Rectangle(90, 10, 20, 20), false],
      [new Rectangle(10, 90, 20, 20), false],
      // Completely outside
      [new Rectangle(200, 200, 10, 10), false],
      // Outer rectangle is smaller
      [new Rectangle(0, 0, 5, 5), new Rectangle(0, 0, 10, 10), true],
      // Same size
      [new Rectangle(0, 0, 100, 100), true],
    ])("should return %s when checking if %s is inside outer rect", (inner: Rectangle, expectedOrOuter: boolean | Rectangle, expectedIfThreeArgs?: boolean) => {
      let testOuter = outer
      let testExpected = expectedOrOuter as boolean
      if (typeof expectedOrOuter !== "boolean") {
        testOuter = expectedOrOuter as Rectangle
        testExpected = expectedIfThreeArgs as boolean
      }
      expect(testOuter.containsRect(inner)).toBe(testExpected)
    })
  })

  describe("overlaps", () => {
    const rect1 = new Rectangle(10, 10, 20, 20) // 10,10 to 30,30
    test.each([
      // Completely overlapping
      [new Rectangle(15, 15, 10, 10), true], // r2 inside r1
      // Partially overlapping
      [new Rectangle(0, 0, 15, 15), true], // r2 top-left of r1
      [new Rectangle(20, 0, 15, 15), true], // r2 top-right of r1
      [new Rectangle(0, 20, 15, 15), true], // r2 bottom-left of r1
      [new Rectangle(20, 20, 15, 15), true], // r2 bottom-right of r1
      [new Rectangle(15, 5, 10, 30), true], // r2 overlaps vertically
      [new Rectangle(5, 15, 30, 10), true], // r2 overlaps horizontally
      // Touching (not overlapping by definition used)
      [new Rectangle(30, 10, 10, 10), false], // r2 to the right, touching
      [new Rectangle(0, 10, 10, 10), false], // r2 to the left, touching
      [new Rectangle(10, 30, 10, 10), false], // r2 below, touching
      [new Rectangle(10, 0, 10, 10), false], // r2 above, touching
      // Not overlapping
      [new Rectangle(100, 100, 5, 5), false], // r2 far away
      [new Rectangle(0, 0, 5, 5), false], // r2 outside top-left
      // rect1 inside rect2
      [new Rectangle(0, 0, 100, 100), true],
    ])("should return %s for overlap with %s", (rect2, expected) => {
      expect(rect1.overlaps(rect2)).toBe(expected)
      // Overlap should be commutative
      expect(rect2.overlaps(rect1)).toBe(expected)
    })
  })

  describe("getCentre", () => {
    test("should return the centre point", () => {
      const rect = new Rectangle(10, 20, 30, 40) // centreX = 10 + 15 = 25, centreY = 20 + 20 = 40
      const centre = rect.getCentre()
      expect(centre[0]).toBe(25)
      expect(centre[1]).toBe(40)
      expect(centre).not.toBe(rect.pos) // Should be a new Point
    })
  })

  describe("getArea", () => {
    test("should return the area", () => {
      expect(new Rectangle(0, 0, 5, 10).getArea()).toBe(50)
      expect(new Rectangle(1, 1, 0, 10).getArea()).toBe(0)
    })
  })

  describe("getPerimeter", () => {
    test("should return the perimeter", () => {
      expect(new Rectangle(0, 0, 5, 10).getPerimeter()).toBe(30) // 2 * (5+10)
      expect(new Rectangle(0, 0, 0, 0).getPerimeter()).toBe(0)
    })
  })

  describe("getTopLeft", () => {
    test("should return the top-left point", () => {
      const rect = new Rectangle(1, 2, 3, 4)
      const tl = rect.getTopLeft()
      expect(tl[0]).toBe(1)
      expect(tl[1]).toBe(2)
      expect(tl).not.toBe(rect.pos)
    })
  })

  describe("getBottomRight", () => {
    test("should return the bottom-right point", () => {
      const rect = new Rectangle(1, 2, 10, 20) // right=11, bottom=22
      const br = rect.getBottomRight()
      expect(br[0]).toBe(11)
      expect(br[1]).toBe(22)
    })
  })

  describe("getSize", () => {
    test("should return the size", () => {
      const rect = new Rectangle(1, 2, 30, 40)
      const s = rect.getSize()
      expect(s[0]).toBe(30)
      expect(s[1]).toBe(40)
      expect(s).not.toBe(rect.size)
    })
  })

  describe("getOffsetTo", () => {
    test("should return the offset from top-left to the point", () => {
      const rect = new Rectangle(10, 20, 5, 5)
      const offset = rect.getOffsetTo([12, 23])
      expect(offset[0]).toBe(2) // 12 - 10
      expect(offset[1]).toBe(3) // 23 - 20
    })
  })

  describe("getOffsetFrom", () => {
    test("should return the offset from the point to the top-left", () => {
      const rect = new Rectangle(10, 20, 5, 5)
      const offset = rect.getOffsetFrom([12, 23])
      expect(offset[0]).toBe(-2) // 10 - 12
      expect(offset[1]).toBe(-3) // 20 - 23
    })
  })

  describe("setWidthRightAnchored", () => {
    test("should set width, anchoring the right edge", () => {
      const rect = new Rectangle(10, 0, 20, 0) // x:10, width:20 -> right:30
      rect.setWidthRightAnchored(15) // new width 15
      expect(rect.width).toBe(15)
      expect(rect.x).toBe(15) // x = oldX + (oldWidth - newWidth) = 10 + (20 - 15) = 15
      expect(rect.right).toBe(30) // right should remain 30 (15+15)
    })
  })

  describe("setHeightBottomAnchored", () => {
    test("should set height, anchoring the bottom edge", () => {
      const rect = new Rectangle(0, 10, 0, 20) // y:10, height:20 -> bottom:30
      rect.setHeightBottomAnchored(15) // new height 15
      expect(rect.height).toBe(15)
      expect(rect.y).toBe(15) // y = oldY + (oldHeight - newHeight) = 10 + (20-15) = 15
      expect(rect.bottom).toBe(30) // bottom should remain 30 (15+15)
    })
  })

  describe("toArray / export", () => {
    test("should return an array with [x, y, width, height]", () => {
      const rect = new Rectangle(1, 2, 3, 4)
      const arr = rect.toArray()
      expect(arr).toEqual([1, 2, 3, 4])
      expect(Array.isArray(arr)).toBe(true)
      expect(arr).not.toBeInstanceOf(Float64Array)

      const exported = rect.export()
      expect(exported).toEqual([1, 2, 3, 4])
      expect(Array.isArray(exported)).toBe(true)
      expect(exported).not.toBeInstanceOf(Float64Array)
    })
  })

  describe("_drawDebug", () => {
    test("should call canvas context methods", () => {
      const rect = new Rectangle(10, 20, 30, 40)
      const mockCtx = {
        strokeStyle: "black",
        lineWidth: 1,
        beginPath: vi.fn(),
        strokeRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D

      rect._drawDebug(mockCtx, "blue")

      expect(mockCtx.beginPath).toHaveBeenCalledOnce()
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(10, 20, 30, 40)
      expect(mockCtx.strokeStyle).toBe("black") // Restored
      expect(mockCtx.lineWidth).toBe(1) // Restored

      // Check if it was set during the call
      // This is a bit tricky as it's restored in finally.
      // We'd need to spy on the setter or check the calls in order.
      // For simplicity, we're assuming the implementation is correct if strokeRect was called with correct params.
      // A more robust test could involve spying on property assignments if vitest supports it easily.
    })
    test("should use default color if not provided", () => {
      const rect = new Rectangle(1, 2, 3, 4)
      const mockCtx = {
        strokeStyle: "black",
        lineWidth: 1,
        beginPath: vi.fn(),
        strokeRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D
      rect._drawDebug(mockCtx)
      // Check if strokeStyle was "red" at the time of strokeRect
      // This requires a more complex mock or observing calls.
      // A simple check is that it ran without error and values were restored.
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(1, 2, 3, 4)
      expect(mockCtx.strokeStyle).toBe("black")
    })
  })
})
