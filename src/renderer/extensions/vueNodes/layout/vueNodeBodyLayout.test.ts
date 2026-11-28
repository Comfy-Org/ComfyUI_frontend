import { describe, expect, it } from 'vitest'

import { nodeGeometryOf } from '@comfyorg/theme-core/nodeGeometry'

import { layoutVueNodeBody } from './vueNodeBodyLayout'
import type { BodyItem } from './vueNodeBodyLayout'

const DEFAULT_GEOMETRY = nodeGeometryOf(undefined)

const GROWABLE_40 = {
  kind: 'growable',
  minHeight: 40,
  minWidth: 0
} as const

function growable(extra: Partial<BodyItem & { kind: 'control' }> = {}) {
  return {
    kind: 'control',
    key: 'g',
    growable: true,
    sizing: GROWABLE_40,
    ...extra
  } satisfies BodyItem
}

describe('layoutVueNodeBody', () => {
  it('overlaps a socket row with a neighbouring widget row but not with the slot block', () => {
    const layout = layoutVueNodeBody(
      200,
      200,
      [
        { kind: 'slots', inputs: [0], outputs: [0] },
        { kind: 'socket', key: 's', input: 1 },
        { kind: 'control', key: 'c', growable: false }
      ],
      DEFAULT_GEOMETRY
    )

    expect(layout.rows.get('s')).toEqual({ y: 28, height: 20 })
    expect(layout.rows.get('c')).toEqual({ y: 50, height: 24 })
    expect(layout.inputs).toEqual(
      new Map([
        [0, { x: 0, y: 14 }],
        [1, { x: 0, y: 38 }]
      ])
    )
    expect(layout.outputs).toEqual(new Map([[0, { x: 200, y: 14 }]]))
    expect(layout.minBodyHeight).toBe(86)
    expect(layout.slack).toBe(0)
  })

  it('places rows and anchors with the Classic stylesheet geometry', () => {
    const layout = layoutVueNodeBody(
      200,
      200,
      [
        { kind: 'slots', inputs: [0], outputs: [0] },
        { kind: 'socket', key: 's', input: 1 },
        { kind: 'control', key: 'c', growable: false }
      ],
      nodeGeometryOf('classic')
    )

    expect(layout.rows.get('s')).toEqual({ y: 26, height: 20 })
    expect(layout.rows.get('c')).toEqual({ y: 50, height: 24 })
    expect(layout.inputs).toEqual(
      new Map([
        [0, { x: 10, y: 14 }],
        [1, { x: 10, y: 36 }]
      ])
    )
    expect(layout.outputs).toEqual(new Map([[0, { x: 190, y: 14 }]]))
  })

  it.for([
    {
      name: 'a growable row takes the spare height',
      row: growable(),
      height: 184,
      minBodyHeight: 56,
      slack: 144
    },
    {
      name: 'a user height overrides growable',
      row: growable({ userHeight: 60 }),
      height: 60,
      minBodyHeight: 76,
      slack: 0
    },
    {
      name: 'a content height raises the growable minimum',
      row: growable({ contentHeight: 90 }),
      height: 184,
      minBodyHeight: 106,
      slack: 94
    }
  ])('$name', ({ row, height, minBodyHeight, slack }) => {
    const layout = layoutVueNodeBody(200, 200, [row], DEFAULT_GEOMETRY)

    expect(layout.rows.get('g')).toEqual({ y: 4, height })
    expect(layout.minBodyHeight).toBe(minBodyHeight)
    expect(layout.slack).toBe(slack)
  })

  it('anchors nothing for an empty slot block and keeps the gap after it', () => {
    const layout = layoutVueNodeBody(
      200,
      200,
      [
        { kind: 'slots', inputs: [], outputs: [] },
        { kind: 'control', key: 'c', input: 0, growable: false }
      ],
      DEFAULT_GEOMETRY
    )

    expect(layout.inputs).toEqual(new Map([[0, { x: 0, y: 20 }]]))
    expect(layout.outputs).toEqual(new Map())
  })

  it('splits the spare height between a growable row and a media region, leaving the media out of the slack', () => {
    const layout = layoutVueNodeBody(
      200,
      200,
      [growable(), { kind: 'media', key: 'm' }],
      DEFAULT_GEOMETRY
    )

    expect(layout.rows.get('g')).toEqual({ y: 4, height: 110 })
    expect(layout.rows.get('m')).toEqual({ y: 118, height: 70 })
    expect(layout.slack).toBe(70)
  })
})
