<template>
  <div
    class="col-span-2 grid grid-cols-[min-content_minmax(80px,min-content)_minmax(125px,1fr)] gap-x-2 gap-y-1"
  >
    <template v-for="row in rowIndices" :key="row">
      <div
        class="col-span-full mt-1 flex items-center justify-between border-t border-node-component-surface pt-1"
      >
        <span
          class="truncate text-xs font-medium text-node-component-slot-text"
        >
          {{
            t('dynamicGroup.group', { group_name: groupName, index: row + 1 })
          }}
        </span>
        <button
          v-if="canRemoveRows"
          v-tooltip.top="
            t('dynamicGroup.removeGroup', { group_name: groupName })
          "
          type="button"
          class="mr-1.75 flex cursor-pointer appearance-none border-0 bg-transparent p-0 text-node-component-slot-text/40 transition-colors duration-150 hover:text-danger-100 focus-visible:outline-none"
          :aria-label="t('dynamicGroup.removeGroup', { group_name: groupName })"
          @click="onRemoveRow(row)"
        >
          <span
            class="icon-[material-symbols--close] size-4"
            aria-hidden="true"
          />
        </button>
      </div>
      <div
        v-for="fw in rowWidgets(row)"
        :key="fw.name"
        class="group col-span-full grid grid-cols-subgrid items-stretch"
      >
        <div
          :class="
            cn(
              'z-10 -ml-3 flex w-3 items-stretch opacity-0 transition-opacity duration-150 group-hover:opacity-100',
              fw.linked && 'opacity-100'
            )
          "
        >
          <InputSlot
            v-if="fw.slotData && fw.inputIndex !== undefined"
            :slot-data="fw.slotData"
            :node-id="resolvedNodeId"
            :node-type="nodeType"
            :index="fw.inputIndex"
            :connected="fw.linked"
            dot-only
          />
        </div>
        <component
          :is="fw.component"
          :model-value="fw.value"
          :widget="fw.simplified"
          :node-id="nodeId"
          :node-type="nodeType"
          class="col-span-2"
          @update:model-value="fw.onUpdate"
        />
      </div>
    </template>
    <Button
      :disabled="addDisabled"
      class="col-span-full mt-1 border-0 bg-component-node-widget-background text-node-component-slot-text"
      size="sm"
      variant="textonly"
      @click="onAddRow"
    >
      <span
        class="mr-1 icon-[material-symbols--add] size-4"
        aria-hidden="true"
      />
      {{ t('dynamicGroup.addGroup', { group_name: groupName }) }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { WidgetSlotMetadata } from '@/composables/graph/useGraphNodeManager'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import type { DynamicGroupNode } from '@/core/graph/widgets/dynamicWidgets'
import type { INodeSlot } from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import InputSlot from '@/renderer/extensions/vueNodes/components/InputSlot.vue'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetState } from '@/types/widgetState'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { cn } from '@comfyorg/tailwind-utils'

const { widget, nodeId, nodeType } = defineProps<{
  widget: SimplifiedWidget<number>
  nodeId: string
  nodeType?: string
}>()

const { t } = useI18n()
const widgetValueStore = useWidgetValueStore()
const nodeDefStore = useNodeDefStore()
const { nodeManager } = useVueNodeLifecycle()

const group = widget.name

const node = computed(() => {
  const graph = app.canvas?.graph ?? app.graph
  return graph?.getNodeById(toNodeId(nodeId)) as DynamicGroupNode | undefined
})

const groupState = computed(
  () => node.value?.comfyDynamic?.dynamicGroup?.[group]
)

// Reading `input.link` off the raw litegraph node isn't reactive, so widgets
// wouldn't gray out on connect. The graph node manager tracks link changes and
// exposes them via `slotMetadata`, which updates on `node:slot-links:changed`.
const slotMetadataByName = computed(() => {
  const map = new Map<string, WidgetSlotMetadata>()
  const id = node.value?.id
  if (id == null) return map
  for (const w of nodeManager.value?.vueNodeData.get(id)?.widgets ?? []) {
    if (w.slotMetadata) map.set(w.name, w.slotMetadata)
  }
  return map
})

const minRows = computed(() => groupState.value?.min ?? 0)
const groupName = computed(
  () => groupState.value?.groupName ?? t('dynamicGroup.defaultGroupName')
)

interface FieldWidgetView {
  name: string
  row: number
  component: Component
  simplified: SimplifiedWidget
  value: WidgetValue
  onUpdate: (value: WidgetValue) => void
  slotData?: INodeSlot
  inputIndex?: number
  linked: boolean
}

function resolveWidgetState(w: IBaseWidget): WidgetState | undefined {
  if (w.widgetId) return widgetValueStore.getWidget(w.widgetId)
  const graphId = node.value?.graph?.rootGraph?.id
  if (!graphId) return undefined
  const localId = stripGraphPrefix(String(nodeId))
  if (!localId) return undefined
  return widgetValueStore.getWidget(widgetId(graphId, localId, w.name))
}

function toFieldView(
  n: DynamicGroupNode,
  w: IBaseWidget,
  row: number,
  fieldName: string
): FieldWidgetView {
  const state = resolveWidgetState(w)
  const value = state?.value ?? w.value
  const slotMeta = slotMetadataByName.value.get(w.name)
  const inputIndex =
    slotMeta?.index ??
    n.inputs.findIndex(
      (input) => input.name === w.name || input.widget?.name === w.name
    )
  const slotData = inputIndex === -1 ? undefined : n.inputs[inputIndex]
  const linked = slotMeta?.linked ?? slotData?.link != null
  const simplified: SimplifiedWidget = {
    name: w.name,
    type: state?.type ?? w.type,
    value,
    label: state?.label ?? w.label ?? fieldName,
    options: linked
      ? { ...(state?.options ?? w.options), disabled: true }
      : (state?.options ?? w.options),
    spec: nodeDefStore.getInputSpecForWidget(n, w.name)
  }
  return {
    name: w.name,
    row,
    component: getComponent(w.type) ?? WidgetLegacy,
    simplified,
    value,
    onUpdate: (next: WidgetValue) => {
      if (state) state.value = next
      w.value = next ?? undefined
      w.callback?.(next)
    },
    slotData,
    inputIndex: inputIndex === -1 ? undefined : inputIndex,
    linked
  }
}

const fieldWidgets = computed<FieldWidgetView[]>(() => {
  const n = node.value
  if (!n?.widgets) return []
  const prefix = `${group}.`
  const views: FieldWidgetView[] = []
  for (const w of n.widgets) {
    if (!w.name.startsWith(prefix)) continue
    const rest = w.name.slice(prefix.length)
    const dot = rest.indexOf('.')
    if (dot === -1) continue
    const row = Number(rest.slice(0, dot))
    if (!Number.isInteger(row)) continue
    views.push(toFieldView(n, w, row, rest.slice(dot + 1)))
  }
  return views
})

const rowIndices = computed(() =>
  [...new Set(fieldWidgets.value.map((fw) => fw.row))].sort((a, b) => a - b)
)

const addDisabled = computed(
  () => rowIndices.value.length >= (groupState.value?.max ?? Infinity)
)

const canRemoveRows = computed(() => rowIndices.value.length > minRows.value)

const resolvedNodeId = computed<NodeId>(() => toNodeId(nodeId))

function rowWidgets(row: number): FieldWidgetView[] {
  return fieldWidgets.value.filter((fw) => fw.row === row)
}

function onAddRow() {
  groupState.value?.addRow()
}

function onRemoveRow(row: number) {
  groupState.value?.removeRow(row)
}
</script>
