import { getCnrIdFromProperties } from './cnrIdUtil'
import type { NodeReplacement } from './types'

const rules = [
  ['jameswalker55/comfyui-various', 'JWString', 'text', 'PrimitiveString'],
  [
    'jameswalker55/comfyui-various',
    'JWStringMultiline',
    'text',
    'PrimitiveStringMultiline'
  ],
  ['comfyui_lc123_nodes', 'LCPositive', 'positive', 'PrimitiveStringMultiline'],
  ['comfyui_lc123_nodes', 'LCNegative', 'negative', 'PrimitiveStringMultiline'],
  ['comfyui_lc123_nodes', 'LCBooleanValue', 'value', 'PrimitiveBoolean'],
  ['comfyui-kjnodes', 'StringConstant', 'string', 'PrimitiveString'],
  ['comfyui-kjnodes', 'BOOLConstant', 'value', 'PrimitiveBoolean'],
  ['comfyui-easy-use', 'easy string', 'value', 'PrimitiveString'],
  ['comfyui-easy-use', 'easy boolean', 'value', 'PrimitiveBoolean'],
  ['comfyui-easy-use', 'easy int', 'value', 'PrimitiveInt'],
  ['comfyui-impact-pack', 'ImpactBoolean', 'value', 'PrimitiveBoolean'],
  [
    'comfyui-crystools',
    'Primitive string [Crystools]',
    'string',
    'PrimitiveString'
  ],
  [
    'comfyui-crystools',
    'Primitive string multiline [Crystools]',
    'string',
    'PrimitiveStringMultiline'
  ],
  [
    'comfyui-crystools',
    'Primitive boolean [Crystools]',
    'boolean',
    'PrimitiveBoolean'
  ],
  ['comfyui-crystools', 'Primitive integer [Crystools]', 'int', 'PrimitiveInt'],
  ['comfyui_layerstyle', 'LayerUtility: String', 'string', 'PrimitiveString'],
  [
    'comfyui_layerstyle',
    'LayerUtility: TextBox',
    'text',
    'PrimitiveStringMultiline'
  ],
  ['comfyui_layerstyle', 'LayerUtility: Seed', 'seed', 'SeedNode'],
  ['cg-use-everywhere', 'Simple String', 'string', 'PrimitiveString'],
  [
    'was-node-suite-comfyui',
    'Logic Boolean Primitive',
    'boolean',
    'PrimitiveBoolean'
  ],
  [
    'comfyui-image-saver',
    'String Literal (Image Saver)',
    'string',
    'PrimitiveStringMultiline'
  ],
  ['comfyui-image-saver', 'Int Literal (Image Saver)', 'int', 'PrimitiveInt'],
  ['derfuu_comfyui_moddednodes', 'DF_Text', 'Text', 'PrimitiveString'],
  [
    'derfuu_comfyui_moddednodes',
    'DF_Text_Box',
    'Text',
    'PrimitiveStringMultiline'
  ],
  ['controlaltai-nodes', 'BooleanBasic', 'boolean', 'PrimitiveBoolean']
] as const

const control = 'control_after_generate'
const modes = new Set(['fixed', 'increment', 'decrement', 'randomize'])
const definitions = {
  PrimitiveString: ['STRING', 'string'],
  PrimitiveStringMultiline: ['STRING', 'string'],
  PrimitiveBoolean: ['BOOLEAN', 'boolean'],
  PrimitiveInt: ['INT', 'number'],
  SeedNode: ['INT', 'number']
} as const

interface SavedNode {
  type: string
  properties?: Record<string, unknown>
  inputs?: unknown
  outputs?: unknown
  widgets_values?: unknown
  widgets_values_named?: unknown
}

export function getCoreEquivalent(node: SavedNode): NodeReplacement | null {
  const rule = rules.find(([, oldId]) => oldId === node.type)
  return rule &&
    getCnrIdFromProperties(node.properties)?.toLowerCase() === rule[0]
    ? validateMapping(node, rule)
    : null
}

export function getInstalledCoreEquivalent(
  type: string,
  pythonModule: string,
  serialize: () => SavedNode | null
): NodeReplacement | null {
  const rule = rules.find(([, oldId]) => oldId === type)
  if (!rule) return null
  const folder = rule[0].split('/').at(-1)
  const module = pythonModule.toLowerCase().split('@')[0]
  if (module !== `custom_nodes.${folder}`) return null
  const saved = serialize()
  return saved ? validateMapping(saved, rule) : null
}

function matchesPorts(node: SavedNode, field: string, slotType: string) {
  return (
    Array.isArray(node.outputs) &&
    node.outputs.length === 1 &&
    node.outputs[0]?.type === slotType &&
    (node.inputs == null ||
      (Array.isArray(node.inputs) &&
        node.inputs.length <= 1 &&
        node.inputs.every(
          (input) => input?.name === field && input?.type === slotType
        )))
  )
}

function readWidgets(node: SavedNode, field: string, keys: string[]) {
  const named = node.widgets_values_named
  const positional = node.widgets_values
  if (named == null) {
    if (Array.isArray(positional) && positional.length === keys.length)
      return { value: positional[0], mode: positional[1] }
    return null
  }
  if (
    typeof named !== 'object' ||
    !(field in named) ||
    Object.keys(named).some((key) => !keys.includes(key))
  )
    return null
  return { value: Reflect.get(named, field), mode: Reflect.get(named, control) }
}

function isSeedValue(value: unknown, mode: unknown): boolean {
  return (
    typeof value === 'number' &&
    value >= 0 &&
    typeof mode === 'string' &&
    modes.has(mode)
  )
}

function validateMapping(
  node: SavedNode,
  [, oldId, field, target]: (typeof rules)[number]
): NodeReplacement | null {
  const [slotType, valueType] = definitions[target]
  if (!matchesPorts(node, field, slotType)) return null

  const seed = target === 'SeedNode'
  const keys = seed ? [field, control] : [field]
  const widgets = readWidgets(node, field, keys)
  if (!widgets) return null
  const { value, mode } = widgets
  if (
    typeof value !== valueType ||
    (typeof value === 'number' && !Number.isSafeInteger(value))
  )
    return null
  if (seed && !isSeedValue(value, mode)) return null

  const inputMapping: NonNullable<NodeReplacement['input_mapping']> = [
    { old_id: field, new_id: seed ? 'seed' : 'value' }
  ]
  if (seed) inputMapping.push({ old_id: control, new_id: control })
  if (target === 'PrimitiveInt')
    inputMapping.push({ new_id: control, set_value: 'fixed' })
  return {
    old_node_id: oldId,
    new_node_id: target,
    old_widget_ids: keys,
    input_mapping: inputMapping,
    output_mapping: null,
    editorOnly: true
  }
}
