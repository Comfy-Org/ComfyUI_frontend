<template>
  <div class="flex flex-col gap-2">
    <label
      ref="dropRef"
      :class="
        cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors focus-within:border-muted-foreground',
          isOverDropZone
            ? 'border-muted-foreground'
            : 'border-border hover:border-muted-foreground'
        )
      "
      data-attr="upload-model-file-drop"
      @dragenter.stop
      @dragleave.stop
      @dragover.prevent.stop
      @drop.prevent.stop
    >
      <input
        type="file"
        accept=".safetensors"
        class="sr-only"
        data-testid="upload-model-file-input"
        @change="onFileChange"
      />
      <span class="text-muted-foreground">
        {{ $t('assetBrowser.fileUpload.drop') }}
      </span>
      <span
        class="rounded-md bg-secondary px-3 py-1.5 font-medium text-foreground"
      >
        {{ $t('assetBrowser.fileUpload.choose') }}
      </span>
    </label>
    <p v-if="error" class="m-0 text-destructive">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { error } = defineProps<{
  error?: string
}>()

const emit = defineEmits<{
  choose: [file: File]
}>()

const dropRef = ref<HTMLElement | null>(null)

const { isOverDropZone } = useDropZone(dropRef, {
  multiple: false,
  onDrop(files) {
    const file = files?.[0]
    if (file) emit('choose', file)
  }
})

function onFileChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) emit('choose', file)
}
</script>
