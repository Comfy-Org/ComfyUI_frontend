import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'

import {
  callListener,
  reportListenerFailure
} from '@/platform/nodeApi/shared/listeners'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeHandle } from '@/platform/nodeApi/v4/types'
import type {
  Deliver,
  DispatchContext,
  HookSource,
  MethodInstaller
} from './dispatchContext'
import type { HookInstaller, NodeType } from './extensions'
import { connectionInstallers } from './connectionDispatch'
import { createLifecycleDispatch } from './lifecycleDispatch'
import { menuEntry } from './nodeMenu'
import type { CheckedMenuItem } from './nodeMenu'
import { pointerInstallers } from './pointerDispatch'
import { propertyInstallers } from './propertyDispatch'
import type { HookName } from './nodeHooks'

/** The prototype methods each hook needs a dispatcher on. */
const METHODS_FOR: Readonly<Record<HookName, readonly string[]>> = {
  onCreated: ['onConfigure'],
  onConfigured: ['onConfigure'],
  onRemoved: ['onRemoved'],
  onExecuted: ['onExecuted'],
  onSerialize: ['onSerialize'],
  onResized: ['onResize'],
  onConnectionsChanged: ['onConnectionsChange'],
  onBeforeConnect: ['onConnectInput', 'onConnectOutput'],
  onPropertyChanged: ['onPropertyChanged'],
  onHover: ['onMouseEnter', 'onMouseLeave'],
  onDoubleClick: ['onDblClick'],
  addMenuItem: []
}

interface HookDispatch extends HookInstaller {
  /** The context-menu entries packs added for a node, lowest `order` first. */
  menuItemsFor(node: LGraphNode): IContextMenuValue[]
}

export function createHookDispatch(
  nodes: NodeHandles,
  source: HookSource,
  copyOfSaved: SavedCopier
): HookDispatch {
  const installed = new WeakMap<typeof LGraphNode, Set<string>>()
  const knownPrototypes = new WeakSet<object>()
  const failedMenuItems = new WeakSet<CheckedMenuItem>()

  function isInGraph(node: LGraphNode): boolean {
    return node.graph?.getNodeById(node.id) === node
  }

  function isMadeFromKnownClass(node: LGraphNode): boolean {
    let prototype: unknown = Object.getPrototypeOf(node)
    while (typeof prototype === 'object' && prototype !== null) {
      if (knownPrototypes.has(prototype)) return true
      prototype = Object.getPrototypeOf(prototype)
    }
    return false
  }

  function menuEntryReportedOnce(item: CheckedMenuItem, handle: NodeHandle) {
    try {
      return menuEntry(item, handle)
    } catch (error) {
      if (!failedMenuItems.has(item)) {
        failedMenuItems.add(item)
        reportListenerFailure('addMenuItem', error)
      }
      return undefined
    }
  }

  const deliver: Deliver = (type, hook, node, call) => {
    const callbacks = source.callbacksFor(type, hook)
    const { graph } = node
    if (callbacks.length === 0 || !graph || !isInGraph(node)) return []
    const handle = nodes.find(graph, String(node.id))
    if (!handle) return []
    return callbacks.map((callback) =>
      source.callbacksFor(type, hook).includes(callback)
        ? callListener(hook, () => call(callback, handle))
        : undefined
    )
  }

  const context: DispatchContext = {
    deliver,
    source,
    copyOfSaved,
    isInGraph,
    isMadeFromKnownClass
  }
  const lifecycle = createLifecycleDispatch(context)
  const installers: Readonly<Record<string, MethodInstaller>> = {
    ...lifecycle.installers,
    ...connectionInstallers(deliver),
    ...propertyInstallers(context),
    ...pointerInstallers(deliver)
  }

  return {
    install(nodeType: NodeType, hooks: readonly HookName[]) {
      knownPrototypes.add(nodeType.nodeClass.prototype)
      const done = installed.get(nodeType.nodeClass) ?? new Set<string>()
      installed.set(nodeType.nodeClass, done)
      for (const method of hooks.flatMap((hook) => METHODS_FOR[hook])) {
        if (done.has(method)) continue
        done.add(method)
        installers[method](nodeType.nodeClass, nodeType.type)
      }
    },
    demandChanged: lifecycle.demandChanged,
    menuItemsFor(node) {
      if (!isMadeFromKnownClass(node)) return []
      const entries = deliver(
        node.type,
        'addMenuItem',
        node,
        (item, handle) => ({
          order: item.order,
          entry: menuEntryReportedOnce(item, handle)
        })
      )
      return entries
        .flatMap((shown) =>
          shown?.entry ? [{ ...shown, entry: shown.entry }] : []
        )
        .sort((first, second) => first.order - second.order)
        .map(({ entry }) => entry)
    }
  }
}
