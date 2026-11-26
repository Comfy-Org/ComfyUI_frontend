import type { ComfyNodeDef as ComfyNodeDefV1 } from '@comfyorg/object-info-parser'
import { once } from 'es-toolkit'

import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { createListeners } from '@/platform/nodeApi/shared/listeners'
import { savedCopier, savedRecord } from '@/platform/nodeApi/shared/savedCopy'
import { useApp } from '@/scripts/appInstance'
import type { ComfyExtension } from '@/types/comfy'
import type {
  DefRegistry,
  Resolver,
  Unsubscribe
} from '@/platform/nodeApi/v4/types'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { Packs } from '@/platform/nodeApi/v4/packs'
import type { WidgetTypes } from '@/platform/nodeApi/v4/widgets/widgetTypes'
import {
  addDefinitionHooks,
  checkedDefinition,
  nodeDefFromDefinition,
  registerDefinedType
} from './definedNodeType'
import { SELECTOR_NEEDED, checkedSelector } from './defSelector'
import { createExtensions } from './extensions'
import type { NodeType } from './extensions'
import type { NodeHookSource } from './dispatchContext'
import { createHookDispatch } from './hookDispatch'
import { categoryOfHostDef, nodeDefFromHost } from './nodeDef'
import { checkedReadable } from '@/platform/nodeApi/shared/readableInput'
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

/** The resolvers of the types packs defined with one, for the nodes made from those definitions. */
export interface DefinedResolvers {
  resolverFor(node: LGraphNode): Resolver | undefined
  any(): boolean
}

interface DefinedResolver {
  readonly resolve: Resolver
  readonly nodeClass: typeof LGraphNode
}

interface DefRegistryParts {
  readonly defs: DefRegistry
  readonly nodeTypeHooks: NodeTypeHooks
  readonly resolvers: DefinedResolvers
  readonly nodeHooks: NodeHookSource
  reapplyTypeColors(): void
}

export function createDefRegistry(
  nodes: NodeHandles,
  widgetTypes: WidgetTypes,
  packs: Pick<Packs, 'checked'>
): DefRegistryParts {
  const copyOfSaved = savedCopier()
  const dispatch = createHookDispatch(
    nodes,
    {
      callbacksFor: (node, hook, joined) =>
        extensions.callbacksFor(node, hook, joined),
      demand: (hook) => extensions.demand(hook),
      clock: () => extensions.clock(),
      revision: () => extensions.revision()
    },
    copyOfSaved
  )
  const extensions = createExtensions(dispatch)
  const refreshed = createListeners('onRefreshed')
  const colors = createTypeColors()
  const resolving = new Map<string, DefinedResolver>()
  const hostRegistering = new Set<string>()

  function registerHostType(
    nodeClass: typeof LGraphNode,
    hostDef: ComfyNodeDefV1
  ): void {
    const declared = savedRecord(copyOfSaved('defs', hostDef)) ?? hostDef
    hostRegistering.add(hostDef.name)
    try {
      extensions.typeRegistered({
        type: hostDef.name,
        category: categoryOfHostDef(declared),
        nodeClass,
        def: () => nodeDefFromHost(declared, copyOfSaved)
      })
    } finally {
      hostRegistering.delete(hostDef.name)
    }
  }

  function isTypeTaken(type: string): boolean {
    return (
      Object.hasOwn(LiteGraph.registered_node_types, type) ||
      hostRegistering.has(type)
    )
  }

  function define(packId: unknown, definition: unknown): Unsubscribe {
    const owner = packs.checked('define', packId)
    const checked = checkedReadable(
      'define',
      'a node definition object',
      definition,
      checkedDefinition
    )
    if (isTypeTaken(checked.type)) {
      throw invalidArgument(
        'define',
        'a type name no node type has yet',
        checked.type
      )
    }
    const nodeClass = registerDefinedType(checked, owner)
    const nodeType: NodeType = {
      type: checked.type,
      category: checked.category,
      nodeClass,
      def: () => nodeDefFromDefinition(checked)
    }
    const stopHooks = extensions.extendOwnType(nodeType, owner, (builder) =>
      addDefinitionHooks(builder, checked)
    )
    extensions.typeRegistered(nodeType)
    const resolver = checked.resolve && { resolve: checked.resolve, nodeClass }
    if (resolver) resolving.set(checked.type, resolver)
    return once(() => {
      stopHooks()
      extensions.typeUnregistered(nodeType)
      if (resolver && resolving.get(checked.type) === resolver) {
        resolving.delete(checked.type)
      }
      if (LiteGraph.registered_node_types[checked.type] === nodeClass) {
        LiteGraph.unregisterNodeType(checked.type)
      }
    })
  }

  const defs: DefRegistry = Object.freeze({
    extend(packId: unknown, selector: unknown, apply: unknown) {
      const owner = packs.checked('extend', packId)
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
      return extensions.extend(owner, selects, (builder) => apply(builder))
    },
    define,
    get: (type: string) =>
      extensions.nodeType(checkedTypeName('get', type))?.def(),
    has: (type: string) =>
      extensions.nodeType(checkedTypeName('has', type)) !== undefined,
    all: () => Object.freeze(extensions.nodeTypes().map(({ def }) => def())),
    refresh: () => useApp().reloadNodeDefs(),
    onRefreshed: refreshed.subscribe,
    typeColor: colors.typeColor,
    setTypeColor: colors.setTypeColor,
    nodeColor: colors.nodeColor,
    isTypeCompatible: colors.isTypeCompatible,
    defineWidgetType: widgetTypes.define
  })

  return {
    defs,
    nodeTypeHooks: {
      name: NODE_TYPE_HOOKS_NAME,
      beforeRegisterNodeDef: registerHostType,
      refreshComboInNodes: () => refreshed.notify(),
      getNodeMenuItems: dispatch.menuItemsFor
    },
    reapplyTypeColors: colors.reapply,
    resolvers: {
      resolverFor(node) {
        const resolver = resolving.get(node.type)
        return resolver && node instanceof resolver.nodeClass
          ? resolver.resolve
          : undefined
      },
      any: () => resolving.size > 0
    },
    nodeHooks: {
      callbacksOf: dispatch.callbacksOf,
      demand: (hook) => extensions.demand(hook),
      deliverTo: dispatch.deliverTo
    }
  }
}

function checkedTypeName(member: string, type: unknown): string {
  if (typeof type !== 'string')
    throw invalidArgument(member, 'a type name', type)
  return type
}
