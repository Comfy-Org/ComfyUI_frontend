<template>
  <ImageUpload
    v-model="modelValue"
    :loading="isUploading"
    @file-selected="handleFileUpload"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ImageUpload from '@/components/ui/image-upload/ImageUpload.vue'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'

const modelValue = defineModel<string>()

const { t } = useI18n()

const isUploading = ref(false)

const uploadFile = async (file: File): Promise<string | null> => {
  const body = new FormData()
  body.append('image', file)
  body.append('subfolder', 'backgrounds')

  const resp = await api.fetchApi('/upload/image', {
    method: 'POST',
    body
  })

  if (resp.status !== 200) {
    useToastStore().addAlert(t('toastMessages.failedToUploadBackgroundImage'))
    return null
  }

  const data = await resp.json()
  return data.name
}

const handleFileUpload = async (file: File) => {
  isUploading.value = true
  try {
    const uploadedName = await uploadFile(file)
    if (uploadedName) {
      const params = new URLSearchParams({
        filename: uploadedName,
        type: 'input',
        subfolder: 'backgrounds'
      })
      appendCloudResParam(params, file.name)
      modelValue.value = `/api/view?${params.toString()}`
    }
  } catch (error) {
    useToastStore().addAlert(
      t('toastMessages.errorUploadingBackgroundImage', {
        error: String(error)
      })
    )
  } finally {
    isUploading.value = false
  }
}
</script>
