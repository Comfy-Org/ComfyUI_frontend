import { NodeSearchService } from '@/services/nodeSearchService'
import { ComfyNodeDef } from '@/types/apiTypes'
import { defineStore } from 'pinia'
import { Type, Transform, plainToClass, Expose } from 'class-transformer'
import { ComfyWidgetConstructor } from '@/scripts/widgets'
import { TreeNode } from 'primevue/treenode'
import { buildTree } from '@/utils/treeUtil'

export class BaseInputSpec<T = any> {
  name: string
  type: string
  tooltip?: string
  default?: T

  @Type(() => Boolean)
  forceInput?: boolean

  static isInputSpec(obj: any): boolean {
    return (
      Array.isArray(obj) &&
      obj.length >= 1 &&
      (typeof obj[0] === 'string' || Array.isArray(obj[0]))
    )
  }
}

export class NumericInputSpec extends BaseInputSpec<number> {
  @Type(() => Number)
  min?: number

  @Type(() => Number)
  max?: number

  @Type(() => Number)
  step?: number
}

export class IntInputSpec extends NumericInputSpec {
  type: 'INT' = 'INT'
}

export class FloatInputSpec extends NumericInputSpec {
  type: 'FLOAT' = 'FLOAT'

  @Type(() => Number)
  round?: number
}

export class BooleanInputSpec extends BaseInputSpec<boolean> {
  type: 'BOOLEAN' = 'BOOLEAN'

  labelOn?: string
  labelOff?: string
}

export class StringInputSpec extends BaseInputSpec<string> {
  type: 'STRING' = 'STRING'

  @Type(() => Boolean)
  multiline?: boolean

  @Type(() => Boolean)
  dynamicPrompts?: boolean
}

export class ComboInputSpec extends BaseInputSpec<any> {
  type: string = 'COMBO'

  @Transform(({ value }) => value[0])
  comboOptions: any[]

  @Type(() => Boolean)
  controlAfterGenerate?: boolean

  @Type(() => Boolean)
  imageUpload?: boolean
}

export class CustomInputSpec extends BaseInputSpec {}

export class ComfyInputsSpec {
  @Transform(({ value }) => ComfyInputsSpec.transformInputSpecRecord(value))
  required: Record<string, BaseInputSpec> = {}

  @Transform(({ value }) => ComfyInputsSpec.transformInputSpecRecord(value))
  optional: Record<string, BaseInputSpec> = {}

  hidden?: Record<string, any>

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

  private static transformSingleInputSpec(
    name: string,
    value: any
  ): BaseInputSpec {
    if (!BaseInputSpec.isInputSpec(value)) return value

    const [typeRaw, _spec] = value
    const spec = _spec ?? {}
    const type = Array.isArray(typeRaw) ? 'COMBO' : value[0]

    switch (type) {
      case 'INT':
        return plainToClass(IntInputSpec, { name, type, ...spec })
      case 'FLOAT':
        return plainToClass(FloatInputSpec, { name, type, ...spec })
      case 'BOOLEAN':
        return plainToClass(BooleanInputSpec, { name, type, ...spec })
      case 'STRING':
        return plainToClass(StringInputSpec, { name, type, ...spec })
      case 'COMBO':
        return plainToClass(ComboInputSpec, {
          name,
          type,
          ...spec,
          comboOptions: typeRaw,
          default: spec.default ?? typeRaw[0]
        })
      default:
        return plainToClass(CustomInputSpec, { name, type, ...spec })
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

export class ComfyNodeDefImpl {
  name: string
  display_name: string
  category: string
  python_module: string
  description: string

  @Transform(({ value, obj }) => value ?? obj.category === '', {
    toClassOnly: true
  })
  @Type(() => Boolean)
  @Expose()
  deprecated: boolean

  @Transform(
    ({ value, obj }) => value ?? obj.category.startsWith('_for_testing'),
    {
      toClassOnly: true
    }
  )
  @Type(() => Boolean)
  @Expose()
  experimental: boolean

  @Type(() => ComfyInputsSpec)
  input: ComfyInputsSpec

  @Transform(({ obj }) => ComfyNodeDefImpl.transformOutputSpec(obj))
  output: ComfyOutputsSpec

  private static transformOutputSpec(obj: any): ComfyOutputsSpec {
    const { output, output_is_list, output_name, output_tooltips } = obj
    const result = output.map((type: string | any[], index: number) => {
      const typeString = Array.isArray(type) ? 'COMBO' : type

      return new ComfyOutputSpec(
        index,
        output_name[index],
        typeString,
        output_is_list[index],
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
  return plainToClass(ComfyNodeDefImpl, {
    name: '',
    display_name: '',
    category: folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath,
    python_module: 'nodes',
    description: 'Dummy Folder Node (User should never see this string)'
  })
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
        const nodeDefImpl = plainToClass(ComfyNodeDefImpl, nodeDef)
        newNodeDefsByName[nodeDef.name] = nodeDefImpl
        nodeDefsByDisplayName[nodeDef.display_name] = nodeDefImpl
      }
      this.nodeDefsByName = newNodeDefsByName
      this.nodeDefsByDisplayName = nodeDefsByDisplayName
    },
    addNodeDef(nodeDef: ComfyNodeDef) {
      const nodeDefImpl = plainToClass(ComfyNodeDefImpl, nodeDef)
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
