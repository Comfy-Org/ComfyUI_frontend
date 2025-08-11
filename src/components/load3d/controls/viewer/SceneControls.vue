<template>
  <div class="space-y-4">
    <div v-if="!hasBackgroundImage">
      <label>
        {{ t('load3d.backgroundColor') }}
      </label>
      <input v-model="backgroundColor" type="color" class="w-full" />
    </div>

    <div>
      <Checkbox v-model="showGrid" input-id="showGrid" binary name="showGrid" />
      <label for="showGrid" class="pl-2">
        {{ t('load3d.showGrid') }}
      </label>
    </div>

    <div v-if="!hasBackgroundImage">
      <Button
        severity="secondary"
        :label="t('load3d.uploadBackgroundImage')"
        icon="pi pi-image"
        class="w-full"
        @click="openImagePicker"
      />
      <input
        ref="imagePickerRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleImageUpload"
      />
    </div>

    <div v-if="hasBackgroundImage" class="space-y-2">
      <Button
        severity="secondary"
        :label="t('load3d.removeBackgroundImage')"
        icon="pi pi-times"
        class="w-full"
        @click="removeBackgroundImage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { ref } from 'vue'

import { t } from '@/i18n'

const backgroundColor = defineModel<string>('backgroundColor')
const showGrid = defineModel<boolean>('showGrid')

defineProps<{
  hasBackgroundImage?: boolean
}>()

const emit = defineEmits<{
  (e: 'updateBackgroundImage', file: File | null): void
}>()

const imagePickerRef = ref<HTMLInputElement | null>(null)

const openImagePicker = () => {
  imagePickerRef.value?.click()
}

const handleImageUpload = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    emit('updateBackgroundImage', input.files[0])
  }

  input.value = ''
}

const removeBackgroundImage = () => {
  emit('updateBackgroundImage', null)
}
</script>
