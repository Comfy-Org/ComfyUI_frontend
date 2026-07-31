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
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildTooltipConfig } from '@/composables/useTooltipConfig'

import Textarea from '@/components/ui/textarea/Textarea.vue'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { cn } from '@comfyorg/tailwind-utils'

import AttachmentChip from './composer/AttachmentChip.vue'
import RunModePopover from './composer/RunModePopover.vue'

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

const duplicateIdClass =
  'shrink-0 rounded-[26px] bg-charcoal-400 px-2 py-0.5 font-mono text-xs/4 font-medium text-smoke-800'

const mentionNodes = ref<SelectedNode[]>([])
function loadMentionNodes(): void {
  mentionNodes.value = getMentionNodes().toSorted((a, b) =>
    a.title.localeCompare(b.title)
  )
}

function onAddNodesOpen(open: boolean): void {
  if (open) loadMentionNodes()
}

const mentionOpen = ref(false)
const mentionQuery = ref('')
const mentionStart = ref(-1)
const mentionActive = ref(0)

const mentionMatches = computed(() => {
  if (!mentionOpen.value) return []
  const query = mentionQuery.value.toLowerCase()
  return mentionNodes.value.filter(
    (node) =>
      node.title.toLowerCase().includes(query) || node.id.includes(query)
  )
})

const mentionVisible = computed(() => mentionMatches.value.length > 0)

function duplicatedTitles(nodes: SelectedNode[]): Set<string> {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const node of nodes) {
    if (seen.has(node.title)) dupes.add(node.title)
    else seen.add(node.title)
  }
  return dupes
}

const graphDupes = computed(() => duplicatedTitles(mentionNodes.value))
const tagDupes = computed(() => duplicatedTitles(selectionTags))

function closeMention(): void {
  mentionOpen.value = false
  mentionQuery.value = ''
  mentionStart.value = -1
  mentionActive.value = 0
}

function syncMention(event: Event): void {
  const el = event.target as HTMLTextAreaElement
  const caret = el.selectionStart ?? 0
  const text = el.value
  const at = text.lastIndexOf('@', caret - 1)
  const atValid =
    at !== -1 && at < caret && (at === 0 || /\s/.test(text[at - 1]))
  if (!atValid) {
    closeMention()
    return
  }
  const query = text.slice(at + 1, caret)
  if (query.includes('\n')) {
    closeMention()
    return
  }
  if (!mentionOpen.value) loadMentionNodes()
  mentionOpen.value = true
  mentionStart.value = at
  mentionQuery.value = query
  mentionActive.value = 0
}

function pickMention(node: SelectedNode): void {
  emit('mentionPick', node)
  const draft = composer.draft.value
  const before = draft.slice(0, mentionStart.value)
  const end = mentionStart.value + 1 + mentionQuery.value.length
  let after = draft.slice(end)
  if (after.startsWith(' ') && (before === '' || before.endsWith(' ')))
    after = after.slice(1)
  composer.draft.value = before + after
  closeMention()
  textareaRef.value?.focus()
}

function onComposerKeydown(event: KeyboardEvent): void {
  if (mentionVisible.value && !event.isComposing && !event.shiftKey) {
    const matches = mentionMatches.value
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      mentionActive.value = (mentionActive.value + 1) % matches.length
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      mentionActive.value =
        (mentionActive.value - 1 + matches.length) % matches.length
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      pickMention(matches[mentionActive.value])
      return
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      closeMention()
      return
    }
  }
  if (event.key === 'Enter') onEnter(event)
}

const CARET_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End']

function onComposerKeyup(event: KeyboardEvent): void {
  if (mentionOpen.value && CARET_KEYS.includes(event.key)) syncMention(event)
}

const mentionListRef = useTemplateRef<HTMLDivElement>('mentionListRef')
watch(mentionActive, async () => {
  await nextTick()
  mentionListRef.value
    ?.querySelector('[aria-selected="true"]')
    ?.scrollIntoView?.({ block: 'nearest' })
})

const { t } = useI18n()

const placeholderHint = computed(() => {
  const [firstLine = '', secondLine = ''] = t('agent.placeholder').split('\n')
  const addNodes = t('agent.addNodesFromGraph').toLocaleLowerCase()
  return {
    firstLine,
    addNodes,
    dragAssets: secondLine.slice(addNodes.length).trim()
  }
})

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

