<template>
  <div role="status" aria-live="polite">
    <div
      v-if="gate !== 'none'"
      id="partner-run-gate-caption"
      class="mt-2 w-full border-t border-border/50 bg-background px-4 pt-2 select-none"
      data-testid="partner-run-gate-caption"
    >
      <div class="flex w-full items-center justify-center gap-2">
        <i
          class="icon-[lucide--info] text-muted-foreground"
          aria-hidden="true"
        />
        {{ t('actionbar.partnerRunGate.signInCaption') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { usePartnerNodesRunGate } from '@/platform/billing/composables/usePartnerNodesRunGate'

const { t } = useI18n()
const { gate } = usePartnerNodesRunGate()
</script>
