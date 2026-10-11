<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useStorage } from '@vueuse/core'
import { computed, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type {
  AgentFreeUseNoticeMetadata,
  AgentFreeUsePlacement
} from '@/platform/telemetry/types'
import { AGENT_DOCS_URL } from '@/workbench/extensions/agent/constants'

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
// writeDefaults false: an account that resolves after mount would otherwise
// plant `false` under the signed-out key on its way to its own.
const dismissed = useStorage(
  () => freeUseNoticeDismissedKey(resolvedUserInfo.value?.id),
  false,
  undefined,
  { writeDefaults: false }
)

/**
 * `useStorage` re-reads when its key getter changes, so the dismissal is only
 * authoritative once auth has settled on the account that owns the key.
 * Rendering before then flashes the notice at a viewer who had dismissed it and
 * reports an impression they did not choose to see.
 */
const visible = computed(() => isAuthInitialized.value && !dismissed.value)

let reportedShown = false
watch(
  visible,
  (onScreen) => {
    if (!onScreen || reportedShown) return
    reportedShown = true
    emit('notice', { action: 'shown', placement })
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
