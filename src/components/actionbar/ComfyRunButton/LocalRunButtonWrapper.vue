<template>
  <ComfyQueueButton v-if="gate === 'none'" />
  <Button
    v-else
    v-tooltip.bottom="{
      value: t('actionbar.partnerRunGate.signInCaption'),
      showDelay: 600
    }"
    variant="secondary"
    size="unset"
    class="h-8 gap-1.5 rounded-lg px-4 whitespace-nowrap"
    data-testid="partner-sign-in-to-run-button"
    @click="openPartnerSignInDialog"
  >
    <i class="icon-[lucide--log-in] size-4" aria-hidden="true" />
    {{ t('actionbar.partnerRunGate.signInToRun') }}
  </Button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import Button from '@/components/ui/button/Button.vue'
import { usePartnerNodesRunGate } from '@/composables/billing/usePartnerNodesRunGate'
import { useDialogService } from '@/services/dialogService'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'

const { t } = useI18n()
const { gate, partnerNodes } = usePartnerNodesRunGate()
const dialogService = useDialogService()
const { mode: queueMode } = storeToRefs(useQueueSettingsStore())

// Auto-queue would keep submitting (and failing server-side) behind a gated
// button; force it off, mirroring the paymentRecoveryLock handling.
watch(
  gate,
  (value) => {
    if (value !== 'none') queueMode.value = 'disabled'
  },
  { immediate: true }
)

function openPartnerSignInDialog() {
  void dialogService.showApiNodesSignInDialog(
    partnerNodes.value.map((node) => node.nodeName)
  )
}
</script>
