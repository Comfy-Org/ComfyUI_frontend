<template>
  <AppDialogPanel
    size="compact"
    class="w-90 max-w-full"
    data-testid="platform-plans-link-dialog"
    @close="onClose"
  >
    <template #title>
      {{ title }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ body }}
    </p>

    <template #footer>
      <Button
        as="a"
        variant="inverted"
        size="lg"
        :href="link.href"
        target="_blank"
        rel="noopener noreferrer"
        @click="follow"
      >
        {{ linkLabel }}
        <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import Button from '@comfyorg/design-system/button/Button'
import type { PaymentIntentSource } from '@comfyorg/telemetry/types'

import { platformPlansLink } from '@/platform/billing/openPlatformPlans'

const { title, body, linkLabel, source, onClose } = defineProps<{
  title: string
  body: string
  linkLabel: string
  source?: PaymentIntentSource
  onClose: () => void
}>()

const link = platformPlansLink(source)

function follow() {
  link.onFollow()
  onClose()
}
</script>
