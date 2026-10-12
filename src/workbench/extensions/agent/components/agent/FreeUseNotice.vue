<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useLocalStorage } from '@vueuse/core'
import { computed, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type {
  AgentFreeUseNoticeMetadata,
  AgentFreeUsePlacement
} from '@/platform/telemetry/types'
import { AGENT_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'

import { freeUseNoticeDismissedKey } from './freeUseNoticeDismissal'

const PLACEMENT_CLASSES = {
  'top-banner': 'px-4 py-3',
  'near-composer': 'rounded-lg px-4 py-3',
  'above-input': 'px-4 py-3',
  'inside-input': 'm-3 rounded-lg px-4 py-3'
} as const satisfies Record<AgentFreeUsePlacement, string>

const { placement } = defineProps<{ placement: AgentFreeUsePlacement }>()
const emit = defineEmits<{ notice: [metadata: AgentFreeUseNoticeMetadata] }>()

const { isAuthInitialized, resolvedUserInfo } = useCurrentUser()
const dismissed = useLocalStorage(
  () => freeUseNoticeDismissedKey(resolvedUserInfo.value?.id),
  false,
  { writeDefaults: false }
)

const visible = computed(() => isAuthInitialized.value && !dismissed.value)

watch(
  visible,
  (onScreen) => {
    if (onScreen) emit('notice', { action: 'shown', placement })
  },
  { immediate: true }
)

function onDismiss(): void {
  dismissed.value = true
  emit('notice', { action: 'dismissed', placement })
}
</script>

<template>
  <div
    v-if="visible"
    role="note"
    :aria-label="$t('agent.freeUseNoticeLabel')"
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
      <Button
        variant="link"
        size="unset"
        as="a"
        :href="AGENT_DOCS_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="inline p-0 text-sm/5 font-normal text-primary-background-hover hover:underline hover:underline-offset-4"
        @click="emit('notice', { action: 'learn_more_clicked', placement })"
      >
        {{ $t('g.learnMore') }}
      </Button>
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
