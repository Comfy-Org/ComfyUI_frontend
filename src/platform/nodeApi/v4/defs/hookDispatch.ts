import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IContextMenuValue, LGraph } from '@/lib/litegraph/src/litegraph'

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
  menuItemsFor(node: LGraphNode): IContextMenuValue[]
}

export function createHookDispatch(
  nodes: NodeHandles,
  source: HookSource,
  copyOfSaved: SavedCopier,
  openGraph: () => LGraph | null
): HookDispatch {
  const installed = new WeakMap<LGraphNode, Set<string>>()
  const knownPrototypes = new WeakSet<LGraphNode>()
  const failedMenuItems = new WeakSet<CheckedMenuItem>()

  function isInGraph(node: LGraphNode): boolean {
    return node.graph?.getNodeById(node.id) === node
  }

  function knownPrototypeOf(node: LGraphNode): LGraphNode | undefined {
    let prototype: unknown = Object.getPrototypeOf(node)
    while (prototype instanceof LGraphNode) {
      if (knownPrototypes.has(prototype)) return prototype
      prototype = Object.getPrototypeOf(prototype)
    }
    return undefined
  }

  function isMadeFromKnownClass(node: LGraphNode): boolean {
    return knownPrototypeOf(node) !== undefined
  }

  function liveNodesOf(type: string): LGraphNode[] {
    const root = openGraph()?.rootGraph
    if (!root) return []
    return [root, ...root.subgraphs.values()].flatMap((graph) =>
      graph.nodes.filter((node) => node.type === type)
    )
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
    if (callbacks.length === 0 || node.type !== type) return []
    if (!graph || !isInGraph(node)) return []
    const handle = nodes.find(graph, String(node.id))
    if (!handle) return []
    let revision = source.revision()
    let current: ReadonlySet<unknown> | undefined
    return callbacks.map((callback) => {
      if (source.revision() !== revision) {
        revision = source.revision()
        current = new Set<unknown>(source.callbacksFor(type, hook))
      }
      return !current || current.has(callback)
        ? callListener(hook, () => call(callback, handle))
        : undefined
    })
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
    registered(nodeType: NodeType) {
      knownPrototypes.add(nodeType.nodeClass.prototype)
    },
    install(nodeType: NodeType, hooks: readonly HookName[]) {
      const methods = new Set(hooks.flatMap((hook) => METHODS_FOR[hook]))
      const addedTo = new Map<LGraphNode, readonly string[]>()
      const installOn = (prototype: LGraphNode) => {
        if (addedTo.has(prototype)) return
        const done = installed.get(prototype) ?? new Set<string>()
        installed.set(prototype, done)
        const added = [...methods].filter((method) => !done.has(method))
        for (const method of added) {
          done.add(method)
          installers[method](prototype, nodeType.type)
        }
        addedTo.set(prototype, added)
      }
      installOn(nodeType.nodeClass.prototype)
      for (const node of liveNodesOf(nodeType.type)) {
        const prototype = knownPrototypeOf(node)
        if (!prototype) continue
        installOn(prototype)
        for (const method of addedTo.get(prototype) ?? []) {
          if (Object.hasOwn(node, method))
            installers[method](node, nodeType.type)
        }
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
