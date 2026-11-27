<script setup lang="ts">
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSafeLocalStorage } from '@/platform/storage/useSafeStorage'
import { AGENT_COST_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'

import { agentCostNoticeDismissedKey } from './agentCostNoticeDismissal'

const { isAuthInitialized, resolvedUserInfo } = useCurrentUser()
const dismissed = useSafeLocalStorage(
  () => agentCostNoticeDismissedKey(resolvedUserInfo.value?.id),
  false,
  { writeDefaults: false }
)

const visible = computed(() => isAuthInitialized.value && !dismissed.value)
</script>

<template>
  <div
    v-if="visible"
    role="note"
    :aria-label="$t('agent.agentCostNoticeLabel')"
    class="flex items-start gap-3 rounded-lg bg-primary/30 px-4 py-3 text-foreground"
  >
    <p class="my-0 min-w-0 flex-1 text-sm/5">
      {{ $t('agent.agentCostNotice') }}
      <Button
        variant="link"
        size="unset"
        as="a"
        :href="AGENT_COST_DOCS_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="inline p-0 text-sm/5 font-normal text-foreground underline underline-offset-4"
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
      @click="dismissed = true"
    >
      <i aria-hidden="true" class="icon-[lucide--x] size-5" />
    </Button>
  </div>
</template>
