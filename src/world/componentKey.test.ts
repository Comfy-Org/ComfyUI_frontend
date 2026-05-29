import { describe, expectTypeOf, it } from 'vitest'

import type { ComponentKey } from './componentKey'
import { defineComponentKey } from './componentKey'
import type { NodeEntityId, WidgetEntityId } from './entityIds'

describe('ComponentKey type shapes', () => {
  it('defineComponentKey returns ComponentKey<TData, TEntity>', () => {
    const key = defineComponentKey<{ value: number }, WidgetEntityId>(
      'TypeShapeKey'
    )
    expectTypeOf(key).toEqualTypeOf<
      ComponentKey<{ value: number }, WidgetEntityId>
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
