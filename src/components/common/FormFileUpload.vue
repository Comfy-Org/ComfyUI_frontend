<template>
  <div class="image-upload-wrapper">
    <div class="flex gap-2 items-center">
      <slot name="preview"></slot>

      <div class="flex flex-col gap-2">
        <Button
          icon="pi pi-upload"
          :label="$t('g.upload')"
          size="small"
          @click="triggerFileInput"
        />
        <Button
          v-if="modelValue"
          class="w-full"
          outlined
          icon="pi pi-trash"
          severity="danger"
          size="small"
          @click="clear"
        />
      </div>
    </div>
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      :accept="inputAccept"
      @change="handleFileUpload"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

defineProps<{
  modelValue: string
  inputAccept: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      emit('update:modelValue', e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
}

const clear = () => {
  emit('update:modelValue', '')
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>