async function openPlaceholderNodePicker(): Promise<void> {
  loadMentionNodes()
  mentionOpen.value = true
  mentionQuery.value = ''
  mentionStart.value = 0
  mentionActive.value = 0
  await nextTick()
  textareaRef.value?.focus()
}

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
        'border-agent-border-strong bg-agent-surface focus-within:border-agent-fg relative flex flex-col rounded-[10px] border transition-colors',
        insertHighlight &&
          'border-agent-accent focus-within:border-agent-accent'
      )
    "
  >
    <div
      v-if="mentionVisible"
      id="agent-mention-listbox"
      ref="mentionListRef"
      role="listbox"
      :aria-label="t('agent.addNodesFromGraph')"
      class="bg-agent-surface-raised absolute inset-x-0 bottom-full z-1100 mb-2 max-h-64 overflow-y-auto rounded-[10px] border border-black/10 p-1 shadow-md"
      @mousedown.prevent
    >
      <div
        v-for="(node, index) in mentionMatches"
        :id="`agent-mention-opt-${index}`"
        :key="node.id"
        role="option"
        :aria-selected="index === mentionActive"
        :class="
          cn(
            'text-agent-fg flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm/5',
            index === mentionActive && 'bg-neutral-100 text-neutral-900'
          )
        "
        @mouseenter="mentionActive = index"
        @click="pickMention(node)"
      >
        <span class="truncate">{{ node.title }}</span>
        <span
          v-if="graphDupes.has(node.title)"
          :class="cn(duplicateIdClass, 'ml-auto')"
        >
          #{{ node.id }}
        </span>
      </div>
    </div>

    <div
      v-if="$slots.header"
      class="bg-agent-surface flex h-11 shrink-0 items-center rounded-t-[10px] px-2"
    >
      <slot name="header" />
    </div>

    <div v-if="selectionTags.length" class="flex flex-wrap gap-2 p-3">
      <span
        v-for="tag in selectionTags"
        :key="tag.id"
        class="bg-agent-surface-hover text-agent-fg inline-flex h-7 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-xs/4 font-medium"
      >
        <span class="icon-[comfy--node] size-3.5" />
        <span class="max-w-40 truncate">{{ tag.title }}</span>
        <span
          v-if="graphDupes.has(tag.title) || tagDupes.has(tag.title)"
          :class="duplicateIdClass"
          >#{{ tag.id }}</span
        >
        <button
          type="button"
          :aria-label="t('agent.remove')"
          class="text-agent-fg-muted hover:text-agent-fg flex size-3.5 cursor-pointer items-center justify-center transition-colors"
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

    <div class="relative min-h-16">
      <Textarea
        ref="textareaRef"
        v-model="composer.draft.value"
        :aria-label="t('agent.placeholder')"
        rows="1"
        class="field-sizing-content max-h-50 min-h-16 w-full min-w-0 resize-none overflow-x-hidden overflow-y-auto rounded-none bg-transparent px-3 py-2 text-sm/5 wrap-break-word whitespace-pre-wrap focus-visible:ring-0"
        :aria-expanded="mentionVisible"
        aria-controls="agent-mention-listbox"
        :aria-activedescendant="
          mentionVisible ? `agent-mention-opt-${mentionActive}` : undefined
        "
        @keydown="onComposerKeydown"
        @keyup="onComposerKeyup"
        @input="syncMention"
        @click="syncMention"
        @blur="closeMention"
      />

      <div
        v-if="!composer.draft.value"
        class="text-agent-fg-muted pointer-events-none absolute inset-x-[12px] top-[8px] z-10 text-[14px]/[20px]"
      >
        <span class="block h-[20px]">{{ placeholderHint.firstLine }}</span>
        <div class="-mt-px flex h-[20px] items-center">
          <button
            type="button"
            aria-controls="agent-mention-listbox"
            :aria-expanded="mentionVisible"
            class="hover:text-agent-fg focus-visible:text-agent-fg focus-visible:outline-agent-fg pointer-events-auto mr-[4px] ml-[-5px] inline-flex h-[20px] shrink-0 cursor-pointer items-center gap-[4px] rounded-[8px] px-[4px] text-[14px]/[20px] transition-colors focus-visible:outline-1"
            @click="openPlaceholderNodePicker"
          >
            <span
              class="icon-[lucide--square-mouse-pointer] size-[14px] shrink-0"
            />
            <span>{{ placeholderHint.addNodes }},</span>
          </button>
          <span>{{ placeholderHint.dragAssets }}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between px-3 py-2">
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          v-tooltip.top="buildTooltipConfig(t('agent.addToPrompt'))"
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
                    <span
                      v-if="graphDupes.has(node.title)"
                      :class="cn(duplicateIdClass, 'ml-auto')"
                    >
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
        <RunModePopover />
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
