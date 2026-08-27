<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, inject, nextTick, ref, useTemplateRef, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildAgentTooltipConfig } from '@/composables/useTooltipConfig'

import Textarea from '@/components/ui/textarea/Textarea.vue'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { selectedNodeKey } from '../../composables/agent/useCanvasSelection'
import type { WorkflowReference } from '../../types/workflowReference'
import { cn } from '@comfyorg/tailwind-utils'

import AttachmentChip from './composer/AttachmentChip.vue'
import RunModePopover from './composer/RunModePopover.vue'
import AgentTooltip from './AgentTooltip.vue'

const {
  streaming = false,
  submitting = false,
  canAttach = false,
  canOpenAssets = false,
  selectionTags = [],
  workflowReferences = [],
  availableWorkflows = [],
  editableWorkflowId,
  getMentionNodes = () => []
} = defineProps<{
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  canOpenAssets?: boolean
  selectionTags?: SelectedNode[]
  workflowReferences?: WorkflowReference[]
  availableWorkflows?: WorkflowReference[]
  editableWorkflowId?: string
  getMentionNodes?: () => SelectedNode[]
}>()
const emit = defineEmits<{
  send: [
    text: string,
    attachments: ComposerAttachment[],
    workflowReferences?: WorkflowReference[]
  ]
  stop: []
  attach: []
  openAssets: []
  selectNodes: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
  workflowReferencePick: [workflow: WorkflowReference]
  requestWorkflowReferences: []
  removeWorkflowReference: [id: string]
}>()
const { t } = useI18n()

const assetDragActive = inject<Readonly<Ref<boolean>>>(
  'agentAssetDragActive',
  ref(false)
)

const duplicateIdClass =
  'shrink-0 rounded-[26px] bg-charcoal-400 px-1 py-0.5 font-mono text-xs/4 font-medium text-smoke-800'

const graphNodes = ref<SelectedNode[]>([])
const mentionNodes = computed(() => {
  const referenced = new Set(selectionTags.map(selectedNodeKey))
  return graphNodes.value.filter(
    (node) => !referenced.has(selectedNodeKey(node))
  )
})
const eligibleWorkflows = computed(() => {
  const selectedIds = new Set(workflowReferences.map(({ id }) => id))
  return availableWorkflows
    .filter(({ id }) => id !== editableWorkflowId && !selectedIds.has(id))
    .toSorted((a, b) => a.name.localeCompare(b.name))
})
function loadMentionNodes(): void {
  graphNodes.value = getMentionNodes().toSorted((a, b) =>
    a.title.localeCompare(b.title)
  )
}

const mentionOpen = ref(false)
const mentionSection = ref<'root' | 'nodes' | 'workflows'>('root')
const workflowSubmenuOpen = ref(false)
const mentionQuery = ref('')
const mentionStart = ref(-1)
const mentionActive = ref(0)

type MentionMatch =
  | { kind: 'section'; id: 'nodes' | 'workflows'; label: string }
  | { kind: 'back'; id: 'back'; label: string }
  | { kind: 'node'; id: string; label: string; node: SelectedNode }
  | {
      kind: 'workflow'
      id: string
      label: string
      workflow: WorkflowReference
    }

/**
 * Nodes already in the basket, hidden from the picker - re-picking one is a
 * no-op and only makes the list harder to scan.
 *
 * Filtered here rather than out of `mentionNodes`, because that list also
 * feeds `graphDupes`: dropping a staged node from it would stop its chip
 * showing the `#id` that disambiguates it from a same-titled node still in
 * the graph.
 */
const stagedKeys = computed(
  () => new Set(selectionTags.map((tag) => selectedNodeKey(tag)))
)

