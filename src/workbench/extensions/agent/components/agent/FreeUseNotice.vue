<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Message from '@/components/ui/message/Message.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type {
  AgentFreeUseNoticeMetadata,
  AgentFreeUsePlacement
} from '@/platform/telemetry/types'
import { AGENT_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'

import { freeUseNoticeDismissedKey } from './freeUseNoticeDismissal'

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
  <Message
    v-if="visible"
    severity="info"
    role="note"
    aria-live="off"
    :aria-label="$t('agent.freeUseNoticeLabel')"
    :data-placement="placement"
    :class="placement === 'inside-input' && 'm-3 w-auto'"
  >
    <div class="flex items-start gap-3">
      <p class="my-0 min-w-0 flex-1">
        {{ $t('agent.freeUseNotice') }}
        <Button
          variant="link"
          size="link"
          as="a"
          :href="AGENT_DOCS_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="py-0 underline"
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
  </Message>
</template>
