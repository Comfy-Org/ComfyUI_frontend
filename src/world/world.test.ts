import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { computed } from 'vue'

import { defineComponentKey } from './componentKey'
import type { NodeEntityId, WidgetEntityId } from './entityIds'
import { asGraphId, nodeEntityId, widgetEntityId } from './entityIds'
import { createWorld } from './world'

const TestWidgetThing = defineComponentKey<{ value: number }, WidgetEntityId>(
  'TestWidgetThing'
)

const TestNodeThing = defineComponentKey<{ tag: string }, NodeEntityId>(
  'TestNodeThing'
)

describe('createWorld', () => {
  const graphId = asGraphId('00000000-0000-0000-0000-000000000001')

  it('round-trips set / get / remove', () => {
    const world = createWorld()
    const widgetId = widgetEntityId(graphId, 1, 'seed')

    expect(world.getComponent(widgetId, TestWidgetThing)).toBeUndefined()

    world.setComponent(widgetId, TestWidgetThing, { value: 42 })
    expect(world.getComponent(widgetId, TestWidgetThing)?.value).toBe(42)

    world.removeComponent(widgetId, TestWidgetThing)
    expect(world.getComponent(widgetId, TestWidgetThing)).toBeUndefined()
  })

  it('propagates mutations through the stored proxy', () => {
    const world = createWorld()
    const widgetId = widgetEntityId(graphId, 1, 'seed')
    const data = { value: 42 }
    world.setComponent(widgetId, TestWidgetThing, data)
    data.value = 99
    expect(world.getComponent(widgetId, TestWidgetThing)?.value).toBe(99)
  })

  it('returns the same proxy across reads of the same (id, key)', () => {
    const world = createWorld()
    const widgetId = widgetEntityId(graphId, 1, 'seed')
    world.setComponent(widgetId, TestWidgetThing, { value: 42 })

    const a = world.getComponent(widgetId, TestWidgetThing)
    const b = world.getComponent(widgetId, TestWidgetThing)
    expect(a).toBe(b)
  })

  it('reacts when subscribing before the first component for a key exists', () => {
    const world = createWorld()
    const widgetId = widgetEntityId(graphId, 1, 'seed')
    const observed = computed(
      () => world.getComponent(widgetId, TestWidgetThing)?.value
    )

    expect(observed.value).toBeUndefined()
    world.setComponent(widgetId, TestWidgetThing, { value: 42 })
    expect(observed.value).toBe(42)
  })

  it('iterates entities for a given component key', () => {
    const world = createWorld()
    const a = widgetEntityId(graphId, 1, 'seed')
    const b = widgetEntityId(graphId, 1, 'cfg')
    world.setComponent(a, TestWidgetThing, { value: 1 })
    world.setComponent(b, TestWidgetThing, { value: 2 })

    const ids = world.entitiesWith(TestWidgetThing)
    expect(ids.sort()).toEqual([a, b].sort())
  })

  it('keeps entity kinds isolated by ComponentKey phantom param', () => {
    const world = createWorld()
    const nodeId = nodeEntityId(graphId, 1)
    world.setComponent(nodeId, TestNodeThing, { tag: 'foo' })
    expect(world.getComponent(nodeId, TestNodeThing)?.tag).toBe('foo')

    // Cross-kind access is rejected at compile time. The type-level assertion
    // below fails to compile if `widgetEntityId(...)` ever becomes assignable
    // to a parameter expecting `NodeEntityId`, locking in the brand isolation
    // contract without resorting to `@ts-expect-error`.
    type CrossKindGetComponent = Parameters<
      typeof world.getComponent<{ tag: string }, NodeEntityId>
    >[0]
    type WidgetIsNotAssignableToNode =
      WidgetEntityId extends CrossKindGetComponent ? false : true
    const _crossKindIsRejected: WidgetIsNotAssignableToNode = true
    expect(_crossKindIsRejected).toBe(true)
  })
})

describe('widgetEntityId', () => {
  it('is deterministic across (graphId, nodeId, name)', () => {
    const g = asGraphId('00000000-0000-0000-0000-000000000001')
    expect(widgetEntityId(g, 1, 'seed')).toBe(widgetEntityId(g, 1, 'seed'))
  })

  it('preserves cross-subgraph identity (root graph keying)', () => {
    // Same root graph + same nodeId + same name = same entity, regardless of
    // the subgraph depth from which the consumer reaches the node.
    const g = asGraphId('00000000-0000-0000-0000-000000000001')
    const fromRoot = widgetEntityId(g, 42, 'seed')
    const fromNested = widgetEntityId(g, 42, 'seed')
    expect(fromRoot).toBe(fromNested)
  })
})

describe('ComponentKey identity', () => {
  it('keys component buckets by reference, not by name string', () => {
    // Suppress the dev-time collision warning emitted by defineComponentKey.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    interface PayloadA {
      a: number
    }
    interface PayloadB {
      b: number
    }
    const keyA = defineComponentKey<PayloadA, NodeEntityId>('Collision')
    const keyB = defineComponentKey<PayloadB, NodeEntityId>('Collision')
    expect(keyA).not.toBe(keyB)
    expect(keyA.name).toBe(keyB.name)

    const world = createWorld()
    const id = nodeEntityId(
      asGraphId('00000000-0000-0000-0000-000000000001'),
      1
    )

    world.setComponent(id, keyA, { a: 1 })
    world.setComponent(id, keyB, { b: 2 })

    expect(world.getComponent(id, keyA)).toEqual({ a: 1 })
    expect(world.getComponent(id, keyB)).toEqual({ b: 2 })

    errorSpy.mockRestore()
  })
})

describe('World type shapes', () => {
  const world = createWorld()
  const WidgetThing = defineComponentKey<{ value: number }, WidgetEntityId>(
    'TypeShapeWidgetThing'
  )

  it('getComponent narrows to TData | undefined for the key', () => {
    expectTypeOf(
      world.getComponent<{ value: number }, WidgetEntityId>
    ).returns.toEqualTypeOf<{ value: number } | undefined>()
  })

  it('setComponent third parameter matches the key TData', () => {
    expectTypeOf(world.setComponent<{ value: number }, WidgetEntityId>)
      .parameter(2)
      .toEqualTypeOf<{ value: number }>()
  })

  it('entitiesWith returns TEntity[] for the key', () => {
    expectTypeOf(
      world.entitiesWith<{ value: number }, WidgetEntityId>
    ).returns.toEqualTypeOf<WidgetEntityId[]>()
  })

  it('rejects cross-kind entity ids at the call site', () => {
    // A widget-keyed read demands a WidgetEntityId. NodeEntityId must not
    // be assignable, otherwise a NodeEntityId could be passed to a
    // ComponentKey<_, WidgetEntityId>.
    expectTypeOf<
      NodeEntityId extends WidgetEntityId ? true : false
    >().toEqualTypeOf<false>()
    void WidgetThing
  })
})
