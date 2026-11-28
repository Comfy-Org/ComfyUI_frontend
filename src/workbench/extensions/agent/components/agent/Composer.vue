<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useTelemetry } from '@comfyorg/telemetry'
import type {
  AgentSkillSelectionSource,
  AgentStopMethod
} from '@comfyorg/telemetry/types'
import { registerEscapeOverride } from '@/platform/keybindings/escapeOverride'
import {
  useBuiltinSkillCatalogStatus,
  useSkillCatalogStatus
} from '@/platform/skills/composables/useSkillCatalogStatus'
import { useBuiltinSkillsStore } from '@/platform/skills/stores/builtinSkillsStore'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import { useNodeEmphasisSource } from '@/systems/nodeEmphasisSystem'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import InlinePromptEditor from './composer/InlinePromptEditor.vue'
import PromptQueue from './composer/PromptQueue.vue'
import { composerPromptForSubmission } from '@/workbench/extensions/agent/utils/composerPrompt'
import { formatAgentErrorContext } from '@/workbench/extensions/agent/utils/formatAgentErrorContext'
import type { AgentStarterPromptAttribution } from '@/workbench/extensions/agent/utils/starterPrompts'
import { useAgentMentionPicker } from '@/workbench/extensions/agent/composables/agent/useAgentMentionPicker'
import { useSkillMenuDescription } from '@/workbench/extensions/agent/composables/agent/useSkillMenuDescription'
import { useWorkflowReferencePicker } from '@/workbench/extensions/agent/composables/agent/useWorkflowReferencePicker'
import type {
  AttachmentValidationError,
  ComposerAttachment
} from '@/workbench/extensions/agent/types/composerAttachment'
import type { MentionSection } from '@/workbench/extensions/agent/composables/agent/mentionPickerState'
import { useComposer } from '@/workbench/extensions/agent/composables/agent/useComposer'
import { useAgentPromptQueueStore } from '@/workbench/extensions/agent/stores/agent/agentPromptQueueStore'
import type { SelectedNode } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'
import type { SkillReferenceMetadata } from '@/workbench/extensions/agent/types/skillReference'
import type {
  PromptSnapshot,
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '@/workbench/extensions/agent/types/workflowReference'
import { cn } from '@comfyorg/tailwind-utils'

import AssetTray from './composer/AssetTray.vue'
import ComposerAddMenu from './composer/ComposerAddMenu.vue'
import ComposerPlaceholder from './composer/ComposerPlaceholder.vue'
import MentionMenuList from './composer/MentionMenuList.vue'
import MentionMenuStatus from './composer/MentionMenuStatus.vue'
import ComposerSendCluster from './composer/ComposerSendCluster.vue'

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
  derivingWorkflow = false,
  openingChat = false,
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
  ) => Promise<WorkflowReferenceMetadata | undefined>
  editableWorkflowId?: string
  hasWorkflowTarget?: boolean
  workflowSelecting?: boolean
  derivingWorkflow?: boolean
  openingChat?: boolean
  getMentionNodes?: () => SelectedNode[]
}>()
const emit = defineEmits<{
  send: [
    text: string,
    attachments: ComposerAttachment[],
    workflowReferences?: WorkflowReference[]
  ]
  stop: [method: AgentStopMethod]
  attach: []
  attachFiles: [files: File[]]
  removeAttachment: [id: string]
  openAssets: []
  selectNodes: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
  requestWorkflowReferences: []
  removeWorkflowReference: [id: string]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
  manageSkills: []
}>()
const { t } = useI18n()
const skills = useSkillPacksStore()
const builtinSkills = useBuiltinSkillsStore()
const comfySkillsMenuStatus = useBuiltinSkillCatalogStatus()

const running = computed(() => streaming || submitting)
const promptQueue = useAgentPromptQueueStore()
const editing = computed(() => promptQueue.editingId !== null)
const queueRows = computed(() =>
  promptQueue.items
    .filter((item) => item.id !== promptQueue.runningId)
    .map((item) => ({
      id: item.id,
      text: item.text,
      status: 'waiting' as const
    }))
)

