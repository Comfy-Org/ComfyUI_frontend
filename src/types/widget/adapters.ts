/**
 * Adapters for converting between LiteGraph widget types and the new WidgetModel.
 *
 * @module widget/adapters
 */

import type { IWidget, TWidgetType } from '@/lib/litegraph/src/types/widgets'

import type { WidgetKind, WidgetModel } from './model'
import type { NodeId } from './primitives'

/**
 * Maps legacy LiteGraph widget types to canonical WidgetKind.
 * 'toggle' → 'boolean', 'text' → 'string' (handled specially for multiline)
 */
const LEGACY_TYPE_TO_KIND: Record<TWidgetType, WidgetKind> = {
  toggle: 'boolean',
  number: 'number',
  slider: 'slider',
  knob: 'knob',
  combo: 'combo',
  string: 'string',
  text: 'textarea',
  button: 'button',
  custom: 'custom',
  fileupload: 'fileupload',
  color: 'color',
  markdown: 'markdown',
  image: 'image',
  treeselect: 'treeselect',
  multiselect: 'multiselect',
  chart: 'chart',
  galleria: 'galleria',
  imagecompare: 'imagecompare',
  selectbutton: 'selectbutton',
  textarea: 'textarea',
  asset: 'asset',
  imagecrop: 'imagecrop',
  boundingbox: 'boundingbox'
}

const KIND_TO_LEGACY_TYPE: Record<WidgetKind, TWidgetType> = {
  boolean: 'toggle',
  number: 'number',
  slider: 'slider',
  knob: 'knob',
  combo: 'combo',
  string: 'string',
  textarea: 'textarea',
  button: 'button',
  custom: 'custom',
  fileupload: 'fileupload',
  color: 'color',
  markdown: 'markdown',
  image: 'image',
  treeselect: 'treeselect',
  multiselect: 'multiselect',
  chart: 'chart',
  galleria: 'galleria',
  imagecompare: 'imagecompare',
  selectbutton: 'selectbutton',
  asset: 'asset',
  imagecrop: 'imagecrop',
  boundingbox: 'boundingbox'
}

export function legacyTypeToKind(type: TWidgetType): WidgetKind {
  return LEGACY_TYPE_TO_KIND[type] ?? 'custom'
}

export function kindToLegacyType(kind: WidgetKind): TWidgetType {
  return KIND_TO_LEGACY_TYPE[kind]
}

/**
 * Converts a LiteGraph IWidget to a WidgetModel.
 * Requires nodeId since IWidget does not carry it.
 */
export function fromLiteGraphWidget(
  widget: IWidget,
  nodeId: NodeId
): WidgetModel {
  const kind = legacyTypeToKind(widget.type)
  const base = {
    nodeId,
    name: widget.name,
    hidden: widget.hidden,
    disabled: widget.disabled,
    advanced: widget.advanced,
    promoted: widget.promoted
  }

  const baseOptions = {
    label: widget.options?.property ?? widget.label,
    tooltip: widget.tooltip,
    readOnly: widget.options?.read_only,
    serialize: widget.serialize
  }

  switch (kind) {
    case 'boolean':
      return {
        ...base,
        kind: 'boolean',
        value: Boolean(widget.value),
        options: baseOptions
      }
    case 'number':
      return {
        ...base,
        kind: 'number',
        value: Number(widget.value) || 0,
        options: {
          ...baseOptions,
          min: widget.options?.min,
          max: widget.options?.max,
          step: widget.options?.step2 ?? widget.options?.step,
          precision: widget.options?.precision
        }
      }
    case 'slider':
      return {
        ...base,
        kind: 'slider',
        value: Number(widget.value) || 0,
        options: {
          ...baseOptions,
          min: widget.options?.min ?? 0,
          max: widget.options?.max ?? 100,
          step: widget.options?.step2 ?? widget.options?.step
        }
      }
    case 'knob':
      return {
        ...base,
        kind: 'knob',
        value: Number(widget.value) || 0,
        options: {
          ...baseOptions,
          min: widget.options?.min ?? 0,
          max: widget.options?.max ?? 100,
          step: widget.options?.step2 ?? widget.options?.step,
          gradientStops: (widget.options as { gradient_stops?: string })
            ?.gradient_stops
        }
      }
    case 'combo': {
      const values = extractComboValues(widget.options?.values)
      return {
        ...base,
        kind: 'combo',
        value: widget.value as string | number,
        options: {
          ...baseOptions,
          values,
          getOptionLabel: widget.options?.getOptionLabel
        }
      }
    }
    case 'string':
      return {
        ...base,
        kind: 'string',
        value: String(widget.value ?? ''),
        options: {
          ...baseOptions,
          multiline: widget.options?.multiline
        }
      }
    case 'textarea':
      return {
        ...base,
        kind: 'textarea',
        value: String(widget.value ?? ''),
        options: {
          ...baseOptions,
          multiline: true
        }
      }
    case 'button':
      return {
        ...base,
        kind: 'button',
        value: widget.value as string | undefined,
        options: {
          ...baseOptions,
          iconClass: widget.options?.iconClass
        }
      }
    case 'fileupload':
      return {
        ...base,
        kind: 'fileupload',
        value: String(widget.value ?? ''),
        options: baseOptions
      }
    case 'color':
      return {
        ...base,
        kind: 'color',
        value: String(widget.value ?? ''),
        options: baseOptions
      }
    case 'markdown':
      return {
        ...base,
        kind: 'markdown',
        value: String(widget.value ?? ''),
        options: baseOptions
      }
    case 'image':
      return {
        ...base,
        kind: 'image',
        value: String(widget.value ?? ''),
        options: baseOptions
      }
    case 'asset':
      return {
        ...base,
        kind: 'asset',
        value: String(widget.value ?? ''),
        options: {
          ...baseOptions,
          nodeType: widget.options?.nodeType
        }
      }
    case 'treeselect':
      return {
        ...base,
        kind: 'treeselect',
        value: widget.value as string | string[],
        options: baseOptions
      }
    case 'multiselect':
      return {
        ...base,
        kind: 'multiselect',
        value: (widget.value as string[]) ?? [],
        options: baseOptions
      }
    case 'selectbutton': {
      const values = (widget.options?.values as string[]) ?? []
      return {
        ...base,
        kind: 'selectbutton',
        value: String(widget.value ?? ''),
        options: { ...baseOptions, values }
      }
    }
    case 'chart':
      return {
        ...base,
        kind: 'chart',
        value: (widget.value as object) ?? {},
        options: baseOptions
      }
    case 'galleria':
      return {
        ...base,
        kind: 'galleria',
        value: (widget.value as string[]) ?? [],
        options: baseOptions
      }
    case 'imagecompare':
      return {
        ...base,
        kind: 'imagecompare',
        value: (widget.value as string[]) ?? [],
        options: baseOptions
      }
    case 'imagecrop':
      return {
        ...base,
        kind: 'imagecrop',
        value: (widget.value as {
          x: number
          y: number
          width: number
          height: number
        }) ?? {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        },
        options: baseOptions
      }
    case 'boundingbox':
      return {
        ...base,
        kind: 'boundingbox',
        value: (widget.value as {
          x: number
          y: number
          width: number
          height: number
        }) ?? {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        },
        options: baseOptions
      }
    case 'custom':
    default:
      return {
        ...base,
        kind: 'custom',
        value: widget.value,
        options: { ...baseOptions, ...widget.options }
      }
  }
}

