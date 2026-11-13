import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type {
  BeforeConnectEvent,
  ConnectionChangeEvent,
  ExecutionResult,
  NodeCreatedEvent,
  NodeDef,
  NodeDefBuilder,
  NodeHandle,
  PropertyChangeEvent
} from '@/platform/nodeApi/v4/types'

/** The callback a pack gives each hook. */
export interface HookCallbacks {
  onCreated: (node: NodeHandle, event: NodeCreatedEvent) => void
  onConfigured: (
    node: NodeHandle,
    data: Readonly<Record<string, unknown>>
  ) => void
  onRemoved: (node: NodeHandle) => void
  onExecuted: (node: NodeHandle, result: ExecutionResult) => void
  onSerialize: (node: NodeHandle) => Readonly<Record<string, unknown>> | void
  onResized: (
    node: NodeHandle,
    size: Readonly<{ width: number; height: number }>
  ) => void
  onConnectionsChanged: (node: NodeHandle, event: ConnectionChangeEvent) => void
  onBeforeConnect: (
    node: NodeHandle,
    event: BeforeConnectEvent
  ) => boolean | void
  onPropertyChanged: (node: NodeHandle, event: PropertyChangeEvent) => void
  onHover: (node: NodeHandle, hovering: boolean) => void
  onDoubleClick: (node: NodeHandle) => void
}

export type HookName = keyof HookCallbacks

export const HOOK_NAMES = [
  'onCreated',
  'onConfigured',
  'onRemoved',
  'onExecuted',
  'onSerialize',
  'onResized',
  'onConnectionsChanged',
  'onBeforeConnect',
  'onPropertyChanged',
  'onHover',
  'onDoubleClick'
] as const satisfies readonly HookName[]

/** The callbacks one extension added to one type, by hook, in the order it added them. */
export type HookCallbackLists = { readonly [K in HookName]: HookCallbacks[K][] }

interface OpenBuilder {
  readonly builder: NodeDefBuilder
  /** Ends the builder and gives what it collected. Its methods throw from then on. */
  close(): HookCallbackLists
}

export function createNodeDefBuilder(def: NodeDef): OpenBuilder {
  const callbacks: HookCallbackLists = {
    onCreated: [],
    onConfigured: [],
    onRemoved: [],
    onExecuted: [],
    onSerialize: [],
    onResized: [],
    onConnectionsChanged: [],
    onBeforeConnect: [],
    onPropertyChanged: [],
    onHover: [],
    onDoubleClick: []
  }
  let open = true

  function hook<K extends HookName>(name: K) {
    return (callback: HookCallbacks[K]): void => {
      if (!open) {
        throw new TypeError(
          `${name} can only be called inside the callback given to extend.`
        )
      }
      if (typeof callback !== 'function') {
        throw invalidArgument(name, 'a function to call', callback)
      }
      callbacks[name].push(callback)
    }
  }

  const builder: NodeDefBuilder = Object.freeze({
    def,
    onCreated: hook('onCreated'),
    onConfigured: hook('onConfigured'),
    onRemoved: hook('onRemoved'),
    onExecuted: hook('onExecuted'),
    onSerialize: hook('onSerialize'),
    onResized: hook('onResized'),
    onConnectionsChanged: hook('onConnectionsChanged'),
    onBeforeConnect: hook('onBeforeConnect'),
    onPropertyChanged: hook('onPropertyChanged'),
    onHover: hook('onHover'),
    onDoubleClick: hook('onDoubleClick')
  })

  return {
    builder,
    close() {
      open = false
      return callbacks
    }
  }
}
