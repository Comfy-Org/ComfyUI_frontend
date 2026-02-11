<template>
  <component :is="extension.component" v-if="extension.type === 'vue'" />
  <div
    v-else
    :ref="
      (el) => {
        if (el)
          mountCustomExtension(extension as CustomExtension, el as HTMLElement)
      }
    "
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'

import type { CustomExtension, VueExtension } from '@/types/extensionTypes'

const { extension } = defineProps<{
  extension: VueExtension | CustomExtension
}>()

const mountCustomExtension = (ext: CustomExtension, el: HTMLElement) => {
  ext.render(el)
}

onBeforeUnmount(() => {
  if (extension.type === 'custom' && extension.destroy) {
    extension.destroy()
  }
})
</script>
