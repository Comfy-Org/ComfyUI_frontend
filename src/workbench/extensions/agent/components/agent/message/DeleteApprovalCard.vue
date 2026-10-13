<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import type {
  AskUserResolution,
  DeleteApprovalPart
} from '../../../services/agent/agentMessageParts'

const { part, answering = false } = defineProps<{
  part: DeleteApprovalPart
  answering?: boolean
}>()
const emit = defineEmits<{
  answer: [askId: string, selection: 'delete' | 'keep']
}>()

const { t } = useI18n()

const STATUS_TEXT: Record<AskUserResolution['status'], string> = {
  answered: 'agent.deleteApproval.answered',
  closed: 'agent.deleteApproval.closed',
  retired: 'agent.deleteApproval.retired',
  unknown: 'agent.deleteApproval.unconfirmed'
}

const decision = computed(() => {
  const resolution = part.resolution
  if (!resolution) return undefined
  if (resolution.status === 'answered') {
    const count = part.nodes.length + part.hiddenNodeCount
    if (resolution.selected.includes('delete'))
      return t('agent.deleteApproval.deleted', count)
    if (resolution.selected.includes('keep'))
      return t('agent.deleteApproval.kept', count)
  }
  return t(STATUS_TEXT[resolution.status])
})
</script>

<template>
  <div
    class="flex w-full flex-col gap-2 overflow-hidden rounded-lg border border-component-node-border bg-secondary-background p-4 shadow-interface"
  >
    <p
      class="m-0 text-sm/5 wrap-break-word whitespace-pre-line text-base-foreground"
    >
      {{ part.prompt }}
    </p>

    <div
      class="flex flex-col gap-1 rounded-md bg-component-node-background p-2 text-xs/5"
    >
      <ul
        :aria-label="t('agent.deleteApproval.nodes')"
        class="m-0 flex max-h-40 list-none flex-col gap-0.5 overflow-y-auto p-0"
      >
        <li
          v-for="node in part.nodes"
          :key="node.id"
          class="flex min-w-0 items-baseline gap-2"
        >
          <span v-if="node.name" class="truncate text-base-foreground">
            {{ node.name }}
          </span>
          <span class="max-w-1/2 shrink-0 truncate text-muted-foreground">
            #{{ node.id }}
          </span>
        </li>
      </ul>
      <p v-if="part.hiddenNodeCount > 0" class="m-0 text-muted-foreground">
        {{ t('agent.deleteApproval.moreNodes', part.hiddenNodeCount) }}
      </p>
    </div>

    <p
      v-if="decision"
      role="status"
      class="m-0 text-sm/5 text-muted-foreground"
    >
      {{ decision }}
    </p>

    <div v-else class="flex h-6 w-full justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        :disabled="answering"
        :aria-busy="answering || undefined"
        @click="emit('answer', part.askId, 'keep')"
      >
        {{ t('agent.deleteApproval.keep') }}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        :disabled="answering"
        :aria-busy="answering || undefined"
        @click="emit('answer', part.askId, 'delete')"
      >
        {{ t('agent.deleteApproval.delete') }}
      </Button>
    </div>
  </div>
</template>
