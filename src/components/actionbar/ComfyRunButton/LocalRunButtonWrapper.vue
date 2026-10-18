<template>
  <div ref="root" class="contents">
    <ComfyQueueButton v-if="gate === 'none'" />
    <Button
      v-else
      :tooltip="t('actionbar.partnerRunGate.signInCaption')"
      tooltip-side="bottom"
      variant="secondary"
      size="unset"
      class="h-8 gap-1.5 rounded-lg px-4 whitespace-nowrap"
      data-testid="partner-sign-in-to-run-button"
      aria-describedby="partner-run-gate-caption"
      @click="openPartnerSignInDialog"
    >
      <i class="icon-[lucide--log-in] size-4" aria-hidden="true" />
      {{ t('actionbar.partnerRunGate.signInToRun') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import Button from '@/components/ui/button/Button.vue'
import { usePartnerNodesRunGate } from '@/composables/billing/usePartnerNodesRunGate'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'

const { t } = useI18n()
const { gate, partnerNodes } = usePartnerNodesRunGate()
const { showApiNodesSignInDialog } = useAuthDialogs()
const root = useTemplateRef<HTMLElement>('root')

// Signing in swaps the focused gated button for the queue button, which would
// otherwise drop keyboard focus to <body>.
watch(gate, async () => {
  const hadFocus = root.value?.contains(document.activeElement)
  if (!hadFocus) return
  await nextTick()
  root.value?.querySelector('button')?.focus()
})

function openPartnerSignInDialog() {
  void showApiNodesSignInDialog(
    partnerNodes.value.map((node) => node.displayName)
  )
}
</script>
