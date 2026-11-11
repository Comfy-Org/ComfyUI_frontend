import { describe, expect, it } from 'vitest'

import { hostNode, textToImageNodes } from './fakePointHost'
import type { Point, Rect } from './geometry'
import { draftForSelection, matchMark, targetAtPoint } from './markMatching'

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

describe('targetAtPoint', () => {
  it('AN-02: finds the setting row under the pointer', () => {
    expect(targetAtPoint({ x: 300, y: 410 }, nodes)).toEqual({
      address: { kind: 'setting', nodeId: latent.id, setting: 'height' },
      label: 'Empty Latent Image › height',
      rect: { x: 260, y: 402, width: 180, height: 18 }
    })
  })

  it('AN-02: finds the node when the pointer is on it but on no row', () => {
    expect(targetAtPoint({ x: 800, y: 480 }, nodes)).toEqual({
      address: { kind: 'node', nodeId: save.id },
      label: 'Save Image',
      rect: { x: 700, y: 295, width: 190, height: 200 }
    })
  })

  it('AN-02: finds nothing on empty canvas', () => {
    expect(targetAtPoint({ x: 40, y: 600 }, nodes)).toBeNull()
  })

  it('picks the node drawn on top where two nodes overlap', () => {
    const onTop = hostNode({
      id: 12,
      type: 'Note',
      title: 'Note',
      rect: { x: 400, y: 380, width: 100, height: 60 }
    })

    expect(targetAtPoint({ x: 420, y: 430 }, [...nodes, onTop])?.label).toBe(
      'Note'
    )
  })
})

describe('draftForSelection', () => {
  it('AN-10: makes one comment that covers every selected node', () => {
    expect(draftForSelection([latent.id, save.id], nodes)).toEqual({
      annotationId: null,
      targets: [
        { kind: 'node', nodeId: latent.id },
        { kind: 'node', nodeId: save.id }
      ],
      label: 'Empty Latent Image, Save Image',
      comment: ''
    })
  })

  it('makes nothing when no selected node is in the workflow', () => {
    expect(draftForSelection([], nodes)).toBeNull()
  })
})
