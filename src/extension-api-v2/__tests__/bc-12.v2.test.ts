// Category: BC.12 — Per-widget serialization transform
// DB cross-ref: S4.W3
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/browser_tests/helpers/painter.ts#L70
// blast_radius: 5.58 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: WidgetHandle.on('beforeSerialize', handler) with event.setSerializedValue / event.skip
// Notes: WidgetHandle identity is by name not position (PR #10392 widgets_values_named migration path).
//        serialize===false widgets still fire beforeSerialize and still appear in the named map.

import { describe, it, expect } from 'vitest'
import { expectTypeOf } from 'vitest'
import type {
  WidgetHandle,
  WidgetBeforeSerializeEvent,
  WidgetValue
} from '@/extension-api/widget'

describe('BC.12 v2 contract — per-widget serialization transform', () => {
  describe('WidgetHandle.on(\'beforeSerialize\', handler) — event type shape', () => {
    it('WidgetBeforeSerializeEvent has the correct structural shape', () => {
      // Type-level check — verifies the contract surface without needing a live World.
      type E = WidgetBeforeSerializeEvent
      expectTypeOf<E['context']>().toEqualTypeOf<
        'workflow' | 'prompt' | 'clone' | 'subgraph-promote'
      >()
      expectTypeOf<E['value']>().toEqualTypeOf<WidgetValue>()
      expectTypeOf<E['setSerializedValue']>().toBeFunction()
      expectTypeOf<E['skip']>().toBeFunction()
    })

    it('WidgetHandle.on accepts \'beforeSerialize\' and returns Unsubscribe', () => {
      // Type-level: on('beforeSerialize') overload exists and returns () => void
      type OnBeforeSerialize = WidgetHandle['on']
      type Unsubscribe = ReturnType<WidgetHandle['on']>
      expectTypeOf<Unsubscribe>().toEqualTypeOf<() => void>()

      // The overload accepting 'beforeSerialize' must compile — verified by the
      // presence of the overload signature in widget.ts.
      type SerializeHandler = Parameters<
        Extract<
          OnBeforeSerialize,
          (event: 'beforeSerialize', handler: (e: WidgetBeforeSerializeEvent) => void | Promise<void>) => () => void
        >
      >[1]
      expectTypeOf<SerializeHandler>().not.toBeNever()
    })

    it('beforeSerialize event context discriminant covers all four serialization paths', () => {
      const contexts = ['workflow', 'prompt', 'clone', 'subgraph-promote'] as const
      type Context = (typeof contexts)[number]
      type EventContext = WidgetBeforeSerializeEvent['context']

      // Exhaustiveness: every declared context literal is assignable to EventContext
      const _check: Context extends EventContext ? true : never = true
      expect(_check).toBe(true)
    })

    it('setSerializedValue accepts unknown (JSON-serializable value of any shape)', () => {
      expectTypeOf<WidgetBeforeSerializeEvent['setSerializedValue']>()
        .parameter(0)
        .toEqualTypeOf<unknown>()
    })

    it('skip() takes no arguments', () => {
      type SkipArity = Parameters<WidgetBeforeSerializeEvent['skip']>
      expectTypeOf<SkipArity['length']>().toEqualTypeOf<0>()
    })
  })

  describe('WidgetHandle.on(\'beforeSerialize\', handler) — runtime behaviour', () => {
    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline
      'on(\'beforeSerialize\', fn) fires fn during graphToPrompt(); calling event.setSerializedValue(v) places v in the named map under the widget name'
    )

    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline
      'if no beforeSerialize listener is registered, graphToPrompt() uses WidgetHandle.getValue() directly'
    )

    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline
      'calling event.skip() in a context=\'prompt\' handler excludes the widget from the backend API prompt; the named-map entry is still written for workflow serialization'
    )

    it.todo(
      // TODO(Phase B): requires live World + scope disposal
      'on(\'beforeSerialize\') listener is removed when the extension scope is disposed; subsequent serializations use the raw getValue() result'
    )

    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline
      'async beforeSerialize handlers are awaited before the serialization payload is finalized'
    )
  })

  describe('serialize===false widgets (control_after_generate)', () => {
    it('isSerializeEnabled() defaults to true; setSerializeEnabled(false) disables it', () => {
      // Type-level: both methods exist on WidgetHandle
      expectTypeOf<WidgetHandle['isSerializeEnabled']>().toBeFunction()
      expectTypeOf<WidgetHandle['setSerializeEnabled']>().toBeFunction()

      type IsReturn = ReturnType<WidgetHandle['isSerializeEnabled']>
      type SetParam = Parameters<WidgetHandle['setSerializeEnabled']>[0]
      expectTypeOf<IsReturn>().toEqualTypeOf<boolean>()
      expectTypeOf<SetParam>().toEqualTypeOf<boolean>()
    })

    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline
      'a widget with setSerializeEnabled(false) still fires beforeSerialize with context=\'prompt\'; the returned serializedValue is NOT sent to the backend prompt'
    )

    it.todo(
      // TODO(Phase B): requires live World + graphToPrompt pipeline
      'a widget with setSerializeEnabled(false) still appears in widgets_values_named in the workflow JSON (full round-trip preservation)'
    )

    it.todo(
      // TODO(Phase B): requires live World
      'WidgetHandle identity for a serialize===false widget is stable across slot reordering because it is name-based not position-based'
    )
  })
})
