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

/**
 * A widget whose `name` is whatever a node pack actually assigned. The runtime
 * type is the thing under test, so the narrowing happens once here rather than
 * at each fixture.
 */
function widgetNamed(name: unknown): { name: string } {
  return { name } as { name: string }
}

/** The refused widgets alone; the cause is asserted separately where it matters. */
function refusedWidgets<T extends { name: string }>(widgets: T[]): T[] {
  return dropUnrenamableDuplicateWidgets(widgets).map(({ widget }) => widget)
}

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
    // `ensureUniqueWidgetNames` is all-or-nothing, so one unrenamable widget
    // leaves every other collision on the node standing too.
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
    // `seed#1` is held outright further down the array, so the rename must
    // reach past it rather than collide with a name nothing renamed.
    widgets.push({ name: 'seed#1' })

    expect(refusedWidgets(widgets)).toEqual([refused])
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
    expect(refusedWidgets(widgets)).toContain(stubborn)
    expect(widgets.map(({ name }) => name)).toEqual(['seed'])
  })

  it('refuses a widget whose name accessor throws, without letting it escape', () => {
    const hostile = {
      get name(): string {
        throw new Error('name is not readable')
      }
    }
    const widgets = [{ name: 'seed' }, hostile]

    // A name that cannot be read is a `WidgetId` that cannot be derived, and
    // leaving it on the node makes `ensureUniqueWidgetNames` fail on every
    // later call — which bails registration for the whole node, including the
    // widgets that are perfectly addressable. The throw must not escape.
    expect(refusedWidgets(widgets)).toEqual([hostile])
    expect(widgets).toHaveLength(1)
  })

  it('tells an unreadable name apart from one that reads as undefined', () => {
    const first = widgetNamed(undefined)
    const second = widgetNamed(undefined)
    const widgets = [first, second]

    // `undefined` is a bad identity, not a missing one: two of them collide
    // with each other and would mint the same `graphId:nodeId:undefined`.
    expect(refusedWidgets(widgets)).toEqual([])
    expect(widgets.map(({ name }) => name)).toEqual([undefined, 'undefined#1'])
  })

  it('refuses a name that reads fine but cannot become an id', () => {
    // Both of these read without throwing and then fail on the way to a
    // `WidgetId`: one will not coerce to a string at all, the other is a lone
    // surrogate that `encodeURIComponent` rejects. Letting either escape wedges
    // the commit that is trying to settle the node's names.
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
    // `String(Symbol())` succeeds, so coercion alone says this name is fine —
    // but `widgetId` encodes the raw value and throws on it.
    //
    // An empty name is the opposite case and must NOT be refused: it mints an
    // id the store declines to key on, which costs the widget nothing, while
    // deleting it loses a widget that renders and serializes.
    const symbolNamed = widgetNamed(Symbol('seed'))
    const empty = widgetNamed('')
    const fine = widgetNamed('seed')
    const widgets = [fine, symbolNamed, empty]

    expect(refusedWidgets(widgets)).toEqual([symbolNamed])
    expect(widgets).toEqual([fine, empty])
  })

  it('reports the name the walk read, not one the rename attempts left behind', () => {
    // The walk writes to a colliding widget before giving up, so the value the
    // accessor holds afterwards can be a candidate no widget on the node owns.
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
    // A hostile accessor need not answer the same way twice, so the cause has
    // to come from the walk that made the decision.
    // Reads 1 and 2 are the reserved-names pass and the walk itself; a third
    // read — which is what re-deriving the cause at the report site costs —
    // succeeds and would call this a duplicate instead.
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
    // The widget now reads as a plain duplicate, which is the wrong answer.
    expect(flaky.name).toBe('seed')
  })

  it('collides names that differ as values but coincide as id strings', () => {
    // `widgetId` keys on `encodeURIComponent(String(name))`, so these two mint
    // the same id. Comparing the raw values lets both through and the clash
    // lands in the store, where nothing is looking for it.
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

  it('offers another name when a setter rejects only the first one', () => {
    // `BaseWidget` delegates its `name` setter to the store, which refuses to
    // move onto an id something else already holds. Refusal deletes a widget,
    // so one rejected candidate must not be read as unrenamable.
    let name = 'seed'
    const picky = {
      get name() {
        return name
      },
      set name(value: string) {
        if (value !== 'seed#1') name = value
      }
    }
    const widgets = [{ name: 'seed' }, picky]

    expect(refusedWidgets(widgets)).toEqual([])
    expect(widgets.map((widget) => widget.name)).toEqual(['seed', 'seed#2'])
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

    expect(refusedWidgets(widgets)).toEqual([stubborn])
    // `seed#1` was offered to `stubborn` and did not take, so it is still free
    // for the next widget — a name one setter refuses is not a name in use.
    expect(offered).toContain('seed#1')
    expect(widgets.map((widget) => widget.name)).toEqual(['seed', 'seed#1'])
  })

  it('refuses every occurrence of a widget it refused once', () => {
    const refused = pinned('seed')
    const widgets = [{ name: 'seed' }, refused, refused]

    // The identity bypass that keeps a reordering widget in place must not
    // re-admit one whose first occurrence was already refused and reported.
    expect(refusedWidgets(widgets)).toEqual([refused])
    expect(widgets.map(({ name }) => name)).toEqual(['seed'])
  })

  it('does not refuse one widget object occupying two array slots', () => {
    const shared = pinned('seed')
    const other = pinned('seed')
    const widgets = [shared, shared, other]

    // Identity duplicates are one widget mid-reorder, not a name collision.
    expect(refusedWidgets(widgets)).toEqual([other])
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
