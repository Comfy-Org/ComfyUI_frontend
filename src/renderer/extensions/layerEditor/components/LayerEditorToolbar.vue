<template>
  <div
    class="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border-default bg-base-background p-1 shadow-lg"
  >
    <ToggleGroup
      type="single"
      :model-value="pointerMode"
      @update:model-value="onPointerModeChange"
    >
      <ToggleGroupItem
        value="pointer"
        class="size-8 flex-none rounded-full p-0"
        :title="t('layerEditor.selectTool')"
        :aria-label="t('layerEditor.selectTool')"
      >
        <i class="icon-[lucide--mouse-pointer-2] size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="hand"
        class="size-8 flex-none rounded-full p-0"
        :title="t('layerEditor.handTool')"
        :aria-label="t('layerEditor.handTool')"
      >
        <i class="icon-[lucide--hand] size-4" />
      </ToggleGroupItem>
    </ToggleGroup>

    <Popover v-model:open="zoomOpen">
      <PopoverTrigger as-child>
        <button
          :class="
            cn(
              'flex h-8 cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-2 text-xs text-base-foreground transition-colors',
              'hover:bg-secondary-background-hover'
            )
          "
          :title="t('layerEditor.zoom')"
          :aria-label="t('layerEditor.zoom')"
        >
          <span class="min-w-8 text-center">{{ zoomPercent }}</span>
          <i class="icon-[lucide--chevron-down] size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        :side-offset="8"
        class="z-1700 flex w-auto min-w-20 flex-col border-border-default p-1"
        :style="zoomContentStyle"
      >
        <button
          v-for="item in zoomItems"
          :key="item.label"
          :class="zoomItemClass"
          @click="applyZoom(item.ratio)"
        >
          {{ item.label }}
        </button>
        <button :class="zoomItemClass" @click="applyZoom(null)">
          {{ t('layerEditor.fitView') }}
        </button>
      </PopoverContent>
    </Popover>

    <button
      :class="toolButtonClass(false)"
      :disabled="!canUndo"
      :title="t('layerEditor.undo')"
      :aria-label="t('layerEditor.undo')"
      @click="session.undo()"
    >
      <i class="icon-[lucide--undo-2] size-4" />
    </button>
    <button
      :class="toolButtonClass(false)"
      :disabled="!canRedo"
      :title="t('layerEditor.redo')"
      :aria-label="t('layerEditor.redo')"
      @click="session.redo()"
    >
      <i class="icon-[lucide--redo-2] size-4" />
    </button>
    <button
      :class="toolButtonClass(false)"
      :disabled="exporting"
      :title="t('layerEditor.exportPsd')"
      :aria-label="t('layerEditor.exportPsd')"
      @click="onExportPsd"
    >
      <i class="icon-[lucide--file-down] size-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import { PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import { useLayerEditorExport } from '@/renderer/extensions/layerEditor/composables/useLayerEditorExport'
import type { LayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { cn } from '@comfyorg/tailwind-utils'

const { session } = defineProps<{ session: LayerEditorSession }>()

const { t } = useI18n()
const { pointerMode, canUndo, canRedo, zoomRatio } = session
const { exporting, exportPsd } = useLayerEditorExport(session)

const zoomOpen = ref(false)
const zoomContentStyle = useModalLiftedZIndex(zoomOpen)

const zoomItems = [
  { label: '25%', ratio: 0.25 },
  { label: '50%', ratio: 0.5 },
  { label: '100%', ratio: 1 },
  { label: '200%', ratio: 2 }
]

const zoomItemClass =
  'cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-left text-xs text-base-foreground hover:bg-secondary-background-hover'

function onPointerModeChange(value: AcceptableValue | AcceptableValue[]): void {
  if (value === 'pointer' || value === 'hand') session.setPointerMode(value)
}

function applyZoom(ratio: number | null): void {
  if (ratio == null) session.fitView()
  else session.setZoom(ratio)
  zoomOpen.value = false
}

function onExportPsd(): void {
  void exportPsd()
}

const zoomPercent = computed(() => `${Math.round(zoomRatio.value * 100)}%`)

function toolButtonClass(active: boolean): string {
  return cn(
    'flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-base-foreground transition-colors',
    'hover:bg-secondary-background-hover disabled:cursor-default disabled:opacity-40',
    active && 'bg-secondary-background-selected'
  )
}
</script>
