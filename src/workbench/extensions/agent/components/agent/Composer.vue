<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Textarea from '../ui/Textarea.vue'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { cn } from '@comfyorg/tailwind-utils'

import AttachmentChip from './composer/AttachmentChip.vue'
import SelectionTagChip from './composer/SelectionTagChip.vue'

const {
  streaming = false,
  submitting = false,
  canAttach = false,
  selectionTags = []
} = defineProps<{
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  selectionTags?: SelectedNode[]
}>()
const emit = defineEmits<{
  send: [text: string, attachments: ComposerAttachment[]]
  stop: []
  attach: []
  removeTag: [id: string]
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
  addAttachment: composer.addAttachment,
  updateAttachment: composer.updateAttachment,
  removeAttachment: composer.removeAttachment
})
</script>

<template>
  <div
    class="border-agent-border-strong bg-agent-surface-raised focus-within:border-agent-fg-muted flex flex-col rounded-2xl border transition-colors"
  >
    <div v-if="selectionTags.length" class="flex flex-wrap gap-1.5 px-4 pt-3">
      <SelectionTagChip
        v-for="tag in selectionTags"
        :key="tag.id"
        :title="tag.title"
        @remove="emit('removeTag', tag.id)"
      />
    </div>

    <div
      v-if="composer.attachments.value.length"
      class="flex flex-wrap gap-1.5 px-4 pt-3"
    >
      <AttachmentChip
        v-for="item in composer.attachments.value"
        :key="item.id"
        :name="item.name"
        :preview-url="item.previewUrl"
        :uploading="item.uploading"
        @remove="composer.removeAttachment(item.id)"
      />
    </div>

    <Textarea
      v-model="composer.draft.value"
      :placeholder="t('agent.placeholder')"
      rows="1"
      class="max-h-48 min-h-20 px-4 py-3"
      @keydown.enter="onEnter"
    />

    <div class="flex items-center justify-between px-3 py-2">
      <div class="flex items-center gap-1">
        <button
          v-if="canAttach"
          type="button"
          :aria-label="t('agent.attach')"
          class="rounded-agent text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex size-8 cursor-pointer items-center justify-center transition-colors"
          @click="emit('attach')"
        >
          <span class="icon-[lucide--paperclip] size-4" />
        </button>
        <button
          type="button"
          :aria-label="t('agent.mention')"
          class="rounded-agent text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex size-8 cursor-pointer items-center justify-center transition-colors"
          @click="composer.insert('@')"
        >
          <span class="icon-[lucide--at-sign] size-4" />
        </button>
      </div>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="text-agent-fg-muted hover:bg-agent-surface-hover flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs transition-colors"
          :aria-label="t('agent.modelAuto')"
        >
          <span>{{ t('agent.modelAuto') }}</span>
          <span class="icon-[lucide--chevron-down] size-3" />
        </button>
        <button
          type="button"
          :aria-label="streaming ? t('agent.stop') : t('agent.send')"
          :disabled="!streaming && !composer.canSend.value"
          :class="
            cn(
              'flex size-8 items-center justify-center rounded-xl transition-colors',
              streaming
                ? 'bg-agent-surface-hover text-agent-fg hover:bg-agent-border cursor-pointer'
                : 'bg-agent-fg text-agent-surface hover:bg-agent-fg/90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
            )
          "
          @click="composer.submit"
        >
          <span
            :class="
              cn(
                'size-4',
                submitting
                  ? 'icon-[lucide--loader-circle] animate-spin'
                  : streaming
                    ? 'icon-[lucide--square]'
                    : 'icon-[lucide--arrow-up]'
              )
            "
          />
        </button>
      </div>
    </div>
  </div>
</template>
