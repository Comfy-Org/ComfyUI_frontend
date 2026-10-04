import { describe, expect, it, vi } from 'vitest'

import type { WidgetId } from './widgetId'
import {
  dropUnrenamableDuplicateWidgets,
  ensureUniqueWidgetNames,
  isWidgetId,
  ownedWidgetNameKey,
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

function widgetNamed(name: unknown): { name: unknown } {
  return { name }
}

function refusedWidgets<T extends { name: unknown }>(widgets: T[]): T[] {
  return dropUnrenamableDuplicateWidgets(widgets)
    .filter(({ cause }) => cause !== 'unresolved-duplicate')
    .map(({ widget }) => widget)
}

function reportedCauses<T extends { name: unknown }>(
  widgets: T[]
): [T, string][] {
  return dropUnrenamableDuplicateWidgets(widgets).map(({ widget, cause }) => [
    widget,
    cause
  ])
}

describe('dropUnrenamableDuplicateWidgets', () => {
  function pinned(name: string): { name: string } {
    return Object.defineProperty({ name }, 'name', { writable: false })
  }

  it('refuses nothing and mutates nothing when every name is already unique', () => {
    const widgets = [{ name: 'seed' }, { name: 'steps' }]

    expect(refusedWidgets(widgets)).toEqual([])
    expect(widgets.map(({ name }) => name)).toEqual(['seed', 'steps'])
  })

  it('refuses nothing when the duplicate can be renamed', () => {
    const widgets = [{ name: 'seed' }, { name: 'seed' }]

    expect(refusedWidgets(widgets)).toEqual([])
    expect(widgets.map(({ name }) => name)).toEqual(['seed', 'seed#1'])
  })

  it('keeps the first occurrence and refuses the one it cannot rename', () => {
    const first = { name: 'seed' }
    const refused = pinned('seed')
    const widgets = [first, refused]

    expect(refusedWidgets(widgets)).toEqual([refused])
    expect(widgets).toEqual([first])
  })

  it('renames the collisions the refusal was masking', () => {
    const refused = pinned('seed')
    const widgets = [
      { name: 'seed' },
      { name: 'steps' },
      refused,
      { name: 'steps' }
    ]

    expect(refusedWidgets(widgets)).toEqual([refused])
    expect(widgets.map(({ name }) => name)).toEqual([
      'seed',
      'steps',
      'steps#1'
    ])
  })

  it('does not hand a generated name to a widget that already holds it', () => {
    const refused = pinned('seed')
    const widgets = [{ name: 'seed' }, refused, { name: 'seed' }]
    widgets.push({ name: 'seed#1' })

    expect(refusedWidgets(widgets)).toEqual([refused])
    expect(widgets.map(({ name }) => name)).toEqual([
      'seed',
      'seed#2',
      'seed#1'
    ])
  })

  it('reports a widget whose setter silently ignores the rename, without removing it', () => {
    const stubborn = {
      get name() {
        return 'seed'
      },
      set name(_value: string) {}
    }
    const unrenamable = pinned('seed')
    const widgets = [{ name: 'seed' }, unrenamable, stubborn]

    expect(reportedCauses(widgets)).toEqual([
      [unrenamable, 'duplicate-name'],
      [stubborn, 'unresolved-duplicate']
    ])
    expect(widgets).toEqual([{ name: 'seed' }, stubborn])
  })

  it('keeps a declining setter rather than removing it, and says the pair is unresolved', () => {
    const declining = {
      get name() {
        return 'seed'
      },
      set name(_value: string) {}
    }
    const widgets = [{ name: 'seed' }, declining]

    const reported = dropUnrenamableDuplicateWidgets(widgets)

    expect(reported).toEqual([
      { widget: declining, cause: 'unresolved-duplicate', name: 'seed' }
    ])
    expect(widgets).toHaveLength(2)
    expect(widgets[1]).toBe(declining)
  })

  it('refuses a widget whose name accessor throws, without letting it escape', () => {
    const hostile = {
      get name(): string {
        throw new Error('name is not readable')
      }
    }
    const widgets = [{ name: 'seed' }, hostile]

    expect(refusedWidgets(widgets)).toEqual([hostile])
    expect(widgets).toHaveLength(1)
  })

  it('tells an unreadable name apart from one that reads as undefined', () => {
    const first = widgetNamed(undefined)
    const second = widgetNamed(undefined)
    const widgets = [first, second]

    expect(refusedWidgets(widgets)).toEqual([])
    expect(widgets.map(({ name }) => name)).toEqual([undefined, 'undefined#1'])
  })

  it('refuses a name that reads fine but cannot become an id', () => {
    const unstringifiable = widgetNamed(Object.create(null))
    const unencodable = { name: '\uD800' }
    const fine = { name: 'seed' }
    const widgets = [fine, unstringifiable, unencodable]

    const refused = dropUnrenamableDuplicateWidgets(widgets)

    expect(refused.map(({ widget }) => widget)).toEqual([
      unstringifiable,
      unencodable
    ])
    expect(widgets).toEqual([fine])
  })

  it('refuses a name that cannot be encoded into an id, but keeps an empty one', () => {
    const symbolNamed = widgetNamed(Symbol('seed'))
    const empty = widgetNamed('')
    const fine = widgetNamed('seed')
    const widgets = [fine, symbolNamed, empty]

    expect(refusedWidgets(widgets)).toEqual([symbolNamed])
    expect(widgets).toEqual([fine, empty])
  })

  it('reports the name the walk read, not one the rename attempts left behind', () => {
    const first = widgetNamed('seed')
    let stored = 'seed'
    const normalising = {
      get name(): string {
        return stored
      },
      set name(value: string) {
        stored = `${value}-normalised`
      }
    }

    const refused = dropUnrenamableDuplicateWidgets([first, normalising])

    expect(refused).toHaveLength(1)
    expect(refused[0].name).toBe('seed')
    expect(refused[0].widget.name).not.toBe('seed')
  })

  it('records why each widget was refused, rather than leaving it to be guessed', () => {
    let reads = 0
    const flaky = {
      get name(): string {
        reads++
        if (reads <= 2) throw new Error('not readable yet')
        return 'seed'
      }
    }
    const first = { name: 'seed' }
    const pinned = { name: 'other' }
    Object.defineProperty(pinned, 'name', {
      value: 'seed',
      writable: false,
      configurable: false
    })

    const refused = dropUnrenamableDuplicateWidgets([first, flaky, pinned])

    expect(refused.map(({ cause }) => cause)).toEqual([
      'unreadable-name',
      'duplicate-name'
    ])
    expect(flaky.name).toBe('seed')
  })

  it('removes a duplicate whose `name` is a getter-only accessor on its prototype', () => {
    const first = { name: 'seed' }
    const inherited: { name: unknown } = Object.create({
      get name() {
        return 'seed'
      }
    })
    const widgets = [first, inherited]

    const refused = dropUnrenamableDuplicateWidgets(widgets)

    expect(refused.map(({ cause }) => cause)).toEqual(['duplicate-name'])
    expect(widgets).toEqual([first])
  })

  it('refuses a widget whose descriptor trap throws instead of aborting the walk', () => {
    const first = { name: 'seed' }
    const target = Object.defineProperty({ name: 'seed' }, 'name', {
      writable: false
    })
    const hostile = new Proxy(target, {
      getOwnPropertyDescriptor() {
        throw new Error('hostile descriptor trap')
      }
    })

    const widgets = [first, hostile]
    expect(() => dropUnrenamableDuplicateWidgets(widgets)).not.toThrow()

    expect(widgets).toEqual([first])
  })

  it('collides names that differ as values but coincide as id strings', () => {
    const widgets = [
      widgetNamed(undefined),
      { name: 'undefined' },
      widgetNamed(1),
      { name: '1' }
    ]

    expect(refusedWidgets(widgets)).toEqual([])
    expect(widgets.map(({ name }) => name)).toEqual([
      undefined,
      'undefined#1',
      1,
      '1#1'
    ])
  })

  it('skips a candidate name that is already taken outside the array', () => {
    const widgets = [{ name: 'seed' }, { name: 'seed' }]

    const refused = dropUnrenamableDuplicateWidgets(
      widgets,
      (name) => name === 'seed#1'
    )

    expect(refused).toEqual([])
    expect(widgets.map(({ name }) => name)).toEqual(['seed', 'seed#2'])
  })

  it('does not reserve a name one widget rejected against the next widget', () => {
    const offered: string[] = []
    const stubborn = {
      get name() {
        return 'seed'
      },
      set name(value: string) {
        offered.push(value)
      }
    }
    const renamable = { name: 'seed' }
    const widgets = [{ name: 'seed' }, stubborn, renamable]

    expect(refusedWidgets(widgets)).toEqual([])
    expect(offered).toContain('seed#1')
    expect(widgets.map((widget) => widget.name)).toEqual([
      'seed',
      'seed',
      'seed#1'
    ])
  })

  it('refuses every occurrence of a widget it refused once', () => {
    const refused = pinned('seed')
    const widgets = [{ name: 'seed' }, refused, refused]

    expect(refusedWidgets(widgets)).toEqual([refused])
    expect(widgets.map(({ name }) => name)).toEqual(['seed'])
  })

  it('does not refuse one widget object occupying two array slots', () => {
    const shared = pinned('seed')
    const other = pinned('seed')
    const widgets = [shared, shared, other]

    expect(refusedWidgets(widgets)).toEqual([other])
    expect(widgets).toEqual([shared, shared])
  })
})

/**
 * Which widget on a node may mint an id for the name it holds. The whole-node
 * question `ensureUniqueWidgetNames` answers is the wrong one for this: a node
 * carrying one pair nothing could rename apart has to keep registering its
 * other widgets, or the node's whole widget order empties and a Vue node draws
 * nothing.
 */
describe('ownedWidgetNameKey', () => {
  it('gives the name to the first widget holding it, and to no later one', () => {
    const first = { name: 'seed' }
    const later = { name: 'seed' }
    const unrelated = { name: 'cfg' }
    const widgets = [first, later, unrelated]

    expect(ownedWidgetNameKey(widgets, first)).toBe('seed')
    expect(ownedWidgetNameKey(widgets, later)).toBeUndefined()
    // The whole point: a widget that collides with nothing keeps its identity
    // even while the node is ambiguous.
    expect(ownedWidgetNameKey(widgets, unrelated)).toBe('cfg')
  })

  it('treats one widget in two array slots as one widget, not a collision', () => {
    // An index-assignment reorder transiently repeats the same object.
    const shared = { name: 'seed' }

    expect(ownedWidgetNameKey([shared, shared], shared)).toBe('seed')
  })

  it('collides names that differ as values but coincide as id strings', () => {
    // `widgetId` keys on `encodeURIComponent(String(name))`, so these two mint
    // one id. Comparing raw values would hand both an identity and let the
    // clash land in the store, which is the registration this gate exists to
    // refuse.
    const numeric = { name: 1 as unknown as string }
    const textual = { name: '1' }
    const widgets = [numeric, textual]

    // And the key is the coerced one, which is what the id is built from.
    expect(ownedWidgetNameKey(widgets, numeric)).toBe('1')
    expect(ownedWidgetNameKey(widgets, textual)).toBeUndefined()
  })

  it('refuses a widget whose own name cannot be read', () => {
    const hostile = {
      get name(): string {
        throw new Error('nope')
      }
    }

    expect(ownedWidgetNameKey([hostile], hostile)).toBeUndefined()
  })

  it('does not let an unreadable name on another widget decide this one', () => {
    // That widget is refused in its own right. Letting its accessor throw
    // through here would deny an identity to a widget it has nothing to do
    // with — and abort the walk mid-`LGraph.add`.
    const hostile = {
      get name(): string {
        throw new Error('nope')
      }
    }
    const ordinary = { name: 'seed' }

    expect(ownedWidgetNameKey([hostile, ordinary], ordinary)).toBe('seed')
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