function extractComboValues(values: unknown): Array<string | number> {
  if (Array.isArray(values)) return values
  if (values && typeof values === 'object') return Object.keys(values)
  return []
}

/**
 * Converts a WidgetModel back to a partial IWidget structure.
 * Returns properties that can be spread onto an existing IWidget.
 */
export function toLiteGraphWidget(
  model: WidgetModel
): Partial<IWidget> & { name: string; type: TWidgetType; value: unknown } {
  const type = kindToLegacyType(model.kind)

  const base = {
    name: model.name,
    type,
    value: model.value,
    hidden: model.hidden,
    disabled: model.disabled,
    advanced: model.advanced,
    promoted: model.promoted
  }

  switch (model.kind) {
    case 'number':
      return {
        ...base,
        options: {
          min: model.options.min,
          max: model.options.max,
          step2: model.options.step,
          precision: model.options.precision,
          read_only: model.options.readOnly
        }
      } as Partial<IWidget> & {
        name: string
        type: TWidgetType
        value: unknown
      }
    case 'slider':
      return {
        ...base,
        options: {
          min: model.options.min,
          max: model.options.max,
          step2: model.options.step,
          read_only: model.options.readOnly
        }
      } as Partial<IWidget> & {
        name: string
        type: TWidgetType
        value: unknown
      }
    case 'knob':
      return {
        ...base,
        options: {
          min: model.options.min,
          max: model.options.max,
          step2: model.options.step,
          gradient_stops: model.options.gradientStops,
          read_only: model.options.readOnly
        }
      } as Partial<IWidget> & {
        name: string
        type: TWidgetType
        value: unknown
      }
    case 'combo':
      return {
        ...base,
        options: {
          values: model.options.values,
          getOptionLabel: model.options.getOptionLabel,
          read_only: model.options.readOnly
        }
      } as Partial<IWidget> & {
        name: string
        type: TWidgetType
        value: unknown
      }
    case 'string':
    case 'textarea':
      return {
        ...base,
        options: {
          multiline: model.options.multiline,
          read_only: model.options.readOnly
        }
      } as Partial<IWidget> & {
        name: string
        type: TWidgetType
        value: unknown
      }
    case 'selectbutton':
      return {
        ...base,
        options: {
          values: model.options.values,
          read_only: model.options.readOnly
        }
      } as Partial<IWidget> & {
        name: string
        type: TWidgetType
        value: unknown
      }
    default:
      return {
        ...base,
        options: {
          read_only: model.options?.readOnly
        }
      } as Partial<IWidget> & {
        name: string
        type: TWidgetType
        value: unknown
      }
  }
}

/**
 * Creates a WidgetIdentity from a minimal widget-like object.
 * Used for adapting legacy fake widgets that only have { name: string }.
 */
export function toWidgetIdentity(
  widget: { name: string },
  nodeId: NodeId
): { nodeId: NodeId; name: string } {
  return { nodeId, name: widget.name }
}

/**
 * Creates a SlotWidgetRef from a widget name.
 * Used to associate an input slot with a widget on the same node.
 */
export function createSlotWidgetRef(name: string): { readonly name: string } {
  return Object.freeze({ name })
}

/**
 * Creates a mutable slot widget ref for cases requiring prototype manipulation.
 * @internal Used by SubgraphNode for prototype chain building.
 */
export function createMutableSlotWidgetRef(name: string): { name: string } {
  return { name }
}
