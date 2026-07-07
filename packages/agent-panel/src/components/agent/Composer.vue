<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Textarea from '@/components/ui/Textarea.vue'
import type { ComposerAttachment } from '@/composables/agent/useComposer'
import { useComposer } from '@/composables/agent/useComposer'
import { cn } from '@/utils/cn'

import AttachmentChip from './composer/AttachmentChip.vue'

const { streaming = false } = defineProps<{ streaming?: boolean }>()
const emit = defineEmits<{
  send: [text: string, attachments: ComposerAttachment[]]
  stop: []
  attach: []
}>()

const { t } = useI18n()

const composer = useComposer({
  onSend: (text, attachments) => emit('send', text, attachments),
  isStreaming: () => streaming,
  onStop: () => emit('stop')
})

// Enter sends; Shift+Enter inserts a newline (default textarea behavior). An Enter that
// commits an IME composition (CJK input) must NOT send the half-composed text.
function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return
  event.preventDefault()
  composer.submit()
}

// Parent (asset tray / file picker) stages attachments through this.
defineExpose({
  insert: composer.insert,
  addAttachment: composer.addAttachment
})
</script>

<template>
  <div
    class="rounded-agent border-agent-border bg-agent-surface-raised focus-within:border-agent-border-strong flex flex-col gap-2 border p-2"
  >
    <div
      v-if="composer.attachments.value.length"
      class="flex flex-wrap gap-1.5"
    >
      <AttachmentChip
        v-for="item in composer.attachments.value"
        :key="item.id"
        :name="item.name"
        :preview-url="item.previewUrl"
        @remove="composer.removeAttachment(item.id)"
      />
    </div>

    <Textarea
      v-model="composer.draft.value"
      :placeholder="t('agent.placeholder')"
      rows="1"
      class="max-h-40 min-h-9"
      @keydown.enter="onEnter"
    />

    <div class="flex items-center justify-between">
      <button
        type="button"
        :aria-label="t('agent.attach')"
        class="rounded-agent text-agent-fg-subtle hover:bg-agent-surface-hover hover:text-agent-fg flex size-8 items-center justify-center transition-colors"
        @click="emit('attach')"
      >
        <span class="icon-[lucide--paperclip] size-4" />
      </button>

      <button
        type="button"
        :aria-label="streaming ? t('agent.stop') : t('agent.send')"
        :disabled="!streaming && !composer.canSend.value"
        :class="
          cn(
            'rounded-agent flex size-8 items-center justify-center transition-colors',
            streaming
              ? 'bg-agent-surface-hover text-agent-fg hover:bg-agent-border'
              : 'bg-agent-accent text-agent-accent-fg hover:bg-agent-accent/90 disabled:cursor-not-allowed disabled:opacity-40'
          )
        "
        @click="composer.submit"
      >
        <span
          :class="
            cn(
              'size-4',
              streaming ? 'icon-[lucide--square]' : 'icon-[lucide--arrow-up]'
            )
          "
        />
      </button>
    </div>
  </div>
</template>
