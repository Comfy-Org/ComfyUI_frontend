<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { AGENT_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'

const { kind, canTopUp = false } = defineProps<{
  kind: 'free' | 'credits'
  canTopUp?: boolean
}>()
const emit = defineEmits<{ addCredits: [] }>()
</script>

<template>
  <div
    role="note"
    :aria-label="$t('agent.localCreditNoticeLabel')"
    :class="
      cn(
        'px-4 py-3 text-foreground',
        kind === 'free' ? 'bg-primary/30' : 'rounded-lg bg-secondary'
      )
    "
  >
    <p class="my-0 text-sm/5">
      {{
        kind === 'free'
          ? $t('agent.localFreeUseNotice')
          : $t('agent.localCreditsNotice')
      }}
      <Button
        v-if="kind === 'free'"
        variant="link"
        size="unset"
        as="a"
        :href="AGENT_DOCS_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="inline p-0 text-sm/5 font-normal text-foreground underline underline-offset-4"
      >
        {{ $t('g.learnMore') }}
      </Button>
      <Button
        v-else-if="canTopUp"
        type="button"
        variant="link"
        size="unset"
        class="inline p-0 text-sm/5 font-normal text-foreground underline underline-offset-4"
        @click="emit('addCredits')"
      >
        {{ $t('agent.paywall.addCredits') }}
      </Button>
    </p>
  </div>
</template>
