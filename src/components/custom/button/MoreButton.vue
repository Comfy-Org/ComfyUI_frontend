<template>
  <div class="relative inline-flex items-center">
    <IconButton @click="toggle">
      <i-lucide:more-vertical class="text-sm" />
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
    >
      <div class="flex flex-col gap-1 p-2 min-w-40">
        <slot :close="hide" />
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import IconButton from './IconButton.vue'

const popover = ref<InstanceType<typeof Popover>>()

const toggle = (event: Event) => {
  popover.value?.toggle(event)
}

const hide = () => {
  popover.value?.hide()
}

const pt = computed(() => ({
  root: {
    class: 'absolute z-50'
  },
  content: {
    class: [
      'mt-2 bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white rounded-lg',
      'shadow-lg border border-zinc-200 dark-theme:border-zinc-700'
    ]
  }
}))
</script>
