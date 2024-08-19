import { NodeSearchService } from '@/services/nodeSearchService'
import { ComfyNodeDef } from '@/types/apiTypes'
import { defineStore } from 'pinia'
import { Type, Transform, plainToClass } from 'class-transformer'
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

function sortedTree(node: TreeNode): TreeNode {
  // Create a new node with the same label and data
  const newNode: TreeNode = {
    ...node
  }

  if (node.children) {
    // Sort the children of the current node
    const sortedChildren = [...node.children].sort((a, b) =>
      a.label.localeCompare(b.label)
    )
    // Recursively sort the children and add them to the new node
    newNode.children = []
    for (const child of sortedChildren) {
      newNode.children.push(sortedTree(child))
    }
  }

  return newNode
}

interface State {
  nodeDefsByName: Record<string, ComfyNodeDefImpl>
  widgets: Record<string, ComfyWidgetConstructor>
}

export const useNodeDefStore = defineStore('nodeDef', {
  state: (): State => ({
    nodeDefsByName: {},
    widgets: {}
  }),
  getters: {
    nodeDefs(state) {
      return Object.values(state.nodeDefsByName)
    },
    nodeSearchService(state) {
      return new NodeSearchService(Object.values(state.nodeDefsByName))
    },
    nodeTree(): TreeNode {
      return buildTree(this.nodeDefs, (nodeDef: ComfyNodeDefImpl) => [
        ...nodeDef.category.split('/'),
        nodeDef.display_name
      ])
    },
    sortedNodeTree(): TreeNode {
      return sortedTree(this.nodeTree)
    }
  },
  actions: {
    updateNodeDefs(nodeDefs: ComfyNodeDef[]) {
      const newNodeDefsByName: { [key: string]: ComfyNodeDefImpl } = {}
      for (const nodeDef of nodeDefs) {
        newNodeDefsByName[nodeDef.name] = plainToClass(
          ComfyNodeDefImpl,
          nodeDef
        )
      }
      this.nodeDefsByName = newNodeDefsByName
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
