<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Textarea from '@/components/ui/textarea/Textarea.vue'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { cn } from '@comfyorg/tailwind-utils'

import AttachmentChip from './composer/AttachmentChip.vue'

const {
  streaming = false,
  submitting = false,
  canAttach = false,
  canOpenAssets = false,
  selectionTags = [],
  getMentionNodes = () => []
} = defineProps<{
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  canOpenAssets?: boolean
  selectionTags?: SelectedNode[]
  getMentionNodes?: () => SelectedNode[]
}>()
const emit = defineEmits<{
  send: [text: string, attachments: ComposerAttachment[]]
  stop: []
  attach: []
  openAssets: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
}>()

const mentionNodes = ref<SelectedNode[]>([])
function onAddNodesOpen(open: boolean): void {
  if (open) mentionNodes.value = getMentionNodes()
}

const { t } = useI18n()

const composer = useComposer({
  onSend: (text, attachments) => emit('send', text, attachments),
  isStreaming: () => streaming,
  onStop: () => emit('stop')
})

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return
  event.preventDefault()
  composer.submit()
}

const running = computed(() => streaming || submitting)

function onPrimaryAction(): void {
  if (running.value) emit('stop')
  else composer.submit()
}

const textareaRef = useTemplateRef<InstanceType<typeof Textarea>>('textareaRef')
const insertHighlight = ref(false)
const { start: startInsertHighlight } = useTimeoutFn(
  () => {
    insertHighlight.value = false
  },
  1000,
  { immediate: false }
)

function insert(text: string): void {
  composer.insert(text)
  insertHighlight.value = true
  startInsertHighlight()
  textareaRef.value?.focus()
}

defineExpose({
  insert,
  addAttachment: composer.addAttachment,
  updateAttachment: composer.updateAttachment,
  removeAttachment: composer.removeAttachment
})
</script>

<template>
  <div
    :class="
      cn(
        'border-agent-border-strong bg-agent-surface-raised focus-within:border-agent-fg-muted flex flex-col rounded-2xl border transition-colors',
        insertHighlight &&
          'border-agent-accent focus-within:border-agent-accent'
      )
    "
  >
    <div v-if="selectionTags.length" class="flex flex-wrap gap-1.5 px-4 pt-3">
      <span
        v-for="tag in selectionTags"
        :key="tag.id"
        class="rounded-agent bg-agent-pill text-agent-fg inline-flex items-center gap-1.5 py-1 pr-2 pl-1.5 text-xs"
      >
        <span class="text-agent-fg-subtle icon-[lucide--at-sign] size-3.5" />
        <span class="max-w-40 truncate">{{ tag.title }}</span>
        <button
          type="button"
          :aria-label="t('agent.remove')"
          class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg -my-1 -mr-1 flex size-5 cursor-pointer items-center justify-center rounded-full transition-colors"
          @click="emit('removeTag', tag.id)"
        >
          <span class="icon-[lucide--x] size-3.5" />
        </button>
      </span>
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
      ref="textareaRef"
      v-model="composer.draft.value"
      :placeholder="t('agent.placeholder')"
      rows="1"
      class="field-sizing-content max-h-48 min-h-20 resize-none overflow-y-auto rounded-xl bg-transparent px-4 py-3 focus-visible:ring-0"
      @keydown.enter="onEnter"
    />

    <div class="flex items-center justify-between px-3 py-2">
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          v-tooltip.top="{ value: t('agent.addToPrompt'), showDelay: 300 }"
          :aria-label="t('agent.addToPrompt')"
          class="rounded-agent text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex size-8 cursor-pointer items-center justify-center transition-colors"
        >
          <span class="icon-[lucide--plus] size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            side="top"
            align="start"
            :side-offset="4"
            class="agent-scope rounded-agent border-agent-border bg-agent-surface-raised z-1100 w-64 border p-1 shadow-lg"
          >
            <DropdownMenuSub @update:open="onAddNodesOpen">
              <DropdownMenuSubTrigger
                class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
              >
                <span class="icon-[lucide--box-select] size-3.5 shrink-0" />
                <span class="truncate">
                  {{ t('agent.addNodesFromGraph') }}
                </span>
                <span
                  class="ml-auto icon-[lucide--chevron-right] size-3.5 shrink-0"
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  :side-offset="4"
                  class="agent-scope rounded-agent border-agent-border bg-agent-surface-raised z-1100 max-h-64 w-64 overflow-y-auto border p-1 shadow-lg"
                >
                  <DropdownMenuItem
                    v-for="node in mentionNodes"
                    :key="node.id"
                    class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
                    @select="emit('mentionPick', node)"
                  >
                    <span class="truncate">{{ node.title }}</span>
                    <span class="text-agent-fg-subtle ml-auto shrink-0">
                      #{{ node.id }}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="!mentionNodes.length"
                    disabled
                    class="text-agent-fg-subtle px-2 py-1.5 text-xs"
                  >
                    {{ t('agent.noNodesToMention') }}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuItem
              v-if="canOpenAssets"
              class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
              @select="emit('openAssets')"
            >
              <span class="icon-[lucide--image] size-3.5 shrink-0" />
              <span class="truncate">{{ t('agent.addFromAssets') }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="canAttach"
              class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
              @select="emit('attach')"
            >
              <span class="icon-[lucide--paperclip] size-3.5 shrink-0" />
              <span class="truncate">{{ t('agent.attachFiles') }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

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
          :aria-label="running ? t('agent.stop') : t('agent.send')"
          :disabled="!running && !composer.canSend.value"
          :class="
            cn(
              'flex size-8 items-center justify-center rounded-xl transition-colors',
              running
                ? 'bg-agent-surface-hover text-agent-fg hover:bg-agent-border cursor-pointer'
                : 'bg-agent-fg text-agent-surface hover:bg-agent-fg/90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
            )
          "
          @click="onPrimaryAction"
        >
          <span
            :class="
              cn(
                'size-4',
                running ? 'icon-[lucide--square]' : 'icon-[lucide--arrow-up]'
              )
            "
          />
        </button>
      </div>
    </div>
  </div>
</template>