const composer = useComposer({
  onSend: (_text, attachments) => {
    if (!hasWorkflowTarget || workflowSelecting || derivingWorkflow) return
    const prepared = composerPromptForSubmission(composer.prompt.value)
    if (workflowReferences.value.length > 0) {
      const { text: draft, workflowReferences: references } = prepared
      const offsets = references.map((reference) => reference.textOffset)
      const start = Math.min(
        draft.length - draft.trimStart().length,
        ...offsets
      )
      const end = Math.max(draft.trimEnd().length, ...offsets)
      emit(
        'send',
        withErrorContext(draft.slice(start, end)),
        attachments,
        references.map((reference) => ({
          ...reference,
          textOffset: Math.min(
            end - start,
            Math.max(0, reference.textOffset - start)
          )
        }))
      )
    } else emit('send', withErrorContext(prepared.text.trim()), attachments)
  },
  isRunning: () => running.value,
  onStop: () => emit('stop', 'button')
})
const showStop = computed(
  () =>
    running.value &&
    !editing.value &&
    (!composer.canSend.value ||
      !hasWorkflowTarget ||
      workflowSelecting ||
      derivingWorkflow ||
      openingChat)
)

const editorRef =
  useTemplateRef<InstanceType<typeof InlinePromptEditor>>('editorRef')
watch(
  () => skills.scope,
  (scope) => composer.setSkillScope(scope),
  { immediate: true, flush: 'sync' }
)
const { workflowReferences } = composer

function withErrorContext(text: string): string {
  const context = composer.errorContext.value
  return context ? formatAgentErrorContext(context, text) : text
}

const placeholderLabel = computed(() =>
  t(
    openingChat
      ? 'agent.openingChat'
      : skills.enabled
        ? 'agent.placeholder'
        : 'agent.placeholderWithoutSkills'
  )
)
const showPlaceholderHint = computed(
  () => !composer.draft.value && !composer.prompt.value.references.length
)

const highlightedAssetIds = ref<string[]>([])
const uploadingAttachmentCount = computed(
  () => composer.attachments.value.filter((item) => item.uploading).length
)

const { eligibleWorkflows, selectWorkflow } = useWorkflowReferencePicker({
  editor: () => editorRef.value,
  references: () => workflowReferences.value,
  workflows: () => availableWorkflows,
  editableWorkflowId: () => editableWorkflowId,
  selecting: () => workflowSelecting,
  resolve: (workflow) => selectWorkflowReference(workflow),
  captureInsertion: (from, to) =>
    composer.captureReferenceTarget(
      from,
      to,
      editorRef.value?.insertionPoint()
    ),
  isInsertionLive: (target) => target.isLive(),
  insertInBackground: (target, reference) => target.insert(reference)
})

function pickSkill(
  skill: SkillReferenceMetadata,
  source: AgentSkillSelectionSource,
  from?: number,
  to?: number
): void {
  if (!editorRef.value?.selectSkill(skill, from, to)) return
  useTelemetry()?.trackAgentSkillSelected({ source })
}

const {
  mentionSection,
  mentionActive,
  mentionMatches,
  mentionVisible,
  mentionActiveNode,
  mentionHasResults,
  skillQueryEmpty,
  graphDupes,
  syncMention,
  pickMention,
  isMentionDisabled,
  onComposerKeydown: handleMentionKeydown,
  onComposerKeyup,
  close: closeMention,
  highlight: highlightMention
} = useAgentMentionPicker({
  draft: () => composer.draft.value,
  editor: () => editorRef.value,
  selectionTags: () => selectionTags,
  workflows: () => eligibleWorkflows.value,
  skills: () => skills.packs,
  comfySkills: () => builtinSkills.visibleSkills,
  skillsEnabled: () => skills.enabled,
  assets: () =>
    composer.attachments.value.filter((item) => !item.validationError),
  nodeReferenceDisabledReason: () => nodeReferenceDisabledReason,
  workflowSelecting: () => workflowSelecting,
  getMentionNodes: () => getMentionNodes(),
  selectWorkflow,
  selectSkill: (skill, from, to) => pickSkill(skill, 'slash_picker', from, to),
  pickNode: (node) => emit('mentionPick', node),
  pickAsset: (asset) => composer.referenceAttachment(asset.id),
  requestWorkflows: () => emit('requestWorkflowReferences')
})
useNodeEmphasisSource(() => {
  const node = mentionActiveNode.value
  return node && toNodeId(node.id)
})

