<script setup lang="ts">
import { useStorage } from '@vueuse/core'

import Button from '@/components/ui/button/Button.vue'

const { expanded = false, workflowName } = defineProps<{
  expanded?: boolean
  workflowName?: string
}>()

const dismissed = useStorage('Comfy.AgentPanel.runNoticeDismissed', false)
</script>

<template>
  <div
    v-if="!dismissed"
    role="note"
    class="relative flex items-start gap-2 overflow-hidden rounded-lg bg-base-background p-4 ring-1 ring-border-subtle before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-muted-foreground"
  >
    <span
      class="icon-[heroicons--information-circle-20-solid] size-5 shrink-0 text-muted-foreground"
    />
    <p class="my-0 min-w-0 flex-1 text-sm font-medium text-base-foreground">
      <i18n-t v-if="workflowName" keypath="agent.workflowEditNotice" tag="span">
        <template #workflow>
          <span class="underline decoration-solid">{{ workflowName }}</span>
        </template>
      </i18n-t>
      <template v-else>
        {{ $t(expanded ? 'agent.runNoticeExpanded' : 'agent.runNotice') }}
      </template>
    </p>
    <Button
      type="button"
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="$t('agent.dismiss')"
      class="shrink-0"
      @click="dismissed = true"
    >
      <span class="icon-[lucide--x] size-5" />
    </Button>
  </div>
</template>
