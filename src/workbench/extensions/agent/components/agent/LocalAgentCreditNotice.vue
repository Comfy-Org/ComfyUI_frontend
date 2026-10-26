<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { AGENT_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'

const { kind, canTopUp = false } = defineProps<{
  kind: 'free' | 'credits'
  canTopUp?: boolean
}>()
const emit = defineEmits<{ addCredits: []; dismiss: [] }>()
</script>

<template>
  <div
    role="note"
    :aria-label="$t('agent.localCreditNoticeLabel')"
    :class="
      cn(
        'text-foreground',
        kind === 'free'
          ? 'flex min-h-[62px] items-center gap-2 bg-primary/30 p-4'
          : 'rounded-lg bg-secondary px-4 py-3'
      )
    "
  >
    <p
      :class="
        kind === 'free'
          ? 'my-0 min-w-0 flex-1 text-xs leading-[15px]'
          : 'my-0 text-sm/5'
      "
    >
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
        class="ml-1 inline p-0 text-xs leading-[15px] font-normal text-azure-400 hover:text-azure-300 hover:underline"
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
    <Button
      v-if="kind === 'free'"
      type="button"
      variant="muted-textonly"
      size="icon"
      :aria-label="$t('agent.dismiss')"
      class="-m-2 shrink-0 hover:bg-transparent hover:text-foreground"
      @click="emit('dismiss')"
    >
      <span class="icon-[lucide--x] size-4" />
    </Button>
  </div>
</template>
