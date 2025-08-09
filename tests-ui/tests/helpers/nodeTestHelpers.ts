// Simple mock objects for testing Vue node components
export function createMockWidget(overrides: any = {}) {
  return {
    name: 'test_widget',
    type: 'number',
    value: 0,
    options: {},
    callback: null,
    ...overrides
  }
}

// Create mock VueNodeData for testing
export function createMockVueNodeData(overrides: any = {}) {
  return {
    id: 'node-1',
    type: 'TestNode',
    title: 'Test Node',
    mode: 0,
    selected: false,
    executing: false,
    widgets: [],
    inputs: [],
    outputs: [],
    ...overrides
  }
}

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

// Helper to create a position
export function createPosition(x: number, y: number) {
  return { x, y }
}

// Helper to create a size
export function createSize(width: number, height: number) {
  return { width, height }
}
