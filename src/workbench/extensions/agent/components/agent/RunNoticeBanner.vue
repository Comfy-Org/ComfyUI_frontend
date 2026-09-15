<script setup lang="ts">
import { useStorage } from '@vueuse/core'

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
    class="relative flex items-start gap-2 overflow-hidden rounded-lg bg-base-background p-4 ring-1 ring-border-subtle before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary-background"
  >
    <span
      class="icon-[heroicons--information-circle-20-solid] size-5 shrink-0 text-primary-background"
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
    <button
      type="button"
      :aria-label="$t('agent.dismiss')"
      class="flex size-5 shrink-0 cursor-pointer items-center justify-center p-0 text-muted-foreground hover:text-base-foreground"
      @click="dismissed = true"
    >
      <span class="icon-[lucide--x] size-5" />
    </button>
  </div>
</template>
