<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { text } = defineProps<{ text: string }>()
const emit = defineEmits<{ feedback: [vote: 'up' | 'down' | null] }>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })

const vote = ref<'up' | 'down' | null>(null)

function setVote(next: 'up' | 'down'): void {
  vote.value = vote.value === next ? null : next
  emit('feedback', vote.value)
}
</script>

<template>
  <div class="text-agent-fg-subtle flex items-center gap-0.5">
    <button
      type="button"
      :aria-label="t('agent.helpful')"
      :aria-pressed="vote === 'up'"
      :class="
        cn(
          'rounded-agent hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 items-center justify-center transition-colors',
          vote === 'up' && 'text-agent-accent'
        )
      "
      @click="setVote('up')"
    >
      <span class="icon-[lucide--thumbs-up] size-3.5" />
    </button>
    <button
      type="button"
      :aria-label="t('agent.notHelpful')"
      :aria-pressed="vote === 'down'"
      :class="
        cn(
          'rounded-agent hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 items-center justify-center transition-colors',
          vote === 'down' && 'text-agent-danger'
        )
      "
      @click="setVote('down')"
    >
      <span class="icon-[lucide--thumbs-down] size-3.5" />
    </button>
    <button
      type="button"
      :aria-label="copied ? t('agent.copied') : t('agent.copy')"
      class="rounded-agent hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 items-center justify-center transition-colors"
      @click="copy(text)"
    >
      <span
        :class="
          cn(
            'size-3.5',
            copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
          )
        "
      />
    </button>
  </div>
</template>
