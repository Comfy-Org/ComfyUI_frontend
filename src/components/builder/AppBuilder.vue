<script setup lang="ts">
import { remove } from 'es-toolkit'
import { computed, ref, toValue } from 'vue'
import type { MaybeRef } from 'vue'
import { useI18n } from 'vue-i18n'

import AppModeWidgetList from '@/components/builder/AppModeWidgetList.vue'
import DraggableList from '@/components/common/DraggableList.vue'
import IoItem from '@/components/builder/IoItem.vue'
import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import {
  LGraphEventMode,
  TitleMode
} from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import TransformPane from '@/renderer/core/layout/transform/TransformPane.vue'
import { app } from '@/scripts/app'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import { renameWidget } from '@/utils/widgetUtil'
import { useAppMode } from '@/composables/useAppMode'
import { nodeTypeValidForApp, useAppModeStore } from '@/stores/appModeStore'
import { resolveNodeWidget } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'

type BoundStyle = { top: string; left: string; width: string; height: string }

const appModeStore = useAppModeStore()
const canvasInteractions = useCanvasInteractions()
const canvasStore = useCanvasStore()
const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()
const { t } = useI18n()
const canvas: LGraphCanvas = canvasStore.getCanvas()

const { isSelectMode, isSelectInputsMode, isSelectOutputsMode, isArrangeMode } =
  useAppMode()
const hoveringSelectable = ref(false)

workflowStore.activeWorkflow?.changeTracker?.reset()

const inputsWithState = computed(() =>
  appModeStore.selectedInputs.map(([nodeId, widgetName]) => {
    const [node, widget] = resolveNodeWidget(nodeId, widgetName)
    if (!node || !widget) {
      return {
        nodeId,
        widgetName,
        subLabel: t('linearMode.builder.unknownWidget')
      }
    }

    return {
      nodeId,
      widgetName,
      label: widget.label,
      subLabel: node.title,
      canRename: true
    }
  })
)
const outputsWithState = computed<[NodeId, string][]>(() =>
  appModeStore.selectedOutputs.map((nodeId) => [
    nodeId,
    app.rootGraph.getNodeById(nodeId)?.title ?? String(nodeId)
  ])
)

function inlineRenameInput(
  nodeId: NodeId,
  widgetName: string,
  newLabel: string
) {
  const [node, widget] = resolveNodeWidget(nodeId, widgetName)
  if (!node || !widget) return
  renameWidget(widget, node, newLabel)
}

function getHovered(
  e: MouseEvent
): undefined | [LGraphNode, undefined] | [LGraphNode, IBaseWidget] {
  const { graph } = canvas
  if (!canvas || !graph) return

  if (settingStore.get('Comfy.VueNodes.Enabled')) return undefined
  if (!e) return

  canvas.adjustMouseEvent(e)
  const node = graph.getNodeOnPos(e.canvasX, e.canvasY)
  if (!node) return

  const widget = node.getWidgetOnPos(e.canvasX, e.canvasY, false)

  if (widget || node.constructor.nodeData?.output_node) return [node, widget]
}

function getBounding(nodeId: NodeId, widgetName?: string) {
  if (settingStore.get('Comfy.VueNodes.Enabled')) return undefined
  const [node, widget] = resolveNodeWidget(nodeId, widgetName)
  if (!node) return

  const titleOffset =
    node.title_mode === TitleMode.NORMAL_TITLE ? LiteGraph.NODE_TITLE_HEIGHT : 0

  if (!widgetName)
    return {
      width: `${node.size[0]}px`,
      height: `${node.size[1] + titleOffset}px`,
      left: `${node.pos[0]}px`,
      top: `${node.pos[1] - titleOffset}px`
    }
  if (!widget) return

  const margin = widget instanceof DOMWidgetImpl ? widget.margin : undefined
  const marginX = margin ?? BaseWidget.margin
  const height =
    (widget.computedHeight !== undefined
      ? widget.computedHeight - 4
      : LiteGraph.NODE_WIDGET_HEIGHT) - (margin ? 2 * margin - 4 : 0)
  return {
    width: `${node.size[0] - marginX * 2}px`,
    height: `${height}px`,
    left: `${node.pos[0] + marginX}px`,
    top: `${node.pos[1] + widget.y + (margin ?? 0)}px`
  }
}

