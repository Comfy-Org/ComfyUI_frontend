import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'

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
import { HOOK_NAMES } from './nodeHooks'
import type { HookName } from './nodeHooks'

const METHODS_FOR: Readonly<Record<HookName, readonly string[]>> = {
  onCreated: ['onConfigure'],
  onConfigured: ['onConfigure', 'onSerialize'],
  onRemoved: ['onRemoved'],
  onExecuted: ['onExecuted'],
  onSerialize: ['onSerialize'],
  onResized: ['onResize'],
  onConnectionsChanged: ['onConnectionsChange'],
  onBeforeConnect: ['onConnectInput', 'onConnectOutput'],
  onPropertyChanged: ['configure', 'onPropertyChanged'],
  onHover: ['onMouseEnter', 'onMouseLeave'],
  onDoubleClick: ['onDblClick'],
  onDragOver: ['onDragOver'],
  onDrop: ['onDragDrop'],
  addMenuItem: []
}

interface HookDispatch extends HookInstaller {
  menuItemsFor(node: LGraphNode): IContextMenuValue[]
}

export function createHookDispatch(
  nodes: NodeHandles,
  source: HookSource,
  copyOfSaved: SavedCopier
): HookDispatch {
  const installed = new WeakMap<LGraphNode, Set<string>>()
  const knownPrototypes = new WeakSet<LGraphNode>()
  const joined = new WeakMap<LGraphNode, number>()
  let stopHearingAdds: (() => void) | undefined
  const failedMenuItems = new WeakSet<CheckedMenuItem>()

  function isInGraph(node: LGraphNode): boolean {
    return node.graph?.getNodeById(node.id) === node
  }

  function isMadeFromKnownClass(node: LGraphNode): boolean {
    let prototype: unknown = Object.getPrototypeOf(node)
    while (prototype instanceof LGraphNode) {
      if (knownPrototypes.has(prototype)) return true
      prototype = Object.getPrototypeOf(prototype)
    }
    return false
  }

  function reportMenuItemOnce(item: CheckedMenuItem, error: unknown): void {
    if (failedMenuItems.has(item)) return
    failedMenuItems.add(item)
    reportListenerFailure('addMenuItem', error)
  }

  function menuEntryReportedOnce(
    item: CheckedMenuItem,
    node: LGraphNode,
    handle: NodeHandle
  ) {
    const asked = <T>(answer: T): T => {
      if (answer instanceof Promise) {
        answer.catch((error: unknown) => reportMenuItemOnce(item, error))
      }
      return answer
    }
    try {
      return menuEntry(item, handle, asked, () =>
        source
          .callbacksFor(node, 'addMenuItem', joined.get(node) ?? 0)
          .some(({ callback }) => callback === item)
      )
    } catch (error) {
      reportMenuItemOnce(item, error)
      return undefined
    }
  }

  const deliver: Deliver = (type, hook, node, call) => {
    if (node.type !== type) return []
    const stamp = joined.get(node) ?? 0
    const entries = source.callbacksFor(node, hook, stamp)
    const { graph } = node
    if (entries.length === 0 || !graph || !isInGraph(node)) return []
    const handle = nodes.find(graph, String(node.id))
    if (!handle) return []
    let revision = source.revision()
    let live: ReadonlySet<object> | undefined
    return entries.map(({ application, callback }) => {
      if (source.revision() !== revision) {
        revision = source.revision()
        live = new Set(
          source
            .callbacksFor(node, hook, stamp)
            .map((entry) => entry.application)
        )
      }
      return !live || live.has(application)
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
    install(nodeType: NodeType, hooks: readonly HookName[]) {
      const { prototype } = nodeType.nodeClass
      knownPrototypes.add(prototype)
      const done = installed.get(prototype) ?? new Set<string>()
      installed.set(prototype, done)
      for (const method of hooks.flatMap((hook) => METHODS_FOR[hook])) {
        if (done.has(method)) continue
        done.add(method)
        installers[method](prototype, nodeType.type)
      }
    },
    demandChanged() {
      const needed = HOOK_NAMES.some((hook) => source.demand(hook) > 0)
      if (needed && !stopHearingAdds) {
        stopHearingAdds = onGraphIntent((intent) => {
          if (intent.type !== 'add_node') return
          joined.set(intent.node, source.clock())
          lifecycle.nodeAdded(intent.node, intent.source === 'load')
        })
      } else if (!needed && stopHearingAdds) {
        stopHearingAdds()
        stopHearingAdds = undefined
      }
    },
    menuItemsFor(node) {
      if (!isMadeFromKnownClass(node)) return []
      const entries = deliver(
        node.type,
        'addMenuItem',
        node,
        (item, handle) => ({
          order: item.order,
          entry: menuEntryReportedOnce(item, node, handle)
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
