<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({
  inheritAttrs: false
})

const { isVertical = false } = defineProps<{
  isVertical?: boolean
}>()

const emit = defineEmits<{
  menuOpened: []
  menuClosed: []
}>()

const isOpen = ref(false)

function onOpenChange(open: boolean) {
  isOpen.value = open
  if (open) emit('menuOpened')
  else emit('menuClosed')
}

function close() {
  isOpen.value = false
}

defineExpose({ hide: close, isOpen })
</script>

<template>
  <DropdownMenu
    v-model:open="isOpen"
    :modal="false"
    @update:open="onOpenChange"
  >
    <DropdownMenuTrigger as-child>
      <Button size="icon" variant="secondary" v-bind="$attrs">
        <i
          :class="
            cn(
              !isVertical
                ? 'icon-[lucide--ellipsis]'
                : 'icon-[lucide--more-vertical]'
            )
          "
        />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      size="lg"
      align="end"
      :side-offset="4"
      data-testid="more-menu-content"
    >
      <slot :close="close" />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
