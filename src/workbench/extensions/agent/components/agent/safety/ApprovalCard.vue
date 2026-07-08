<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '../../ui/Button.vue'
import type { ApprovalCard } from './safetyTypes'
import { cn } from '@comfyorg/tailwind-utils'

// NON-optimistic: clicking Approve/Deny emits the answer and moves the card to 'waiting'
// (parent calls answerApproval); it flips to 'resolved' ONLY when the server's
// approval_closed lands. The card never shows "approved" on click alone.
const { card } = defineProps<{ card: ApprovalCard }>()
const emit = defineEmits<{ answer: [approvalId: string, approved: boolean] }>()

const { t } = useI18n()

// A rapid double-click must not emit two answers before the parent flips the card off
// 'open'; an approval is a spend decision.
const answered = ref(false)

function answer(approved: boolean): void {
  if (answered.value) return
  answered.value = true
  emit('answer', card.approvalId, approved)
}
</script>

<template>
  <div
    class="rounded-agent border-agent-border bg-agent-surface-raised space-y-2 border p-3"
  >
    <div class="flex items-center gap-2 text-sm">
      <span class="text-agent-accent icon-[lucide--shield-alert] size-4" />
      <span class="text-agent-fg font-medium">{{
        t('agent.approvalTitle')
      }}</span>
    </div>
    <p class="text-agent-fg-muted text-sm">{{ card.summary }}</p>
    <p class="text-agent-fg-subtle font-mono text-xs">{{ card.tool }}</p>

    <div v-if="card.status === 'open'" class="flex gap-2">
      <Button size="sm" :disabled="answered" @click="answer(true)">
        {{ t('agent.approve') }}
      </Button>
      <Button
        size="sm"
        variant="outline"
        :disabled="answered"
        @click="answer(false)"
      >
        {{ t('agent.deny') }}
      </Button>
    </div>
    <p
      v-else-if="card.status === 'waiting'"
      class="text-agent-fg-muted flex items-center gap-1.5 text-xs"
    >
      <span class="icon-[lucide--loader-circle] size-3.5 animate-spin" />
      {{ t('agent.waiting') }}
    </p>
    <p
      v-else
      :class="
        cn(
          'text-xs',
          card.outcome === 'approved'
            ? 'text-agent-success'
            : 'text-agent-fg-subtle'
        )
      "
    >
      {{ card.outcome }}
    </p>
  </div>
</template>
