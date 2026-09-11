import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { DrawWidgetOptions } from '@/lib/litegraph/src/widgets/BaseWidget'
import { ButtonWidget } from '@/lib/litegraph/src/widgets/ButtonWidget'
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
import { zDynamicGroupInputSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

export function dynamicGroupWidget(
  node: LGraphNode,
  inputName: string,
  inputData: InputSpec
) {
  const parsed = zDynamicGroupInputSpec.safeParse(inputData)
  if (!parsed.success) {
    console.warn(`Invalid DynamicGroup input '${inputName}'`, parsed.error)
    return {
      widget: node.addCustomWidget({
        type: 'button',
        name: inputName,
        value: undefined,
        y: 0,
        serialize: false,
        options: { disabled: true, socketless: true, serialize: false }
      })
    }
  }

  const { min, max, template, group_name = inputName } = parsed.data[1]
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
      iconClass: 'icon-[lucide--plus]'
    },
    callback: () =>
      changeRows(() => {
        controller.value = rows().length + 1
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
    if (!node.widgets) return
    const prefix = `${inputName}.${index}`
    for (let slot = node.inputs.length - 1; slot >= 0; slot--)
      if (node.inputs[slot].name.startsWith(`${prefix}.`))
        node.removeInput(slot)
    const removed = node.widgets.filter(
      (widget) => widget.name === prefix || widget.name.startsWith(`${prefix}.`)
    )
    for (const widget of removed) {
      node.widgets.splice(node.widgets.indexOf(widget), 1)
      widget.onRemove?.()
      if (widget.widgetId) store.deleteWidget(widget.widgetId)
    }
    for (const header of rows()) {
      const oldPrefix = header.name
      const row = Number(oldPrefix.slice(inputName.length + 1))
      if (row <= index) continue
      const newPrefix = `${inputName}.${row - 1}`
      for (const widget of node.widgets)
        if (
          widget.name === oldPrefix ||
          widget.name.startsWith(`${oldPrefix}.`)
        )
          widget.name = newPrefix + widget.name.slice(oldPrefix.length)
      for (const input of node.inputs) {
        if (!input.name.startsWith(`${oldPrefix}.`)) continue
        input.name = newPrefix + input.name.slice(oldPrefix.length)
        if (input.widget) input.widget.name = input.name
      }
    }
  }

  function addRow(index: number) {
    const start = node.widgets?.length ?? 0
    const previous = captureInputLayout(node)
    const header: IBaseWidget = node.addCustomWidget(
      new DynamicGroupRowWidget(
        {
          name: `${inputName}.${index}`,
          type: 'button',
          clicked: false,
          value: undefined,
          y: 0,
          serialize: false,
          options: { socketless: true, serialize: false },
          callback: () => {
            if (rows().length <= min) return
            changeRows(() => {
              removeRow(Number(header.name.slice(inputName.length + 1)))
              publish()
            })
          }
        },
        node
      )
    )
    header.type = 'dynamic_group_row'
    for (const [fields, isOptional] of [
      [template.required, false],
      [template.optional, true]
    ] as const) {
      for (const [field, spec] of Object.entries(fields ?? {})) {
        const name = `${inputName}.${index}.${field}`
        const refreshed = useNodeDefStore().getInputSpecForWidget(node, name)
        addNodeInput(node, {
          ...(refreshed ??
            transformInputSpecV1ToV2(spec, { name, isOptional })),
          display_name: spec[1]?.display_name ?? field
        })
        const fieldWidget = node.widgets?.find((widget) => widget.name === name)
        fieldWidget?.linkedWidgets?.forEach((linked, index) => {
          linked.name = `${name}.${index}`
        })
      }
    }
    const addedInputs = node.inputs.splice(previous.inputs.length)
    const inputs = [...previous.inputs]
    for (const addedInput of addedInputs) {
      const existing = previous.inputs.find(
        (input) => input.name === addedInput.name
      )
      if (existing) existing.widget = addedInput.widget
      else inputs.push(addedInput)
    }
    replaceNodeInputs(node, previous, inputs, previous.links)
    const widgets = node.widgets
    if (!widgets) return
    const added = widgets.splice(start)
    widgets.splice(widgets.indexOf(add), 0, ...added)
  }

  Object.defineProperty(controller, 'value', {
    get: () => rowCount,
    set(value: unknown) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return
      const count = Math.max(min, Math.min(max, Math.trunc(value)))
      while (rows().length > count) removeRow(rows().length - 1)
      while (rows().length < count) addRow(rows().length)
      publish()
    }
  })
  controller.value = initialCount
  return { widget: controller }
}

class DynamicGroupRowWidget extends ButtonWidget {
  override drawWidget(
    ctx: CanvasRenderingContext2D,
    { width, showText = true }: DrawWidgetOptions
  ) {
    const { y, height } = this
    const label = `${this.label}  ×`
    ctx.save()
    ctx.fillStyle = this.secondary_text_color
    ctx.strokeStyle = this.outline_color
    ctx.textAlign = 'right'
    if (showText) ctx.fillText(label, width - 15, y + height * 0.7)
    ctx.beginPath()
    ctx.moveTo(15, y + height / 2)
    ctx.lineTo(
      width - (showText ? ctx.measureText(label).width + 25 : 15),
      y + height / 2
    )
    ctx.stroke()
    ctx.restore()
  }
}
