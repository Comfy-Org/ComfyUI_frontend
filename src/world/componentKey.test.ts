import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import type { ComponentKey } from './componentKey'
import { defineComponentKey, defineComponentKeys, slot } from './componentKey'
import type { NodeEntityId, WidgetEntityId } from './entityIds'

describe('defineComponentKeys', () => {
  it('synthesizes runtime names from prefix and property keys', () => {
    const keys = defineComponentKeys('Foo', {
      Bar: slot<{ x: number }, NodeEntityId>(),
      Baz: slot<{ y: string }, NodeEntityId>()
    })
    expect(keys.FooComponentBar.name).toBe('FooComponentBar')
    expect(keys.FooComponentBaz.name).toBe('FooComponentBaz')
  })

  it('produces keys with distinct identities across calls', () => {
    // Suppress dev-time collision warning fired by defineComponentKey.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const a = defineComponentKeys('FooA', {
      Bar: slot<Record<string, never>, NodeEntityId>()
    })
    const b = defineComponentKeys('FooA', {
      Bar: slot<Record<string, never>, NodeEntityId>()
    })
    // Two separate factory calls => two separate key objects, even with same name.
    expect(a.FooAComponentBar).not.toBe(b.FooAComponentBar)
    expect(a.FooAComponentBar.name).toBe(b.FooAComponentBar.name)

    errorSpy.mockRestore()
  })

  it('produces keys with the expected literal-type name (compile-time check)', () => {
    const keys = defineComponentKeys('WidgetTest', {
      Value: slot<{ value: unknown }, WidgetEntityId>()
    })
    // Type-only assertion: the literal name flows through the type. If the
    // literal disappears from the return type, this assignment fails to
    // compile.
    type CheckName = (typeof keys.WidgetTestComponentValue)['name']
    const _check: CheckName = 'WidgetTestComponentValue'
    void _check
    expect(keys.WidgetTestComponentValue.name).toBe('WidgetTestComponentValue')
  })
})

describe('ComponentKey type shapes', () => {
  it('defineComponentKey returns ComponentKey<TData, TEntity>', () => {
    const key = defineComponentKey<{ value: number }, WidgetEntityId>(
      'TypeShapeKey'
    )
    expectTypeOf(key).toEqualTypeOf<
      ComponentKey<{ value: number }, WidgetEntityId>
    >()
  })

  it('defineComponentKeys recovers TData/TEntity per slot', () => {
    const keys = defineComponentKeys('Demo', {
      Value: slot<{ v: number }, WidgetEntityId>(),
      Tag: slot<string, NodeEntityId>()
    })
    // Each key carries its own (TData, TEntity, full-name literal) trio.
    expectTypeOf(keys.DemoComponentValue).toEqualTypeOf<
      ComponentKey<{ v: number }, WidgetEntityId, 'DemoComponentValue'>
    >()
    expectTypeOf(keys.DemoComponentTag).toEqualTypeOf<
      ComponentKey<string, NodeEntityId, 'DemoComponentTag'>
    >()
  })

  it('ComponentKey phantom params keep entity kinds disjoint', () => {
    // A widget-keyed ComponentKey is not assignable to a node-keyed one,
    // even when TData matches.
    expectTypeOf<
      ComponentKey<{ v: number }, WidgetEntityId> extends ComponentKey<
        { v: number },
        NodeEntityId
      >
        ? true
        : false
    >().toEqualTypeOf<false>()
  })
})
