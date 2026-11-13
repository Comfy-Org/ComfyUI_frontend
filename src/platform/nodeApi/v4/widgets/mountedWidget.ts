import { isPlainObject } from 'es-toolkit'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { DOMWidgetImpl } from '@/scripts/domWidget'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import {
  callListener,
  createListeners
} from '@/platform/nodeApi/shared/listeners'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type {
  MountDef,
  MountedData,
  MountedValue,
  WidgetHandle
} from '@/platform/nodeApi/v4/types'
import {
  definitionFields,
  optionalFlag,
  optionalSize,
  requiredName
} from './definitionFields'
import { assertSavable } from './savableValue'

/** A mount definition from a pack, checked, with its defaults applied. */
export interface MountSpec {
  /** The member the definition was given to, for a refusal. */
  readonly member: string
  readonly name: string
  readonly render: (container: HTMLElement, value: MountedValue) => void
  readonly destroy: () => void
  readonly height: number | undefined
  readonly hideOnZoom: boolean
  readonly serialize: boolean
  readonly sendToPrompt: boolean
  readonly defaultValue: MountedData | undefined
  /** Runs after every write of the value, whoever made it. */
  readonly written: () => void
}

const FIELDS = [
  'name',
  'render',
  'destroy',
  'height',
  'hideOnZoom',
  'serialize',
  'sendToPrompt',
  'defaultValue'
] as const satisfies readonly (keyof MountDef)[]

export function checkedMountDef(member: string, def: unknown): MountSpec {
  const fields = definitionFields(member, def, FIELDS)
  const defaultValue =
    fields.defaultValue === undefined
      ? undefined
      : mountedData(member, fields.defaultValue)
  const serialize =
    optionalFlag(member, fields.serialize) ?? defaultValue !== undefined
  return {
    member,
    name: requiredName(member, fields.name),
    render: packFunction(member, fields.render),
    destroy:
      fields.destroy === undefined
        ? () => {}
        : packFunction(member, fields.destroy),
    height: optionalSize(member, fields.height),
    hideOnZoom: optionalFlag(member, fields.hideOnZoom) ?? true,
    serialize,
    sendToPrompt: optionalFlag(member, fields.sendToPrompt) ?? serialize,
    defaultValue,
    written: () => {}
  }
}

function mountedData(member: string, value: unknown): MountedData {
  if (typeof value === 'string') return value
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw invalidArgument(member, 'a string, or a plain object or array', value)
  }
  assertSavable(member, value)
  return structuredClone(value)
}

/** The host DOM widget a mount definition describes, not yet on its node. */
export function createMountedWidget(
  node: LGraphNode,
  spec: MountSpec
): {
  readonly widget: DOMWidgetImpl<HTMLDivElement, MountedData>
  readonly onChange: ReturnType<typeof createListeners<[MountedData]>>
  readonly settingOwnValue: (set: () => void) => void
} {
  const onChange = createListeners<[MountedData]>('mount.onChange')
  let value: MountedData = spec.defaultValue ?? ''
  let settingOwn = false
  const widget = new DOMWidgetImpl<HTMLDivElement, MountedData>({
    node,
    name: spec.name,
    type: 'custom',
    element: document.createElement('div'),
    options: {
      hideOnZoom: spec.hideOnZoom,
      serialize: spec.sendToPrompt,
      getValue: () => value,
      setValue: (next) => {
        value = next
        if (!settingOwn) onChange.notify(next)
        spec.written()
      }
    }
  })
  widget.serialize = spec.serialize
  widget.onRemove = useChainCallback(widget.onRemove, () =>
    callListener('mount.destroy', spec.destroy)
  )
  return {
    widget,
    onChange,
    settingOwnValue(set) {
      settingOwn = true
      try {
        set()
      } finally {
        settingOwn = false
      }
    }
  }
}

/** Hands the pack its element and the value accessor, once the widget is on its node. */
export function renderMounted(
  spec: MountSpec,
  mounted: ReturnType<typeof createMountedWidget>,
  handle: WidgetHandle,
  copyOfSaved: SavedCopier
): MountedValue {
  const value: MountedValue = Object.freeze({
    get: () => copyOfSaved('get', mounted.widget.value),
    set(next: unknown) {
      const checked = mountedData('set', next)
      mounted.settingOwnValue(() => handle.setValue(checked))
    },
    onChange(listener: unknown) {
      if (typeof listener !== 'function') {
        throw invalidArgument('onChange', 'a function to call', listener)
      }
      return mounted.onChange.add((next) =>
        Reflect.apply(listener, undefined, [copyOfSaved('onChange', next)])
      )
    }
  })
  callListener('mount.render', () => spec.render(mounted.widget.element, value))
  return value
}

/** A pack's function, called with the arguments it is given, or a `TypeError` naming `member`. */
export function packFunction(
  member: string,
  callback: unknown
): (...args: unknown[]) => void {
  if (typeof callback !== 'function') {
    throw invalidArgument(member, 'a function to call', callback)
  }
  return (...args) => {
    Reflect.apply(callback, undefined, args)
  }
}
