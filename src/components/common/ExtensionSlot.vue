<template>
  <component v-if="extension.type === 'vue'" :is="extension.component" />
  <div
    v-else
    :ref="
      (el) => {
        if (el)
          mountCustomExtension(
            props.extension as CustomExtension,
            el as HTMLElement
          )
      }
    "
  ></div>
</template>

<script setup lang="ts">
import { CustomExtension, VueExtension } from '@/types/extensionTypes'
import { onBeforeUnmount } from 'vue'

const props = defineProps<{
  extension: VueExtension | CustomExtension
}>()

const mountCustomExtension = (extension: CustomExtension, el: HTMLElement) => {
  extension.render(el)
}

onBeforeUnmount(() => {
  if (props.extension.type === 'custom' && props.extension.destroy) {
    props.extension.destroy()
  }
})
</script>
