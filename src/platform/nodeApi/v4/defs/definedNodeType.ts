import type { RenderShape } from '@comfyorg/graph-model/globalEnums'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import { zNodePackMetadata } from '@comfyorg/graph-model/workflowSchema'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import {
  checkedFields,
  isStoreKey,
  optionalCallback
} from '@/platform/nodeApi/v4/checkedFields'
import {
  checkedChoice,
  checkedString
} from '@/platform/nodeApi/v4/edit/checkedArguments'
import { chooseResizable } from '@/platform/nodeApi/v4/edit/nodeSizing'
import { checkedSlotType } from '@/platform/nodeApi/v4/edit/slotPatch'
import { SLOT_SHAPES } from '@/platform/nodeApi/v4/edit/slotVocabulary'
import type {
  NodeDef,
  NodeDefBuilder,
  NodeDefinition,
  PackId
} from '@/platform/nodeApi/v4/types'
import { PACK_PROPERTIES } from '@/platform/nodeApi/v4/packs'
import type { IssuedPack } from '@/platform/nodeApi/v4/packs'
import { checkedPresentation } from './nodePresentation'
import type { CheckedPresentation } from './nodePresentation'

type DefinitionHooks = Partial<
  Pick<
    NodeDefinition,
    | 'onCreated'
    | 'onConfigured'
    | 'onRemoved'
    | 'onSerialize'
    | 'onConnectionsChanged'
    | 'onPropertyChanged'
  >
>

interface CheckedSlot {
  readonly name: string
  readonly type: string
  readonly shape?: RenderShape
}

/** A definition every field of which has been checked, with its defaults filled in. */
export interface CheckedDefinition {
  readonly type: string
  readonly title: string
  readonly category: string
  readonly description: string
  readonly inputs: readonly CheckedSlot[]
  readonly outputs: readonly CheckedSlot[]
  readonly execution: 'backend' | 'frontend'
  readonly presentation: CheckedPresentation
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
  presentation: true,
  onCreated: true,
  onConfigured: true,
  onRemoved: true,
  onSerialize: true,
  onConnectionsChanged: true,
  onPropertyChanged: true
} satisfies Record<keyof NodeDefinition, true>

const EXECUTIONS = ['backend', 'frontend'] as const

/** Refuses a definition an untyped caller got wrong, before anything is registered. */
export function checkedDefinition(given: unknown): CheckedDefinition {
  const definition = checkedFields(
    'define',
    'a node definition',
    given,
    DEFINITION_FIELDS
  )
  const type = checkedTypeName(definition.type)
  return {
    type,
    title: optionalText('title', definition.title) || type,
    category: optionalText('category', definition.category) ?? '',
    description: optionalText('description', definition.description) ?? '',
    inputs: checkedSlots('inputs', definition.inputs),
    outputs: checkedSlots('outputs', definition.outputs),
    execution: checkedExecution(definition.execution),
    presentation: checkedPresentation(definition.presentation),
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

export function registerDefinedType(
  definition: CheckedDefinition,
  { packId, verified }: IssuedPack
): typeof LGraphNode {
  const { title, inputs, outputs, execution, presentation } = definition
  const stamp = verified ? packStamp(packId) : {}
  class DefinedNode extends LGraphNode {
    static override title = title
    static title_mode = presentation.titleMode
    static collapsable = presentation.collapsible

    constructor(nodeTitle: string) {
      super(nodeTitle)
      Object.assign(this.properties, stamp)
      if (!presentation.resizable) chooseResizable(this, { resizable: false })
      for (const input of inputs) this.addInput(input.name, input.type)
      for (const { name, type, shape } of outputs) {
        this.addOutput(name, type, shape === undefined ? {} : { shape })
      }
      if (execution === 'frontend') this.isVirtualNode = true
      else this.comfyClass = definition.type
    }

    override configure(info: ISerialisedNode): void {
      const saved = info.properties ?? {}
      if ([...PACK_PROPERTIES].some((key) => Object.hasOwn(saved, key))) {
        for (const key of Object.keys(stamp)) {
          if (!Object.hasOwn(saved, key)) delete this.properties[key]
        }
      }
      super.configure(info)
    }
  }
  LiteGraph.registerNodeType(definition.type, DefinedNode)
  DefinedNode.category = definition.category
  DefinedNode.description = definition.description
  return DefinedNode
}

function packStamp({ id, version }: PackId): Readonly<Record<string, string>> {
  return Object.freeze({
    cnr_id: id,
    ...(version !== undefined &&
      zNodePackMetadata.shape.ver.safeParse(version).success && {
        ver: version
      })
  })
}

export function nodeDefFromDefinition(definition: CheckedDefinition): NodeDef {
  const slot = ({ name, type }: CheckedSlot) => Object.freeze({ name, type })
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

function checkedTypeName(type: unknown): string {
  if (!isStoreKey(type) || type.trim() === '') {
    throw invalidArgument('define', 'a type name', type)
  }
  return type
}

function optionalHook<K extends keyof DefinitionHooks>(
  name: K,
  hook: unknown
): DefinitionHooks[K] {
  return optionalCallback('define', name, hook) as DefinitionHooks[K]
}

function optionalText(field: string, value: unknown): string | undefined {
  if (value === undefined || typeof value === 'string') return value
  throw invalidArgument('define', `a ${field} that is text`, value)
}

const SLOT_FIELDS = {
  inputs: { name: true, type: true },
  outputs: { name: true, type: true, shape: true }
} as const satisfies Record<
  'inputs' | 'outputs',
  Partial<Record<'name' | 'type' | 'shape', true>>
>

function checkedSlots(
  field: 'inputs' | 'outputs',
  slots: unknown
): readonly CheckedSlot[] {
  if (slots === undefined) return []
  if (!Array.isArray(slots)) {
    throw invalidArgument('define', `a list of ${field}`, slots)
  }
  return Array.from(slots, (given: unknown, index) => {
    const known: Readonly<Record<string, true>> = SLOT_FIELDS[field]
    const slot = checkedFields('define', `${field}[${index}]`, given, known)
    const shape =
      slot.shape === undefined
        ? undefined
        : SLOT_SHAPES[
            checkedChoice(
              'define',
              `${field}[${index}].shape`,
              slot.shape,
              SLOT_SHAPES
            )
          ]
    return Object.freeze({
      name: checkedString('define', `${field}[${index}].name`, slot.name),
      type: checkedSlotType(
        'define',
        checkedString('define', `${field}[${index}].type`, slot.type)
      ),
      shape
    })
  })
}

function checkedExecution(execution: unknown): CheckedDefinition['execution'] {
  if (execution === undefined) return 'frontend'
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
