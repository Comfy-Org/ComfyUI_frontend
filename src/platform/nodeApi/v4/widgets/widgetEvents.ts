import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { createListeners } from '@/platform/nodeApi/shared/listeners'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type {
  Unsubscribe,
  WidgetSerializeEvent,
  WidgetValue
} from '@/platform/nodeApi/v4/types'
import { savableValue } from './savableValue'

export interface WidgetEvents {
  /**
   * Adds a pack's listener to one event of `widget`, or of no widget when it
   * is gone. Refuses an unknown event or a listener that is not a function.
   */
  listen(
    widget: BaseWidget | undefined,
    event: unknown,
    listener: unknown
  ): Unsubscribe
  /** Runs a commit made through `setValue`, which `activate` does not report. */
  asSetValue(commit: () => void): void
}

type Copy = WidgetValue | undefined
type PackListener = (...args: unknown[]) => void

const EVENTS = ['change', 'activate', 'removed', 'beforeSerialize'] as const
type WidgetEvent = (typeof EVENTS)[number]

function widgetListeners() {
  return {
    change: createListeners<[Copy, Copy]>('widget.change'),
    activate: createListeners<[Copy]>('widget.activate'),
    removed: createListeners('widget.removed'),
    beforeSerialize: createListeners<[WidgetSerializeEvent]>(
      'widget.beforeSerialize'
    )
  }
}
type WidgetListeners = ReturnType<typeof widgetListeners>
interface BridgeContext {
  readonly copy: (value: unknown) => Copy
  readonly isSettingValue: () => boolean
}
type Bridge = (
  widget: BaseWidget,
  listeners: WidgetListeners,
  context: BridgeContext
) => void

const BRIDGE_FOR: Readonly<Record<WidgetEvent, Bridge>> = {
  change: commitBridge,
  activate: commitBridge,
  removed: removalBridge,
  beforeSerialize: serializeBridge
}

export function createWidgetEvents(copyOfSaved: SavedCopier): WidgetEvents {
  const listenersOf = new WeakMap<BaseWidget, WidgetListeners>()
  const bridgesOf = new WeakMap<BaseWidget, Set<Bridge>>()
  let settingValues = 0
  const context: BridgeContext = {
    copy: (value) => copyOfSaved('on', value ?? null),
    isSettingValue: () => settingValues > 0
  }

  function listenersFor(widget: BaseWidget, event: WidgetEvent) {
    const listeners = listenersOf.get(widget) ?? widgetListeners()
    listenersOf.set(widget, listeners)
    const bridges = bridgesOf.get(widget) ?? new Set()
    bridgesOf.set(widget, bridges)
    const bridge = BRIDGE_FOR[event]
    if (!bridges.has(bridge)) bridge(widget, listeners, context)
    bridges.add(bridge)
    return listeners
  }

  return {
    listen(widget, event, listener) {
      const known = knownEvent(event)
      const call = packListener(listener)
      return widget ? listenersFor(widget, known)[known].add(call) : () => {}
    },
    asSetValue(commit) {
      settingValues++
      try {
        commit()
      } finally {
        settingValues--
      }
    }
  }
}

function commitBridge(
  widget: BaseWidget,
  listeners: WidgetListeners,
  { copy, isSettingValue }: BridgeContext
): void {
  let committed = widget.value
  widget.callback = useChainCallback(widget.callback, () => {
    const previous = committed
    committed = widget.value
    if (!Object.is(previous, committed)) {
      listeners.change.notify(copy(committed), copy(previous))
    }
    if (!isSettingValue()) {
      listeners.activate.notify(copy(committed))
    }
  })
}

function removalBridge(widget: BaseWidget, listeners: WidgetListeners): void {
  widget.onRemove = useChainCallback(widget.onRemove, () =>
    listeners.removed.drain()
  )
}

function serializeBridge(
  widget: BaseWidget,
  listeners: WidgetListeners,
  { copy }: BridgeContext
): void {
  const serializeValue = widget.serializeValue
  widget.serializeValue = async (node, index) => {
    const value = serializeValue
      ? await serializeValue.call(widget, node, index)
      : widget.value
    return serializedFor(listeners, value, copy)
  }
}

function knownEvent(event: unknown): WidgetEvent {
  const known = EVENTS.find((name) => name === event)
  if (!known) {
    throw invalidArgument('on', `an event of ${EVENTS.join(', ')}`, event)
  }
  return known
}

function packListener(listener: unknown): PackListener {
  if (typeof listener !== 'function') {
    throw invalidArgument('on', 'a function to call', listener)
  }
  return (...args) => {
    Reflect.apply(listener, undefined, args)
  }
}

function serializedFor(
  listeners: WidgetListeners,
  value: unknown,
  copy: (value: unknown) => Copy
): unknown {
  let replacement: { readonly value: WidgetValue } | undefined
  const event: WidgetSerializeEvent = Object.freeze({
    context: 'prompt',
    value: copy(value),
    setSerializedValue(next: unknown) {
      const checked = savableValue('setSerializedValue', next)
      replacement = { value: checked }
    }
  })
  listeners.beforeSerialize.notify(event)
  return replacement ? replacement.value : value
}