function onSelectNodes(event: Event): void {
  if (nodeReferenceDisabledReason) {
    event.preventDefault()
    return
  }
  emit('selectNodes')
}

watch(mentionSection, (section) => {
  if (section !== 'skills') return
  void skills.refreshPacks()
  void builtinSkills.ensureSkills()
})

type DraftSkillSnapshot = [
  name: string | undefined,
  epoch: number,
  enabled: boolean,
  section: MentionSection
]

function draftSkillNeedsRefresh(
  [name, epoch, enabled]: DraftSkillSnapshot,
  [oldName, oldEpoch, oldEnabled, oldSection]: Partial<DraftSkillSnapshot>
): boolean {
  if (!name || !enabled) return false
  if (epoch !== oldEpoch || enabled !== oldEnabled) return true
  // A pick from the open skills menu is covered by the menu-open refresh.
  return name !== oldName && oldSection !== 'skills'
}

watch(
  [
    () =>
      composer.prompt.value.references.find(
        (reference) => reference.kind === 'skill'
      )?.name,
    () => composer.promptEpoch.value,
    () => skills.enabled,
    mentionSection
  ],
  (next, previous) => {
    if (draftSkillNeedsRefresh(next, previous))
      void skills.refreshPacksInBackground()
  },
  { immediate: true }
)

function onEditorSelectionChange(): void {
  const point = editorRef.value?.insertionPoint()
  if (point) composer.setInsertionPoint(point)
  syncMention()
}

const SKILL_DESCRIPTION_ID = 'agent-skill-description'
const REFERENCE_MENU_ID = 'agent-reference-menu'
const {
  describedSkill,
  requestDescription,
  dismissDescription,
  leaveDescription,
  keepDescriptionOpen
} = useSkillMenuDescription(() => {
  const match = mentionMatches.value[mentionActive.value]
  return match?.kind === 'skill' ? match.skill : undefined
})
watch(mentionVisible, (visible) => {
  if (!visible) dismissDescription()
})

function onMentionHover(index: number): void {
  highlightMention(index)
  requestDescription('hover')
}

function onEditorInput(): void {
  prefillFadeMs.value = null
  syncMention()
  if (mentionVisible.value) requestDescription('input')
}

function focusEditor(): void {
  editorRef.value?.focus()
}

function isSkillDescription(target: EventTarget | null): boolean {
  return (
    target instanceof Element && !!target.closest(`#${SKILL_DESCRIPTION_ID}`)
  )
}

function onEditorBlur(event: FocusEvent): void {
  if (!isSkillDescription(event.relatedTarget)) closeMention()
}

const editorHostRef = useTemplateRef<HTMLDivElement>('editorHostRef')

function onDescriptionFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget
  if (next instanceof Node && editorHostRef.value?.contains(next)) return
  closeMention()
}

function onDescriptionDismiss(): void {
  closeMention()
  focusEditor()
}

const HIGHLIGHT_KEYS = ['ArrowDown', 'ArrowUp']

function requestKeyboardDescription(event: KeyboardEvent): void {
  if (mentionVisible.value && HIGHLIGHT_KEYS.includes(event.key))
    requestDescription('input')
}

function isModifiedEscape(event: KeyboardEvent): boolean {
  return event.shiftKey || event.ctrlKey || event.altKey || event.metaKey
}

function stopRunOnEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !running.value) return
  if (event.isComposing || event.repeat || isModifiedEscape(event)) return
  event.preventDefault()
  event.stopPropagation()
  emit('stop', 'escape')
}

