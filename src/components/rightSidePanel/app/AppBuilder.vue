<script setup lang="ts">
import { remove } from 'es-toolkit'
import { useElementBounding, whenever } from '@vueuse/core'
import { computed, reactive, toValue } from 'vue'
import type { MaybeRef } from 'vue'
import { useI18n } from 'vue-i18n'

import DraggableList from '@/components/common/DraggableList.vue'
import IoItem from '@/components/rightSidePanel/app/IoItem.vue'
import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import Button from '@/components/ui/button/Button.vue'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import TransformPane from '@/renderer/core/layout/transform/TransformPane.vue'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { useHoveredStore } from '@/stores/hoveredStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { cn } from '@/utils/tailwindUtil'

type BoundStyle = { top: string; left: string; width: string; height: string }

const canvasInteractions = useCanvasInteractions()
const canvasStore = useCanvasStore()
const hoveredStore = useHoveredStore()
const rightSidePanelStore = useRightSidePanelStore()
const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()
const { t } = useI18n()
const canvas: LGraphCanvas = canvasStore.getCanvas()

const selectedInputs = reactive<[NodeId, string][]>([])
const selectedOutputs = reactive<NodeId[]>([])
const inputsWithState = computed(() =>
  selectedInputs.map(([nodeId, widgetName]) => {
    const node = app.rootGraph.getNodeById(nodeId)
    const widget = node?.widgets?.find((w) => w.name === widgetName)
    if (!node || !widget) return { nodeId, widgetName }

    const input = node.inputs.find((i) => i.widget?.name === widget.name)
    const rename = input && (() => renameWidget(widget, input))

    return {
      nodeId,
      widgetName,
      label: widget.label,
      subLabel: node.title,
      rename
    }
  })
)
const outputsWithState = computed<[NodeId, string][]>(() =>
  selectedOutputs.map((nodeId) => [
    nodeId,
    app.rootGraph.getNodeById(nodeId)?.title ?? String(nodeId)
  ])
)

whenever(
  () => workflowStore.activeWorkflow,
  (workflow) => {
    workflow.changeTracker.reset()

    const { activeState } = workflow.changeTracker
    const newInputs = activeState.extra?.linearData?.inputs ?? []
    selectedInputs.splice(0, selectedInputs.length, ...newInputs)
    const newOutputs = activeState.extra?.linearData?.outputs ?? []
    selectedOutputs.splice(0, selectedOutputs.length, ...newOutputs)
  }
)

async function renameWidget(widget: IBaseWidget, input: INodeInputSlot) {
  const newLabel = await useDialogService().prompt({
    title: t('g.rename'),
    message: t('g.enterNewNamePrompt'),
    defaultValue: widget.label,
    placeholder: widget.name
  })
  if (newLabel === null) return
  widget.label = newLabel || undefined
  input.label = newLabel || undefined
  widget.callback?.(widget.value)
  useCanvasStore().canvas?.setDirty(true)
}

function getHovered(
  e?: MouseEvent
): undefined | [LGraphNode, undefined] | [LGraphNode, IBaseWidget] {
  const { graph } = canvas
  if (!canvas || !graph) return

  if (settingStore.get('Comfy.VueNodes.Enabled')) {
    const node = graph.getNodeById(hoveredStore.hoveredNodeId)
    if (!node) return

    const widget = node.widgets?.find(
      (w) => w.name === hoveredStore.hoveredWidgetName
    )
    return [node, widget]
  }
  if (!e) return

  canvas.adjustMouseEvent(e)
  const node = graph.getNodeOnPos(e.canvasX, e.canvasY)
  if (!node) return

  return [node, node.getWidgetOnPos(e.canvasX, e.canvasY, false)]
}

