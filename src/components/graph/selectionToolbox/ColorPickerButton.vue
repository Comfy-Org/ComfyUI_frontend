<template>
  <div class="relative">
    <Button
      v-tooltip.top="{
        value: localizedCurrentColorName ?? t('color.noColor'),
        showDelay: 1000
      }"
      data-testid="color-picker-button"
      variant="muted-textonly"
      :aria-label="t('g.color')"
      @click="() => (showColorPicker = !showColorPicker)"
    >
      <div class="flex items-center gap-1 px-0">
        <i class="pi pi-circle-fill" :style="{ color: currentColor ?? '' }" />
        <i class="icon-[lucide--chevron-down]" />
      </div>
    </Button>
    <div
      v-if="showColorPicker"
      class="color-picker-container absolute -top-10 left-1/2"
    >
      <SelectButton
        :model-value="selectedColorOption"
        :options="colorOptions"
        option-label="name"
        data-key="value"
        @update:model-value="applyColor"
      >
        <template #option="{ option }">
          <i
            v-tooltip.top="
              typeof option.localizedName === 'function'
                ? option.localizedName()
                : option.localizedName
            "
            class="pi pi-circle-fill"
            :style="{
              color: isLightTheme ? option.value.light : option.value.dark
            }"
            :data-testid="option.name"
          />
        </template>
      </SelectButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import type { Raw } from 'vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { NodeColorOption } from '@/composables/graph/useNodeColorOptions'
import { useNodeColorOptions } from '@/composables/graph/useNodeColorOptions'
import type { IColorable } from '@/lib/litegraph/src/interfaces'
import type {
  ColorOption as CanvasColorOption,
  Positionable
} from '@/lib/litegraph/src/litegraph'
import { isColorable } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { getItemsColorOption } from '@/utils/litegraphUtil'

const { t } = useI18n()
const canvasStore = useCanvasStore()
const workflowStore = useWorkflowStore()

const { colorOptions, NO_COLOR_OPTION, applyColorToItems, isLightTheme } =
  useNodeColorOptions()

const showColorPicker = ref(false)

const selectedColorOption = ref<NodeColorOption | null>(null)
const applyColor = (colorOption: NodeColorOption | null) => {
  const colorName = colorOption?.name ?? NO_COLOR_OPTION.value.name

  const colorableItems = canvasStore.selectedItems
    .filter(isColorable)
    .map((item) => item as unknown as IColorable)
  applyColorToItems(colorableItems, colorName)

  canvasStore.canvas?.setDirty(true, true)
  currentColorOption.value = getItemsColorOption(canvasStore.selectedItems)
  showColorPicker.value = false
  workflowStore.activeWorkflow?.changeTracker.checkState()
}

const currentColorOption = ref<CanvasColorOption | null>(null)
const currentColor = computed(() =>
  currentColorOption.value
    ? isLightTheme.value
      ? colorOptions.value.find(
          (option: NodeColorOption) =>
            option.value.dark === currentColorOption.value?.bgcolor
        )?.value.light
      : currentColorOption.value?.bgcolor
    : null
)

const localizedCurrentColorName = computed(() => {
  if (!currentColorOption.value?.bgcolor) return null
  const colorOption = colorOptions.value.find(
    (option: NodeColorOption) =>
      option.value.dark === currentColorOption.value?.bgcolor ||
      option.value.light === currentColorOption.value?.bgcolor
  )
  const name = colorOption?.localizedName ?? NO_COLOR_OPTION.value.localizedName
  return typeof name === 'function' ? name() : name
})

const updateColorSelectionFromNode = (
  newSelectedItems: Raw<Positionable[]>
) => {
  showColorPicker.value = false
  selectedColorOption.value = null
  currentColorOption.value = getItemsColorOption(newSelectedItems)
}

watch(
  () => canvasStore.selectedItems,
  (newSelectedItems) => {
    updateColorSelectionFromNode(newSelectedItems)
  },
  { immediate: true }
)
</script>

<style scoped>
@reference '../../../assets/css/style.css';

.color-picker-container {
  transform: translateX(-50%);
}

:deep(.p-togglebutton) {
  @apply py-2 px-1;
}
</style>