const mentionMatches = computed<MentionMatch[]>(() => {
  if (!mentionOpen.value) return []
  if (mentionSection.value === 'root') {
    return [
      { kind: 'section', id: 'nodes', label: t('agent.nodes') },
      { kind: 'section', id: 'workflows', label: t('agent.workflows') }
    ]
  }

  const query = mentionQuery.value.toLowerCase()
  const back: MentionMatch = { kind: 'back', id: 'back', label: t('g.back') }
  if (mentionSection.value === 'nodes') {
    return [
      back,
      ...mentionNodes.value
        .filter(
          (node) =>
            !stagedKeys.value.has(selectedNodeKey(node)) &&
            (node.title.toLowerCase().includes(query) ||
              node.id.includes(query))
        )
        .map(
          (node): MentionMatch => ({
            kind: 'node',
            id: selectedNodeKey(node),
            label: node.title,
            node
          })
        )
    ]
  }

  return [
    back,
    ...eligibleWorkflows.value
      .filter(({ name }) => name.toLowerCase().includes(query))
      .map(
        (workflow): MentionMatch => ({
          kind: 'workflow',
          id: workflow.id,
          label: workflow.name,
          workflow
        })
      )
  ]
})

const mentionVisible = computed(() => mentionOpen.value)
const mentionHasResults = computed(
  () => mentionSection.value === 'root' || mentionMatches.value.length > 1
)

function duplicatedTitles(nodes: SelectedNode[]): Set<string> {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const node of nodes) {
    if (seen.has(node.title)) dupes.add(node.title)
    else seen.add(node.title)
  }
  return dupes
}

const graphDupes = computed(() => duplicatedTitles(graphNodes.value))
const tagDupes = computed(() => duplicatedTitles(selectionTags))

watch(
  () => selectionTags,
  (tags) => {
    if (tags.length) loadMentionNodes()
  },
  { immediate: true }
)

function closeMention(): void {
  mentionOpen.value = false
  mentionSection.value = 'root'
  mentionQuery.value = ''
  mentionStart.value = -1
  mentionActive.value = 0
}

function resetMentionActive(): void {
  mentionActive.value =
    mentionSection.value !== 'root' &&
    mentionQuery.value.length > 0 &&
    mentionMatches.value.length > 1
      ? 1
      : 0
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
  if (!mentionOpen.value) {
    loadMentionNodes()
    mentionSection.value = 'root'
  }
  mentionOpen.value = true
  mentionStart.value = at
  mentionQuery.value = query
  resetMentionActive()
}

function pickMention(match: MentionMatch): void {
  if (match.kind === 'section') {
    mentionSection.value = match.id
    if (match.id === 'workflows') emit('requestWorkflowReferences')
    resetMentionActive()
    return
  }
  if (match.kind === 'back') {
    mentionSection.value = 'root'
    mentionActive.value = 0
    return
  }
  if (match.kind === 'node') emit('mentionPick', match.node)
  else emit('workflowReferencePick', match.workflow)
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

function onWorkflowSubmenuOpenChange(open: boolean): void {
  if (open) emit('requestWorkflowReferences')
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
    ?.querySelector('[data-active="true"]')
    ?.scrollIntoView?.({ block: 'nearest' })
})

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
  onSend: (text, attachments) => {
    if (workflowReferences.length > 0)
      emit('send', text, attachments, [...workflowReferences])
    else emit('send', text, attachments)
  },
  isStreaming: () => streaming,
  onStop: () => emit('stop')
})

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return
  event.preventDefault()
  composer.submit()
}

const running = computed(() => streaming || submitting)
const primaryActionTooltip = computed(() =>
  composer.canSend.value
    ? t('agent.send')
    : t('agent.addPromptToSend', 'Add a prompt to send')
)

function onPrimaryAction(): void {
  if (running.value) emit('stop')
  else composer.submit()
}

const textareaRef = useTemplateRef<InstanceType<typeof Textarea>>('textareaRef')

function insert(text: string): void {
  composer.insert(text)
  textareaRef.value?.focus()
}

function replaceDraft(text: string): void {
  composer.draft.value = text
  textareaRef.value?.focus()
}

defineExpose({
  insert,
  replaceDraft,
  addAttachment: composer.addAttachment,
  updateAttachment: composer.updateAttachment,
  removeAttachment: composer.removeAttachment
})
</script>