function onComposerKeydown(event: KeyboardEvent): void {
  prefillFadeMs.value = null
  if (event.key === 'Enter') event.stopPropagation()
  if (openingChat) {
    event.preventDefault()
    return
  }
  requestKeyboardDescription(event)
  if (handleMentionKeydown(event)) return
  if (event.key === 'Enter') onEnter(event)
  stopRunOnEscape(event)
}

const mentionListRef = useTemplateRef<HTMLDivElement>('mentionListRef')
watch(mentionActive, async () => {
  await nextTick()
  mentionListRef.value
    ?.querySelector('[data-active="true"]')
    ?.scrollIntoView?.({ block: 'nearest' })
})

const mentionMenuLabel = computed(() =>
  t(mentionSection.value === 'skills' ? 'agent.skills' : 'agent.addToPrompt')
)
const groupedSkillsInMention = computed(
  () =>
    mentionSection.value === 'skills' && builtinSkills.visibleSkills.length > 0
)
const mentionMenuHeading = computed(() => {
  if (mentionSection.value === 'skills') {
    return groupedSkillsInMention.value && mentionHasResults.value
      ? undefined
      : t('agent.skills')
  }
  return mentionSection.value === 'root' ? t('agent.reference') : undefined
})
const skillsMenuStatus = useSkillCatalogStatus()
const skillsMenuStatusMessage = computed(() =>
  skillsMenuStatus.value === 'failed' ? skills.loadFailureReason : undefined
)
const userSkillMentionStatus = computed(() => {
  if (mentionSection.value !== 'skills') return undefined
  if (skills.packs.length === 0 && skills.loading) {
    return { label: t('agent.skillsLoading'), retryable: false }
  }
  if (skillsMenuStatus.value === 'failed') {
    return {
      label: skills.loadFailureReason ?? t('agent.skillsLoadError'),
      retryable: true
    }
  }
  return undefined
})
const comfySkillMentionStatus = computed(() => {
  if (mentionSection.value !== 'skills') return undefined
  if (comfySkillsMenuStatus.value === 'loading') {
    return { label: t('agent.comfySkillsLoading'), retryable: false }
  }
  if (comfySkillsMenuStatus.value === 'failed') {
    return { label: t('agent.comfySkillsLoadError'), retryable: true }
  }
  return undefined
})
const showEmptyMentionStatus = computed(
  () =>
    !mentionHasResults.value &&
    !userSkillMentionStatus.value &&
    !comfySkillMentionStatus.value
)
const emptyMentionLabel = computed(() =>
  mentionSection.value === 'skills'
    ? skillsEmptyLabel()
    : t(
        mentionSection.value === 'workflows'
          ? 'agent.noWorkflowsToReference'
          : 'agent.noNodesToReference'
      )
)

function skillsEmptyLabel(): string {
  if (skills.catalogUnavailable) return t('agent.skillsUnavailable')
  return t('agent.noSkillsFound')
}

function openReferenceMenu(): void {
  const editor = editorRef.value
  if (!editor) return
  const { start } = editor.selection()
  const needsSeparator =
    start > 0 && !/\s/.test(composer.draft.value[start - 1] ?? '')
  editor.insertText(needsSeparator ? ' @' : '@')
  editor.focus()
  syncMention()
}

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return
  event.preventDefault()
  if (showStop.value || !composer.canSend.value) return
  composer.submit('keyboard')
}

const primaryActionLabel = computed(() =>
  showStop.value ? t('agent.stop') : t('agent.send')
)
const SEND_BLOCKED_MESSAGES = {
  'invalid-video': 'agent.sendBlockedByInvalidVideo',
  'unsupported-type': 'agent.sendBlockedByUnsupportedType'
} as const satisfies Record<AttachmentValidationError, string>

