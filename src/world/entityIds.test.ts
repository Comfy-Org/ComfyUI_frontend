import { describe, expect, it } from 'vitest'

import type { WidgetEntityId } from './entityIds'
import {
  isWidgetEntityId,
  parseWidgetEntityId,
  widgetEntityId
} from './entityIds'

describe('widgetEntityId', () => {
  const graphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  it('builds a deterministic id from its components', () => {
    const id = widgetEntityId(graphId, 42, 'seed')
    expect(id).toBe(`${graphId}:42:seed`)
  })

  it('produces equal ids for equal inputs', () => {
    expect(widgetEntityId(graphId, 42, 'seed')).toBe(
      widgetEntityId(graphId, 42, 'seed')
    )
  })

  it('produces distinct ids when any component differs', () => {
    const baseline = widgetEntityId(graphId, 42, 'seed')
    expect(widgetEntityId(graphId, 43, 'seed')).not.toBe(baseline)
    expect(widgetEntityId(graphId, 42, 'steps')).not.toBe(baseline)
    const otherGraph = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890'
    expect(widgetEntityId(otherGraph, 42, 'seed')).not.toBe(baseline)
  })

  it('accepts string node ids', () => {
    const id = widgetEntityId(graphId, 'node-7', 'value')
    expect(id).toBe(`${graphId}:node-7:value`)
  })
})

describe('parseWidgetEntityId', () => {
  const graphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  it('round-trips a constructed id', () => {
    const id = widgetEntityId(graphId, 42, 'seed')
    expect(parseWidgetEntityId(id)).toEqual({
      graphId,
      nodeId: '42',
      name: 'seed'
    })
  })

  it('preserves colons inside the name segment', () => {
    const rawName = 'nested:label:with:colons'
    const rawId = `${graphId}:42:${rawName}` as WidgetEntityId
    expect(parseWidgetEntityId(rawId)).toEqual({
      graphId,
      nodeId: '42',
      name: rawName
    })
  })
})

describe('isWidgetEntityId', () => {
  const graphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  it('accepts ids built by the constructor', () => {
    expect(isWidgetEntityId(widgetEntityId(graphId, 1, 'x'))).toBe(true)
  })

  it('rejects strings without two colon-separated segments', () => {
    expect(isWidgetEntityId('only-one-colon:42')).toBe(false)
    expect(isWidgetEntityId('no-colons')).toBe(false)
    expect(isWidgetEntityId(':leading-colon:name')).toBe(false)
    expect(isWidgetEntityId('graph::name')).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isWidgetEntityId(42)).toBe(false)
    expect(isWidgetEntityId(null)).toBe(false)
    expect(isWidgetEntityId(undefined)).toBe(false)
    expect(isWidgetEntityId({})).toBe(false)
  })
})
