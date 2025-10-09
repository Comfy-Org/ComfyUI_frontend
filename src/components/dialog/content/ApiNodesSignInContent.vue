<template>
  <div class="flex h-110 max-w-96 flex-col gap-4 p-2">
    <div class="mb-2 text-2xl font-medium">
      {{ t('apiNodesSignInDialog.title') }}
    </div>

    <div class="mb-4 text-base">
      {{ t('apiNodesSignInDialog.message') }}
    </div>

    <ApiNodesList :node-names="apiNodeNames" />

    <div class="flex items-center justify-between">
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
