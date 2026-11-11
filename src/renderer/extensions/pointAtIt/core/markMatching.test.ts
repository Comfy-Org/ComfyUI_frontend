import { describe, expect, it } from 'vitest'

import { textToImageNodes } from './fakePointHost'
import type { Point, Rect } from './geometry'
import { markSelection, matchMark } from './markMatching'

const nodes = textToImageNodes()
const latent = nodes[1]
const save = nodes[2]
const latentRect = { x: 260, y: 360, width: 180, height: 90 }
const widthAndHeightRows = { x: 260, y: 384, width: 180, height: 36 }

function loopAround(rect: Rect, margin = 6): Point[] {
  const left = rect.x - margin
  const top = rect.y - margin
  const right = rect.x + rect.width + margin
  const bottom = rect.y + rect.height + margin
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: left + 4, y: top + 4 }
  ]
}

function labels(stroke: Point[]): string[] {
  return matchMark(stroke, nodes).map((chip) => chip.label)
}

describe('matchMark', () => {
  it('M-03: a click on a setting row marks that setting', () => {
    expect(matchMark([{ x: 300, y: 392 }], nodes)).toEqual([
      {
        id: 'setting:5:width',
        target: { kind: 'setting', nodeId: latent.id, setting: 'width' },
        label: 'Empty Latent Image › width'
      }
    ])
  })

  it('M-04: a stroke around most of a node marks the node and none of its settings', () => {
    expect(labels(loopAround(latentRect))).toEqual(['Empty Latent Image'])
  })

  it('a stroke around some settings marks each of them', () => {
    expect(labels(loopAround(widthAndHeightRows, 2))).toEqual([
      'Empty Latent Image › width',
      'Empty Latent Image › height'
    ])
  })

  it('M-05: a stroke over part of a node and no setting marks the node', () => {
    const pictureArea = { x: 720, y: 360, width: 150, height: 120 }

    expect(labels(loopAround(pictureArea, 0))).toEqual(['Save Image'])
  })

  it('M-06: a stroke on empty canvas marks nothing', () => {
    expect(
      labels(loopAround({ x: 40, y: 600, width: 80, height: 60 }))
    ).toEqual([])
  })

  it('a click on a node outside its settings marks the node', () => {
    expect(labels([{ x: 800, y: 480 }])).toEqual(['Save Image'])
  })
})

describe('markSelection', () => {
  it('S-01: makes one chip per selected node, anchored at the selected nodes', () => {
    const fallback = { x: 640, y: 400, width: 0, height: 0 }

    expect(markSelection([latent.id, save.id], nodes, fallback)).toEqual({
      chips: [
        {
          id: 'node:5',
          target: { kind: 'node', nodeId: latent.id },
          label: 'Empty Latent Image'
        },
        {
          id: 'node:9',
          target: { kind: 'node', nodeId: save.id },
          label: 'Save Image'
        }
      ],
      anchor: { x: 260, y: 295, width: 630, height: 200 }
    })
  })
})