function handleDown(e: MouseEvent) {
  const [node] = getHovered(e) ?? []
  if (!node || e.button > 0) canvasInteractions.forwardEventToCanvas(e)
}
function handleClick(e: MouseEvent) {
  const [node, widget] = getHovered(e) ?? []
  if (
    node?.mode !== LGraphEventMode.ALWAYS ||
    !nodeTypeValidForApp(node.type) ||
    node.has_errors
  )
    return canvasInteractions.forwardEventToCanvas(e)

  if (!widget) {
    if (!isSelectOutputsMode.value) return
    if (!node.constructor.nodeData?.output_node)
      return canvasInteractions.forwardEventToCanvas(e)
    const index = appModeStore.selectedOutputs.findIndex((id) => id == node.id)
    if (index === -1) appModeStore.selectedOutputs.push(node.id)
    else appModeStore.selectedOutputs.splice(index, 1)
    return
  }
  if (!isSelectInputsMode.value || widget.options.canvasOnly) return

  const storeId = isPromotedWidgetView(widget) ? widget.sourceNodeId : node.id
  const storeName = isPromotedWidgetView(widget)
    ? widget.sourceWidgetName
    : widget.name
  const index = appModeStore.selectedInputs.findIndex(
    ([nodeId, widgetName]) => storeId == nodeId && storeName === widgetName
  )
  if (index === -1) appModeStore.selectedInputs.push([storeId, storeName])
  else appModeStore.selectedInputs.splice(index, 1)
}

function nodeToDisplayTuple(
  n: LGraphNode
): [NodeId, MaybeRef<BoundStyle> | undefined, boolean] {
  return [
    n.id,
    getBounding(n.id),
    appModeStore.selectedOutputs.some((id) => n.id === id)
  ]
}

