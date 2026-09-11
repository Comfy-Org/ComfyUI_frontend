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

import InlinePromptEditor from './composer/InlinePromptEditor.vue'
import type {
  MentionPickerEvent,
  MentionPickerState,
  MentionSection
} from '../../composables/agent/mentionPickerState'
import { transitionMentionPicker } from '../../composables/agent/mentionPickerState'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { selectedNodeKey } from '../../composables/agent/useCanvasSelection'
import type {
  WorkflowReference,
  WorkflowReferenceOption
} from '../../types/workflowReference'
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
  nodeReferenceDisabledReason,
  availableWorkflows = [],
  selectWorkflowReference = async () => undefined,
  editableWorkflowId,
  hasWorkflowTarget = false,
  workflowSelecting = false,
  getMentionNodes = () => []
} = defineProps<{
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  canOpenAssets?: boolean
  selectionTags?: SelectedNode[]
  nodeReferenceDisabledReason?: string
  availableWorkflows?: WorkflowReferenceOption[]
  selectWorkflowReference?: (
    workflow: WorkflowReferenceOption
  ) => Promise<WorkflowReference | undefined>
  editableWorkflowId?: string
  hasWorkflowTarget?: boolean
  workflowSelecting?: boolean
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
  requestWorkflowReferences: []
  removeWorkflowReference: [id: string]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
  workflowTargetRequired: []
}>()
const workflowReferences = defineModel<WorkflowReference[]>(
  'workflowReferences',
  { default: () => [] }
)
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
  const selectedIds = new Set(workflowReferences.value.map(({ id }) => id))
  return availableWorkflows.filter(
    ({ id }) =>
      id === undefined || (id !== editableWorkflowId && !selectedIds.has(id))
  )
})
function loadMentionNodes(): void {
  if (nodeReferenceDisabledReason) {
    graphNodes.value = []
    return
  }
  graphNodes.value = getMentionNodes().toSorted((a, b) =>
    a.title.localeCompare(b.title)
  )
}

const mention = ref<MentionPickerState>({ status: 'closed' })
const mentionSection = computed(() =>
  mention.value.status === 'open' ? mention.value.section : 'root'
)
const mentionQuery = computed(() =>
  mention.value.status === 'open' ? mention.value.query : null
)
const mentionActive = computed(() =>
  mention.value.status === 'open' ? mention.value.activeIndex : 0
)
const workflowSubmenuOpen = ref(false)
const addMenuOpen = ref(false)

