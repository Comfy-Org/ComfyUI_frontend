<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  disabled = false,
  loading = false
} = defineProps<{
  class?: string
  disabled?: boolean
  loading?: boolean
}>()

const modelValue = defineModel<string>({ default: '' })

const emit = defineEmits<{
  fileSelected: [file: File]
}>()

const { t } = useI18n()

const fileInput = ref<HTMLInputElement | null>(null)

const previewFailed = ref(false)
watch(modelValue, () => {
  previewFailed.value = false
})

const imageBaseName = computed(() => {
  if (!modelValue.value) return ''
  try {
    const url = new URL(modelValue.value, window.location.origin)
    const filename =
      url.searchParams.get('filename') ?? url.pathname.split('/').pop() ?? ''
    return filename.split('/').pop() ?? ''
  } catch {
    return modelValue.value
  }
})

function openFileBrowser() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('fileSelected', file)
  input.value = ''
}

function clearImage() {
  modelValue.value = ''
}
</script>

<template>
  <div
    :class="
      cn(
        'flex h-8 w-full items-center overflow-clip rounded-lg bg-component-node-widget-background hover:bg-component-node-widget-background-hovered',
        (disabled || loading) && 'cursor-not-allowed opacity-50',
        className
      )
    "
  >
    <button
      type="button"
      :disabled="disabled || loading"
      class="flex h-full min-w-0 flex-1 cursor-pointer items-center border-none bg-transparent p-0 outline-none disabled:cursor-not-allowed"
      @click="openFileBrowser"
    >
      <span class="flex size-8 shrink-0 items-center justify-center">
        <i
          v-if="loading"
          class="icon-[lucide--loader-circle] size-4 animate-spin text-muted-foreground"
        />
        <img
          v-else-if="modelValue && !previewFailed"
          :src="modelValue"
          alt=""
          data-testid="image-upload-preview"
          class="size-5 rounded-sm object-cover"
          @error="previewFailed = true"
        />
        <i v-else class="icon-[lucide--image] size-4 text-muted-foreground" />
      </span>
      <span
        :class="
          cn(
            'min-w-0 flex-1 truncate text-left text-xs',
            imageBaseName
              ? 'text-component-node-foreground'
              : 'text-muted-foreground'
          )
        "
      >
        {{ imageBaseName || t('g.chooseImage') }}
      </span>
    </button>
    <button
      v-if="modelValue && !loading"
      type="button"
      :disabled="disabled"
      :aria-label="t('g.removeImage')"
      class="flex size-8 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-component-node-foreground outline-none disabled:cursor-not-allowed"
      @click="clearImage"
    >
      <i class="icon-[lucide--x] size-4" />
    </button>
    <input
      ref="fileInput"
      data-testid="image-upload-input"
      type="file"
      class="hidden"
      accept="image/*"
      @change="handleFileChange"
    />
  </div>
</template>