const sendBlockedReason = computed(() => {
  const invalid = composer.attachments.value.flatMap(
    ({ name, validationError }) =>
      validationError ? [{ name, validationError }] : []
  )
  if (showStop.value || invalid.length === 0) return undefined
  if (invalid.length > 1)
    return t('agent.sendBlockedByInvalidAttachments', {
      count: invalid.length
    })
  const [{ name, validationError }] = invalid
  return t(SEND_BLOCKED_MESSAGES[validationError], { name })
})
const primaryActionTooltip = computed(
  () => sendBlockedReason.value ?? primaryActionLabel.value
)
const primaryActionAriaDisabled = computed(() =>
  sendBlockedReason.value ? true : undefined
)
const primaryActionDisabled = computed(
  () =>
    openingChat ||
    (!showStop.value &&
      !sendBlockedReason.value &&
      (!hasWorkflowTarget ||
        workflowSelecting ||
        derivingWorkflow ||
        !composer.canSend.value))
)
const skillSearchHint = computed(() =>
  skillQueryEmpty.value ? t('agent.typeToSearch') : undefined
)
const activeMentionDescendant = computed(() =>
  mentionVisible.value && mentionActive.value >= 0
    ? `agent-reference-item-${mentionActive.value}`
    : undefined
)
const primaryActionShortcut = computed(() =>
  showStop.value ? t('agent.stopShortcut') : undefined
)

function onPrimaryAction(): void {
  if (openingChat) return
  if (showStop.value) emit('stop', 'button')
  else composer.submit('explicit')
}

const composerContainerRef = useTemplateRef<HTMLDivElement>(
  'composerContainerRef'
)

function focusIsWithinComposerOrUnset(): boolean {
  const active = document.activeElement
  return (
    active === null ||
    active === document.body ||
    composerContainerRef.value?.contains(active) === true
  )
}

function handleEscapeOverride(event: KeyboardEvent): boolean {
  if (
    openingChat ||
    event.key !== 'Escape' ||
    !running.value ||
    event.isComposing ||
    isModifiedEscape(event)
  )
    return false
  if (event.defaultPrevented) return false

  if (!focusIsWithinComposerOrUnset()) return false

  event.preventDefault()
  if (!event.repeat) emit('stop', 'escape')
  return true
}

function preloadSkillCatalog(enabled: boolean): void {
  if (!enabled) return
  void skills.ensurePacks()
  void builtinSkills.ensureSkills()
}

function requestSkills(): void {
  void skills.refreshPacks()
  void builtinSkills.ensureSkills()
}

watch(
  [() => skills.enabled, () => skills.scope],
  ([enabled]) => preloadSkillCatalog(enabled),
  {
    immediate: true
  }
)

let unregisterEscapeOverride: (() => void) | undefined
onMounted(() => {
  void skills.startFlagGate({ fetch: false })
  unregisterEscapeOverride = registerEscapeOverride(handleEscapeOverride)
})
onUnmounted(() => {
  unregisterEscapeOverride?.()
})

const prefillFadeMs = ref<number | null>(null)
const prefillFade = computed(() =>
  prefillFadeMs.value === null
    ? {}
    : {
        class: 'agent-talk-fade',
        style: { '--talk-delay': `${prefillFadeMs.value}ms` }
      }
)

function focusIsWithinEditorOrUnset(): boolean {
  const active = document.activeElement
  return (
    active === null ||
    active === document.body ||
    (editorHostRef.value?.contains(active) === true &&
      active.getAttribute('contenteditable') === 'true')
  )
}

async function focusPrefill(delayMs: number): Promise<void> {
  const prefilled = composer.prompt.value
  prefillFadeMs.value = delayMs
  await nextTick()
  if (composer.prompt.value !== prefilled || !focusIsWithinEditorOrUnset())
    return
  editorRef.value?.focusAtEnd()
}

function insert(
  text: string,
  starterPrompt?: AgentStarterPromptAttribution
): void {
  composer.insert(text, starterPrompt)
  editorRef.value?.focus()
}

function replaceDraft(prompt: PromptSnapshot): void {
  composer.replacePrompt(prompt)
  editorRef.value?.focus()
}

function removeAttachment(id: string): void {
  composer.removeAttachment(id)
  emit('removeAttachment', id)
}

