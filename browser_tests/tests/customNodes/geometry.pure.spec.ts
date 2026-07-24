import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { NodeGeometry } from '@e2e/fixtures/customNode/geometry'
import {
  diffGeometry,
  loadPackGeometry,
  packGeometryRelativePath
} from '@e2e/fixtures/customNode/geometry'
import { loadManifest } from '@e2e/fixtures/customNode/manifest'

// The differ is the geometry tier's entire failure-reporting contract:
// every red a maintainer ever sees comes out of diffGeometry.

function node(overrides: Partial<NodeGeometry> = {}): NodeGeometry {
  return {
    litegraph: {
      w: 263.85,
      h: 106,
      widgets: [{ name: 'seed', y: 915 }],
      inputs: [[10, 14]],
      outputs: [[254.85000610351562, 14]]
    },
    vue: {
      w: 263.8437566786189,
      h: 143.99999833034525,
      widgets: [{ dy: 30.00000834827365, h: 20 }],
      slots: [[-6.000008626549439, 30.00000834827365]]
    },
    ...overrides
  }
}

test.describe('diffGeometry', () => {
  test('identical input yields no deltas', () => {
    expect(diffGeometry({ A: node() }, { A: node() })).toEqual([])
  })

  test('an integer value delta reds with the exact path', () => {
    const measured = node()
    measured.litegraph.widgets = [{ name: 'seed', y: 920 }]
    expect(diffGeometry({ A: node() }, { A: measured })).toEqual([
      'A.litegraph.widgets[0].y: expected 915, got 920'
    ])
  })

  test('sub-epsilon cross-runner float jitter is absorbed', () => {
    const measured = node()
    measured.vue!.w = 263.8437566786189 + 0.0002
    measured.litegraph.h = 106.005
    expect(diffGeometry({ A: node() }, { A: measured })).toEqual([])
  })

  test('a delta beyond GEOMETRY_EPSILON_PX still reds with the exact path', () => {
    const measured = node()
    measured.litegraph.h = 106.5
    expect(diffGeometry({ A: node() }, { A: measured })).toEqual([
      'A.litegraph.h: expected 106, got 106.5'
    ])
  })

  test('a widget added or removed reds as a length mismatch', () => {
    const measured = node()
    measured.litegraph.widgets = [
      { name: 'seed', y: 915 },
      { name: 'extra', y: 940 }
    ]
    expect(diffGeometry({ A: node() }, { A: measured })).toEqual([
      'A.litegraph.widgets: expected length 1, got 2'
    ])
  })

  test('a null-vs-number widget y reds as a type mismatch', () => {
    const measured = node()
    measured.litegraph.widgets = [{ name: 'seed', y: null }]
    expect(diffGeometry({ A: node() }, { A: measured })).toEqual([
      'A.litegraph.widgets[0].y: expected 915, got null'
    ])
  })

  test('a measured node with no baseline reds toward recording', () => {
    expect(diffGeometry({}, { A: node() })).toEqual([
      'A: no geometry baseline - re-record via the record workflow (ADDING_CUSTOM_NODES.md Step 5b) with the change that added it'
    ])
  })

  test('a corrupted baseline shape (array vs object) reds with the ? length', () => {
    const corrupted = node()
    corrupted.litegraph.inputs = {} as never
    expect(diffGeometry({ A: corrupted }, { A: node() })).toEqual([
      'A.litegraph.inputs: expected length ?, got 1'
    ])
  })

  test('a measured -0 equals a stored 0 (JSON writes -0 as 0; no unfixable red)', () => {
    const measured = node()
    measured.litegraph.w = -0
    const baseline = node()
    baseline.litegraph.w = 0
    expect(diffGeometry({ A: baseline }, { A: measured })).toEqual([])
  })

  test('a baseline node no longer measured reds as stale', () => {
    expect(diffGeometry({ A: node() }, {})).toEqual([
      'A: baseline entry but the node was not measured - stale baseline, re-record'
    ])
  })

  test('a vue section vanishing (or appearing) reds', () => {
    const noVue = node()
    delete noVue.vue
    expect(diffGeometry({ A: node() }, { A: noVue })).not.toEqual([])
    expect(diffGeometry({ A: noVue }, { A: node() })).not.toEqual([])
  })

  test('two deltas in one node yield one line; deltas in two nodes yield two', () => {
    const measured = node()
    measured.litegraph.w = 1
    measured.litegraph.h = 2
    expect(diffGeometry({ A: node() }, { A: measured })).toHaveLength(1)
    expect(
      diffGeometry({ A: node(), B: node() }, { A: measured, B: measured })
    ).toHaveLength(2)
  })
})

test.describe('baseline path resolution', () => {
  test('cloud resolves a separate baseline set; core paths are untouched', () => {
    const prior = process.env.CUSTOM_NODES_ENV
    try {
      delete process.env.CUSTOM_NODES_ENV
      const pack = loadManifest()[0].pack
      const coreBaseline = loadPackGeometry(pack)
      expect(coreBaseline).not.toBeNull()
      expect(packGeometryRelativePath(pack)).toBe(
        `browser_tests/fixtures/customNode/geometry/${pack}.json`
      )
      process.env.CUSTOM_NODES_ENV = 'cloud'
      expect(packGeometryRelativePath(pack)).toBe(
        `browser_tests/fixtures/customNode/geometry/cloud/${pack}.json`
      )
      expect(loadPackGeometry(pack)).toBeNull()
      delete process.env.CUSTOM_NODES_ENV
      expect(loadPackGeometry(pack)).toEqual(coreBaseline)
    } finally {
      if (prior === undefined) delete process.env.CUSTOM_NODES_ENV
      else process.env.CUSTOM_NODES_ENV = prior
    }
  })
})
