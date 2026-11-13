import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type {
  ExecutionResult,
  NodeCreatedEvent,
  NodeDef,
  NodeDefBuilder,
  NodeHandle
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
}

export type HookName = keyof HookCallbacks

export const HOOK_NAMES = [
  'onCreated',
  'onConfigured',
  'onRemoved',
  'onExecuted',
  'onSerialize',
  'onResized'
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
    onResized: []
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
    onResized: hook('onResized')
  })

  return {
    builder,
    close() {
      open = false
      return callbacks
    }
  }
}
