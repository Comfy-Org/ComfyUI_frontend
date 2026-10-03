import { t } from '@/i18n'
import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { VueOnlyWidget } from '@/lib/litegraph/src/widgets/VueOnlyWidget'
import {
  captureInputLayout,
  replaceNodeInputs
} from '@/lib/litegraph/src/node/slotLinks'
import {
  getWidgetIds,
  resolveNodeRootGraphId
} from '@/lib/litegraph/src/utils/widget'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import {
  getInputSpecType,
  zDynamicGroupInputSpec
} from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { deriveWidgetSurfaces } from '@/types/widgetVisibility'
import { isSubgraph } from '@/utils/typeGuardUtil'

export function dynamicGroupWidget(
  node: LGraphNode,
  inputName: string,
  inputData: InputSpec
) {
  const {
    min,
    max,
    template,
    group_name = inputName
  } = zDynamicGroupInputSpec.parse(inputData)[1]
  const fields = { ...template.required, ...template.optional }
  const widgetStore = useWidgetStore()
  for (const [field, spec] of Object.entries(fields)) {
    if (!widgetStore.widgets.has(spec[1]?.widgetType ?? getInputSpecType(spec)))
      throw new TypeError(
        `DynamicGroup field '${inputName}.${field}' requires a registered widget`
      )
  }
  const store = useWidgetValueStore()
  const { addNodeInput } = useLitegraphService()
  const controller: IBaseWidget = node.addCustomWidget({
    name: inputName,
    type: 'number',
    value: min,
    y: 0,
    hidden: true,
    options: { min, max, socketless: true, serialize: false }
  })
  node.addCustomWidget(
    new DynamicGroupNoticeWidget(
      {
        name: `${inputName}.$notice`,
        label: group_name,
        type: 'dynamic_group_notice',
        value: undefined,
        y: 0,
        serialize: false,
        options: {
          socketless: true,
          serialize: false,
          surfaces: { canvas: 'shown', vueNode: 'never', panel: 'never' }
        }
      },
      node
    )
  )
  const initialCount = controller.value
  let rowCount = 0
  const add: IBaseWidget = node.addCustomWidget({
    name: `${inputName}.$add`,
    label: t('dynamicGroup.add', { group: group_name }),
    type: 'button',
    value: undefined,
    y: 0,
    serialize: false,
    options: {
      socketless: true,
      serialize: false,
      iconClass: 'icon-[lucide--plus]',
      surfaces: { canvas: 'never', vueNode: 'shown', panel: 'shown' }
    },
    callback: () =>
      changeRows(() => {
        if (rows().length < max) controller.value = rows().length + 1
      })
  })

  function rows() {
    return (node.widgets ?? []).filter(
      (widget) =>
        widget.type === 'dynamic_group_row' &&
        widget.name.startsWith(`${inputName}.`)
    )
  }

  function publish() {
    const headers = rows()
    rowCount = headers.length
    headers.forEach((header, index) => {
      header.label = t('dynamicGroup.row', {
        group: group_name,
        index: index + 1
      })
      header.options.disabled = headers.length <= min
    })
    add.options.disabled = headers.length >= max
    if (controller.widgetId) store.setValue(controller.widgetId, headers.length)
    const graphId = resolveNodeRootGraphId(node)
    if (graphId && node.widgets)
      store.setNodeWidgetOrder(graphId, node.id, getWidgetIds(node.widgets))
  }

  function changeRows(change: () => void) {
    const graph = node.graph
    graph?.beforeChange()
    graph?.canvasAction((canvas) => canvas.emitBeforeChange())
    try {
      change()
      node.setSize([node.size[0], node.computeSize([...node.size])[1]])
    } finally {
      graph?.afterChange()
      graph?.canvasAction((canvas) => canvas.emitAfterChange())
      node.setDirtyCanvas(true, true)
    }
  }

  function removeRow(index: number) {
    if (!node.widgets) return false
    const prefix = `${inputName}.${index}`
    const removed = node.widgets.filter(
      (widget) => widget.name === prefix || widget.name.startsWith(`${prefix}.`)
    )
    if (!removed.length) return false
    if (!removeRowInputs(prefix)) return false
    for (const widget of removed.reverse()) {
      if (node.widgets.includes(widget)) node.removeWidget(widget)
    }
    for (const header of rows()) {
      const oldPrefix = header.name
      const row = Number(oldPrefix.slice(inputName.length + 1))
      if (row <= index) continue
      const newPrefix = `${inputName}.${row - 1}`
      renameRow(oldPrefix, newPrefix)
    }
    return true
  }

  function removeRowInputs(prefix: string) {
    const previous = captureInputLayout(node)
    const inputs = previous.inputs.filter(
      (input) => !input.name.startsWith(`${prefix}.`)
    )
    const result = replaceNodeInputs(
      node,
      previous,
      inputs,
      previous.links,
      true
    )
    if (!result.ok) return false
    for (const link of node.graph?.floatingLinks.values() ?? []) {
      if (link.target_id !== node.id) continue
      const slot = inputs.indexOf(previous.inputs[link.target_slot])
      if (slot === -1) node.graph?.removeFloatingLink(link)
      else link.target_slot = slot
    }
    previous.inputs.forEach((input, slot) => {
      if (!inputs.includes(input)) node.onInputRemoved?.(slot, input)
    })
    return true
  }

  function fieldLabel(index: number, field: string) {
    const row = t('dynamicGroup.row', { group: group_name, index: index + 1 })
    return `${row} ${fields[field][1]?.display_name ?? field}`
  }

  function renamePromotedInputLabel(
    slot: number,
    previous: string,
    next: string
  ) {
    const graph = node.graph
    const link = node.getInputLink(slot)
    if (!graph || !isSubgraph(graph) || link?.origin_id !== SUBGRAPH_INPUT_ID)
      return
    const promoted = graph.inputs[link.origin_slot]
    if (promoted.label === previous) graph.renameInput(promoted, next)
  }

  function renameRowLabels(oldIndex: number, newIndex: number) {
    for (const field of Object.keys(fields)) {
      const name = `${inputName}.${newIndex}.${field}`
      const previous = fieldLabel(oldIndex, field)
      const next = fieldLabel(newIndex, field)
      const widget = node.widgets?.find((widget) => widget.name === name)
      if (widget?.label === previous) widget.label = next
      const slot = node.findInputSlot(name)
      if (slot === -1) continue
      const input = node.inputs[slot]
      if (input.label === previous) input.label = next
      renamePromotedInputLabel(slot, previous, next)
    }
  }

  function renameRow(oldPrefix: string, newPrefix: string) {
    for (const widget of node.widgets ?? []) {
      if (widget.name === oldPrefix || widget.name.startsWith(`${oldPrefix}.`))
        widget.name = newPrefix + widget.name.slice(oldPrefix.length)
    }
    for (const input of node.inputs) {
      if (!input.name.startsWith(`${oldPrefix}.`)) continue
      input.name = newPrefix + input.name.slice(oldPrefix.length)
      if (input.widget) input.widget.name = input.name
    }
    renameRowLabels(
      Number(oldPrefix.slice(inputName.length + 1)),
      Number(newPrefix.slice(inputName.length + 1))
    )
  }

  function addRow(index: number) {
    const previousSize: [number, number] = [...node.size]
    const start = node.widgets?.length ?? 0
    const previous = captureInputLayout(node)
    const header: IBaseWidget = node.addCustomWidget({
      name: `${inputName}.${index}`,
      type: 'dynamic_group_row',
      value: undefined,
      y: 0,
      serialize: false,
      options: {
        socketless: true,
        serialize: false,
        surfaces: { canvas: 'never', vueNode: 'shown', panel: 'shown' }
      },
      callback: () => {
        if (rows().length <= min) return
        changeRows(() => {
          removeRow(Number(header.name.slice(inputName.length + 1)))
          publish()
        })
      }
    })
    addRowFields(index)
    const addedInputs = node.inputs.splice(previous.inputs.length)
    const inputs = [
      ...previous.inputs,
      ...addedInputs.filter(
        (added) => !previous.inputs.some((input) => input.name === added.name)
      )
    ]
    const result = replaceNodeInputs(node, previous, inputs, previous.links)
    if (!result.ok) {
      for (const widget of (node.widgets?.slice(start) ?? []).reverse())
        node.removeWidget(widget)
      node.setSize(previousSize)
      return false
    }
    for (const addedInput of addedInputs) {
      const existing = previous.inputs.find(
        (input) => input.name === addedInput.name
      )
      if (existing) existing.widget = addedInput.widget
    }
    const widgets = node.widgets
    if (!widgets) return false
    const added = widgets.splice(start)
    widgets.splice(widgets.indexOf(add), 0, ...added)
    return true
  }

  function addRowFields(index: number) {
    for (const [fields, isOptional] of [
      [template.required, false],
      [template.optional, true]
    ] as const) {
      for (const [field, spec] of Object.entries(fields ?? {})) {
        const name = `${inputName}.${index}.${field}`
        const refreshed = useNodeDefStore().getInputSpecForWidget(node, name)
        const fieldStart = node.widgets?.length ?? 0
        addNodeInput(node, {
          ...(refreshed ??
            transformInputSpecV1ToV2(spec, { name, isOptional })),
          display_name: fieldLabel(index, field)
        })
        const input = node.inputs.find((input) => input.name === name)
        if (input) input.label ??= fieldLabel(index, field)
        let auxiliaryIndex = 0
        node.widgets?.slice(fieldStart).forEach((widget) => {
          const options = widget.options
          options.surfaces = {
            ...deriveWidgetSurfaces(widget),
            canvas: 'never'
          }
          widget.options = options
          if (widget.name === name) {
            if (input?.label) widget.label = input.label
            return
          }
          widget.label ??= widget.name
          widget.name = `${name}.${auxiliaryIndex++}`
        })
      }
    }
  }

  function validateSavedRowCount(value: number, requested: number) {
    const graphId = resolveNodeRootGraphId(node)
    if (!graphId) return
    const widgets = node.widgets ?? []
    const position = widgets
      .filter((widget) => widget.serialize !== false)
      .indexOf(controller)
    const restored = store.getRestoredWidgetValue(
      graphId,
      node.id,
      inputName,
      position
    )
    if (restored?.value !== value) return
    const firstRowPrefix = `${inputName}.0.`
    const rowFields = widgets
      .filter(
        (widget) =>
          widget.serialize !== false && widget.name.startsWith(firstRowPrefix)
      )
      .map((widget) => widget.name.slice(firstRowPrefix.length))
    const fieldNames = rowFields.length ? rowFields : Object.keys(fields)
    const following = widgets.slice(widgets.indexOf(add) + 1)
    const followingRows = following.filter(
      (widget) => widget.type === 'dynamic_group_row'
    )
    const reserved = following.filter(
      (widget) =>
        widget.serialize !== false &&
        !followingRows.some((row) => widget.name.startsWith(`${row.name}.`))
    ).length
    // Reserve trailing widgets in positional saves; named saves check the row keys.
    let positionToCheck = position + 1 + reserved
    for (let index = 0; index < requested; index++) {
      for (const field of fieldNames) {
        if (
          !store.getRestoredWidgetValue(
            graphId,
            node.id,
            `${inputName}.${index}.${field}`,
            positionToCheck++
          )
        )
          throw new RangeError(
            `Invalid saved row count for DynamicGroup '${inputName}'`
          )
      }
    }
  }

  Object.defineProperty(controller, 'value', {
    get: () => rowCount,
    set(value: unknown) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return
      const requested = Math.max(0, Math.trunc(value))
      validateSavedRowCount(value, requested)
      const count = Math.max(min, requested)
      for (let index = rows().length - 1; index >= count; index--) {
        if (!removeRow(index)) break
      }
      while (rows().length < count) {
        if (!addRow(rows().length)) break
        if (rows().length === 1) {
          try {
            validateSavedRowCount(value, requested)
          } catch (error) {
            removeRow(0)
            throw error
          }
        }
      }
      publish()
    }
  })
  controller.value = initialCount
  return { widget: controller }
}

class DynamicGroupNoticeWidget extends VueOnlyWidget<IBaseWidget> {
  protected get vueOnlyLabel(): string {
    return this.label ?? this.name
  }
}
