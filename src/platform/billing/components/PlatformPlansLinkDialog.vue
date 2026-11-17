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
        :rel="platformLinkRel()"
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

import { platformPlansLink } from '@/platform/billing/openPlatformPlans'
import { platformLinkRel } from '@/platform/workspace/utils/platformLink'

const { title, body, linkLabel, onClose } = defineProps<{
  title: string
  body: string
  linkLabel: string
  onClose: () => void
}>()

const link = platformPlansLink('plans-link-dialog')

function follow() {
  link.onFollow()
  onClose()
}
</script>
