import { describe, expect, expectTypeOf, it } from 'vitest'

import type { UUID } from '@/utils/uuid'

import type { NodeEntityId, NodeId, WidgetEntityId } from './entityIds'
import {
  asGraphId,
  deriveWidgetEntityId,
  isWidgetEntityId,
  nodeEntityId,
  parseLegacyWidgetEntityId,
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

describe('isWidgetEntityId', () => {
  const graphId = asGraphId('a1b2c3d4-e5f6-7890-abcd-ef1234567890' as UUID)

  it('accepts ids built by the constructor', () => {
    expect(isWidgetEntityId(widgetEntityId(graphId, 1 as NodeId, 'x'))).toBe(
      true
    )
  })

  it('rejects strings lacking the widget: prefix', () => {
    expect(isWidgetEntityId('only-one-colon:42')).toBe(false)
    expect(isWidgetEntityId('no-colons')).toBe(false)
    expect(isWidgetEntityId(`${graphId}:42:seed`)).toBe(false)
    expect(isWidgetEntityId(`node:${graphId}:42`)).toBe(false)
  })

  it('rejects strings with too few segments', () => {
    expect(isWidgetEntityId('widget:abc')).toBe(false)
    expect(isWidgetEntityId(`widget:${graphId}:42`)).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isWidgetEntityId(42)).toBe(false)
    expect(isWidgetEntityId(null)).toBe(false)
    expect(isWidgetEntityId(undefined)).toBe(false)
    expect(isWidgetEntityId({})).toBe(false)
  })
})

describe('parseLegacyWidgetEntityId', () => {
  const graphId = asGraphId('11111111-1111-4111-8111-111111111111' as UUID)

  it('parses an unprefixed widget id for the current graph', () => {
    expect(parseLegacyWidgetEntityId(`${graphId}:42:seed`, graphId)).toEqual({
      graphId,
      nodeId: '42',
      name: 'seed'
    })
  })

  it('preserves widget names containing colons', () => {
    expect(
      parseLegacyWidgetEntityId(`${graphId}:7:images.image:0`, graphId)?.name
    ).toBe('images.image:0')
  })

  it('rejects canonical widget ids and other graph ids', () => {
    expect(
      parseLegacyWidgetEntityId(widgetEntityId(graphId, 42, 'seed'), graphId)
    ).toBeUndefined()
    expect(
      parseLegacyWidgetEntityId(
        '22222222-2222-4222-8222-222222222222:42:seed',
        graphId
      )
    ).toBeUndefined()
  })
})

describe('deriveWidgetEntityId', () => {
  const graphId = asGraphId('e1d2c3b4-a5f6-1234-5678-90abcdef1234' as UUID)

  it('builds an entity id when all inputs are present', () => {
    const id = deriveWidgetEntityId(graphId, 5 as NodeId, 'seed')
    expect(id).toBe(widgetEntityId(graphId, 5 as NodeId, 'seed'))
  })

  it('returns undefined when graphId is missing', () => {
    expect(deriveWidgetEntityId(undefined, 5 as NodeId, 'seed')).toBeUndefined()
  })

  it('returns undefined when nodeId is undefined', () => {
    expect(deriveWidgetEntityId(graphId, undefined, 'seed')).toBeUndefined()
  })

  it('returns undefined for the sentinel nodeId -1', () => {
    expect(deriveWidgetEntityId(graphId, -1, 'seed')).toBeUndefined()
  })

  it('accepts a plain UUID for graphId', () => {
    const plain = 'f0e1d2c3-b4a5-6789-0123-456789abcdef' as UUID
    expect(deriveWidgetEntityId(plain, 1 as NodeId, 'x')).toBe(
      widgetEntityId(plain, 1 as NodeId, 'x')
    )
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
    expectTypeOf<
      WidgetEntityId extends NodeEntityId ? WidgetEntityId : never
    >().toEqualTypeOf<never>()
    expectTypeOf<
      NodeEntityId extends WidgetEntityId ? NodeEntityId : never
    >().toEqualTypeOf<never>()
  })
})
