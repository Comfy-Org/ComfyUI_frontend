import axios from 'axios'
import _ from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { transformNodeDefV1ToV2 } from '@/schemas/nodeDef/migration'
import type {
  ComfyNodeDef as ComfyNodeDefV2,
  InputSpec as InputSpecV2,
  OutputSpec as OutputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  ComfyInputsSpec as ComfyInputSpecV1,
  ComfyNodeDef as ComfyNodeDefV1,
  ComfyOutputTypesSpec as ComfyOutputSpecV1
} from '@/schemas/nodeDefSchema'
import { NodeSearchService } from '@/services/nodeSearchService'
import {
  type NodeSource,
  NodeSourceType,
  getNodeSource
} from '@/types/nodeSource'
import type { TreeNode } from '@/types/treeExplorerTypes'
import type { FuseSearchable, SearchAuxScore } from '@/utils/fuseUtil'
import { buildTree } from '@/utils/treeUtil'

export class ComfyNodeDefImpl
  implements ComfyNodeDefV1, ComfyNodeDefV2, FuseSearchable
{
  // ComfyNodeDef fields (V1)
  readonly name: string
  readonly display_name: string
  /**
   * Category is not marked as readonly as the bookmark system
   * needs to write to it to assign a node to a custom folder.
   */
  category: string
  readonly python_module: string
  readonly description: string
  readonly help: string
  readonly deprecated: boolean
  readonly experimental: boolean
  readonly output_node: boolean
  readonly api_node: boolean
  /**
   * @deprecated Use `inputs` instead
   */
  readonly input: ComfyInputSpecV1
  /**
   * @deprecated Use `outputs` instead
   */
  readonly output: ComfyOutputSpecV1
  /**
   * @deprecated Use `outputs[n].is_list` instead
   */
  readonly output_is_list?: boolean[]
  /**
   * @deprecated Use `outputs[n].name` instead
   */
  readonly output_name?: string[]
  /**
   * @deprecated Use `outputs[n].tooltip` instead
   */
  readonly output_tooltips?: string[]

  // V2 fields
  readonly inputs: Record<string, InputSpecV2>
  readonly outputs: OutputSpecV2[]
  readonly hidden?: Record<string, any>

  // ComfyNodeDefImpl fields
  readonly nodeSource: NodeSource

  /**
   * @internal
   * Migrate default input options to forceInput.
   */
  static #migrateDefaultInput(nodeDef: ComfyNodeDefV1): ComfyNodeDefV1 {
    const def = _.cloneDeep(nodeDef)
    def.input ??= {}
    // For required inputs, now we have the input socket always present. Specifying
    // it now has no effect.
    for (const [name, spec] of Object.entries(def.input.required ?? {})) {
      const inputOptions = spec[1]
      if (inputOptions && inputOptions.defaultInput) {
        console.warn(
          `Use of defaultInput on required input ${nodeDef.python_module}:${nodeDef.name}:${name} is deprecated. Please drop the defaultInput option.`
        )
      }
    }
    // For optional inputs, defaultInput is used to distinguish the null state.
    // We migrate it to forceInput. One example is the "seed_override" input usage.
    // User can connect the socket to override the seed.
    for (const [name, spec] of Object.entries(def.input.optional ?? {})) {
      const inputOptions = spec[1]
      if (inputOptions && inputOptions.defaultInput) {
        console.warn(
          `Use of defaultInput on optional input ${nodeDef.python_module}:${nodeDef.name}:${name} is deprecated. Please use forceInput instead.`
        )
        inputOptions.forceInput = true
      }
    }
    return def
  }

  constructor(def: ComfyNodeDefV1) {
    const obj = ComfyNodeDefImpl.#migrateDefaultInput(def)

    /**
     * Assign extra fields to `this` for compatibility with group node feature.
     * TODO: Remove this once group node feature is removed.
     */
    Object.assign(this, obj)

    // Initialize V1 fields
    this.name = obj.name
    this.display_name = obj.display_name
    this.category = obj.category
    this.python_module = obj.python_module
    this.description = obj.description
    this.help = obj.help ?? ''
    this.deprecated = obj.deprecated ?? obj.category === ''
    this.experimental =
      obj.experimental ?? obj.category.startsWith('_for_testing')
    this.output_node = obj.output_node
    this.api_node = !!obj.api_node
    this.input = obj.input ?? {}
    this.output = obj.output ?? []
    this.output_is_list = obj.output_is_list
    this.output_name = obj.output_name
    this.output_tooltips = obj.output_tooltips

    // Initialize V2 fields
    const defV2 = transformNodeDefV1ToV2(obj)
    this.inputs = defV2.inputs
    this.outputs = defV2.outputs
    this.hidden = defV2.hidden

    // Initialize node source
    this.nodeSource = getNodeSource(obj.python_module)
  }

  get nodePath(): string {
    return (this.category ? this.category + '/' : '') + this.name
  }

  get isDummyFolder(): boolean {
    return this.name === ''
  }

  postProcessSearchScores(scores: SearchAuxScore): SearchAuxScore {
    const nodeFrequencyStore = useNodeFrequencyStore()
    const nodeFrequency = nodeFrequencyStore.getNodeFrequencyByName(this.name)
    return [scores[0], -nodeFrequency, ...scores.slice(1)]
  }

  get isCoreNode(): boolean {
    return this.nodeSource.type === NodeSourceType.Core
  }

  get nodeLifeCycleBadgeText(): string {
    if (this.deprecated) return '[DEPR]'
    if (this.experimental) return '[BETA]'
    return ''
  }
}

