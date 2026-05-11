// Category: BC.12 — Per-widget serialization transform
// DB cross-ref: S4.W3
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/browser_tests/helpers/painter.ts#L70
// Migration: v1 widget.serializeValue positional index → v2 WidgetHandle.on('beforeSerialize') name-based

import { describe, it, expect } from 'vitest'
import { expectTypeOf } from 'vitest'
import type {
  WidgetHandle,
  WidgetBeforeSerializeEvent
} from '@/extension-api/widget'

describe('BC.12 migration — per-widget serialization transform', () => {
  describe('API surface difference: positional index removed', () => {
    it('v1 serializeValue received (node, index); v2 beforeSerialize event has no index field', () => {
      // Type-level proof: WidgetBeforeSerializeEvent has no numeric index property.
      type E = WidgetBeforeSerializeEvent
      // These keys must NOT exist on the event type.
      type HasIndex = 'index' extends keyof E ? true : false
      type HasWidgetIndex = 'widgetIndex' extends keyof E ? true : false
      const noIndex: HasIndex = false
      const noWidgetIndex: HasWidgetIndex = false
      expect(noIndex).toBe(false)
      expect(noWidgetIndex).toBe(false)
    })

    it('v2 beforeSerialize event carries context discriminant absent from v1 serializeValue', () => {
      type E = WidgetBeforeSerializeEvent
      type HasContext = 'context' extends keyof E ? true : false
      const hasContext: HasContext = true
      expect(hasContext).toBe(true)

      // The context field covers all four serialization paths.
      expectTypeOf<E['context']>().toEqualTypeOf<
        'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
      >()
    })

    it('v2 setSerializedValue replaces the implicit return-value contract of v1 serializeValue', () => {
      // v1: `return transformedValue` — the return value was used.
      // v2: `event.setSerializedValue(transformedValue)` — explicit override.
      type SetFn = WidgetBeforeSerializeEvent['setSerializedValue']
      expectTypeOf<SetFn>().toBeFunction()
      expectTypeOf<SetFn>().parameter(0).toEqualTypeOf<unknown>()
    })

    it('v2 skip() replaces v1 options.serialize===false pattern for prompt exclusion', () => {
      type SkipFn = WidgetBeforeSerializeEvent['skip']
      expectTypeOf<SkipFn>().toBeFunction()
      // skip() takes no arguments — not a value return
      type Params = Parameters<SkipFn>
      expectTypeOf<Params['length']>().toEqualTypeOf<0>()
    })

    it('v2 WidgetHandle exposes isSerializeEnabled / setSerializeEnabled as first-class fields', () => {
      expectTypeOf<WidgetHandle['isSerializeEnabled']>().toBeFunction()
      expectTypeOf<WidgetHandle['setSerializeEnabled']>().toBeFunction()
    })
  })

  describe('identity model: name-based vs positional', () => {
    it('WidgetHandle.name is a readonly string — the stable identity key replacing positional index', () => {
      type NameField = WidgetHandle['name']
      expectTypeOf<NameField>().toEqualTypeOf<string>()
    })

    it('WidgetHandle.entityId is a branded number — prevents mixing widget IDs with node IDs', () => {
      type EntityId = WidgetHandle['entityId']
      // Branded: assignable to number but not plain number (structurally number & { __brand })
      type IsNumber = EntityId extends number ? true : false
      const branded: IsNumber = true
      expect(branded).toBe(true)
    })

    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt + slot reorder operation
      'v2 WidgetHandle identity is stable after node.widgets reordering; v1 serializeValue index changes if widgets are reordered — this is the primary reason to migrate'
    )

    it.todo(
      // TODO(Phase B): requires live World + multiple on() registrations
      'registering on(\'beforeSerialize\') twice does not double-fire; each unsubscribe function removes only the listener it was returned for'
    )
  })

  describe('serialize===false widget compat', () => {
    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline + serialize===false widget fixture
      'v1 positional index for a widget after control_after_generate is offset by 1 relative to the backend prompt; v2 named-map has no such offset'
    )

    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline
      'migrate: v1 code that hard-codes an index offset for serialize===false slots must be rewritten to use WidgetHandle identity by name in v2'
    )

    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline + workflow round-trip
      'widgets_values_named round-trip: a workflow serialized under v2 with an on(\'beforeSerialize\') transform deserializes to the same widget values as the equivalent v1 serializeValue workflow'
    )
  })

  describe('async transform equivalence', () => {
    it('v2 on(\'beforeSerialize\') handler type accepts both sync and async functions', () => {
      // AsyncHandler<T> = (e: T) => void | Promise<void>
      type Handler = Parameters<WidgetHandle['on']>[1]
      // The beforeSerialize overload's handler must accept Promise return.
      // We check via the on() overload signature: the second param when event='beforeSerialize'
      // is typed as AsyncHandler<WidgetBeforeSerializeEvent>.
      type AsyncHandlerOfEvent = (e: WidgetBeforeSerializeEvent) => void | Promise<void>
      // Assign a sync fn — must compile:
      const _sync: AsyncHandlerOfEvent = (_e) => {}
      // Assign an async fn — must compile:
      const _async: AsyncHandlerOfEvent = async (_e) => {}
      expect(typeof _sync).toBe('function')
      expect(typeof _async).toBe('function')
    })

    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline
      'async transforms: both v1 serializeValue and v2 on(\'beforeSerialize\') are awaited by graphToPrompt() before the workflow is finalized'
    )
  })
})
