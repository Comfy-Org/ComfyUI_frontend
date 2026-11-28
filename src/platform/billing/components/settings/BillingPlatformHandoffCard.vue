<template>
  <section
    v-if="audience === 'owner' || href"
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
          <component
            :is="href ? 'a' : 'button'"
            v-bind="
              href
                ? { href, target: '_blank', rel: 'noopener' }
                : { type: 'button' }
            "
            :class="
              cn(
                'text-muted-foreground underline hover:text-foreground',
                !href &&
                  'cursor-pointer appearance-none border-none bg-transparent p-0 font-[inherit]'
              )
            "
            @click="open"
          >
            {{ $t('workspacePanel.billingTab.handoff.owner.platform') }}
          </component>
        </template>
      </i18n-t>
      <Button
        v-bind="button"
        variant="secondary"
        size="md"
        class="ml-auto shrink-0 no-underline"
        @click="open"
      >
        {{ $t(`workspacePanel.billingTab.handoff.${audience}.action`) }}
        <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import { usePlatformBillingLink } from '@/platform/billing/composables/usePlatformHandoff'

const { audience } = defineProps<{ audience: 'owner' | 'member' }>()

const HANDOFF = {
  owner: { path: '/profile/billing', target: 'open_billing' },
  member: { path: '/profile/usage', target: 'usage' }
} as const

const { href, button, open } = usePlatformBillingLink(
  () => HANDOFF[audience].path,
  () => ({ target: HANDOFF[audience].target })
)
</script>
