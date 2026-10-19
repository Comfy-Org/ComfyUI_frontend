<script setup lang="ts">
import type { DialogPortalProps } from 'reka-ui'
import { DialogPortal, injectConfigProviderContext } from 'reka-ui'
import { computed, onMounted, onUnmounted, shallowRef, watchEffect } from 'vue'

const { open, to, disabled, ...portalProps } = defineProps<
  DialogPortalProps & { open: boolean }
>()
const config = injectConfigProviderContext(null)
const container = shallowRef<HTMLDivElement>()
const destination = computed(() => to ?? config?.teleportTo?.value ?? 'body')

onMounted(() => {
  const element = document.createElement('div')
  element.className = 'contents'
  element.dataset.overlayPortal = ''
  container.value = element
})

watchEffect(() => {
  const element = container.value
  const target = destination.value
  const parent =
    typeof target === 'string' ? document.querySelector(target) : target
  if (
    element &&
    !disabled &&
    parent &&
    (open || element.parentElement !== parent)
  ) {
    parent.append(element)
  }
})

onUnmounted(() => container.value?.remove())
</script>

<template>
  <DialogPortal v-if="container" v-bind="portalProps" :to="container" :disabled>
    <slot />
  </DialogPortal>
</template>
