import {
  NodeSearchService,
  type SearchAuxScore
} from '@/services/nodeSearchService'
import {
  type ComfyNodeDef,
  type ComfyInputsSpec as ComfyInputsSpecSchema,
  type ComfyOutputTypesSpec as ComfyOutputTypesSpecSchema,
  type InputSpec
} from '@/types/apiTypes'
import { defineStore } from 'pinia'
import type { TreeNode } from 'primevue/treenode'
import { buildTree } from '@/utils/treeUtil'
import { computed, ref } from 'vue'
import axios from 'axios'
import {
  type NodeSource,
  NodeSourceType,
  getNodeSource
} from '@/types/nodeSource'
import type { LGraphNode } from '@comfyorg/litegraph'

export interface BaseInputSpec<T = any> {
  name: string
  type: string
  tooltip?: string
  default?: T

  forceInput?: boolean
}

export interface NumericInputSpec extends BaseInputSpec<number> {
  min?: number
  max?: number
  step?: number
}

export interface IntInputSpec extends NumericInputSpec {
  type: 'INT'
}

export interface FloatInputSpec extends NumericInputSpec {
  type: 'FLOAT'
  round?: number
}

export interface BooleanInputSpec extends BaseInputSpec<boolean> {
  type: 'BOOLEAN'
  labelOn?: string
  labelOff?: string
}

export interface StringInputSpec extends BaseInputSpec<string> {
  type: 'STRING'
  multiline?: boolean
  dynamicPrompts?: boolean
}

export interface ComboInputSpec extends BaseInputSpec<any> {
  type: 'COMBO'
  comboOptions: any[]
  controlAfterGenerate?: boolean
  imageUpload?: boolean
}

export class ComfyInputsSpec {
  required: Record<string, BaseInputSpec>
  optional: Record<string, BaseInputSpec>
  hidden?: Record<string, any>

  constructor(obj: ComfyInputsSpecSchema) {
    this.required = ComfyInputsSpec.transformInputSpecRecord(obj.required ?? {})
    this.optional = ComfyInputsSpec.transformInputSpecRecord(obj.optional ?? {})
    this.hidden = obj.hidden
  }

  private static transformInputSpecRecord(
    record: Record<string, InputSpec>
  ): Record<string, BaseInputSpec> {
    const result: Record<string, BaseInputSpec> = {}
    for (const [key, value] of Object.entries(record)) {
      result[key] = ComfyInputsSpec.transformSingleInputSpec(key, value)
    }
    return result
  }

  private static isInputSpec(obj: any): boolean {
    return (
      Array.isArray(obj) &&
      obj.length >= 1 &&
      (typeof obj[0] === 'string' || Array.isArray(obj[0]))
    )
  }

  private static transformSingleInputSpec(
    name: string,
    value: any
  ): BaseInputSpec {
    if (!ComfyInputsSpec.isInputSpec(value)) return value

    const [typeRaw, _spec] = value
    const spec = _spec ?? {}
    const type = Array.isArray(typeRaw) ? 'COMBO' : value[0]

    switch (type) {
      case 'COMBO':
        return {
          name,
          type,
          ...spec,
          comboOptions: typeRaw,
          default: spec.default ?? typeRaw[0]
        } as ComboInputSpec
      case 'INT':
      case 'FLOAT':
      case 'BOOLEAN':
      case 'STRING':
      default:
        return { name, type, ...spec } as BaseInputSpec
    }
  }

  get all() {
    return [...Object.values(this.required), ...Object.values(this.optional)]
  }

  getInput(name: string): BaseInputSpec | undefined {
    return this.required[name] ?? this.optional[name]
  }
}

export class ComfyOutputSpec {
  constructor(
    public index: number,
    // Name is not unique for output params
    public name: string,
    public type: string,
    public is_list: boolean,
    public comboOptions?: any[],
    public tooltip?: string
  ) {}
}

export class ComfyOutputsSpec {
  constructor(public outputs: ComfyOutputSpec[]) {}

  get all() {
    return this.outputs
  }
}

export class ComfyNodeDefImpl implements ComfyNodeDef {
  // ComfyNodeDef fields
  readonly name: string
  readonly display_name: string
  /**
   * Category is not marked as readonly as the bookmark system
   * needs to write to it to assign a node to a custom folder.
   */
  category: string
  readonly python_module: string
  readonly description: string
  readonly deprecated: boolean
  readonly experimental: boolean
  readonly output_node: boolean
  /**
   * @deprecated Use `inputs` instead
   */
  readonly input: ComfyInputsSpecSchema
  /**
   * @deprecated Use `outputs` instead
   */
  readonly output: ComfyOutputTypesSpecSchema
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