const renderedOutputs = computed(() => {
  void appModeStore.selectedOutputs.length
  return canvas
    .graph!.nodes.filter(
      (n) =>
        n.constructor.nodeData?.output_node &&
        n.mode === LGraphEventMode.ALWAYS &&
        !n.has_errors
    )
    .map(nodeToDisplayTuple)
})
const renderedInputs = computed<[string, MaybeRef<BoundStyle> | undefined][]>(
  () =>
    appModeStore.selectedInputs.map(([nodeId, widgetName]) => [
      `${nodeId}: ${widgetName}`,
      getBounding(nodeId, widgetName)
    ])
)
</script>
<template>
  <div class="flex h-full flex-col">
    <div
      class="flex h-12 items-center border-b border-border-subtle px-4 font-bold"
    >
      {{
        isArrangeMode ? t('nodeHelpPage.inputs') : t('linearMode.builder.title')
      }}
    </div>
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <DraggableList
        v-if="isArrangeMode"
        v-model="appModeStore.selectedInputs"
        class="overflow-x-clip"
      >
        <AppModeWidgetList builder-mode />
      </DraggableList>
      <PropertiesAccordionItem
        v-if="isSelectInputsMode"
        :label="t('nodeHelpPage.inputs')"
        enable-empty-state
        :disabled="!appModeStore.selectedInputs.length"
        :tooltip="`${t('linearMode.builder.inputsDesc')}\n${t('linearMode.builder.inputsExample')}`"
        :tooltip-delay="100"
      >
        <template #label>
          <div class="flex gap-3">
            {{ t('nodeHelpPage.inputs') }}
            <i class="icon-[lucide--info] bg-muted-foreground" />
          </div>
        </template>
        <template #empty>
          <div
            class="p-4 text-muted-foreground"
            v-text="t('linearMode.builder.promptAddInputs')"
          />
        </template>
        <DraggableList
          v-slot="{ dragClass }"
          v-model="appModeStore.selectedInputs"
        >
          <IoItem
            v-for="{
              nodeId,
              widgetName,
              label,
              subLabel,
              canRename
            } in inputsWithState"
            :key="`${nodeId}: ${widgetName}`"
            :class="
              cn(dragClass, 'my-2 rounded-lg bg-primary-background/30 p-2')
            "
            :title="label ?? widgetName"
            :sub-title="subLabel"
            :can-rename="canRename"
            :remove="
              () =>
                remove(
                  appModeStore.selectedInputs,
                  ([id, name]) => nodeId == id && widgetName === name
                )
            "
            @rename="inlineRenameInput(nodeId, widgetName, $event)"
          />
        </DraggableList>
      </PropertiesAccordionItem>
      <!-- Presets toggle — listed alongside inputs -->
      <div
        v-if="isSelectInputsMode"
        :class="
          cn(
            'my-2 flex items-center gap-2 rounded-lg p-2',
            appModeStore.presetsEnabled
              ? 'bg-primary-background/30'
              : 'bg-primary-background/10 opacity-50'
          )
        "
      >
        <i class="icon-[lucide--layers] size-4 shrink-0" />
        <span class="flex-1 truncate text-sm">
          {{ t('linearMode.presets.label') }}
        </span>
        <button
          class="flex size-6 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground hover:text-base-foreground"
          @click="
            () => {
              appModeStore.presetsEnabled = !appModeStore.presetsEnabled
              appModeStore.persistLinearData()
            }
          "
        >
          <i
            :class="
              appModeStore.presetsEnabled
                ? 'icon-[lucide--eye]'
                : 'icon-[lucide--eye-off]'
            "
            class="size-4"
          />
        </button>
      </div>
      <div
        v-if="isSelectInputsMode && !appModeStore.selectedInputs.length"
        class="m-4 flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-primary-background bg-primary-background/20 text-center text-sm text-primary-background"
      >
        {{ t('linearMode.builder.inputPlaceholder') }}
      </div>
      <PropertiesAccordionItem
        v-if="isSelectOutputsMode"
        :label="t('nodeHelpPage.outputs')"
        enable-empty-state
        :disabled="!appModeStore.selectedOutputs.length"
        :tooltip="`${t('linearMode.builder.outputsDesc')}\n${t('linearMode.builder.outputsExample')}`"
        :tooltip-delay="100"
      >
        <template #label>
          <div class="flex gap-3">
            {{ t('nodeHelpPage.outputs') }}
            <i class="icon-[lucide--info] bg-muted-foreground" />
          </div>
        </template>
        <template #empty>
          <div
            class="p-4 text-muted-foreground"
            v-text="t('linearMode.builder.promptAddOutputs')"
          />
        </template>
        <DraggableList
          v-slot="{ dragClass }"
          v-model="appModeStore.selectedOutputs"
        >
          <IoItem
            v-for="([key, title], index) in outputsWithState"
            :key
            :class="
              cn(
                dragClass,
                'my-2 rounded-lg bg-warning-background/40 p-2',
                index === 0 && 'ring-2 ring-warning-background'
              )
            "
            :title
            :sub-title="String(key)"
            :remove="
              () => remove(appModeStore.selectedOutputs, (k) => k == key)
            "
          />
        </DraggableList>
      </PropertiesAccordionItem>
      <div
        v-if="isSelectOutputsMode && !appModeStore.selectedOutputs.length"
        class="m-4 flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-warning-background bg-warning-background/20 text-center text-sm text-warning-background"
      >
        {{ t('linearMode.builder.outputPlaceholder') }}
        <span class="font-bold">
          {{ t('linearMode.builder.outputRequiredPlaceholder') }}
        </span>
      </div>
    </div>
  </div>

  <Teleport
    v-if="isSelectMode && !settingStore.get('Comfy.VueNodes.Enabled')"
    to="body"
  >
    <div
      :class="
        cn(
          'pointer-events-auto absolute size-full',
          hoveringSelectable ? 'cursor-pointer' : 'cursor-grab'
        )
      "
      @pointerdown="handleDown"
      @pointermove="hoveringSelectable = !!getHovered($event)"
      @click="handleClick"
      @wheel="canvasInteractions.forwardEventToCanvas"
    >
      <TransformPane :canvas="canvasStore.getCanvas()">
        <template v-if="isSelectInputsMode">
          <div
            v-for="[key, style] in renderedInputs"
            :key
            :style="toValue(style)"
            class="fixed rounded-lg bg-primary-background/30"
          />
        </template>
        <template v-else>
          <div
            v-for="[key, style, isSelected] in renderedOutputs"
            :key
            :style="toValue(style)"
            :class="
              cn(
                'fixed rounded-2xl ring-5 ring-warning-background',
                !isSelected && 'ring-warning-background/50'
              )
            "
          >
            <div class="absolute top-0 right-0 size-8">
              <div
                v-if="isSelected"
                class="pointer-events-auto absolute -top-1/2 -right-1/2 size-full cursor-pointer rounded-lg bg-warning-background p-2"
                @click.stop="
                  remove(appModeStore.selectedOutputs, (k) => k == key)
                "
                @pointerdown.stop
              >
                <i class="bg-text-foreground icon-[lucide--check] size-full" />
              </div>
              <div
                v-else
                class="pointer-events-auto absolute -top-1/2 -right-1/2 size-full cursor-pointer rounded-lg bg-component-node-background ring-4 ring-warning-background/50 ring-inset"
                @click.stop="appModeStore.selectedOutputs.push(key)"
                @pointerdown.stop
              />
            </div>
          </div>
        </template>
      </TransformPane>
    </div>
  </Teleport>
</template>
