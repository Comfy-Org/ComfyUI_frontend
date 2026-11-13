import type { ComfyNodeDef as ComfyNodeDefV1 } from '@comfyorg/object-info-parser'
import { once } from 'es-toolkit'

import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { createListeners } from '@/platform/nodeApi/shared/listeners'
import { savedCopier } from '@/platform/nodeApi/shared/savedCopy'
import { useApp } from '@/scripts/appInstance'
import type { ComfyExtension } from '@/types/comfy'
import type { DefRegistry, Unsubscribe } from '@/platform/nodeApi/v4/types'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import {
  addDefinitionHooks,
  checkedDefinition,
  nodeDefFromDefinition,
  registerDefinedType
} from './definedNodeType'
import { SELECTOR_NEEDED, checkedSelector } from './defSelector'
import { createExtensions } from './extensions'
import type { NodeType } from './extensions'
import { createHookDispatch } from './hookDispatch'
import { categoryOfHostDef, nodeDefFromHost } from './nodeDef'
import { checkedReadable } from './readableInput'
import { NODE_TYPE_HOOKS_NAME } from './nodeTypeHooksName'
import { createTypeColors } from './typeColors'

/** The extension through which the host tells the API about node types. */
export interface NodeTypeHooks extends ComfyExtension {
  beforeRegisterNodeDef(
    nodeClass: typeof LGraphNode,
    hostDef: ComfyNodeDefV1
  ): void
  refreshComboInNodes(): void
  getNodeMenuItems(node: LGraphNode): IContextMenuValue[]
}

interface DefRegistryParts {
  readonly defs: DefRegistry
  readonly nodeTypeHooks: NodeTypeHooks
  reapplyTypeColors(): void
}

export function createDefRegistry(nodes: NodeHandles): DefRegistryParts {
  const copyOfSaved = savedCopier()
  const dispatch = createHookDispatch(
    nodes,
    {
      callbacksFor: (type, hook) => extensions.callbacksFor(type, hook),
      demand: (hook) => extensions.demand(hook)
    },
    copyOfSaved
  )
  const extensions = createExtensions(dispatch)
  const refreshed = createListeners('onRefreshed')
  const colors = createTypeColors()

  function registerHostType(
    nodeClass: typeof LGraphNode,
    hostDef: ComfyNodeDefV1
  ): void {
    extensions.typeRegistered({
      type: hostDef.name,
      category: categoryOfHostDef(hostDef),
      nodeClass,
      def: () => nodeDefFromHost(hostDef, copyOfSaved)
    })
  }

  function define(definition: unknown): Unsubscribe {
    const checked = checkedReadable(
      'define',
      'a node definition object',
      definition,
      checkedDefinition
    )
    const nodeClass = registerDefinedType(checked)
    const nodeType: NodeType = {
      type: checked.type,
      category: checked.category,
      nodeClass,
      def: () => nodeDefFromDefinition(checked)
    }
    const stopHooks = extensions.extendOwnType(nodeType, (builder) =>
      addDefinitionHooks(builder, checked)
    )
    extensions.typeRegistered(nodeType)
    return once(() => {
      stopHooks()
      extensions.typeUnregistered(nodeType)
      if (LiteGraph.registered_node_types[checked.type] === nodeClass) {
        LiteGraph.unregisterNodeType(checked.type)
      }
    })
  }

  const defs: DefRegistry = Object.freeze({
    extend(selector: unknown, apply: unknown) {
      const selects = checkedReadable(
        'extend',
        SELECTOR_NEEDED,
        selector,
        checkedSelector
      )
      if (typeof apply !== 'function') {
        throw invalidArgument(
          'extend',
          'a function to apply to each type',
          apply
        )
      }
      return extensions.extend(selects, (builder) => apply(builder))
    },
    define,
    get: (type: string) =>
      extensions.nodeType(checkedTypeName('get', type))?.def(),
    has: (type: string) =>
      extensions.nodeType(checkedTypeName('has', type)) !== undefined,
    all: () => Object.freeze(extensions.nodeTypes().map(({ def }) => def())),
    refresh: () => useApp().reloadNodeDefs(),
    onRefreshed(listener: () => void) {
      if (typeof listener !== 'function') {
        throw invalidArgument('onRefreshed', 'a function to call', listener)
      }
      return refreshed.add(listener)
    },
    typeColor: colors.typeColor,
    setTypeColor: colors.setTypeColor,
    nodeColor: colors.nodeColor,
    isTypeCompatible: colors.isTypeCompatible
  })

  return {
    defs,
    nodeTypeHooks: {
      name: NODE_TYPE_HOOKS_NAME,
      beforeRegisterNodeDef: registerHostType,
      refreshComboInNodes: refreshed.notify,
      getNodeMenuItems: dispatch.menuItemsFor
    },
    reapplyTypeColors: colors.reapply
  }
}

function checkedTypeName(member: string, type: unknown): string {
  if (typeof type !== 'string')
    throw invalidArgument(member, 'a type name', type)
  return type
}