export const SYSTEM_NODE_DEFS: Record<string, ComfyNodeDefV1> = {
  PrimitiveNode: {
    name: 'PrimitiveNode',
    display_name: 'Primitive',
    category: 'utils',
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
    category: 'utils',
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
    category: 'utils',
    input: { required: {}, optional: {} },
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
    category: 'utils',
    input: { required: {}, optional: {} },
    output: [],
    output_name: [],
    output_is_list: [],
    output_node: false,
    python_module: 'nodes',
    description:
      'Node that add notes to your project. Reformats text as markdown.'
  }
}

export interface BuildNodeDefTreeOptions {
  /**
   * Custom function to extract the tree path from a node definition.
   * If not provided, uses the default path based on nodeDef.nodePath.
   */
  pathExtractor?: (nodeDef: ComfyNodeDefImpl) => string[]
}

export function buildNodeDefTree(
  nodeDefs: ComfyNodeDefImpl[],
  options: BuildNodeDefTreeOptions = {}
): TreeNode {
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
  } as ComfyNodeDefV1)
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

export const useNodeDefStore = defineStore('nodeDef', () => {
  const nodeDefsByName = ref<Record<string, ComfyNodeDefImpl>>({})
  const nodeDefsByDisplayName = ref<Record<string, ComfyNodeDefImpl>>({})
  const showDeprecated = ref(false)
  const showExperimental = ref(false)
  const nodeDefFilters = ref<NodeDefFilter[]>([])

  const nodeDefs = computed(() => Object.values(nodeDefsByName.value))
  const nodeDataTypes = computed(() => {
    const types = new Set<string>()
    for (const nodeDef of nodeDefs.value) {
      for (const input of Object.values(nodeDef.inputs)) {
        types.add(input.type)
      }
      for (const output of nodeDef.outputs) {
        types.add(output.type)
      }
    }
    return types
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
    const newNodeDefsByDisplayName: Record<string, ComfyNodeDefImpl> = {}

    for (const nodeDef of nodeDefs) {
      const nodeDefImpl =
        nodeDef instanceof ComfyNodeDefImpl
          ? nodeDef
          : new ComfyNodeDefImpl(nodeDef)

      newNodeDefsByName[nodeDef.name] = nodeDefImpl
      newNodeDefsByDisplayName[nodeDef.display_name] = nodeDefImpl
    }

    nodeDefsByName.value = newNodeDefsByName
    nodeDefsByDisplayName.value = newNodeDefsByDisplayName
  }
  function addNodeDef(nodeDef: ComfyNodeDefV1) {
    const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)
    nodeDefsByName.value[nodeDef.name] = nodeDefImpl
    nodeDefsByDisplayName.value[nodeDef.display_name] = nodeDefImpl
  }
  function fromLGraphNode(node: LGraphNode): ComfyNodeDefImpl | null {
    // Frontend-only nodes don't have nodeDef
    const nodeTypeName = node.constructor?.nodeData?.name
    if (!nodeTypeName) return null
    const nodeDef = nodeDefsByName.value[nodeTypeName] ?? null
    return nodeDef
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
      name: 'Hide Deprecated Nodes',
      description: 'Hides nodes marked as deprecated unless explicitly enabled',
      predicate: (nodeDef) => showDeprecated.value || !nodeDef.deprecated
    })

    // Experimental nodes filter
    registerNodeDefFilter({
      id: 'core.experimental',
      name: 'Hide Experimental Nodes',
      description:
        'Hides nodes marked as experimental unless explicitly enabled',
      predicate: (nodeDef) => showExperimental.value || !nodeDef.experimental
    })

    // Subgraph nodes filter
    // @todo Remove this filter when subgraph v2 is released
    registerNodeDefFilter({
      id: 'core.subgraph',
      name: 'Hide Subgraph Nodes',
      description:
        'Temporarily hides subgraph nodes from node library and search',
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

  return {
    nodeDefsByName,
    nodeDefsByDisplayName,
    showDeprecated,
    showExperimental,
    nodeDefFilters,

    nodeDefs,
    nodeDataTypes,
    visibleNodeDefs,
    nodeSearchService,
    nodeTree,

    updateNodeDefs,
    addNodeDef,
    fromLGraphNode,
    registerNodeDefFilter,
    unregisterNodeDefFilter
  }
})

export const useNodeFrequencyStore = defineStore('nodeFrequency', () => {
  const topNodeDefLimit = ref(64)
  const nodeFrequencyLookup = ref<Record<string, number>>({})
  const nodeNamesByFrequency = computed(() =>
    Object.keys(nodeFrequencyLookup.value)
  )
  const isLoaded = ref(false)

  const loadNodeFrequencies = async () => {
    if (!isLoaded.value) {
      try {
        const response = await axios.get('assets/sorted-custom-node-map.json')
        nodeFrequencyLookup.value = response.data
        isLoaded.value = true
      } catch (error) {
        console.error('Error loading node frequencies:', error)
      }
    }
  }

  const getNodeFrequency = (nodeDef: ComfyNodeDefImpl) => {
    return getNodeFrequencyByName(nodeDef.name)
  }

  const getNodeFrequencyByName = (nodeName: string) => {
    return nodeFrequencyLookup.value[nodeName] ?? 0
  }

  const nodeDefStore = useNodeDefStore()
  const topNodeDefs = computed<ComfyNodeDefImpl[]>(() => {
    return nodeNamesByFrequency.value
      .map((nodeName: string) => nodeDefStore.nodeDefsByName[nodeName])
      .filter((nodeDef: ComfyNodeDefImpl) => nodeDef !== undefined)
      .slice(0, topNodeDefLimit.value)
  })

  return {
    nodeNamesByFrequency,
    topNodeDefs,
    isLoaded,
    loadNodeFrequencies,
    getNodeFrequency,
    getNodeFrequencyByName
  }
})