function elementPosition(e: HTMLElement, mleft: number = 0) {
  const bounding = useElementBounding(e)
  return computed(() => ({
    width: `${bounding.width.value / canvas.ds.scale - mleft}px`,
    height: `${bounding.height.value / canvas.ds.scale}px`,
    left: `${bounding.left.value / canvas.ds.scale - canvas.ds.offset[0] + mleft}px`,
    top: `${bounding.top.value / canvas.ds.scale - canvas.ds.offset[1]}px`
  }))
}
function getBounding(nodeId: NodeId, widgetName?: string) {
  if (settingStore.get('Comfy.VueNodes.Enabled')) {
    const element = document.querySelector(
      widgetName
        ? `[data-node-id="${nodeId}"] [data-widget-name="${widgetName}"`
        : `[data-node-id="${nodeId}"]`
    )
    const mleft = widgetName ? 12 : 0
    return element instanceof HTMLElement
      ? elementPosition(element, mleft)
      : undefined
  }
  const node = app.rootGraph.getNodeById(nodeId)
  if (!node) return

  if (!widgetName)
    return {
      width: `${node.size[0]}px`,
      height: `${node.size[1] + 30}px`,
      left: `${node.pos[0]}px`,
      top: `${node.pos[1] - 30}px`
    }
  const widget = node.widgets?.find((w) => w.name === widgetName)
  if (!widget) return

  return {
    width: `${node.size[0] - 30}px`,
    height: `${(widget.computedHeight ?? 24) - 4}px`,
    left: `${node.pos[0] + 15}px`,
    top: `${node.pos[1] + widget.y}px`
  }
}

function handleDown(e: MouseEvent) {
  const [node] = getHovered(e) ?? []
  if (!node || e.button > 0) canvasInteractions.forwardEventToCanvas(e)
}
function handleClick(e: MouseEvent) {
  const [node, widget] = getHovered(e) ?? []
  if (!node) return canvasInteractions.forwardEventToCanvas(e)

  if (!widget) {
    if (!node.constructor.nodeData?.output_node)
      return canvasInteractions.forwardEventToCanvas(e)
    const index = selectedOutputs.findIndex((id) => id === node.id)
    if (index === -1) selectedOutputs.push(node.id)
    else selectedOutputs.splice(index, 1)
    app.rootGraph.extra.linearData ??= {}
    //FIXME type here is only on ComfyWorkflowJson, not an active graph
    ;(app.rootGraph.extra.linearData! as { outputs?: unknown }).outputs = [
      ...selectedOutputs
    ]
    return
  }

  const index = selectedInputs.findIndex(
    ([nodeId, widgetName]) => node.id === nodeId && widget.name === widgetName
  )
  if (index === -1) selectedInputs.push([node.id, widget.name])
  else selectedInputs.splice(index, 1)

  app.rootGraph.extra.linearData ??= {}
  ;(app.rootGraph.extra.linearData! as { inputs?: unknown }).inputs = [
    ...selectedInputs
  ]
}

function nodeToDisplayTuple(
  n: LGraphNode
): [NodeId, MaybeRef<BoundStyle> | undefined, boolean] {
  return [n.id, getBounding(n.id), selectedOutputs.some((id) => n.id === id)]
}

