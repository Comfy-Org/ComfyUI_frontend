<template>
  <div
    ref="grid"
    data-testid="node-widgets"
    :inert="isEditingBlocked"
    class="lg-node-widgets grid grid-cols-[min-content_minmax(0,1fr)] gap-y-(--node-widget-gap) pr-3 text-xs text-node-foreground"
    :style="gridStyle"
    @focusout="captureWidgetChanges"
  >
    <div
      v-for="section in sections"
      :key="section.key"
      :role="section.role"
      :aria-label="section.label"
      class="col-span-full grid grid-cols-subgrid grid-rows-subgrid"
      :style="{ gridRow: `span ${section.rows.length}` }"
    >
      <template v-for="row in section.rows" :key="row.widget.renderKey">
        <div
          :data-testid="row.testId"
          :data-widget-name="row.widget.simplified.name"
          :class="
            cn(
              'group col-span-full grid grid-cols-subgrid items-stretch',
              row.showsControl && 'lg-node-widget'
            )
          "
        >
          <div :class="row.slotClass">
            <InputSlot
              v-if="row.slot"
              :key="`widget-slot-${row.widget.simplified.name}-${row.slot.index}`"
              :slot-data="{
                name: row.widget.simplified.name,
                label: row.widget.simplified.label,
                type: row.slot.type,
                boundingRect: [0, 0, 0, 0]
              }"
              :node-id
              :has-error="row.widget.hasError"
              :index="row.slot.index"
              :socketless="row.widget.simplified.spec?.socketless"
              :standalone="row.standalone"
              :dot-only="row.showsControl"
            />
          </div>
          <AppInput
            v-if="row.showsControl"
            :widget-id="row.widget.widgetId"
            :name="row.widget.simplified.name"
            :enable="row.selectable"
          >
            <Tooltip :disabled="!row.widget.tooltipText">
              <TooltipTrigger as-child>
                <div
                  data-testid="widget-control-shell"
                  :inert="row.readOnly"
                  :class="
                    cn(
                      'grid min-w-0 grid-cols-1',
                      row.rowSize === 'min-content' && 'self-center'
                    )
                  "
                >
                  <component
                    :is="row.widget.vueComponent"
                    :model-value="row.widget.simplified.value"
                    :widget="row.widget.simplified"
                    :node-id
                    :node-type
                    :node-title
                    :invalid="row.widget.hasError"
                    :aria-invalid="row.widget.hasError || undefined"
                    :class="
                      cn('col-span-full', row.widget.hasError && 'font-bold')
                    "
                    @update:model-value="row.widget.updateHandler"
                    @contextmenu="handleContextMenu($event, row.widget)"
                    @removed="restoreRowFocus"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">{{
                row.widget.tooltipText
              }}</TooltipContent>
            </Tooltip>
          </AppInput>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import AppInput from '@/renderer/extensions/linearMode/AppInput.vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { WidgetGridProps } from '@/renderer/extensions/vueNodes/composables/useWidgetGridModel'
import { useWidgetGridModel } from '@/renderer/extensions/vueNodes/composables/useWidgetGridModel'
import InputSlot from './InputSlot.vue'
const {
  processedWidgets,
  nodeType,
  canSelectInputs = false,
  nodeId,
  nodeTitle,
  syncLayout = true,
  presentation = 'node'
} = defineProps<WidgetGridProps>()
const grid = useTemplateRef<HTMLElement>('grid')
const {
  sections,
  gridStyle,
  captureWidgetChanges,
  handleContextMenu,
  restoreRowFocus,
  isEditingBlocked
} = useWidgetGridModel(
  () => ({
    processedWidgets,
    nodeType,
    canSelectInputs,
    nodeId,
    nodeTitle,
    syncLayout,
    presentation
  }),
  grid
)
</script>
