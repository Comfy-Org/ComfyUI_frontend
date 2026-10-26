<template>
  <div
    v-if="parked"
    role="status"
    class="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 sm:flex-row sm:items-center sm:gap-2"
    data-testid="billing-parked-banner"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex items-center gap-2">
        <i class="icon-[lucide--triangle-alert] size-4 shrink-0 text-warning" />
        <span class="text-sm text-foreground">
          {{ $t('workspacePanel.billingStatus.parked.title') }}
        </span>
      </div>
      <p class="m-0 pl-6 text-sm text-muted-foreground">
        {{ $t('workspacePanel.billingStatus.parked.body') }}
      </p>
    </div>
    <Button
      as="a"
      variant="inverted"
      size="lg"
      class="shrink-0"
      :href="CONTACT_SUPPORT_URL"
      target="_blank"
      rel="noopener"
    >
      {{ $t('workspacePanel.billingStatus.parked.contactSupport') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const CONTACT_SUPPORT_URL = 'https://comfy.org/contact/'

const { parked } = defineProps<{
  parked: boolean
}>()
</script>