const renderedOutputs = computed(() => {
  void workflowStore.activeWorkflow
  return canvas
    .graph!.nodes.filter((n) => n.constructor.nodeData?.output_node)
    .map(nodeToDisplayTuple)
})
const renderedInputs = computed<[string, MaybeRef<BoundStyle> | undefined][]>(
  () =>
    selectedInputs.map(([nodeId, widgetName]) => [
      `${nodeId}: ${widgetName}`,
      getBounding(nodeId, widgetName)
    ])
)
</script>
<template>
  <div class="flex font-bold p-2 border-border-subtle border-b items-center">
    {{ t('linearMode.builder.title') }}
    <Button class="ml-auto" @click="rightSidePanelStore.inAppBuilder = false">
      {{ t('linearMode.builder.exit') }}
    </Button>
  </div>
  <PropertiesAccordionItem
    :label="t('nodeHelpPage.inputs')"
    enable-empty-state
    :disabled="!selectedInputs.length"
    class="border-border-subtle border-b"
  >
    <template #empty>
      <div class="w-full p-4 text-muted-foreground gap-2 flex flex-col">
        <div v-text="t('linearMode.builder.promptAddInputs')" />
        <div
          class="text-base-foreground"
          v-text="t('linearMode.builder.noInputs')"
        />
        <div v-text="t('linearMode.builder.inputsDesc')" />
        <div v-text="t('linearMode.builder.inputsExample')" />
      </div>
    </template>
    <div
      class="w-full p-4 pt-2 text-muted-foreground"
      v-text="t('linearMode.builder.promptAddInputs')"
    />
    <DraggableList v-slot="{ dragClass }" v-model="selectedInputs">
      <IoItem
        v-for="{
          nodeId,
          widgetName,
          label,
          subLabel,
          rename
        } in inputsWithState"
        :key="`${nodeId}: ${widgetName}`"
        :class="cn(dragClass, 'bg-primary-background/30 p-2 my-2 rounded-lg')"
        :title="label ?? widgetName"
        :sub-title="subLabel"
        :rename
        :remove="
          () =>
            remove(
              selectedInputs,
              ([id, name]) => nodeId === id && widgetName === name
            )
        "
      />
    </DraggableList>
  </PropertiesAccordionItem>
  <PropertiesAccordionItem
    :label="t('nodeHelpPage.outputs')"
    enable-empty-state
    :disabled="!selectedOutputs.length"
  >
    <template #empty>
      <div class="w-full p-4 text-muted-foreground gap-2 flex flex-col">
        <div v-text="t('linearMode.builder.promptAddOutputs')" />
        <div
          class="text-base-foreground"
          v-text="t('linearMode.builder.noOutputs')"
        />
        <div v-text="t('linearMode.builder.outputsDesc')" />
        <div v-text="t('linearMode.builder.outputsExample')" />
      </div>
    </template>
    <div
      class="w-full p-4 pt-2 text-muted-foreground"
      v-text="t('linearMode.builder.promptAddOutputs')"
    />
    <DraggableList v-slot="{ dragClass }" v-model="selectedOutputs">
      <IoItem
        v-for="([key, title], index) in outputsWithState"
        :key
        :class="
          cn(
            dragClass,
            'bg-warning-background/40 p-2 my-2 rounded-lg',
            index === 0 && 'ring-warning-background ring-2'
          )
        "
        :title
        :sub-title="String(key)"
        :remove="() => remove(selectedOutputs, (k) => k === key)"
      />
    </DraggableList>
  </PropertiesAccordionItem>

  <Teleport to="body">
    <TransformPane
      :class="
        cn(
          'absolute w-full h-full pointer-events-auto!',
          getHovered() ? 'cursor-pointer' : 'cursor-grab'
        )
      "
      :canvas="canvasStore.getCanvas()"
      @pointerdown="handleDown"
      @click="handleClick"
      @wheel="canvasInteractions.forwardEventToCanvas"
    >
      <div
        v-for="[key, style] in renderedInputs"
        :key
        :style="toValue(style)"
        class="fixed bg-primary-background/30 rounded-lg"
      />
      <div
        v-for="[key, style, isSelected] in renderedOutputs"
        :key
        :style="toValue(style)"
        :class="
          cn(
            'fixed ring-warning-background ring-5 rounded-2xl',
            !isSelected && 'ring-warning-background/50'
          )
        "
      >
        <div class="absolute top-0 right-0 size-8">
          <div
            v-if="isSelected"
            class="absolute -top-1/2 -right-1/2 size-full p-2 bg-warning-background rounded-lg"
          >
            <i class="icon-[lucide--check] bg-text-foreground size-full" />
          </div>
          <div
            v-else
            class="absolute -top-1/2 -right-1/2 size-full ring-warning-background/50 ring-4 ring-inset bg-component-node-background rounded-lg"
          />
        </div>
      </div>
    </TransformPane>
  </Teleport>
</template>
