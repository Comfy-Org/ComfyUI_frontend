<template>
  <div ref="root" class="contents">
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
      aria-describedby="partner-run-gate-caption"
      @click="openPartnerSignInDialog"
    >
      <i class="icon-[lucide--log-in] size-4" aria-hidden="true" />
      {{ t('actionbar.partnerRunGate.signInToRun') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import Button from '@/components/ui/button/Button.vue'
import { usePartnerNodesRunGate } from '@/composables/billing/usePartnerNodesRunGate'
import { useDialogService } from '@/services/dialogService'
import type { AutoQueueMode } from '@/stores/queueSettingsStore'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'

const { t } = useI18n()
const { gate, partnerNodes } = usePartnerNodesRunGate()
const dialogService = useDialogService()
const { mode: queueMode } = storeToRefs(useQueueSettingsStore())
const root = useTemplateRef<HTMLElement>('root')

// Auto-queue would keep submitting (and failing server-side) behind a gated
// button. While gated, force the mode to disabled and remember what to restore
// — including a mode the user picks mid-gate — then reinstate it on lift.
const isGated = computed(() => gate.value !== 'none')
let modeToRestore: AutoQueueMode | null = null
watch(
  [isGated, queueMode],
  ([gated, mode]) => {
    if (gated) {
      if (mode !== 'disabled') {
        modeToRestore = mode
        queueMode.value = 'disabled'
      }
    } else if (modeToRestore !== null) {
      queueMode.value = modeToRestore
      modeToRestore = null
    }
  },
  { immediate: true }
)

// Signing in swaps the focused gated button for the queue button, which would
// otherwise drop keyboard focus to <body>.
watch(gate, async () => {
  const hadFocus = root.value?.contains(document.activeElement)
  if (!hadFocus) return
  await nextTick()
  root.value?.querySelector('button')?.focus()
})

function openPartnerSignInDialog() {
  void dialogService.showApiNodesSignInDialog(
    partnerNodes.value.map((node) => node.displayName)
  )
}
</script>
