import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { NodeGeometry } from '@e2e/fixtures/customNode/geometry'
import { diffGeometry } from '@e2e/fixtures/customNode/geometry'

// The differ is the geometry tier's entire failure-reporting contract:
// every red a maintainer ever sees comes out of diffGeometry. These cases
// pin each red path and the exact-equality discipline (no rounding, no
// tolerance) the tier is built on.

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

  test('exactness holds at full float precision - a 1-ulp neighbor reds', () => {
    const measured = node()
    measured.vue!.w = 263.84375667861894
    expect(diffGeometry({ A: node() }, { A: measured })).toEqual([
      'A.vue.w: expected 263.8437566786189, got 263.84375667861894'
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
      'A: no geometry baseline - re-record (CN_GEOMETRY=record) with the change that added it'
    ])
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
