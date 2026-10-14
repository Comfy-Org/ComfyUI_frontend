import { defineStore } from 'pinia'
import { computed, ref, watchEffect } from 'vue'

import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { t } from '@/i18n'
import { promotedInputSource } from '@/core/graph/subgraph/promotedInputWidget'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { resolveDynamicInputSpec } from '@/core/graph/widgets/dynamicInputSpec'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useSettingStore } from '@/platform/settings/settingStore'
import { NodeSearchService } from '@/services/nodeSearchService'
import { useNodeFrequencyStore } from '@/stores/nodeFrequencyStore'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { buildTree } from '@/utils/treeUtil'

export const SYSTEM_NODE_DEFS: Record<string, ComfyNodeDefV1> = {
  PrimitiveNode: {
    name: 'PrimitiveNode',
    display_name: 'Primitive',
    category: 'utilities/primitive',
    input: { required: {}, optional: {} },
    output: ['*'],
    output_name: ['connect to widget input'],
    output_is_list: [false],
    output_node: false,
    python_module: 'nodes',
    description: 'Primitive values like numbers, strings, and booleans.'
  },
  Reroute: {
    name: 'Reroute',
    display_name: 'Reroute',
    category: 'utilities',
    input: { required: { '': ['*', {}] }, optional: {} },
    output: ['*'],
    output_name: [''],
    output_is_list: [false],
    output_node: false,
    python_module: 'nodes',
    description: 'Reroute the connection to another node.'
  },
  Note: {
    name: 'Note',
    display_name: 'Note',
    category: 'utilities',
    input: {
      required: { text: ['STRING', { multiline: true }] },
      optional: {}
    },
    output: [],
    output_name: [],
    output_is_list: [],
    output_node: false,
    python_module: 'nodes',
    description: 'Node that add notes to your project'
  },
  MarkdownNote: {
    name: 'MarkdownNote',
    display_name: 'Markdown Note',
    category: 'utilities',
    input: {
      required: { text: ['STRING', { multiline: true }] },
      optional: {}
    },
    output: [],
    output_name: [],
    output_is_list: [],
    output_node: false,
    python_module: 'nodes',
    description:
      'Node that add notes to your project. Reformats text as markdown.'
  }
}

interface BuildNodeDefTreeOptions {
  /**
   * Custom function to extract the tree path from a node definition.
   * If not provided, uses the default path based on nodeDef.nodePath.
   */
  pathExtractor?: (nodeDef: ComfyNodeDefImpl) => string[]
}

export function buildNodeDefTree(
  nodeDefs: ComfyNodeDefImpl[],
  options: BuildNodeDefTreeOptions = {}
): TreeNode<ComfyNodeDefImpl> {
  const { pathExtractor } = options
  const defaultPathExtractor = (nodeDef: ComfyNodeDefImpl) =>
    nodeDef.nodePath.split('/')
  return buildTree(nodeDefs, pathExtractor || defaultPathExtractor)
}

export function createDummyFolderNodeDef(folderPath: string): ComfyNodeDefImpl {
  return new ComfyNodeDefImpl({
    name: '',
    display_name: '',
    category: folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath,
    python_module: 'nodes',
    description: 'Dummy Folder Node (User should never see this string)',
    input: {},
    output: [],
    output_name: [],
    output_is_list: [],
    output_node: false
  })
}

/**
 * Defines a filter for node definitions in the node library.
 * Filters are applied in a single pass to determine node visibility.
 */
export interface NodeDefFilter {
  /**
   * Unique identifier for the filter.
   * Convention: Use dot notation like 'core.deprecated' or 'extension.myfilter'
   */
  id: string

  /**
   * Display name for the filter (used in UI/debugging).
   */
  name: string

  /**
   * Optional description explaining what the filter does.
   */
  description?: string

  /**
   * The filter function that returns true if the node should be visible.
   * @param nodeDef - The node definition to evaluate
   * @returns true if the node should be visible, false to hide it
   */
  predicate: (nodeDef: ComfyNodeDefImpl) => boolean
}

const TOP_NODE_DEF_LIMIT = 64

