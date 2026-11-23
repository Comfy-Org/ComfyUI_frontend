import {
  callOutOfTurn,
  invalidArgument
} from '@/platform/nodeApi/shared/invalidArgument'
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
import type { IssuedPack } from '@/platform/nodeApi/v4/packs'
import { checkedMenuItem } from './nodeMenu'
import { checkedReadable } from '@/platform/nodeApi/shared/readableInput'
import type { CheckedMenuItem } from './nodeMenu'

/** The frozen entry a saved node holds for a pack, or `{}`. */
export type SavedEntryOf = (
  pack: IssuedPack
) => Readonly<Record<string, unknown>>

/** What one `onSerialize` hook returned, and the id of the pack it saves under. */
export interface PackFields {
  readonly pack: string
  readonly fields: unknown
}

/** What a pack gives each hook: a callback, bound to its pack for the saved fields, or for `addMenuItem` the checked item. */
export interface HookCallbacks {
  onCreated: (node: NodeHandle, event: NodeCreatedEvent) => void
  onConfigured: (node: NodeHandle, entryOf: SavedEntryOf) => void
  onRemoved: (node: NodeHandle) => void
  onExecuted: (node: NodeHandle, result: ExecutionResult) => void
  onSerialize: (node: NodeHandle) => PackFields
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
  onDragOver: (node: NodeHandle, event: DragEvent) => boolean | void
  onDrop: (
    node: NodeHandle,
    event: DragEvent
  ) => boolean | void | Promise<boolean | void>
  addMenuItem: CheckedMenuItem
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
  'onDoubleClick',
  'onDragOver',
  'onDrop',
  'addMenuItem'
] as const satisfies readonly HookName[]

/** The callbacks one extension added to one type, by hook, in the order it added them. */
export type HookCallbackLists = { readonly [K in HookName]: HookCallbacks[K][] }

interface OpenBuilder {
  readonly builder: NodeDefBuilder
  readonly callbacks: HookCallbackLists
  close(): void
}

export function createNodeDefBuilder(
  def: NodeDef,
  pack: IssuedPack
): OpenBuilder {
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
    onDoubleClick: [],
    onDragOver: [],
    onDrop: [],
    addMenuItem: []
  }
  let open = true

  function adder<K extends HookName, Given>(
    name: K,
    checked: (value: Given) => HookCallbacks[K]
  ) {
    return (value: Given): void => {
      if (!open) {
        throw callOutOfTurn(name, 'inside the callback given to extend')
      }
      callbacks[name].push(checked(value))
    }
  }

  function hook<K extends Exclude<HookName, 'addMenuItem'>>(name: K) {
    return adder(name, (callback: HookCallbacks[K]) =>
      checkedHook(name, callback)
    )
  }

  const builder: NodeDefBuilder = Object.freeze({
    def,
    onCreated: hook('onCreated'),
    onConfigured: adder(
      'onConfigured',
      (callback: Parameters<NodeDefBuilder['onConfigured']>[0]) => {
        const configured = checkedHook('onConfigured', callback)
        return (node, entryOf) => configured(node, entryOf(pack))
      }
    ),
    onRemoved: hook('onRemoved'),
    onExecuted: hook('onExecuted'),
    onSerialize: adder(
      'onSerialize',
      (callback: Parameters<NodeDefBuilder['onSerialize']>[0]) => {
        const serialize = checkedHook('onSerialize', callback)
        return (node) => ({ pack: pack.token.id, fields: serialize(node) })
      }
    ),
    onResized: hook('onResized'),
    onConnectionsChanged: hook('onConnectionsChanged'),
    onBeforeConnect: hook('onBeforeConnect'),
    onPropertyChanged: hook('onPropertyChanged'),
    onHover: hook('onHover'),
    onDoubleClick: hook('onDoubleClick'),
    onDragOver: hook('onDragOver'),
    onDrop: hook('onDrop'),
    addMenuItem: adder('addMenuItem', (item: unknown) =>
      checkedReadable(
        'addMenuItem',
        'a menu item object',
        item,
        checkedMenuItem
      )
    )
  })

  return {
    builder,
    callbacks,
    close() {
      open = false
    }
  }
}

function checkedHook<T>(name: string, callback: T): T {
  if (typeof callback !== 'function') {
    throw invalidArgument(name, 'a function to call', callback)
  }
  return callback
}
