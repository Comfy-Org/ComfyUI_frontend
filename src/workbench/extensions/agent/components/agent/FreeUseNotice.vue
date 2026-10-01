<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useStorage } from '@vueuse/core'
import { watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type {
  AgentFreeUseNoticeAction,
  AgentFreeUsePlacement
} from '@/platform/telemetry/types'

import { FREE_USE_NOTICE_DISMISSED_KEY } from './freeUseNoticeDismissal'

const FREE_USE_DOCS_URL = 'https://docs.comfy.org/get_started/cloud'

/**
 * Only the box changes between arms; the copy, the link and the dismiss
 * affordance are identical, so what the experiment varies is placement alone.
 */
const PLACEMENT_CLASSES = {
  'top-banner': 'px-4 py-3',
  'near-composer': 'rounded-lg px-4 py-3',
  'above-input': 'px-4 py-3',
  'inside-input': 'm-3 rounded-lg px-4 py-3'
} as const satisfies Record<AgentFreeUsePlacement, string>

const { placement } = defineProps<{ placement: AgentFreeUsePlacement }>()
const emit = defineEmits<{ notice: [action: AgentFreeUseNoticeAction] }>()

const dismissed = useStorage(FREE_USE_NOTICE_DISMISSED_KEY, false)

watch(
  () => (dismissed.value ? null : placement),
  (visiblePlacement) => {
    if (visiblePlacement !== null) emit('notice', 'shown')
  },
  { immediate: true }
)

function onDismiss(): void {
  dismissed.value = true
  emit('notice', 'dismissed')
}
</script>

<template>
  <div
    v-if="!dismissed"
    role="note"
    data-testid="agent-free-use-notice"
    :data-placement="placement"
    :class="
      cn(
        'flex items-start gap-3 bg-blue-selection text-base-foreground',
        PLACEMENT_CLASSES[placement]
      )
    "
  >
    <p class="my-0 min-w-0 flex-1 text-sm/5">
      {{ $t('agent.freeUseNotice') }}
      <a
        :href="FREE_USE_DOCS_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-background hover:underline hover:underline-offset-4"
        @click="emit('notice', 'learn_more_clicked')"
      >
        {{ $t('g.learnMore') }}
      </a>
    </p>
    <Button
      type="button"
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="$t('agent.dismiss')"
      class="shrink-0"
      @click="onDismiss"
    >
      <span class="icon-[lucide--x] size-5" />
    </Button>
  </div>
</template>
