<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import type { DeleteApprovalPart } from '../../../services/agent/agentMessageParts'
import AskNodeList from './AskNodeList.vue'

const { part, answering = false } = defineProps<{
  part: DeleteApprovalPart
  answering?: boolean
}>()
const emit = defineEmits<{
  answer: [askId: string, selection: 'delete' | 'keep']
}>()

const { t } = useI18n()

const decision = computed(() => {
  const resolution = part.resolution
  if (!resolution) return undefined
  if (resolution.status === 'closed') return t('agent.deleteApproval.closed')
  if (resolution.status === 'retired') return t('agent.deleteApproval.retired')
  if (resolution.status === 'unknown')
    return t('agent.deleteApproval.unconfirmed')
  if (resolution.selected.includes('delete'))
    return t('agent.deleteApproval.deleted')
  if (resolution.selected.includes('keep'))
    return t('agent.deleteApproval.kept')
  return t('agent.deleteApproval.answered')
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

    <AskNodeList :nodes="part.nodes" :hidden-count="part.hiddenNodeCount" />

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
