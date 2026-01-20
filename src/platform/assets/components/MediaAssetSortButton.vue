<template>
  <div class="relative inline-flex items-center">
    <Button
      variant="secondary"
      size="icon"
      @click="toggle"
    >
      <i class="icon-[lucide--arrow-up-down]" />
    </Button>

    <Popover
      ref="popover"
      append-to="body"
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

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

const popover = ref<InstanceType<typeof Popover>>()

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
      'border border-border-default bg-base-background text-base-foreground',
      'shadow-lg'
    )
  }
}))
</script>
