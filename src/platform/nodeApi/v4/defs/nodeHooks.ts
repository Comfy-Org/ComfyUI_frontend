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
import { checkedWidgetDef } from '@/platform/nodeApi/v4/widgets/widgetDef'
import { checkedMenuItem } from './nodeMenu'
import { checkedReadable } from './readableInput'
import type { CheckedMenuItem } from './nodeMenu'

/** What a pack gives each hook: a callback, or for `addMenuItem` the checked item. */
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
    onDoubleClick: [],
    onDragOver: [],
    onDrop: [],
    addMenuItem: []
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
    return adder(name, (callback: HookCallbacks[K]) => {
      if (typeof callback !== 'function') {
        throw invalidArgument(name, 'a function to call', callback)
      }
      return callback
    })
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
    hideWidget: adder('onCreated', widgetHider, 'hideWidget')
  })

  return {
    builder,
    callbacks,
    close() {
      open = false
    }
  }
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
