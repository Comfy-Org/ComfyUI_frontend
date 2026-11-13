import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { callListener } from '@/platform/nodeApi/shared/listeners'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  Deliver,
  DispatchContext,
  HookSource,
  MethodInstaller
} from './dispatchContext'
import type { HookInstaller, NodeType } from './extensions'
import { connectionInstallers } from './connectionDispatch'
import { createLifecycleDispatch } from './lifecycleDispatch'
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
  onDoubleClick: ['onDblClick']
}

export function createHookDispatch(
  nodes: NodeHandles,
  source: HookSource,
  copyOfSaved: SavedCopier
): HookInstaller {
  const installed = new WeakMap<typeof LGraphNode, Set<string>>()

  function isInGraph(node: LGraphNode): boolean {
    return node.graph?.getNodeById(node.id) === node
  }

  const deliver: Deliver = (type, hook, node, call) => {
    const callbacks = source.callbacksFor(type, hook)
    if (callbacks.length === 0 || !isInGraph(node)) return []
    const handle = nodes.find(node.graph ?? undefined, String(node.id))
    if (!handle) return []
    return callbacks.map((callback) =>
      callListener(hook, () => call(callback, handle))
    )
  }

  const context: DispatchContext = { deliver, source, copyOfSaved, isInGraph }
  const lifecycle = createLifecycleDispatch(context)
  const installers: Readonly<Record<string, MethodInstaller>> = {
    ...lifecycle.installers,
    ...connectionInstallers(deliver),
    ...propertyInstallers(context),
    ...pointerInstallers(deliver)
  }

  return {
    install(nodeType: NodeType, hooks: readonly HookName[]) {
      const done = installed.get(nodeType.nodeClass) ?? new Set<string>()
      installed.set(nodeType.nodeClass, done)
      for (const method of hooks.flatMap((hook) => METHODS_FOR[hook])) {
        if (done.has(method)) continue
        done.add(method)
        installers[method](nodeType.nodeClass, nodeType.type)
      }
    },
    demandChanged: lifecycle.demandChanged
  }
}