export const useNodeDefStore = defineStore('nodeDef', () => {
  const settingStore = useSettingStore()

  const nodeDefsByName = ref<Record<string, ComfyNodeDefImpl>>({})
  const nodeDefsByDisplayName = computed(() =>
    Object.fromEntries(
      Object.values(nodeDefsByName.value).map((d) => [d.display_name, d])
    )
  )
  const showDeprecated = ref(false)
  const showExperimental = ref(false)
  const showDevOnly = computed(() => settingStore.get('Comfy.DevMode'))
  const nodeDefFilters = ref<NodeDefFilter[]>([])

  // Update skip_list on all registered node types when dev mode changes
  // This ensures LiteGraph's getNodeTypesCategories/getNodeTypesInCategory
  // correctly filter dev-only nodes from the right-click context menu
  watchEffect(() => {
    const devModeEnabled = showDevOnly.value
    for (const nodeType of Object.values(LiteGraph.registered_node_types)) {
      if (nodeType.nodeData?.dev_only) {
        nodeType.skip_list = !devModeEnabled
      }
    }
  })

  const blueprintNodeDefs = ref<Map<string, ComfyNodeDefImpl>>(new Map())
  const blueprintNodeDefsByName = computed<
    ReadonlyMap<string, ComfyNodeDefImpl>
  >(() => blueprintNodeDefs.value)
  function registerBlueprintNodeDef(nodeDef: ComfyNodeDefImpl) {
    blueprintNodeDefs.value.set(nodeDef.name, nodeDef)
  }
  function removeBlueprintNodeDef(name: string) {
    blueprintNodeDefs.value.delete(name)
  }
  // Blueprints first for discoverability in the node library sidebar
  const nodeDefs = computed(() => [
    ...blueprintNodeDefs.value.values(),
    ...Object.values(nodeDefsByName.value)
  ])
  const nodeDataTypes = computed(() => {
    const types = new Set<string>()
    for (const nodeDef of nodeDefs.value) {
      for (const type of nodeDef.inputTypes) types.add(type)
      for (const type of nodeDef.outputTypes) types.add(type)
    }
    return types
  })
  const allNodeDefsByName = computed(() => {
    const map: Record<string, ComfyNodeDefImpl> = {}
    for (const nodeDef of nodeDefs.value) {
      map[nodeDef.name] = nodeDef
    }
    return map
  })
  const allNodeDefsByDisplayName = computed(() => {
    return Object.fromEntries(nodeDefs.value.map((d) => [d.display_name, d]))
  })

  const visibleNodeDefs = computed(() => {
    return nodeDefs.value.filter((nodeDef) =>
      nodeDefFilters.value.every((filter) => filter.predicate(nodeDef))
    )
  })
  const nodeSearchService = computed(
    () => new NodeSearchService(visibleNodeDefs.value)
  )
  const nodeTree = computed(() => buildNodeDefTree(visibleNodeDefs.value))

  function updateNodeDefs(nodeDefs: ComfyNodeDefV1[]) {
    const newNodeDefsByName: Record<string, ComfyNodeDefImpl> = {}

    for (const nodeDef of nodeDefs) {
      const nodeDefImpl =
        nodeDef instanceof ComfyNodeDefImpl
          ? nodeDef
          : new ComfyNodeDefImpl(nodeDef)

      newNodeDefsByName[nodeDef.name] = nodeDefImpl
    }

    nodeDefsByName.value = newNodeDefsByName
  }
  function addNodeDef(nodeDef: ComfyNodeDefV1) {
    const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)
    nodeDefsByName.value[nodeDef.name] = nodeDefImpl
  }
  function removeNodeDef(nodeName: string) {
    delete nodeDefsByName.value[nodeName]
  }
  function getNodeDefByName(nodeName: string): ComfyNodeDefImpl | undefined {
    return nodeDefsByName.value[nodeName]
  }
  function fromLGraphNode(node: LGraphNode): ComfyNodeDefImpl | null {
    const nodeTypeName = node.constructor.nodeData?.name ?? node.type
    if (!nodeTypeName) return null
    const nodeDef = nodeDefsByName.value[nodeTypeName] ?? null
    return nodeDef
  }

  function getInputSpecForWidget(
    node: LGraphNode,
    widgetName: string
  ): InputSpecV2 | undefined {
    if (!node.isSubgraphNode()) {
      const nodeDef = fromLGraphNode(node)
      if (!nodeDef) return undefined

      if (Object.hasOwn(nodeDef.inputs, widgetName))
        return nodeDef.inputs[widgetName]
      const resolved = resolveDynamicInputSpec(
        nodeDef.input,
        widgetName,
        (name) => node.widgets?.find((widget) => widget.name === name)?.value
      )
      return (
        resolved &&
        transformInputSpecV1ToV2(resolved.spec, {
          name: widgetName,
          isOptional: resolved.isOptional
        })
      )
    }
    // A subgraph node's widget is a promoted input named after its slot; resolve
    // the interior source and read its real spec instead of fabricating one.
    const input = node.inputs.find((i) => i.name === widgetName)
    if (!input) return undefined
    const source = promotedInputSource(node, input)
    if (!source) return undefined
    const resolution = resolveConcretePromotedWidget(
      node,
      source.nodeId,
      source.widgetName
    )
    if (resolution.status !== 'resolved') return undefined
    return getInputSpecForWidget(
      resolution.resolved.node,
      resolution.resolved.widget.name
    )
  }

  /**
   * Registers a node definition filter.
   * @param filter - The filter to register
   */
  function registerNodeDefFilter(filter: NodeDefFilter) {
    nodeDefFilters.value = [...nodeDefFilters.value, filter]
  }

  /**
   * Unregisters a node definition filter by ID.
   * @param id - The ID of the filter to remove
   */
  function unregisterNodeDefFilter(id: string) {
    nodeDefFilters.value = nodeDefFilters.value.filter((f) => f.id !== id)
  }

  /**
   * Register the core node definition filters.
   */
  function registerCoreNodeDefFilters() {
    // Deprecated nodes filter
    registerNodeDefFilter({
      id: 'core.deprecated',
      name: t('nodeFilters.hideDeprecated'),
      description: t('nodeFilters.hideDeprecatedDescription'),
      predicate: (nodeDef) => showDeprecated.value || !nodeDef.deprecated
    })

    // Experimental nodes filter
    registerNodeDefFilter({
      id: 'core.experimental',
      name: t('nodeFilters.hideExperimental'),
      description: t('nodeFilters.hideExperimentalDescription'),
      predicate: (nodeDef) => showExperimental.value || !nodeDef.experimental
    })

    // Dev-only nodes filter
    registerNodeDefFilter({
      id: 'core.dev_only',
      name: t('nodeFilters.hideDevOnly'),
      description: t('nodeFilters.hideDevOnlyDescription'),
      predicate: (nodeDef) => showDevOnly.value || !nodeDef.dev_only
    })

    // Subgraph nodes filter
    // Filter out litegraph typed subgraphs, saved blueprints are added in separately
    registerNodeDefFilter({
      id: 'core.subgraph',
      name: t('nodeFilters.hideSubgraph'),
      description: t('nodeFilters.hideSubgraphDescription'),
      predicate: (nodeDef) => {
        // Hide subgraph nodes (identified by category='subgraph' and python_module='nodes')
        return !(
          nodeDef.category === 'subgraph' && nodeDef.python_module === 'nodes'
        )
      }
    })
  }

  // Register core filters on store initialization
  registerCoreNodeDefFilters()

  const nodeFrequencyStore = useNodeFrequencyStore()
  const topNodeDefs = computed<ComfyNodeDefImpl[]>(() =>
    nodeFrequencyStore.nodeNamesByFrequency
      .flatMap((nodeName) => {
        const nodeDef = getNodeDefByName(nodeName)
        return nodeDef ? [nodeDef] : []
      })
      .slice(0, TOP_NODE_DEF_LIMIT)
  )

  return {
    nodeDefsByName,
    blueprintNodeDefsByName,
    nodeDefsByDisplayName,
    allNodeDefsByName,
    allNodeDefsByDisplayName,
    showDeprecated,
    showExperimental,
    showDevOnly,
    nodeDefFilters,

    nodeDefs,
    nodeDataTypes,
    visibleNodeDefs,
    nodeSearchService,
    nodeTree,

    updateNodeDefs,
    addNodeDef,
    removeNodeDef,
    registerBlueprintNodeDef,
    removeBlueprintNodeDef,
    getNodeDefByName,
    fromLGraphNode,
    getInputSpecForWidget,
    registerNodeDefFilter,
    unregisterNodeDefFilter,
    topNodeDefs
  }
})
