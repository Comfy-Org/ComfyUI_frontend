<!-- Prompt user that the workflow contains API nodes that needs login to run -->
<template>
  <div class="flex flex-col gap-4 max-w-96 h-110 p-2">
    <div class="text-2xl font-medium mb-2">
      {{ t('apiNodesSignInDialog.title') }}
    </div>

    <div class="text-base mb-4">
      {{ t('apiNodesSignInDialog.message') }}
    </div>

    <ApiNodesList :node-names="apiNodeNames" />

    <div class="flex justify-between items-center">
      <Button :label="t('g.learnMore')" link @click="handleLearnMoreClick" />
      <div class="flex gap-2">
        <Button
          :label="t('g.cancel')"
          outlined
          severity="secondary"
          @click="onCancel?.()"
        />
        <Button :label="t('g.login')" @click="onLogin?.()" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { apiNodeNames, onLogin, onCancel } = defineProps<{
  apiNodeNames: string[]
  onLogin?: () => void
  onCancel?: () => void
}>()

const handleLearnMoreClick = () => {
  window.open('https://docs.comfy.org/tutorials/api-nodes/faq', '_blank')
}
</script>