  // ComfyNodeDefImpl fields
  readonly inputs: ComfyInputsSpec
  readonly outputs: ComfyOutputsSpec
  readonly nodeSource: NodeSource

  constructor(obj: ComfyNodeDef) {
    this.name = obj.name
    this.display_name = obj.display_name
    this.category = obj.category
    this.python_module = obj.python_module
    this.description = obj.description
    this.deprecated = obj.deprecated ?? obj.category === ''
    this.experimental =
      obj.experimental ?? obj.category.startsWith('_for_testing')
    this.output_node = obj.output_node
    this.input = obj.input ?? {}
    this.output = obj.output ?? []
    this.output_is_list = obj.output_is_list
    this.output_name = obj.output_name
    this.output_tooltips = obj.output_tooltips

    this.inputs = new ComfyInputsSpec(obj.input ?? {})
    this.outputs = ComfyNodeDefImpl.transformOutputSpec(obj)
    this.nodeSource = getNodeSource(obj.python_module)
  }

  private static transformOutputSpec(obj: any): ComfyOutputsSpec {
    const { output, output_is_list, output_name, output_tooltips } = obj
    const result = (output ?? []).map((type: string | any[], index: number) => {
      const typeString = Array.isArray(type) ? 'COMBO' : type

      return new ComfyOutputSpec(
        index,
        output_name?.[index],
        typeString,
        output_is_list?.[index],
        Array.isArray(type) ? type : undefined,
        output_tooltips?.[index]
      )
    })
    return new ComfyOutputsSpec(result)
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

export const SYSTEM_NODE_DEFS: Record<string, ComfyNodeDef> = {
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
    input: { required: { '': ['*'] }, optional: {} },
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
  }
}

export function buildNodeDefTree(nodeDefs: ComfyNodeDefImpl[]): TreeNode {
  return buildTree(nodeDefs, (nodeDef: ComfyNodeDefImpl) =>
    nodeDef.nodePath.split('/')
  )
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
  } as ComfyNodeDef)
}

export const useNodeDefStore = defineStore('nodeDef', () => {
  const nodeDefsByName = ref<Record<string, ComfyNodeDefImpl>>({})
  const nodeDefsByDisplayName = ref<Record<string, ComfyNodeDefImpl>>({})
  const showDeprecated = ref(false)
  const showExperimental = ref(false)

  const nodeDefs = computed(() => Object.values(nodeDefsByName.value))
  const nodeDataTypes = computed(() => {
    const types = new Set<string>()
    for (const nodeDef of nodeDefs.value) {
      for (const input of nodeDef.inputs.all) {
        types.add(input.type)
      }
      for (const output of nodeDef.outputs.all) {
        types.add(output.type)
      }
    }
    return types
  })
  const visibleNodeDefs = computed(() =>
    nodeDefs.value.filter(
      (nodeDef: ComfyNodeDefImpl) =>
        (showDeprecated.value || !nodeDef.deprecated) &&
        (showExperimental.value || !nodeDef.experimental)
    )
  )
  const nodeSearchService = computed(
    () => new NodeSearchService(visibleNodeDefs.value)
  )
  const nodeTree = computed(() => buildNodeDefTree(visibleNodeDefs.value))

  function updateNodeDefs(nodeDefs: ComfyNodeDef[]) {
    const newNodeDefsByName: Record<string, ComfyNodeDefImpl> = {}
    const newNodeDefsByDisplayName: Record<string, ComfyNodeDefImpl> = {}
    for (const nodeDef of nodeDefs) {
      try {
        const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)
        newNodeDefsByName[nodeDef.name] = nodeDefImpl
        newNodeDefsByDisplayName[nodeDef.display_name] = nodeDefImpl
      } catch (e) {
        // Avoid breaking the app for invalid nodeDefs
        // NodeDef validation is now optional for performance reasons
        console.error('Error adding nodeDef:', e)
      }
    }
    nodeDefsByName.value = newNodeDefsByName
    nodeDefsByDisplayName.value = newNodeDefsByDisplayName
  }
  function addNodeDef(nodeDef: ComfyNodeDef) {
    const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)
    nodeDefsByName.value[nodeDef.name] = nodeDefImpl
    nodeDefsByDisplayName.value[nodeDef.display_name] = nodeDefImpl
  }
  function fromLGraphNode(node: LGraphNode): ComfyNodeDefImpl | null {
    // Frontend-only nodes don't have nodeDef
    return nodeDefsByName.value[node.constructor?.nodeData?.name] ?? null
  }

  return {
    nodeDefsByName,
    nodeDefsByDisplayName,
    showDeprecated,
    showExperimental,

    nodeDefs,
    nodeDataTypes,
    visibleNodeDefs,
    nodeSearchService,
    nodeTree,

    updateNodeDefs,
    addNodeDef,
    fromLGraphNode
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
