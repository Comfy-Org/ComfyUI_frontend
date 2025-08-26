<template>
  <Popover
    ref="popover"
    :append-to="'body'"
    :auto-z-index="true"
    :base-z-index="1100"
    :dismissable="true"
    :close-on-escape="true"
    unstyled
    :pt="submenuPt"
  >
    <!-- Use single column for colors, flex column for shapes -->
    <div
      :class="
        isColorSubmenu
          ? 'flex flex-col gap-1 p-2'
          : 'flex flex-col p-2 min-w-40'
      "
    >
      <div
        v-for="subOption in option.submenu"
        :key="subOption.label"
        :class="
          isColorSubmenu
            ? 'w-7 h-7 flex items-center justify-center hover:bg-gray-100 dark-theme:hover:bg-zinc-700 rounded cursor-pointer'
            : 'flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark-theme:hover:bg-zinc-700 rounded cursor-pointer'
        "
        :title="subOption.label"
        @click="handleSubmenuClick(subOption)"
      >
        <!-- Colors show as circles only -->
        <div
          v-if="subOption.color"
          class="w-5 h-5 rounded-full border border-gray-300 dark-theme:border-zinc-600"
          :style="{ backgroundColor: subOption.color }"
        />
        <!-- Shapes show text with checkmark if selected -->
        <template v-else-if="!subOption.color">
          <ILucideCheck
            v-if="isShapeSelected(subOption)"
            :size="16"
            class="flex-shrink-0"
          />
          <div v-else class="w-4 flex-shrink-0" />
          <span>{{ subOption.label }}</span>
        </template>
      </div>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'
import ILucideCheck from '~icons/lucide/check'

import {
  type MenuOption,
  type SubMenuOption,
  toPascalCase
} from '@/composables/graph/useMoreOptionsMenu'
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'

interface Props {
  option: MenuOption
  containerStyles: {
    width: string
    height: string
    backgroundColor: string
    border: string
    borderRadius: string
  }
}

interface Emits {
  (e: 'submenu-click', subOption: SubMenuOption): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Get current shape to check selection
const { getCurrentShape } = useNodeCustomization()

// Expose popover ref and methods
const popover = ref<InstanceType<typeof Popover>>()

const show = (event: Event, target?: HTMLElement) => {
  popover.value?.show(event, target)
}

const hide = () => {
  popover.value?.hide()
}

defineExpose({
  show,
  hide
})

const handleSubmenuClick = (subOption: SubMenuOption) => {
  emit('submenu-click', subOption)
}

// Check if a shape option is currently selected
const isShapeSelected = (subOption: SubMenuOption): boolean => {
  if (subOption.color) return false // Colors don't have selection state

  const currentShape = getCurrentShape()
  if (!currentShape) return false

  // Compare using Pascal case for consistency with label generation
  const shapeName =
    currentShape.name === 'default' ? 'Default' : currentShape.name
  return toPascalCase(shapeName) === subOption.label
}

// Check if this is a color submenu (all items have colors, no icons)
const isColorSubmenu = computed(() => {
  return (
    props.option.submenu &&
    props.option.submenu.length > 0 &&
    props.option.submenu.every((item) => item.color && !item.icon)
  )
})

const submenuPt = computed(() => ({
  root: {
    class: 'absolute z-[60]'
  },
  content: {
    class: [
      'text-neutral dark-theme:text-white rounded-lg',
      'shadow-lg border border-zinc-200 dark-theme:border-zinc-700'
    ],
    style: {
      backgroundColor: props.containerStyles.backgroundColor
    }
  }
}))
</script>
