<template>
  <BaseModalLayout :content-title="$t('comfyHubPublish.title')" size="md">
    <template #header />
    <template #content>
      <ComfyHubPublishWizardPanel :on-publish="onClose" />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { provide } from 'vue'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import ComfyHubPublishWizardPanel from '@/platform/workflow/sharing/components/comfyhub/publish/ComfyHubPublishWizardPanel.vue'
import { OnCloseKey } from '@/types/widgetTypes'

const { onClose } = defineProps<{
  onClose: () => void
}>()

provide(OnCloseKey, onClose)
</script>
