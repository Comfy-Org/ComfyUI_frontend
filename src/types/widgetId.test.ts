import { describe, expect, it } from 'vitest'

import type { WidgetId } from './widgetId'
import { isWidgetId, parseWidgetId, widgetId } from './widgetId'
import { toNodeId } from '@/types/nodeId'

describe('widgetId', () => {
  const graphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  it('builds a deterministic id from its components', () => {
    const id = widgetId(graphId, toNodeId(42), 'seed')
    expect(id).toBe(`${graphId}:42:seed`)
  })

  it('produces equal ids for equal inputs', () => {
    expect(widgetId(graphId, toNodeId(42), 'seed')).toBe(
      widgetId(graphId, toNodeId(42), 'seed')
    )
  })

  it('produces distinct ids when any component differs', () => {
    const baseline = widgetId(graphId, toNodeId(42), 'seed')
    expect(widgetId(graphId, toNodeId(43), 'seed')).not.toBe(baseline)
    expect(widgetId(graphId, toNodeId(42), 'steps')).not.toBe(baseline)
    const otherGraph = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890'
    expect(widgetId(otherGraph, toNodeId(42), 'seed')).not.toBe(baseline)
  })

  it('accepts string node ids', () => {
    const id = widgetId(graphId, toNodeId('node-7'), 'value')
    expect(id).toBe(`${graphId}:node-7:value`)
  })
})

describe('parseWidgetId', () => {
  const graphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  it('round-trips a constructed id', () => {
    const id = widgetId(graphId, toNodeId(42), 'seed')
    expect(parseWidgetId(id)).toEqual({
      graphId,
      nodeId: toNodeId('42'),
      name: 'seed'
    })
  })

  it('round-trips colons inside the name segment', () => {
    const rawName = 'nested:label:with:colons'
    expect(parseWidgetId(widgetId(graphId, toNodeId(42), rawName))).toEqual({
      graphId,
      nodeId: toNodeId('42'),
      name: rawName
    })
  })

  it('rejects ids that do not match the widget id format', () => {
    expect(() => parseWidgetId(`${graphId}:42:name:extra` as WidgetId)).toThrow(
      'Invalid widget id'
    )
  })
})

describe('isWidgetId', () => {
  const graphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  it('accepts ids built by the constructor', () => {
    expect(isWidgetId(widgetId(graphId, toNodeId(1), 'x'))).toBe(true)
  })

  it('accepts unicode widget names', () => {
    expect(isWidgetId(`${graphId}:1:プロンプト`)).toBe(true)
  })

  it('rejects strings with extra colon-separated segments', () => {
    expect(isWidgetId(`${graphId}:1:name:extra`)).toBe(false)
  })

  it('rejects strings without two colon-separated segments', () => {
    expect(isWidgetId('only-one-colon:42')).toBe(false)
    expect(isWidgetId('no-colons')).toBe(false)
    expect(isWidgetId(':leading-colon:name')).toBe(false)
    expect(isWidgetId('graph::name')).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isWidgetId(42)).toBe(false)
    expect(isWidgetId(null)).toBe(false)
    expect(isWidgetId(undefined)).toBe(false)
    expect(isWidgetId({})).toBe(false)
  })
})
