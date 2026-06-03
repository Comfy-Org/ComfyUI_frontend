<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { useTemplateRef } from 'vue'

// CSS-positioned dropdown for the action row. The picker panel is body-mounted
// and CSS-scaled to the canvas zoom; PrimeVue overlays position via screen
// coordinates, which the panel's transform then scales again — pushing the
// overlay off by an amount that grows with the trigger's x. Positioning the
// content with plain CSS inside the panel inherits that transform, so both
// placement and scale stay correct at any zoom.
const open = defineModel<boolean>('open', { default: false })

const rootRef = useTemplateRef<HTMLElement>('rootRef')
const contentRef = useTemplateRef<HTMLElement>('contentRef')

onClickOutside(
  contentRef,
  () => {
    open.value = false
  },
  { ignore: [rootRef] }
)

function toggle() {
  open.value = !open.value
}
</script>

<template>
  <div ref="rootRef" class="relative inline-flex shrink-0">
    <slot name="trigger" :toggle :open />
    <div
      v-if="open"
      ref="contentRef"
      class="absolute top-full right-0 z-50 mt-2"
    >
      <slot />
    </div>
  </div>
</template>
