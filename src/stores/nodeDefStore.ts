import { NodeSearchService } from '@/services/nodeSearchService'
import { ComfyNodeDef } from '@/types/apiTypes'
import { defineStore } from 'pinia'
import { Type, Transform, plainToClass } from 'class-transformer'

export class BaseInputSpec<T = any> {
  @Transform(({ value }) => value[0])
  type: string

  @Transform(({ value }) => value[1])
  spec: Record<string, any>

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

export class CustomInputSpec extends BaseInputSpec {
  @Transform(({ value }) => value[0])
  declare type: string
}

export type InputSpec =
  | IntInputSpec
  | FloatInputSpec
  | BooleanInputSpec
  | StringInputSpec
  | ComboInputSpec
  | CustomInputSpec

function TransformInputSpec() {
  return Transform(({ value }) => {
    if (!BaseInputSpec.isInputSpec(value)) return value

    const type = Array.isArray(value[0]) ? 'COMBO' : value[0]
    switch (type) {
      case 'INT':
        return plainToClass(IntInputSpec, value)
      case 'FLOAT':
        return plainToClass(FloatInputSpec, value)
      case 'BOOLEAN':
        return plainToClass(BooleanInputSpec, value)
      case 'STRING':
        return plainToClass(StringInputSpec, value)
      case 'COMBO':
        return plainToClass(ComboInputSpec, value)
      default:
        return plainToClass(CustomInputSpec, value)
    }
  })
}

export class ComfyInputsSpec {
  @Type(() => BaseInputSpec)
  @Transform(({ value }) => ComfyInputsSpec.transformInputSpecRecord(value))
  required?: Record<string, BaseInputSpec>

  @Type(() => BaseInputSpec)
  @Transform(({ value }) => ComfyInputsSpec.transformInputSpecRecord(value))
  optional?: Record<string, BaseInputSpec>

  hidden?: Record<string, any>

  private static transformInputSpecRecord(
    record: Record<string, any>
  ): Record<string, BaseInputSpec> {
    if (!record) return record
    const result: Record<string, BaseInputSpec> = {}
    for (const [key, value] of Object.entries(record)) {
      result[key] = ComfyInputsSpec.transformSingleInputSpec(value)
    }
    return result
  }

  @TransformInputSpec()
  private static transformSingleInputSpec(value: any): BaseInputSpec {
    return value
  }
}

export const SYSTEM_NODE_DEFS: ComfyNodeDef[] = [
  {
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
  {
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
  {
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
]

const SYSTEM_NODE_DEFS_BY_NAME = SYSTEM_NODE_DEFS.reduce((acc, nodeDef) => {
  acc[nodeDef.name] = nodeDef
  return acc
}, {}) as Record<string, ComfyNodeDef>

interface State {
  nodeDefsByName: Record<string, ComfyNodeDef>
}

export const useNodeDefStore = defineStore('nodeDef', {
  state: (): State => ({
    nodeDefsByName: SYSTEM_NODE_DEFS_BY_NAME
  }),
  getters: {
    nodeDefs(state) {
      return Object.values(state.nodeDefsByName)
    },
    nodeSearchService(state) {
      return new NodeSearchService(Object.values(state.nodeDefsByName))
    }
  },
  actions: {
    addNodeDef(nodeDef: ComfyNodeDef) {
      this.nodeDefsByName[nodeDef.name] = nodeDef
    },
    addNodeDefs(nodeDefs: ComfyNodeDef[]) {
      for (const nodeDef of nodeDefs) {
        this.nodeDefsByName[nodeDef.name] = nodeDef
      }
    }
  }
})
