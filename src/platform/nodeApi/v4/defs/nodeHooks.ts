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
  PropertyChangeEvent,
  Supplier
} from '@/platform/nodeApi/v4/types'
import type { IssuedPack } from '@/platform/nodeApi/v4/packs'
import { checkedWidgetDef } from '@/platform/nodeApi/v4/widgets/widgetDef'
import { checkedMenuItem } from './nodeMenu'
import { checkedReadable } from '@/platform/nodeApi/shared/readableInput'
import type { CheckedMenuItem } from './nodeMenu'

/** A frozen copy of the saved node's own fields with a pack's saved entry, and no other pack's. */
export type SavedViewOf = (
  pack: IssuedPack
) => Readonly<Record<string, unknown>>

interface PackFields {
  readonly pack: string
  readonly fields: unknown
}

export interface HookCallbacks {
  onCreated: (node: NodeHandle, event: NodeCreatedEvent) => void
  onConfigured: (node: NodeHandle, savedFor: SavedViewOf) => void
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
  setSupply: Supplier
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
  'addMenuItem',
  'setSupply'
] as const satisfies readonly HookName[]

/** The callbacks one extension added to one type, by hook, in the order it added them. */
export type HookCallbackLists = { readonly [K in HookName]: HookCallbacks[K][] }

/** A callback with the application that added it, which identifies it while that application stays. */
export interface HookEntry<K extends HookName> {
  readonly application: object
  readonly callback: HookCallbacks[K]
}

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
    addMenuItem: [],
    setSupply: []
  }
  let open = true

  function adder<K extends HookName, Given>(
    name: K,
    checked: (value: Given) => HookCallbacks[K],
    member: string = name
  ) {
    return (value: Given): void => {
      if (!open) {
        throw new TypeError(
          `${member} can only be called inside the callback given to extend.`
        )
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
        return (node, savedFor) => configured(node, savedFor(pack))
      }
    ),
    onRemoved: hook('onRemoved'),
    onExecuted: hook('onExecuted'),
    onSerialize: adder(
      'onSerialize',
      (callback: Parameters<NodeDefBuilder['onSerialize']>[0]) => {
        const serialize = checkedHook('onSerialize', callback)
        return (node) => ({ pack: pack.packId.id, fields: serialize(node) })
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
    ),
    addWidget: adder('onCreated', widgetAdder, 'addWidget'),
    hideWidget: adder('onCreated', widgetHider, 'hideWidget'),
    setSupply: hook('setSupply')
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

/** A callback that adds the widget `def` describes to each node made. */
function widgetAdder(def: unknown): HookCallbacks['onCreated'] {
  const checked = checkedWidgetDef(def, 'addWidget')
  return (node) => {
    node.widgets.add(checked)
  }
}

/** A callback that hides the widget named `name` on each node made. */
function widgetHider(name: unknown): HookCallbacks['onCreated'] {
  if (typeof name !== 'string' || !name) {
    throw invalidArgument('hideWidget', 'a widget name', name)
  }
  return (node) => node.widgets.get(name)?.setHidden(true)
}
