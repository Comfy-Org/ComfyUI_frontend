<template>
  <div
    v-if="isVisible"
    ref="popoverRef"
    class="fixed z-[1100] rounded-lg shadow-lg border border-base-background bg-interface-panel-surface text-base-foreground"
    :style="popoverStyle"
  >
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
          cn(
            'hover:bg-secondary-background-hover rounded cursor-pointer',
            isColorSubmenu
              ? 'w-7 h-7 flex items-center justify-center'
              : 'flex items-center gap-2 px-3 py-1.5 text-sm',
            subOption.disabled
              ? 'cursor-not-allowed pointer-events-none text-node-icon-disabled'
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
            class="icon-[lucide--check] size-4 flex-shrink-0"
          />
          <div v-else class="w-4 flex-shrink-0" />
          <span>{{ subOption.label }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { onClickOutside } from '@vueuse/core'
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

const popoverRef = ref<HTMLElement>()
const isVisible = ref(false)
const position = ref({ top: 0, left: 0 })
let justOpened = false

const popoverStyle = computed(() => ({
  top: `${position.value.top}px`,
  left: `${position.value.left}px`
}))

const showToRight = (target: HTMLElement) => {
  const rect = target.getBoundingClientRect()
  position.value = {
    top: rect.top,
    left: rect.right + 4
  }
  isVisible.value = true
  justOpened = true
  setTimeout(() => {
    justOpened = false
  }, 0)
}

const hide = () => {
  isVisible.value = false
}

const toggle = (target: HTMLElement) => {
  if (isVisible.value) {
    hide()
  } else {
    showToRight(target)
  }
}

// Ignore clicks on context menu elements to prevent immediate close
onClickOutside(
  popoverRef,
  () => {
    if (justOpened) {
      justOpened = false
      return
    }
    hide()
  },
  { ignore: ['.p-contextmenu', '.p-contextmenu-item-link'] }
)

defineExpose({
  showToRight,
  hide,
  toggle
})

const handleSubmenuClick = (subOption: SubMenuOption) => {
  if (subOption.disabled) {
    return
  }
  emit('submenu-click', subOption)
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