defineExpose({
  focus: focusEditor,
  insert,
  focusPrefill,
  replaceDraft,
  addAttachment: composer.addAttachment,
  updateAttachment: composer.updateAttachment,
  removeAttachment: composer.removeAttachment
})
</script>

<template>
  <div
    id="agent-composer"
    ref="composerContainerRef"
    data-testid="agent-composer"
    class="flex min-w-0 flex-col gap-2"
  >
    <PromptQueue
      :items="queueRows"
      :expanded="promptQueue.expanded"
      :edit-disabled="derivingWorkflow"
      @toggle="promptQueue.toggle"
      @edit="promptQueue.startEdit"
      @delete="promptQueue.deleteItem"
    />

    <div class="relative rounded-lg border border-border/50 bg-background">
      <div
        v-if="mentionVisible"
        :id="REFERENCE_MENU_ID"
        ref="mentionListRef"
        data-testid="agent-reference-menu"
        role="menu"
        :aria-label="mentionMenuLabel"
        class="absolute inset-x-0 bottom-full z-1 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border/50 bg-secondary p-1 font-inter shadow-md"
        @mousedown.prevent
        @mouseleave="leaveDescription"
      >
        <div
          v-if="mentionMenuHeading"
          class="flex h-6 items-center px-1.5 py-1 text-xs/4 text-muted-foreground"
        >
          {{ mentionMenuHeading }}
        </div>
        <MentionMenuList
          :matches="mentionMatches"
          :grouped-skills="groupedSkillsInMention"
          :active-index="mentionActive"
          :is-disabled="isMentionDisabled"
          :node-reference-disabled-reason
          :duplicate-node-titles="graphDupes"
          :described-skill="describedSkill"
          :description-id="SKILL_DESCRIPTION_ID"
          @highlight="onMentionHover"
          @pick="pickMention"
          @description-enter="keepDescriptionOpen"
          @description-leave="leaveDescription"
          @description-focusout="onDescriptionFocusOut"
          @description-release-focus="focusEditor"
          @description-dismiss="onDescriptionDismiss"
        />
        <MentionMenuStatus
          v-if="showEmptyMentionStatus"
          :label="emptyMentionLabel"
        />
        <MentionMenuStatus
          v-if="userSkillMentionStatus"
          :label="userSkillMentionStatus.label"
          :retryable="userSkillMentionStatus.retryable"
          @retry="skills.ensurePacks()"
        />
        <MentionMenuStatus
          v-if="comfySkillMentionStatus"
          :label="comfySkillMentionStatus.label"
          :retryable="comfySkillMentionStatus.retryable"
          @retry="builtinSkills.refreshSkills()"
        />
      </div>

      <div
        v-if="$slots.header"
        class="flex shrink-0 items-center rounded-t-lg bg-background p-1"
      >
        <slot name="header" />
      </div>

      <slot name="aboveInput" />

      <div
        data-testid="composer-input-box"
        class="relative -m-px flex max-h-[50dvh] min-h-28 min-w-0 flex-col rounded-lg border border-border/50 bg-secondary transition-colors focus-within:border-muted-foreground"
      >
        <slot name="insideInput" />
        <AssetTray
          v-if="composer.attachments.value.length"
          :attachments="composer.attachments.value"
          :highlighted-ids="highlightedAssetIds"
          @remove="removeAttachment"
        />

        <div
          data-testid="composer-upload-status"
          aria-live="polite"
          aria-atomic="true"
          :class="
            cn(
              'flex shrink-0 items-center gap-1 text-xs text-muted-foreground',
              uploadingAttachmentCount > 0 && 'px-3 pb-2'
            )
          "
        >
          <template v-if="uploadingAttachmentCount > 0">
            <i
              aria-hidden="true"
              class="icon-[lucide--loader-circle] size-3 animate-spin"
            />
            {{ t('agent.uploadingAttachments', uploadingAttachmentCount) }}
          </template>
        </div>

        <div
          data-testid="composer-inline-input"
          class="flex max-h-100 min-h-16 flex-col overflow-x-hidden overflow-y-auto"
        >
          <div
            v-if="workflowSelecting"
            role="status"
            class="-mb-2 flex items-center gap-1 px-3 pt-3 text-xs text-muted-foreground"
          >
            <i
              aria-hidden="true"
              class="icon-[lucide--loader-circle] size-3 animate-spin"
            />
            {{ t('agent.savingWorkflow') }}
          </div>
          <div class="grid flex-1">
            <div
              ref="editorHostRef"
              data-testid="composer-editor"
              v-bind="prefillFade"
              class="col-start-1 row-start-1 flex flex-col"
            >
              <InlinePromptEditor
                ref="editorRef"
                :model-value="composer.prompt.value"
                :label="placeholderLabel"
                :expanded="mentionVisible"
                :reference-menu-id="REFERENCE_MENU_ID"
                :active-descendant="activeMentionDescendant"
                :search-hint="skillSearchHint"
                :history-epoch="composer.promptEpoch.value"
                :caret-request="composer.pendingCaret.value"
                :editable-workflow-id
                :skill-scope="skills.scope"
                @keydown="onComposerKeydown"
                @update:model-value="composer.applyEditorPrompt"
                @caret-request-handled="composer.clearPendingCaret"
                @resolve-skill-metadata="composer.resolveSkillMetadata"
                @keyup="onComposerKeyup"
                @input="onEditorInput"
                @selection-change="onEditorSelectionChange"
                @click="syncMention"
                @blur="onEditorBlur"
                @attach-files="emit('attachFiles', $event)"
                @open-reference-workflow="
                  (id, name) => emit('openReferenceWorkflow', id, name)
                "
                @remove-node-reference="emit('removeTag', $event)"
                @highlight-assets="highlightedAssetIds = $event"
                @remove-workflow-reference="
                  emit('removeWorkflowReference', $event)
                "
              />
            </div>

            <ComposerPlaceholder
              :label="placeholderLabel"
              :visible="showPlaceholderHint"
              :node-reference-disabled-reason
              @select-nodes="onSelectNodes"
            />
          </div>
        </div>

        <div class="flex shrink-0 items-center justify-between px-3 py-2">
          <div class="flex items-center gap-1">
            <ComposerAddMenu
              :can-attach
              :can-open-assets
              :node-reference-disabled-reason
              :workflows="eligibleWorkflows"
              :workflow-selecting
              :select-workflow="selectWorkflow"
              :skills-enabled="skills.enabled"
              :skills="skills.packs"
              :skills-status="skillsMenuStatus"
              :skills-status-message="skillsMenuStatusMessage"
              :comfy-skills="builtinSkills.visibleSkills"
              :comfy-skills-status="comfySkillsMenuStatus"
              @select-nodes="onSelectNodes"
              @attach="emit('attach')"
              @open-assets="emit('openAssets')"
              @request-workflow-references="emit('requestWorkflowReferences')"
              @request-skills="requestSkills"
              @retry-skills="skills.ensurePacks()"
              @retry-comfy-skills="builtinSkills.refreshSkills()"
              @select-skill="pickSkill($event, 'add_menu')"
              @manage-skills="emit('manageSkills')"
              @focus-prompt="focusEditor"
            />
            <Button
              :tooltip="t('agent.reference')"
              type="button"
              variant="muted-textonly"
              size="icon"
              :aria-label="t('agent.reference')"
              @click="openReferenceMenu"
            >
              <span class="text-base/4 font-medium">@</span>
            </Button>
          </div>

          <ComposerSendCluster
            :editing
            :show-stop="showStop"
            :tooltip="primaryActionTooltip"
            :label="primaryActionLabel"
            :shortcut="primaryActionShortcut"
            :blocked-reason="sendBlockedReason"
            :aria-disabled="primaryActionAriaDisabled"
            :cancel-edit-disabled="derivingWorkflow"
            :disabled="primaryActionDisabled"
            @cancel-edit="promptQueue.cancelEdit()"
            @primary="onPrimaryAction"
          />
        </div>
      </div>
    </div>
  </div>
</template>
