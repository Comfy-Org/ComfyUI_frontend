import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import type { DOMWidgetValue } from '@/types/domWidget'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import {
  callListener,
  createListeners
} from '@/platform/nodeApi/shared/listeners'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { MountDef, MountedValue } from '@/platform/nodeApi/v4/types'
import { optionalFlag, optionalSize, requiredName } from './definitionFields'
import { savableValue } from '@/platform/nodeApi/shared/savableValue'

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
  readonly defaultValue: DOMWidgetValue | undefined
  /** Runs after every write of the value, whoever made it. */
  readonly written: () => void
}

const FIELDS = {
  name: true,
  render: true,
  destroy: true,
  height: true,
  hideOnZoom: true,
  serialize: true,
  sendToPrompt: true,
  defaultValue: true
} satisfies Record<keyof MountDef, true>

export function checkedMountDef(member: string, def: unknown): MountSpec {
  const fields = checkedFields(member, 'a mount definition', def, FIELDS)
  const defaultValue =
    fields.defaultValue === undefined
      ? undefined
      : mountedData(member, fields.defaultValue, 'defaultValue')
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

/** A copy of a mounted widget's value as the host holds it, or a `TypeError` naming `member`. */
export function mountedData(
  member: string,
  value: unknown,
  field: string
): DOMWidgetValue {
  return savableValue(member, value, field) ?? ''
}

/** The host DOM widget a mount definition describes, not yet on its node. */
export function createMountedWidget(
  node: LGraphNode,
  spec: MountSpec
): {
  readonly widget: DOMWidgetImpl<HTMLDivElement, DOMWidgetValue>
  readonly onChange: ReturnType<typeof createListeners<[DOMWidgetValue]>>
  readonly settingOwnValue: (set: () => void) => void
} {
  const onChange = createListeners<[DOMWidgetValue]>('mount.onChange')
  let value: DOMWidgetValue = spec.defaultValue ?? ''
  let settingOwn = false
  const widget = new DOMWidgetImpl<HTMLDivElement, DOMWidgetValue>({
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
        if (!settingOwn) onChange.notify(widget.value)
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
  commit: (value: DOMWidgetValue) => void,
  copyOfSaved: SavedCopier
): MountedValue {
  const value: MountedValue = Object.freeze({
    get: () => copyOfSaved('get', mounted.widget.value),
    set(next: unknown) {
      const checked = mountedData('set', next, 'value')
      mounted.settingOwnValue(() => commit(checked))
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
