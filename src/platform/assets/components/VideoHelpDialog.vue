<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :closable="false"
    :close-on-escape="false"
    :dismissable-mask="true"
    :pt="{
      root: { class: 'video-help-dialog' },
      header: { class: '!hidden' },
      content: { class: '!p-0' },
      mask: { class: '!bg-black/70' }
    }"
    :style="{ width: '90vw', maxWidth: '800px' }"
  >
    <div class="relative">
      <IconButton
        class="absolute top-4 right-6 z-10"
        :aria-label="$t('g.close')"
        @click="isVisible = false"
      >
        <i class="pi pi-times text-sm" />
      </IconButton>
      <video
        :controls="showControls"
        autoplay
        muted
        :loop="loop"
        :aria-label="ariaLabel"
        class="w-full rounded-lg"
        :src="videoUrl"
      >
        {{ $t('g.videoFailedToLoad') }}
      </video>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { computed, onUnmounted, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    videoUrl: string
    ariaLabel?: string
    loop?: boolean
    showControls?: boolean
  }>(),
  {
    ariaLabel: 'Help video',
    loop: true,
    showControls: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isVisible.value) {
    event.stopImmediatePropagation()
    event.stopPropagation()
    event.preventDefault()
    isVisible.value = false
  }
}

watch(
  isVisible,
  (visible) => {
    if (visible) {
      // Add listener with capture phase to intercept before parent dialogs
      document.addEventListener('keydown', handleEscapeKey, { capture: true })
    } else {
      document.removeEventListener('keydown', handleEscapeKey, {
        capture: true
      })
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey, { capture: true })
})
</script>
