import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLitegraphService } from '@/services/litegraphService'

import {
  dynamicGroupRowAllocationBound,
  isDynamicGroupController,
  reachesDynamicGroupRowCount
} from './dynamicGroupDiagnostics'

function controllerWithMin(min: number) {
  const graph = new LGraph()
  const node = new LGraphNode('DynamicGroupBounds')
  graph.add(node)
  useLitegraphService().addNodeInput(node, {
    name: 'rows',
    type: 'COMFY_DYNAMICGROUP_V3',
    isOptional: false,
    min,
    max: 3,
    template: { required: { strength: ['FLOAT', { default: 1 }] } }
  })
  const controller = node.widgets?.find((widget) => widget.name === 'rows')
  if (!controller) throw new Error('Missing controller')
  return { node, controller }
}

describe('DynamicGroup row bounds', () => {
  it('gives a widget that is not a controller no allocation', () => {
    const { node, controller } = controllerWithMin(0)
    const field = node.addWidget('text', 'other', '', () => {})

    expect(isDynamicGroupController(field)).toBe(false)
    expect(dynamicGroupRowAllocationBound(field)).toBe(0)
    expect(dynamicGroupRowAllocationBound(controller)).toBeGreaterThan(0)
  })

  it.for([
    ['1', 'a numeric string'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'infinity'],
    [null, 'null']
  ])('never treats %s as a reached count (%s)', ([value]) => {
    const { controller } = controllerWithMin(1)

    expect(reachesDynamicGroupRowCount(controller, value)).toBe(false)
    expect(controller.value).toBe(1)
  })

  it('compares against the count the setter would settle on', () => {
    const { controller } = controllerWithMin(1)

    expect(reachesDynamicGroupRowCount(controller, 0)).toBe(true)
    expect(reachesDynamicGroupRowCount(controller, 1.9)).toBe(true)
    controller.value = 2
    expect(reachesDynamicGroupRowCount(controller, 1)).toBe(false)
  })

  it('ignores a controller write that is not a finite number', () => {
    const { controller } = controllerWithMin(0)
    controller.value = 2

    controller.value = '1'
    controller.value = Number.NaN

    expect(controller.value).toBe(2)
  })

  it('truncates a fractional count and clamps a negative one to the minimum', () => {
    const { controller } = controllerWithMin(1)

    controller.value = 2.9
    expect(controller.value).toBe(2)
    controller.value = -4
    expect(controller.value).toBe(1)
  })
})
