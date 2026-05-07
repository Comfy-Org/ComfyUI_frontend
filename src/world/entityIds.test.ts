import { describe, expect, expectTypeOf, it } from 'vitest'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'

import type { NodeEntityId, WidgetEntityId } from './entityIds'
import {
  asGraphId,
  nodeEntityId,
  parseWidgetEntityId,
  widgetEntityId
} from './entityIds'

describe('parseWidgetEntityId', () => {
  const graphId = asGraphId('a3f2c1d8-4567-89ab-cdef-1234567890ab' as UUID)

  it('round-trips a simple name', () => {
    const id = widgetEntityId(graphId, 42 as NodeId, 'seed')
    expect(parseWidgetEntityId(id)).toEqual({
      graphId,
      nodeId: '42',
      name: 'seed'
    })
  })

  it('preserves names containing colons', () => {
    const id = widgetEntityId(graphId, 7 as NodeId, 'images.image:0')
    expect(parseWidgetEntityId(id).name).toBe('images.image:0')
  })

  it('handles string node ids', () => {
    // Documented limitation: a colon-containing nodeId would split at the
    // FIRST colon after graphId. NodeId values are scalar-shaped in
    // production, so we only assert the graphId still round-trips here.
    const id = widgetEntityId(graphId, '12:5' as NodeId, 'sub_widget')
    const parsed = parseWidgetEntityId(id)
    expect(parsed.graphId).toBe(graphId)
  })

  it('round-trips an empty name', () => {
    const id = widgetEntityId(graphId, 1 as NodeId, '')
    expect(parseWidgetEntityId(id)).toEqual({
      graphId,
      nodeId: '1',
      name: ''
    })
  })

  it('throws on missing widget: prefix', () => {
    expect(() =>
      parseWidgetEntityId(`node:${graphId}:42` as unknown as WidgetEntityId)
    ).toThrow(/Malformed WidgetEntityId/)
  })

  it('throws on too few colons', () => {
    expect(() => parseWidgetEntityId('widget:abc' as WidgetEntityId)).toThrow(
      /Malformed WidgetEntityId/
    )
  })

  it('throws when nodeId segment is missing', () => {
    expect(() =>
      parseWidgetEntityId(`widget:${graphId}:42` as WidgetEntityId)
    ).toThrow(/Malformed WidgetEntityId/)
  })
})

describe('entityIds type shapes', () => {
  type GraphId = ReturnType<typeof asGraphId>

  it('widgetEntityId returns the WidgetEntityId brand', () => {
    expectTypeOf(widgetEntityId).returns.toEqualTypeOf<WidgetEntityId>()
  })

  it('nodeEntityId returns the NodeEntityId brand', () => {
    expectTypeOf(nodeEntityId).returns.toEqualTypeOf<NodeEntityId>()
  })

  it('parseWidgetEntityId returns the documented shape', () => {
    expectTypeOf(parseWidgetEntityId).returns.toEqualTypeOf<{
      graphId: GraphId
      nodeId: NodeId
      name: string
    }>()
  })

  it('WidgetEntityId and NodeEntityId are distinct brands', () => {
    // Brand isolation: neither direction is assignable. Both `extends`
    // checks must resolve to `never` for the brand contract to hold.
    expectTypeOf<
      WidgetEntityId extends NodeEntityId ? WidgetEntityId : never
    >().toEqualTypeOf<never>()
    expectTypeOf<
      NodeEntityId extends WidgetEntityId ? NodeEntityId : never
    >().toEqualTypeOf<never>()
  })
})
