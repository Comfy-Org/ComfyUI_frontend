<!-- Prompt user that the workflow contains API nodes that needs login to run -->
<template>
  <div class="flex flex-col gap-4 max-w-96 h-110 p-2">
    <div class="text-2xl font-medium mb-2">
      {{ t('apiNodesSignInDialog.title') }}
    </div>

    <div class="text-base mb-4">
      {{ t('apiNodesSignInDialog.message') }}
    </div>

    <ApiNodesCostBreakdown :nodes="apiNodes" :show-total="true" />

    <div class="flex justify-between items-center">
      <Button :label="t('g.learnMore')" link />
      <div class="flex gap-2">
        <Button
          :label="t('g.cancel')"
          outlined
          severity="secondary"
          @click="emit('cancel')"
        />
        <Button :label="t('g.login')" @click="emit('login')" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import ApiNodesCostBreakdown from '@/components/common/ApiNodesCostBreakdown.vue'
import type { ApiNodeCost } from '@/types/apiNodeTypes'

const { t } = useI18n()

const { apiNodes } = defineProps<{
  apiNodes: ApiNodeCost[]
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'login'): void
}>()
</script>
