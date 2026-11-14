<template>
  <section
    v-if="available"
    class="flex flex-col gap-3"
    data-testid="billing-handoff"
  >
    <h2 class="m-0 text-base font-medium text-foreground">
      {{ $t(`workspacePanel.billingTab.handoff.${audience}.label`) }}
    </h2>
    <div
      class="flex items-center gap-4 rounded-xl border border-border px-5 py-4"
      data-testid="billing-handoff-card"
    >
      <i18n-t
        v-if="audience === 'owner'"
        keypath="workspacePanel.billingTab.handoff.owner.line"
        tag="p"
        class="m-0 text-sm text-muted-foreground"
      >
        <template #platform>
          <a
            :href
            target="_blank"
            rel="noopener"
            class="text-muted-foreground underline hover:text-foreground"
            @click="track"
          >
            {{ $t('workspacePanel.billingTab.handoff.owner.platform') }}
          </a>
        </template>
      </i18n-t>
      <Button
        as="a"
        :href
        target="_blank"
        rel="noopener"
        variant="secondary"
        size="md"
        class="ml-auto shrink-0 no-underline"
        @click="track"
      >
        {{ $t(`workspacePanel.billingTab.handoff.${audience}.action`) }}
        <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

const { audience } = defineProps<{ audience: 'owner' | 'member' }>()

const HANDOFF = {
  owner: { path: '/profile/billing', target: 'open_billing' },
  member: { path: '/profile/usage', target: 'usage' }
} as const

const { href, track, available } = usePlatformHandoff(
  () => HANDOFF[audience].path,
  () => ({ target: HANDOFF[audience].target })
)
</script>
