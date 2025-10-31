<template>
  <Popover
    ref="popover"
    :auto-z-index="true"
    :base-z-index="1100"
    :dismissable="true"
    :close-on-escape="true"
    unstyled
    :pt="submenuPt"
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
          isColorSubmenu
            ? 'w-7 h-7 flex items-center justify-center hover:bg-smoke-100 dark-theme:hover:bg-zinc-700 rounded cursor-pointer'
            : 'flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-smoke-100 dark-theme:hover:bg-zinc-700 rounded cursor-pointer'
        "
        :title="subOption.label"
        @click="handleSubmenuClick(subOption)"
      >
        <div
          v-if="subOption.color"
          class="h-5 w-5 rounded-full border border-smoke-300 dark-theme:border-zinc-600"
          :style="{ backgroundColor: subOption.color }"
        />
        <template v-else-if="!subOption.color">
          <i
            v-if="isShapeSelected(subOption)"
            class="icon-[lucide--check] h-4 w-4 flex-shrink-0"
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

const submenuPt = computed(() => ({
  root: {
    class: 'absolute z-[60]'
  },
  content: {
    class: [
      'text-neutral dark-theme:text-white rounded-lg',
      'shadow-lg border border-zinc-200 dark-theme:border-zinc-700',
      'bg-interface-panel-surface'
    ]
  }
}))
</script>
