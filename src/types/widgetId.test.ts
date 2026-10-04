import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WidgetId } from './widgetId'
import {
  dropUnrenamableDuplicateWidgets,
  ensureUniqueWidgetNames,
  isWidgetId,
  parseWidgetId,
  widgetId
} from './widgetId'
import { toNodeId } from '@/types/nodeId'

describe('ensureUniqueWidgetNames', () => {
  it('renames duplicates without colliding with literal suffixes', () => {
    const widgets = [
      { name: 'seed' },
      { name: 'seed' },
      { name: 'seed#1' },
      { name: 'seed' }
    ]

    expect(ensureUniqueWidgetNames(widgets)).toBe(true)
    expect(widgets.map(({ name }) => name)).toEqual([
      'seed',
      'seed#2',
      'seed#1',
      'seed#3'
    ])
  })

  it('logs and leaves all names unchanged when a duplicate cannot be renamed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const widgets = [{ name: 'seed' }, Object.freeze({ name: 'seed' })]

    expect(ensureUniqueWidgetNames(widgets)).toBe(false)
    expect(widgets.map(({ name }) => name)).toEqual(['seed', 'seed'])
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('dropUnrenamableDuplicateWidgets', () => {
  beforeEach(() => {
    // `ensureUniqueWidgetNames` warns whenever it gives up on a rename, which
    // is the entry condition for every case here rather than the subject.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  /** A name that cannot be written, which is how the state is reached. */
  const pinned = (name: string) => {
    const widget = {} as { name: string }
    Object.defineProperty(widget, 'name', { value: name, enumerable: true })
    return widget
  }

  it('refuses nothing and mutates nothing when every name is already unique', () => {
    const widgets = [{ name: 'seed' }, { name: 'steps' }]

    expect(dropUnrenamableDuplicateWidgets(widgets)).toEqual([])
    expect(widgets.map(({ name }) => name)).toEqual(['seed', 'steps'])
  })

  it('refuses nothing when the duplicate can be renamed', () => {
    const widgets = [{ name: 'seed' }, { name: 'seed' }]

    expect(dropUnrenamableDuplicateWidgets(widgets)).toEqual([])
    expect(widgets.map(({ name }) => name)).toEqual(['seed', 'seed#1'])
  })

  it('keeps the first occurrence and refuses the one it cannot rename', () => {
    const first = { name: 'seed' }
    const refused = pinned('seed')
    const widgets = [first, refused]

    expect(dropUnrenamableDuplicateWidgets(widgets)).toEqual([refused])
    expect(widgets).toEqual([first])
  })

  it('renames the collisions the refusal was masking', () => {
    // `ensureUniqueWidgetNames` is all-or-nothing, so one unrenamable widget
    // leaves every other collision on the node standing too.
    const refused = pinned('seed')
    const widgets = [
      { name: 'seed' },
      { name: 'steps' },
      refused,
      { name: 'steps' }
    ]

    expect(dropUnrenamableDuplicateWidgets(widgets)).toEqual([refused])
    expect(widgets.map(({ name }) => name)).toEqual([
      'seed',
      'steps',
      'steps#1'
    ])
  })

  it('does not hand a generated name to a widget that already holds it', () => {
    const refused = pinned('seed')
    const widgets = [{ name: 'seed' }, refused, { name: 'seed' }]
    // `seed#1` is held outright further down the array, so the rename must
    // reach past it rather than collide with a name nothing renamed.
    widgets.push({ name: 'seed#1' })

    expect(dropUnrenamableDuplicateWidgets(widgets)).toEqual([refused])
    expect(widgets.map(({ name }) => name)).toEqual([
      'seed',
      'seed#2',
      'seed#1'
    ])
  })

  it('refuses a widget whose setter silently ignores the rename', () => {
    const stubborn = {
      get name() {
        return 'seed'
      },
      set name(_value: string) {}
    }
    const widgets = [{ name: 'seed' }, pinned('seed'), stubborn]

    // Its descriptor has a setter, so a descriptor check believes the rename
    // will take; only reading the name back afterwards proves it did not.
    expect(dropUnrenamableDuplicateWidgets(widgets)).toContain(stubborn)
    expect(widgets.map(({ name }) => name)).toEqual(['seed'])
  })

  it('refuses nothing when a name accessor throws', () => {
    const hostile = {
      get name(): string {
        throw new Error('name is not readable')
      }
    }
    const widgets = [{ name: 'seed' }, hostile]

    // No readable name is no identity to collide with, so there is nothing to
    // refuse — and the throw must not escape into a widgets mutation.
    expect(dropUnrenamableDuplicateWidgets(widgets)).toEqual([])
    expect(widgets).toHaveLength(2)
  })

  it('does not refuse one widget object occupying two array slots', () => {
    const shared = pinned('seed')
    const other = pinned('seed')
    const widgets = [shared, shared, other]

    // Identity duplicates are one widget mid-reorder, not a name collision.
    expect(dropUnrenamableDuplicateWidgets(widgets)).toEqual([other])
    expect(widgets).toEqual([shared, shared])
  })
})

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

  it('percent-encodes separator-colliding node ids and names', () => {
    const first = widgetId(graphId, toNodeId('node:7'), 'value')
    const second = widgetId(graphId, toNodeId('node'), '7:value')

    expect(first).not.toBe(second)
    expect(first).toContain('node%3A7:value')
    expect(second).toContain('node:7%3Avalue')
    expect(parseWidgetId(first)).toEqual({
      graphId,
      nodeId: toNodeId('node:7'),
      name: 'value'
    })
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
