<template>
  <Popover
    ref="popoverRef"
    :auto-z-index="true"
    :base-z-index="1100"
    :dismissable="true"
    :close-on-escape="true"
    unstyled
    :pt="{
      root: {
        class: 'absolute z-60'
      },
      content: {
        class: [
          'text-base-foreground rounded-lg',
          'shadow-lg border border-base-background',
          'bg-interface-panel-surface'
        ]
      }
    }"
  >
    <div
      :class="
        isColorSubmenu
          ? 'flex flex-col gap-1 p-2'
          : 'flex min-w-40 flex-col p-2'
      "
    >
      <template v-for="subOption in option.submenu" :key="subOption.label">
        <div
          v-if="isPickerOption(subOption)"
          class="flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm"
        >
          <span class="flex-1">{{ subOption.label }}</span>
          <ColorPicker
            :model-value="subOption.pickerValue"
            format="hex"
            :aria-label="subOption.label"
            class="h-8 w-8 overflow-hidden rounded-md border border-border-default bg-secondary-background"
            :pt="{
              preview: {
                class: '!h-full !w-full !rounded-md !border-none'
              }
            }"
            @update:model-value="handleColorPickerUpdate(subOption, $event)"
          />
        </div>
        <div
          v-else
          :class="
            cn(
              'cursor-pointer rounded-sm hover:bg-secondary-background-hover',
              isColorSubmenu
                ? 'flex size-7 items-center justify-center'
                : 'flex items-center gap-2 px-3 py-1.5 text-sm',
              subOption.disabled
                ? 'pointer-events-none cursor-not-allowed text-node-icon-disabled'
                : 'hover:bg-secondary-background-hover'
            )
          "
          :title="subOption.label"
          @click="handleSubmenuClick(subOption)"
        >
          <div
            v-if="subOption.color"
            class="size-5 rounded-full border border-border-default"
            :style="{ backgroundColor: subOption.color }"
          />
          <template v-else-if="!subOption.color">
            <i
              v-if="isShapeSelected(subOption)"
              class="icon-[lucide--check] size-4 shrink-0"
            />
            <div v-else class="w-4 shrink-0" />
            <span>{{ subOption.label }}</span>
          </template>
        </div>
      </template>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import ColorPicker from 'primevue/colorpicker'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import type {
  MenuOption,
  SubMenuOption
} from '@/composables/graph/useMoreOptionsMenu'
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'

interface Props {
  option: MenuOption
}

interface Emits {
  (e: 'submenu-click', subOption: SubMenuOption): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { getCurrentShape } = useNodeCustomization()

const popoverRef = ref<InstanceType<typeof Popover>>()

const toggle = (event: Event, target?: HTMLElement) => {
  popoverRef.value?.toggle(event, target)
}
defineExpose({
  toggle
})

const handleSubmenuClick = (subOption: SubMenuOption) => {
  if (subOption.disabled) {
    return
  }
  emit('submenu-click', subOption)
  popoverRef.value?.hide()
}

const isPickerOption = (subOption: SubMenuOption): boolean =>
  typeof subOption.pickerValue === 'string' &&
  typeof subOption.onColorPick === 'function'

async function handleColorPickerUpdate(
  subOption: SubMenuOption,
  value: string
) {
  if (!isPickerOption(subOption) || !value) return

  await subOption.onColorPick?.(`#${value}`)
  if (typeof popoverRef.value?.hide === 'function') {
    popoverRef.value.hide()
  }
}

const isShapeSelected = (subOption: SubMenuOption): boolean => {
  if (subOption.color) return false

  const currentShape = getCurrentShape()
  if (!currentShape) return false

  return currentShape.localizedName === subOption.label
}

const isColorSubmenu = computed(() => {
  return (
    props.option.submenu &&
    props.option.submenu.length > 0 &&
    props.option.submenu.every((item) => item.color && !item.icon)
  )
})
</script>
