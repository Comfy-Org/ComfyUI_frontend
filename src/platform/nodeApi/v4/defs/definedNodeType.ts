import { isPlainObject } from 'es-toolkit'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type {
  NodeDef,
  NodeDefBuilder,
  NodeDefinition,
  NodeDefinitionSlot
} from '@/platform/nodeApi/v4/types'
import type { HookCallbacks } from './nodeHooks'

type DefinitionHooks = Partial<
  Pick<
    HookCallbacks,
    | 'onCreated'
    | 'onConfigured'
    | 'onRemoved'
    | 'onSerialize'
    | 'onConnectionsChanged'
    | 'onPropertyChanged'
  >
>

/** A definition every field of which has been checked, with its defaults filled in. */
export interface CheckedDefinition {
  readonly type: string
  readonly title: string
  readonly category: string
  readonly description: string
  readonly inputs: readonly NodeDefinitionSlot[]
  readonly outputs: readonly NodeDefinitionSlot[]
  readonly execution: 'backend' | 'frontend'
  readonly hooks: DefinitionHooks
}

const DEFINITION_FIELDS = {
  type: true,
  title: true,
  category: true,
  description: true,
  inputs: true,
  outputs: true,
  execution: true,
  onCreated: true,
  onConfigured: true,
  onRemoved: true,
  onSerialize: true,
  onConnectionsChanged: true,
  onPropertyChanged: true
} satisfies Record<keyof NodeDefinition, true>

const EXECUTIONS = ['backend', 'frontend'] as const

/** Refuses a definition an untyped caller got wrong, before anything is registered. */
export function checkedDefinition(definition: unknown): CheckedDefinition {
  if (!isPlainObject(definition)) {
    throw invalidArgument('define', 'a node definition object', definition)
  }
  const unknownField = Object.keys(definition).find(
    (field) => !Object.hasOwn(DEFINITION_FIELDS, field)
  )
  if (unknownField !== undefined) {
    throw invalidArgument(
      'define',
      `a definition of ${Object.keys(DEFINITION_FIELDS).join(', ')} only`,
      unknownField
    )
  }
  const type = availableTypeName(definition.type)
  return {
    type,
    title: optionalText('title', definition.title) ?? type,
    category: optionalText('category', definition.category) ?? '',
    description: optionalText('description', definition.description) ?? '',
    inputs: checkedSlots('inputs', definition.inputs),
    outputs: checkedSlots('outputs', definition.outputs),
    execution: checkedExecution(definition.execution),
    hooks: {
      onCreated: optionalHook('onCreated', definition.onCreated),
      onConfigured: optionalHook('onConfigured', definition.onConfigured),
      onRemoved: optionalHook('onRemoved', definition.onRemoved),
      onSerialize: optionalHook('onSerialize', definition.onSerialize),
      onConnectionsChanged: optionalHook(
        'onConnectionsChanged',
        definition.onConnectionsChanged
      ),
      onPropertyChanged: optionalHook(
        'onPropertyChanged',
        definition.onPropertyChanged
      )
    }
  }
}

/** Adds the hooks a definition declares, as an extension of its own type. */
export function addDefinitionHooks(
  builder: NodeDefBuilder,
  { hooks }: CheckedDefinition
): void {
  if (hooks.onCreated) builder.onCreated(hooks.onCreated)
  if (hooks.onConfigured) builder.onConfigured(hooks.onConfigured)
  if (hooks.onRemoved) builder.onRemoved(hooks.onRemoved)
  if (hooks.onSerialize) builder.onSerialize(hooks.onSerialize)
  if (hooks.onConnectionsChanged) {
    builder.onConnectionsChanged(hooks.onConnectionsChanged)
  }
  if (hooks.onPropertyChanged)
    builder.onPropertyChanged(hooks.onPropertyChanged)
}

/** Registers the node type a definition describes, and returns its class. */
export function registerDefinedType(
  definition: CheckedDefinition
): typeof LGraphNode {
  const { title, inputs, outputs, execution } = definition
  class DefinedNode extends LGraphNode {
    static override title = title

    constructor(nodeTitle?: string) {
      super(nodeTitle ?? title)
      for (const input of inputs) this.addInput(input.name, input.type)
      for (const output of outputs) this.addOutput(output.name, output.type)
      if (execution === 'frontend') this.isVirtualNode = true
    }
  }
  LiteGraph.registerNodeType(definition.type, DefinedNode)
  DefinedNode.category = definition.category
  DefinedNode.description = definition.description
  return DefinedNode
}

export function nodeDefFromDefinition(definition: CheckedDefinition): NodeDef {
  const slot = ({ name, type }: NodeDefinitionSlot) =>
    Object.freeze({ name, type })
  return Object.freeze({
    type: definition.type,
    title: definition.title,
    category: definition.category,
    description: definition.description,
    inputs: Object.freeze(
      definition.inputs.map(({ name, type }) =>
        Object.freeze({
          name,
          type,
          localizedName: name,
          options: Object.freeze({})
        })
      )
    ),
    outputs: Object.freeze(definition.outputs.map(slot)),
    hidden: Object.freeze({}),
    isOutputNode: false
  })
}

function availableTypeName(type: unknown): string {
  if (typeof type !== 'string' || type === '' || type in Object.prototype) {
    throw invalidArgument('define', 'a type name', type)
  }
  if (Object.hasOwn(LiteGraph.registered_node_types, type)) {
    throw invalidArgument('define', 'a type name no node type has yet', type)
  }
  return type
}

function optionalHook<T>(name: string, hook: T): T | undefined {
  if (hook === undefined || typeof hook === 'function') return hook
  throw invalidArgument('define', `an ${name} that is a function`, hook)
}

function optionalText(field: string, value: unknown): string | undefined {
  if (value === undefined || typeof value === 'string') return value
  throw invalidArgument('define', `a ${field} that is text`, value)
}

function checkedSlots(
  field: 'inputs' | 'outputs',
  slots: unknown
): readonly NodeDefinitionSlot[] {
  if (slots === undefined) return []
  if (!Array.isArray(slots)) {
    throw invalidArgument('define', `a list of ${field}`, slots)
  }
  return slots.map((slot: unknown) => {
    if (
      !isPlainObject(slot) ||
      Object.keys(slot).some((key) => key !== 'name' && key !== 'type') ||
      typeof slot.name !== 'string' ||
      typeof slot.type !== 'string'
    ) {
      throw invalidArgument('define', `${field} of { name, type } text`, slot)
    }
    return Object.freeze({ name: slot.name, type: slot.type })
  })
}

function checkedExecution(execution: unknown): CheckedDefinition['execution'] {
  if (execution === undefined) return 'backend'
  const known = EXECUTIONS.find((name) => name === execution)
  if (known === undefined) {
    throw invalidArgument(
      'define',
      `an execution of ${EXECUTIONS.join(' or ')}`,
      execution
    )
  }
  return known
}
