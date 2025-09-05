// Create a mock canvas context for transform testing
export function createMockCanvasContext() {
  return {
    canvas: {
      width: 1280,
      height: 720,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1280,
        height: 720,
        right: 1280,
        bottom: 720,
        x: 0,
        y: 0
      })
    },
    ds: {
      offset: [0, 0],
      scale: 1
    }
  }
}

// Helper to create bounds for spatial testing
export function createBounds(
  x: number,
  y: number,
  width: number,
  height: number
) {
  return {
    x,
    y,
    width,
    height
  }
}
