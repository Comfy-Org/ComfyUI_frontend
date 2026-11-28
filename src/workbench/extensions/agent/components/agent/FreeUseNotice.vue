<script setup lang="ts">
import { computed, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSafeLocalStorage } from '@/platform/storage/useSafeStorage'
import type { AgentFreeUseNoticeMetadata } from '@comfyorg/telemetry/types'
import { AGENT_COST_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'

import { freeUseNoticeDismissedKey } from './freeUseNoticeDismissal'

const emit = defineEmits<{ notice: [metadata: AgentFreeUseNoticeMetadata] }>()
const placement = 'near-composer' as const

const { isAuthInitialized, resolvedUserInfo } = useCurrentUser()
const dismissed = useSafeLocalStorage(
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
    class="flex items-start gap-3 rounded-lg bg-primary/30 px-4 py-3 text-foreground"
  >
    <p class="my-0 min-w-0 flex-1 text-sm/5">
      {{ $t('agent.freeUseNotice') }}
      <Button
        variant="link"
        size="unset"
        as="a"
        :href="AGENT_COST_DOCS_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="inline p-0 text-sm/5 font-normal text-foreground underline underline-offset-4"
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
      <i aria-hidden="true" class="icon-[lucide--x] size-5" />
    </Button>
  </div>
</template>