<template>
  <div
    class="border-agent-border-strong bg-agent-surface relative flex flex-col rounded-[10px] border"
  >
    <div
      v-if="mentionVisible"
      id="agent-reference-menu"
      ref="mentionListRef"
      data-testid="agent-reference-menu"
      role="menu"
      :aria-label="t('agent.addToPrompt')"
      class="bg-agent-surface-raised absolute inset-x-0 bottom-full z-1100 mb-[-35px] max-h-64 overflow-y-auto rounded-[10px] border border-white/10 p-1 font-inter shadow-md"
      @mousedown.prevent
    >
      <div
        v-if="mentionSection === 'root'"
        class="text-agent-fg-muted flex h-6 items-center px-1.5 py-1 text-xs/4"
      >
        {{ t('agent.reference') }}
      </div>
      <div
        v-for="(match, index) in mentionMatches"
        :id="`agent-reference-item-${index}`"
        :key="`${match.kind}:${match.id}`"
        role="menuitem"
        :data-active="index === mentionActive"
        :class="
          cn(
            'text-agent-fg flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-normal outline-none',
            index === mentionActive && 'bg-agent-surface-hover'
          )
        "
        @mouseenter="mentionActive = index"
        @click="pickMention(match)"
      >
        <span
          v-if="match.kind === 'section' && match.id === 'nodes'"
          class="icon-[comfy--node] size-3.5 shrink-0"
        />
        <span
          v-else-if="match.kind === 'section' && match.id === 'workflows'"
          class="icon-[comfy--workflow] size-3.5 shrink-0"
        />
        <span
          v-else-if="match.kind === 'back'"
          class="icon-[lucide--chevron-left] size-4 shrink-0"
        />
        <span class="min-w-0 flex-1 truncate">{{ match.label }}</span>
        <span
          v-if="match.kind === 'node' && graphDupes.has(match.node.title)"
          :class="cn(duplicateIdClass, 'ml-auto')"
        >
          #{{ match.node.id }}
        </span>
        <span
          v-if="match.kind === 'section'"
          class="icon-[lucide--chevron-right] size-4 shrink-0"
        />
      </div>
      <div
        v-if="!mentionHasResults"
        role="status"
        class="text-agent-fg-muted px-2 py-1 text-xs"
      >
        {{
          mentionSection === 'workflows'
            ? t('agent.noWorkflowsToReference')
            : t('agent.noNodesToReference')
        }}
      </div>
    </div>

    <div
      v-if="$slots.header"
      class="bg-agent-surface flex h-11 shrink-0 items-center rounded-t-[10px] px-2"
    >
      <slot name="header" />
    </div>

    <div
      :class="
        cn(
          'relative flex flex-col border transition-colors',
          assetDragActive
            ? 'border-agent-border h-28 rounded-lg border-dashed bg-charcoal-500'
            : 'bg-agent-surface-raised focus-within:border-agent-fg-muted min-h-28 rounded-[10px] border-white/15'
        )
      "
    >
      <div
        v-if="assetDragActive"
        role="status"
        class="absolute inset-px z-20 flex flex-col items-center justify-center gap-2 rounded-[7px] bg-charcoal-500 font-inter text-[14px] leading-[normal] font-normal text-smoke-600"
      >
        <span
          aria-hidden="true"
          class="icon-[lucide--upload] size-6 shrink-0 text-muted-foreground"
        />
        <span>{{ t('agent.dragAndDropAssets') }}</span>
      </div>
      <div
        v-if="selectionTags.length"
        data-testid="composer-node-section"
        class="flex flex-wrap items-center gap-2 border-b border-border-default p-3"
      >
        <span
          v-for="tag in selectionTags"
          :key="selectedNodeKey(tag)"
          class="bg-agent-surface-hover text-agent-fg inline-flex h-7 items-center gap-1 rounded-lg border border-border-default px-2.5 text-xs/4 font-medium transition-colors hover:bg-tertiary-background-hover"
        >
          <span class="flex items-center gap-1">
            <span class="text-agent-fg-muted icon-[comfy--node] size-3.5" />
            <span class="max-w-40 truncate">{{ tag.title }}</span>
            <span
              v-if="graphDupes.has(tag.title) || tagDupes.has(tag.title)"
              :class="duplicateIdClass"
              >#{{ tag.id }}</span
            >
          </span>
          <button
            v-tooltip.top="buildAgentTooltipConfig(t('agent.remove'))"
            type="button"
            :aria-label="
              t('agent.removeNodeLabel', { node: `${tag.title} #${tag.id}` })
            "
            class="text-agent-fg-muted hover:text-agent-fg flex size-3.5 cursor-pointer items-center justify-center transition-colors"
            @click.stop="emit('removeTag', selectedNodeKey(tag))"
          >
            <span class="icon-[lucide--x] size-3.5 shrink-0" />
          </button>
        </span>
      </div>

      <div
        v-if="composer.attachments.value.length"
        data-testid="composer-asset-section"
        class="flex flex-wrap gap-2 p-3"
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

      <div
        data-testid="composer-inline-input"
        class="flex min-h-16 flex-wrap items-start gap-1 p-3"
      >
        <span
          v-for="workflow in workflowReferences"
          :key="workflow.id"
          data-testid="workflow-reference-chip"
          class="group relative inline-flex max-w-full items-center rounded-sm bg-primary-background/30 px-1 py-0.5 text-xs/[15px] font-normal text-primary-background-hover ring-1 ring-primary-background/30 ring-inset"
        >
          <span class="mr-1 icon-[comfy--workflow] size-3.5 shrink-0" />
          <span class="max-w-40 truncate">{{ workflow.name }}</span>
          <button
            v-tooltip.top="buildAgentTooltipConfig(t('agent.remove'))"
            type="button"
            :aria-label="
              t('agent.removeWorkflowReferenceLabel', {
                workflow: workflow.name
              })
            "
            class="hover:text-agent-fg pointer-events-none absolute top-1/2 right-1 flex size-3.5 -translate-y-1/2 cursor-pointer items-center justify-center bg-[color-mix(in_srgb,var(--color-primary-background)_30%,var(--color-agent-surface-raised))] p-0 opacity-0 transition-[color,opacity] group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
            @click="emit('removeWorkflowReference', workflow.id)"
          >
            <span class="icon-[lucide--x] size-3.5 shrink-0" />
          </button>
        </span>

        <div class="relative min-h-7 min-w-32 flex-1">
          <Textarea
            ref="textareaRef"
            v-model="composer.draft.value"
            :aria-label="t('agent.placeholder')"
            rows="1"
            class="text-agent-fg field-sizing-content max-h-100 min-h-7 w-full min-w-0 resize-none overflow-x-hidden overflow-y-auto rounded-none bg-transparent p-0 font-inter text-[14px]/5 font-normal wrap-break-word whitespace-pre-wrap focus-visible:ring-0"
            :aria-expanded="mentionVisible"
            aria-controls="agent-reference-menu"
            :aria-activedescendant="
              mentionVisible
                ? `agent-reference-item-${mentionActive}`
                : undefined
            "
            @keydown="onComposerKeydown"
            @keyup="onComposerKeyup"
            @input="syncMention"
            @click="syncMention"
            @blur="closeMention"
          />

          <div
            v-if="!composer.draft.value && !workflowReferences.length"
            class="text-agent-fg-muted pointer-events-none absolute inset-x-0 top-0 z-10 font-inter text-[14px]/[20px] font-normal"
          >
            <span>{{ placeholderHint.firstLine }}</span>
            <button
              type="button"
              class="text-agent-fg-muted hover:text-agent-fg focus-visible:text-agent-fg focus-visible:outline-agent-fg pointer-events-auto mr-[4px] ml-[-5px] inline-flex h-[20px] shrink-0 cursor-pointer items-center gap-[4px] rounded-[8px] px-[4px] align-top text-[14px]/[20px] transition-colors focus-visible:outline-1"
              @click="emit('selectNodes')"
            >
              <span
                class="icon-[lucide--mouse-pointer-click] size-[14px] shrink-0"
              />
              <span class="underline decoration-dashed underline-offset-2"
                >{{ placeholderHint.addNodes }},</span
              >
            </button>
            <span>{{ placeholderHint.dragAssets }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between px-3 py-2">
        <DropdownMenuRoot>
          <DropdownMenuTrigger
            v-tooltip.top="buildAgentTooltipConfig(t('agent.addToPrompt'))"
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
              class="agent-scope bg-agent-surface-raised z-1100 box-border w-max min-w-[186px] rounded-[10px] border border-white/10 p-1 font-inter shadow-lg"
            >
              <DropdownMenuItem
                class="text-agent-fg data-highlighted:bg-agent-surface-hover mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                @select="emit('selectNodes')"
              >
                <span class="icon-[comfy--node] size-4 shrink-0" />
                <span class="whitespace-nowrap">
                  {{ t('agent.nodes') }}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSub
                v-model:open="workflowSubmenuOpen"
                @update:open="onWorkflowSubmenuOpenChange"
              >
                <DropdownMenuSubTrigger
                  class="text-agent-fg data-highlighted:bg-agent-surface-hover mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                >
                  <span class="icon-[comfy--workflow] size-4 shrink-0" />
                  <span class="flex-1 text-left whitespace-nowrap">
                    {{ t('agent.workflows') }}
                  </span>
                  <span class="icon-[lucide--chevron-right] size-4 shrink-0" />
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent
                    :side-offset="4"
                    class="agent-scope bg-agent-surface-raised z-1100 box-border max-h-64 min-w-[186px] overflow-y-auto rounded-[10px] border border-white/10 p-1 font-inter shadow-lg"
                  >
                    <DropdownMenuItem
                      class="text-agent-fg data-highlighted:bg-agent-surface-hover mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                      @select.prevent="workflowSubmenuOpen = false"
                    >
                      <span
                        class="icon-[lucide--chevron-left] size-4 shrink-0"
                      />
                      <span>{{ t('g.back') }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-for="workflow in eligibleWorkflows"
                      :key="workflow.id"
                      class="text-agent-fg data-highlighted:bg-agent-surface-hover box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                      @select="emit('workflowReferencePick', workflow)"
                    >
                      <span class="icon-[comfy--workflow] size-4 shrink-0" />
                      <span class="max-w-64 truncate">{{ workflow.name }}</span>
                    </DropdownMenuItem>
                    <div
                      v-if="eligibleWorkflows.length === 0"
                      class="text-agent-fg-muted px-2 py-1 text-xs"
                    >
                      {{ t('agent.noWorkflowsToReference') }}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuItem
                v-if="canOpenAssets"
                class="text-agent-fg data-highlighted:bg-agent-surface-hover box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                @select="emit('openAssets')"
              >
                <span class="icon-[comfy--image-ai-edit] size-4 shrink-0" />
                <span class="whitespace-nowrap">
                  {{ t('agent.addFromAssets') }}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator
                v-if="canAttach && canOpenAssets"
                class="mt-0 mb-px h-px bg-white/10"
              />
              <DropdownMenuItem
                v-if="canAttach"
                class="text-agent-fg data-highlighted:bg-agent-surface-hover box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                @select="emit('attach')"
              >
                <span class="icon-[lucide--paperclip] size-4 shrink-0" />
                <span class="whitespace-nowrap">{{
                  t('agent.attachFiles')
                }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>

        <div class="flex items-center gap-1">
          <RunModePopover />
          <AgentTooltip :label="primaryActionTooltip" :disabled="running">
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
                    running
                      ? 'icon-[lucide--square]'
                      : 'icon-[lucide--arrow-up]'
                  )
                "
              />
            </button>
          </AgentTooltip>
        </div>
      </div>
    </div>
  </div>
</template>
