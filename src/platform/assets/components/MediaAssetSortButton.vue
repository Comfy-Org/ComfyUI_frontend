<template>
  <div class="relative inline-flex items-center">
    <IconButton :size="size" :type="type" @click="toggle">
      <i class="icon-[lucide--arrow-up-down] text-sm" />
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

import IconButton from '@/components/button/IconButton.vue'
import type { BaseButtonProps } from '@/types/buttonTypes'
import { cn } from '@/utils/tailwindUtil'

interface AssetSortButtonProps extends BaseButtonProps {}

const popover = ref<InstanceType<typeof Popover>>()

const { size = 'md', type = 'secondary' } = defineProps<AssetSortButtonProps>()

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
      'bg-base-background text-base-foreground border border-border-default',
      'shadow-lg'
    )
  }
}))
</script>
