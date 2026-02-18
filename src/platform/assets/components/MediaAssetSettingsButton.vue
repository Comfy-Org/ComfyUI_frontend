<template>
  <div class="relative inline-flex items-center">
    <Button variant="secondary" size="icon" @click="toggle">
      <i class="icon-[lucide--settings-2]" />
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
    >
      <div class="flex min-w-42 flex-col gap-2 p-2">
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

function toggle(event: Event) {
  popover.value?.toggle(event)
}

function hide() {
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