type MentionMatch =
  | { kind: 'section'; id: 'nodes' | 'workflows'; label: string }
  | { kind: 'back'; id: 'back'; label: string }
  | { kind: 'node'; id: string; label: string; node: SelectedNode }
  | {
      kind: 'workflow'
      id: string
      label: string
      workflow: WorkflowReferenceOption
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

function getMentionMatches(
  section: MentionSection,
  query: string
): MentionMatch[] {
  const search = query.toLowerCase()
  if (section === 'root') {
    const sections: MentionMatch[] = [
      { kind: 'section', id: 'nodes', label: t('agent.nodes') },
      { kind: 'section', id: 'workflows', label: t('agent.workflows') }
    ]
    return sections.filter(({ label }) => label.toLowerCase().includes(search))
  }

  const back: MentionMatch = { kind: 'back', id: 'back', label: t('g.back') }
  if (section === 'nodes') {
    return [
      back,
      ...mentionNodes.value
        .filter(
          (node) =>
            !stagedKeys.value.has(selectedNodeKey(node)) &&
            (node.title.toLowerCase().includes(search) ||
              node.id.includes(search))
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
      .filter(({ name }) => name.toLowerCase().includes(search))
      .map(
        (workflow): MentionMatch => ({
          kind: 'workflow',
          id: workflow.id ?? workflow.tabPath,
          label: workflow.name,
          workflow
        })
      )
  ]
}

const mentionMatches = computed(() => {
  const query = mentionQuery.value
  return query === null ? [] : getMentionMatches(mentionSection.value, query)
})

const mentionVisible = computed(
  () =>
    mentionQuery.value !== null &&
    (mentionQuery.value === '' ||
      mentionMatches.value.some(
        (match) => match.kind !== 'back' && !isNodeReferenceDisabled(match)
      ))
)
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

function dispatchMention(event: MentionPickerEvent): void {
  mention.value = transitionMentionPicker(mention.value, event)
}

function firstMentionMatchIndex(
  section: MentionSection,
  query: string
): number {
  return getMentionMatches(section, query).findIndex(
    (match) => match.kind !== 'back' && !isNodeReferenceDisabled(match)
  )
}

function syncMention(): void {
  const caret = editorRef.value?.selection().start ?? 0
  const text = composer.draft.value
  const at = text.lastIndexOf('@', caret - 1)
  const atValid =
    at !== -1 && at < caret && (at === 0 || /\s/.test(text[at - 1]))
  if (!atValid) {
    dispatchMention({ type: 'closed' })
    return
  }
  const query = text.slice(at + 1, caret)
  if (query.includes('\n')) {
    dispatchMention({ type: 'closed' })
    return
  }
  if (mention.value.status === 'closed') loadMentionNodes()
  dispatchMention({
    type: 'queryChanged',
    start: at,
    query,
    firstMatchIndex: firstMentionMatchIndex(mentionSection.value, query)
  })
}

function isNodeReferenceDisabled(match: MentionMatch): boolean {
  return (
    !!nodeReferenceDisabledReason &&
    (match.kind === 'node' ||
      (match.kind === 'section' && match.id === 'nodes'))
  )
}

function onSelectNodes(event: Event): void {
  if (nodeReferenceDisabledReason) {
    event.preventDefault()
    return
  }
  emit('selectNodes')
}

watch(
  () => nodeReferenceDisabledReason,
  (reason) => {
    if (!reason) {
      if (mention.value.status === 'open') loadMentionNodes()
      return
    }
    graphNodes.value = []
    if (mention.value.status === 'open' && mention.value.section === 'nodes') {
      dispatchMention({
        type: 'nodesUnavailable',
        firstMatchIndex: firstMentionMatchIndex('root', mention.value.query)
      })
    }
  },
  { flush: 'sync' }
)

async function pickMention(match: MentionMatch): Promise<void> {
  const state = mention.value
  if (state.status === 'closed' || isMentionDisabled(match)) return
  if (match.kind === 'section') {
    editorRef.value?.replaceText(
      state.start + 1,
      state.start + 1 + state.query.length,
      ''
    )
    dispatchMention({ type: 'sectionSelected', section: match.id })
    if (match.id === 'workflows') emit('requestWorkflowReferences')
    return
  }
  if (match.kind === 'back') {
    dispatchMention({ type: 'back' })
    return
  }
  if (match.kind === 'workflow') {
    const insertion = editorRef.value?.captureInsertion(
      state.start,
      state.start + 1 + state.query.length
    )
    const reference = await selectWorkflowReference(match.workflow)
    if (!reference) {
      insertion?.cancel()
      return
    }
    insertion?.insert(reference)
    dispatchMention({ type: 'closed' })
    return
  }
  const draft = composer.draft.value
  emit('mentionPick', match.node)
  const current = mention.value
  if (
    composer.draft.value !== draft ||
    current.status === 'closed' ||
    current.start !== state.start ||
    current.query !== state.query
  )
    return
  const before = draft.slice(0, state.start)
  const end = state.start + 1 + state.query.length
  let after = draft.slice(end)
  if (after.startsWith(' ') && (before === '' || before.endsWith(' ')))
    after = after.slice(1)
  editorRef.value?.replaceText(state.start, draft.length - after.length, '')
  dispatchMention({ type: 'closed' })
  editorRef.value?.focus()
}

function onWorkflowSubmenuOpenChange(open: boolean): void {
  if (open && !workflowSelecting) emit('requestWorkflowReferences')
}

async function pickWorkflow(workflow: WorkflowReferenceOption): Promise<void> {
  if (workflowSelecting) return
  const insertion = editorRef.value?.captureInsertion()
  const reference = await selectWorkflowReference(workflow)
  if (!reference) {
    insertion?.cancel()
    return
  }
  insertion?.insert(reference)
  addMenuOpen.value = false
}

function isMentionDisabled(match: MentionMatch): boolean {
  return (
    isNodeReferenceDisabled(match) ||
    (match.kind === 'workflow' && workflowSelecting)
  )
}

function onComposerKeydown(event: KeyboardEvent): void {
  const state = mention.value
  if (
    state.status === 'open' &&
    mentionVisible.value &&
    !event.isComposing &&
    !event.shiftKey
  ) {
    const matches = mentionMatches.value
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      dispatchMention({
        type: 'highlightMoved',
        direction: event.key === 'ArrowDown' ? 1 : -1,
        disabled: matches.map(isMentionDisabled)
      })
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      const match = matches[state.activeIndex]
      if (match) void pickMention(match)
      return
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      dispatchMention({ type: 'closed' })
      return
    }
  }
  if (event.key === 'Enter') onEnter(event)
}

const CARET_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End']

function onComposerKeyup(event: KeyboardEvent): void {
  if (mention.value.status === 'open' && CARET_KEYS.includes(event.key))
    syncMention()
}

const mentionListRef = useTemplateRef<HTMLDivElement>('mentionListRef')
watch(mentionActive, async () => {
  await nextTick()
  mentionListRef.value
    ?.querySelector('[data-active="true"]')
    ?.scrollIntoView?.({ block: 'nearest' })
})

const placeholderHint = computed(() => {
  const [text = '', mentionNodes = ''] = t('agent.placeholder').split('\n')
  return { text, mentionNodes }
})

const composer = useComposer({
  onSend: (text, attachments) => {
    if (workflowSelecting || submitting) return
    if (!hasWorkflowTarget) {
      emit('workflowTargetRequired')
      return
    }
    if (workflowReferences.value.length > 0) {
      const draft = composer.draft.value
      const offsets = workflowReferences.value.map(
        (reference) => reference.textOffset ?? 0
      )
      const start = Math.min(
        draft.length - draft.trimStart().length,
        ...offsets
      )
      const end = Math.max(draft.trimEnd().length, ...offsets)
      emit(
        'send',
        draft.slice(start, end),
        attachments,
        workflowReferences.value.map((reference) => ({
          ...reference,
          textOffset: Math.min(
            end - start,
            Math.max(0, (reference.textOffset ?? 0) - start)
          )
        }))
      )
    } else emit('send', text, attachments)
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

const editorRef =
  useTemplateRef<InstanceType<typeof InlinePromptEditor>>('editorRef')

function insert(text: string): void {
  composer.insert(text)
  editorRef.value?.focus()
}

function replaceDraft(text: string): void {
  composer.draft.value = text
  editorRef.value?.focus()
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
      <AgentTooltip
        v-for="(match, index) in mentionMatches"
        :key="`${match.kind}:${match.id}`"
        :label="nodeReferenceDisabledReason ?? ''"
        :disabled="!isNodeReferenceDisabled(match)"
      >
        <div
          :id="`agent-reference-item-${index}`"
          :aria-disabled="isMentionDisabled(match) || undefined"
          :aria-description="
            isNodeReferenceDisabled(match)
              ? nodeReferenceDisabledReason
              : undefined
          "
          role="menuitem"
          :data-active="index === mentionActive"
          :class="
            cn(
              'text-agent-fg flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-normal outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
              index === mentionActive && 'bg-agent-surface-hover'
            )
          "
          @mouseenter="dispatchMention({ type: 'highlighted', index })"
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
            v-if="match.kind === 'workflow' && match.workflow.id === undefined"
            class="text-agent-fg-muted text-xs"
            >{{ t('agent.unsavedWorkflow') }}</span
          >
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
      </AgentTooltip>
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
        class="max-h-100 min-h-16 overflow-x-hidden overflow-y-auto p-3"
      >
        <div
          v-if="workflowSelecting"
          role="status"
          class="text-agent-fg-muted mb-1 flex items-center gap-1 text-xs"
        >
          <span class="icon-[lucide--loader-circle] size-3 animate-spin" />
          {{ t('agent.savingWorkflow') }}
        </div>
        <div class="relative min-h-7">
          <InlinePromptEditor
            ref="editorRef"
            v-model="composer.draft.value"
            v-model:references="workflowReferences"
            :label="t('agent.placeholder')"
            :expanded="mentionVisible"
            :active-descendant="
              mentionVisible
                ? `agent-reference-item-${mentionActive}`
                : undefined
            "
            @keydown="onComposerKeydown"
            @keyup="onComposerKeyup"
            @input="syncMention"
            @selection-change="syncMention"
            @click="syncMention"
            @blur="dispatchMention({ type: 'closed' })"
            @open-reference-workflow="
              (id, name) => emit('openReferenceWorkflow', id, name)
            "
            @remove-workflow-reference="emit('removeWorkflowReference', $event)"
          />

          <div
            v-if="!composer.draft.value && !workflowReferences.length"
            class="text-agent-fg-muted pointer-events-none relative z-10 -mt-7 font-inter text-[14px]/[20px] font-normal"
          >
            <span>{{ placeholderHint.text }} </span>
            <AgentTooltip
              :label="nodeReferenceDisabledReason ?? ''"
              :disabled="!nodeReferenceDisabledReason"
            >
              <button
                type="button"
                :aria-disabled="!!nodeReferenceDisabledReason || undefined"
                :aria-description="nodeReferenceDisabledReason"
                class="text-agent-fg-muted hover:text-agent-fg focus-visible:text-agent-fg focus-visible:outline-agent-fg pointer-events-auto -ml-1 inline-flex h-[20px] shrink-0 cursor-pointer items-center gap-[4px] rounded-[8px] px-[4px] align-top text-[14px]/[20px] transition-colors focus-visible:outline-1 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                @click="onSelectNodes"
              >
                <span
                  class="icon-[lucide--mouse-pointer-click] size-[14px] shrink-0"
                />
                <span class="underline decoration-dashed underline-offset-2">{{
                  placeholderHint.mentionNodes
                }}</span>
              </button>
            </AgentTooltip>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between px-3 py-2">
        <DropdownMenuRoot v-model:open="addMenuOpen">
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
              <AgentTooltip
                :label="nodeReferenceDisabledReason ?? ''"
                :disabled="!nodeReferenceDisabledReason"
              >
                <DropdownMenuItem
                  :disabled="!!nodeReferenceDisabledReason"
                  :aria-description="nodeReferenceDisabledReason"
                  class="text-agent-fg data-highlighted:bg-agent-surface-hover mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  @select="onSelectNodes"
                >
                  <span class="icon-[comfy--node] size-4 shrink-0" />
                  <span class="whitespace-nowrap">
                    {{ t('agent.nodes') }}
                  </span>
                </DropdownMenuItem>
              </AgentTooltip>
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
                      :key="workflow.id ?? workflow.tabPath"
                      :disabled="workflowSelecting"
                      class="text-agent-fg data-highlighted:bg-agent-surface-hover box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                      @select.prevent="pickWorkflow(workflow)"
                    >
                      <span class="icon-[comfy--workflow] size-4 shrink-0" />
                      <span class="max-w-64 truncate">{{ workflow.name }}</span>
                      <span
                        v-if="workflow.id === undefined"
                        class="text-agent-fg-muted text-xs"
                        >{{ t('agent.unsavedWorkflow') }}</span
                      >
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
              :disabled="
                !running && (workflowSelecting || !composer.canSend.value)
              "
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
