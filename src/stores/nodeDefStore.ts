// @ts-strict-ignore
import {
  NodeSearchService,
  type SearchAuxScore
} from '@/services/nodeSearchService'
import {
  type ComfyNodeDef,
  type ComfyInputsSpec as ComfyInputsSpecSchema
} from '@/types/apiTypes'
import { defineStore } from 'pinia'
import { ComfyWidgetConstructor } from '@/scripts/widgets'
import { TreeNode } from 'primevue/treenode'
import { buildTree } from '@/utils/treeUtil'
import { computed, ref } from 'vue'
import axios from 'axios'
import { type NodeSource, getNodeSource } from '@/types/nodeSource'

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
    this.required = ComfyInputsSpec.transformInputSpecRecord(obj.required) ?? {}
    this.optional = ComfyInputsSpec.transformInputSpecRecord(obj.optional) ?? {}
    this.hidden = obj.hidden
  }

  private static transformInputSpecRecord(
    record: Record<string, any>
  ): Record<string, BaseInputSpec> {
    if (!record) return record
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

/**
 * Note: This class does not implement the ComfyNodeDef interface, as we are
 * using a custom output spec for output definitions.
 */
export class ComfyNodeDefImpl {
  name: string
  display_name: string
  category: string
  python_module: string
  description: string
  deprecated: boolean
  experimental: boolean
  input: ComfyInputsSpec
  output: ComfyOutputsSpec
  nodeSource: NodeSource

  constructor(obj: ComfyNodeDef) {
    this.name = obj.name
    this.display_name = obj.display_name
    this.category = obj.category
    this.python_module = obj.python_module
    this.description = obj.description
    this.deprecated = obj.deprecated ?? obj.category === ''
    this.experimental =
      obj.experimental ?? obj.category.startsWith('_for_testing')
    this.input = new ComfyInputsSpec(obj.input ?? {})
    this.output = ComfyNodeDefImpl.transformOutputSpec(obj)
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
    output_is_list: []
  } as ComfyNodeDef)
}

interface State {
  nodeDefsByName: Record<string, ComfyNodeDefImpl>
  nodeDefsByDisplayName: Record<string, ComfyNodeDefImpl>
  widgets: Record<string, ComfyWidgetConstructor>
  showDeprecated: boolean
  showExperimental: boolean
}

export const useNodeDefStore = defineStore('nodeDef', {
  state: (): State => ({
    nodeDefsByName: {},
    nodeDefsByDisplayName: {},
    widgets: {},
    showDeprecated: false,
    showExperimental: false
  }),
  getters: {
    nodeDefs(state) {
      return Object.values(state.nodeDefsByName)
    },
    // Node defs that are not deprecated
    visibleNodeDefs(state): ComfyNodeDefImpl[] {
      return this.nodeDefs.filter(
        (nodeDef: ComfyNodeDefImpl) =>
          (state.showDeprecated || !nodeDef.deprecated) &&
          (state.showExperimental || !nodeDef.experimental)
      )
    },
    nodeSearchService() {
      return new NodeSearchService(this.visibleNodeDefs)
    },
    nodeTree(): TreeNode {
      return buildNodeDefTree(this.visibleNodeDefs)
    }
  },
  actions: {
    updateNodeDefs(nodeDefs: ComfyNodeDef[]) {
      const newNodeDefsByName: { [key: string]: ComfyNodeDefImpl } = {}
      const nodeDefsByDisplayName: { [key: string]: ComfyNodeDefImpl } = {}
      for (const nodeDef of nodeDefs) {
        const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)
        newNodeDefsByName[nodeDef.name] = nodeDefImpl
        nodeDefsByDisplayName[nodeDef.display_name] = nodeDefImpl
      }
      this.nodeDefsByName = newNodeDefsByName
      this.nodeDefsByDisplayName = nodeDefsByDisplayName
    },
    addNodeDef(nodeDef: ComfyNodeDef) {
      const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)
      this.nodeDefsByName[nodeDef.name] = nodeDefImpl
      this.nodeDefsByDisplayName[nodeDef.display_name] = nodeDefImpl
    },
    updateWidgets(widgets: Record<string, ComfyWidgetConstructor>) {
      this.widgets = widgets
    },
    getWidgetType(type: string, inputName: string) {
      if (type === 'COMBO') {
        return 'COMBO'
      } else if (`${type}:${inputName}` in this.widgets) {
        return `${type}:${inputName}`
      } else if (type in this.widgets) {
        return type
      } else {
        return null
      }
    },
    inputIsWidget(spec: BaseInputSpec) {
      return this.getWidgetType(spec.type, spec.name) !== null
    }
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
