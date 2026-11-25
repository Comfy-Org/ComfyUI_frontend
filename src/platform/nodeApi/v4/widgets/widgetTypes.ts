import { isPlainObject } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { addWidget } from '@/scripts/domWidget'
import { useWidgetStore } from '@/stores/widgetStore'
import type { CustomComfyWidgetConstructor } from '@/types/comfy'
import type { DOMWidgetValue } from '@/types/domWidget'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import { savedRecord } from '@/platform/nodeApi/shared/savedCopy'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type {
  DefRegistry,
  WidgetTypeContext,
  WidgetTypeDef
} from '@/platform/nodeApi/v4/types'
import { optionalFlag, optionalSize, requiredName } from './definitionFields'
import {
  createMountedWidget,
  mountedData,
  renderMounted
} from './mountedWidget'
import type { MountSpec } from './mountedWidget'
import { isSavable } from '@/platform/nodeApi/shared/savableValue'
import { fixHeight } from './widgetEdits'
import type { WidgetEdits } from './widgetEdits'

/** The widget types packs declare, published as `comfy.defs.defineWidgetType`. */
export interface WidgetTypes {
  define: DefRegistry['defineWidgetType']
}

const FIELDS = {
  render: true,
  defaultValue: true,
  height: true,
  minHeight: true,
  serialize: true
} satisfies Record<keyof WidgetTypeDef, true>

interface CheckedWidgetType {
  readonly render: (...args: unknown[]) => unknown
  readonly defaultValue: DOMWidgetValue | undefined
  readonly height: number | undefined
  readonly minHeight: number | undefined
  readonly serialize: boolean
}

export function createWidgetTypes(
  edits: WidgetEdits,
  copyOfSaved: SavedCopier
): WidgetTypes {
  return {
    define(type: unknown, def: unknown) {
      const name = requiredName('defineWidgetType', 'type', type)
      const checked = checkedWidgetType(def)
      const store = useWidgetStore()
      if (store.widgets.has(name)) {
        throw invalidArgument(
          'defineWidgetType',
          'a type no widget is defined for',
          name
        )
      }
      const construct = widgetConstructor(checked, edits, copyOfSaved)
      store.registerCustomWidgets({ [name]: construct })
      return () => store.unregisterCustomWidget(name, construct)
    }
  }
}

function checkedWidgetType(def: unknown): CheckedWidgetType {
  const fields = checkedFields(
    'defineWidgetType',
    'a widget type definition',
    def,
    FIELDS
  )
  if (typeof fields.render !== 'function') {
    throw invalidArgument(
      'defineWidgetType',
      'a render function',
      fields.render
    )
  }
  const render = fields.render
  return {
    render: (...args) => Reflect.apply(render, undefined, args),
    defaultValue:
      fields.defaultValue === undefined
        ? undefined
        : mountedData('defineWidgetType', fields.defaultValue, 'defaultValue'),
    height: optionalSize('defineWidgetType', 'height', fields.height),
    minHeight: optionalSize('defineWidgetType', 'minHeight', fields.minHeight),
    serialize:
      optionalFlag('defineWidgetType', 'serialize', fields.serialize) ?? true
  }
}

function widgetConstructor(
  type: CheckedWidgetType,
  edits: WidgetEdits,
  copyOfSaved: SavedCopier
): CustomComfyWidgetConstructor {
  return (node, inputName, inputData) => {
    const options = declaredOptions(inputData)
    let teardown: (() => void) | undefined
    const spec: MountSpec = {
      member: 'defineWidgetType',
      name: inputName,
      height: undefined,
      hideOnZoom: true,
      serialize: type.serialize,
      sendToPrompt: type.serialize,
      defaultValue: declaredDefault(options.default) ?? type.defaultValue,
      written: () => {},
      render(container, value) {
        const result = type.render(container, value, inputName, context)
        if (typeof result === 'function') teardown = () => result()
      },
      destroy: () => teardown?.()
    }
    const context: WidgetTypeContext = Object.freeze({
      getOptions: () => savedRecord(copyOfSaved('getOptions', options))
    })
    const mounted = createMountedWidget(node, spec)
    if (type.height !== undefined) fixHeight(mounted.widget, type.height)
    addWidget(node, mounted.widget)
    renderMounted(
      spec,
      mounted,
      commitTo(node, mounted.widget, edits),
      copyOfSaved
    )
    return { widget: mounted.widget, minHeight: type.minHeight }
  }
}

function commitTo(
  node: LGraphNode,
  widget: ReturnType<typeof createMountedWidget>['widget'],
  edits: WidgetEdits
): (value: DOMWidgetValue) => boolean {
  return (value) => {
    edits.setInput(node, widget, value)
    return true
  }
}

function declaredOptions(
  inputData: Parameters<CustomComfyWidgetConstructor>[2]
): Readonly<Record<string, unknown>> {
  const options: unknown = inputData[1]
  return isPlainObject(options) ? options : {}
}

function declaredDefault(value: unknown): DOMWidgetValue | undefined {
  return value !== null && isSavable(value) ? structuredClone(value) : undefined
}
