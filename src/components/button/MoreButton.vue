<template>
  <div class="relative inline-flex items-center">
    <IconButton :size="size" :type="type" @click="toggle">
      <i v-if="!isVertical" class="icon-[lucide--ellipsis] text-sm" />
      <i v-else class="icon-[lucide--more-vertical] text-sm" />
    </IconButton>

    <Popover
      ref="popover"
      :append-to="'body'"
      :auto-z-index="true"
      :base-z-index="1000"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="pt"
      @show="$emit('menuOpened')"
      @hide="$emit('menuClosed')"
    >
      <div class="flex min-w-40 flex-col gap-2 p-2">
        <slot :close="hide" />
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import type { BaseButtonProps } from '@/types/buttonTypes'
import { cn } from '@/utils/tailwindUtil'

import IconButton from './IconButton.vue'

interface MoreButtonProps extends BaseButtonProps {
  isVertical?: boolean
}

const popover = ref<InstanceType<typeof Popover>>()

const {
  size = 'md',
  type = 'secondary',
  isVertical = false
} = defineProps<MoreButtonProps>()

defineEmits<{
  menuOpened: []
  menuClosed: []
}>()

const toggle = (event: Event) => {
  popover.value?.toggle(event)
}

const hide = () => {
  popover.value?.hide()
}

const pt = computed(() => ({
  root: {
    class: cn('absolute z-50')
  },
  content: {
    class: cn(
      'mt-1 rounded-lg',
      'bg-white dark-theme:bg-zinc-800',
      'text-neutral dark-theme:text-white',
      'shadow-lg',
      'border border-zinc-200 dark-theme:border-zinc-700'
    )
  }
}))
</script>
