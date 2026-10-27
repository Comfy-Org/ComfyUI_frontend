<template>
  <div class="@container" data-testid="billing-auto-top-up-banner">
    <div
      role="status"
      class="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3 @2xl:flex-row @2xl:items-center @2xl:gap-2"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex items-center gap-2">
          <i
            class="icon-[lucide--triangle-alert] size-4 shrink-0 text-warning"
          />
          <span class="text-sm text-foreground">{{ $t(copy.title) }}</span>
        </div>
        <p class="m-0 pl-6 text-sm text-muted-foreground">
          {{ $t(copy.body) }}
        </p>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { AutoTopUpBannerKind } from '@/platform/billing/composables/deriveAutoTopUpBanner'

const { kind } = defineProps<{
  kind: AutoTopUpBannerKind
}>()

const COPY = {
  autoTopUpFailed: {
    title: 'workspacePanel.billingStatus.autoTopUpFailed.title',
    body: 'workspacePanel.billingStatus.autoTopUpFailed.body'
  },
  autoTopUpOff: {
    title: 'workspacePanel.billingStatus.autoTopUpOff.title',
    body: 'workspacePanel.billingStatus.autoTopUpOff.body'
  }
} as const satisfies Record<
  AutoTopUpBannerKind,
  { title: string; body: string }
>

const copy = computed(() => COPY[kind])
</script>
