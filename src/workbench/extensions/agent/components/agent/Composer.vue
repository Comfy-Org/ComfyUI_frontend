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

import Button from '@/components/ui/button/Button.vue'
import { registerEscapeOverride } from '@/platform/keybindings/escapeOverride'
import type { AgentStopMethod } from '@/platform/telemetry/types'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'

import InlinePromptEditor from './composer/InlinePromptEditor.vue'
import { composerPromptForSubmission } from '../../utils/composerPrompt'
import type { AgentStarterPromptAttribution } from '../../utils/starterPrompts'
import { useAgentMentionPicker } from '../../composables/agent/useAgentMentionPicker'
import { useSkillMenuDescription } from '../../composables/agent/useSkillMenuDescription'
import { useWorkflowReferencePicker } from '../../composables/agent/useWorkflowReferencePicker'
import type { ComposerAttachment } from '../../types/composerAttachment'
import type { MentionSection } from '../../composables/agent/mentionPickerState'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import type {
  PromptSnapshot,
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'
import { cn } from '@comfyorg/tailwind-utils'

import AssetTray from './composer/AssetTray.vue'
import ComposerAddMenu from './composer/ComposerAddMenu.vue'
import ComposerPlaceholder from './composer/ComposerPlaceholder.vue'
import MentionMenuItem from './composer/MentionMenuItem.vue'
import MentionMenuStatus from './composer/MentionMenuStatus.vue'
import RunModePopover from './composer/RunModePopover.vue'

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
  ) => Promise<WorkflowReferenceMetadata | undefined>
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
  stop: [method: AgentStopMethod]
  attach: []
  attachFiles: [files: File[]]
  openAssets: []
  selectNodes: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
  requestWorkflowReferences: []
  removeWorkflowReference: [id: string]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
  workflowTargetRequired: []
}>()
const { t } = useI18n()
const skills = useSkillPacksStore()

const running = computed(() => streaming || submitting)

const composer = useComposer({
  onSend: (_text, attachments) => {
    if (workflowSelecting || submitting) return
    if (!hasWorkflowTarget) {
      emit('workflowTargetRequired')
      return
    }
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
        draft.slice(start, end),
        attachments,
        references.map((reference) => ({
          ...reference,
          textOffset: Math.min(
            end - start,
            Math.max(0, reference.textOffset - start)
          )
        }))
      )
    } else emit('send', prepared.text.trim(), attachments)
  },
  isRunning: () => running.value,
  onStop: () => emit('stop', 'button')
})

const editorRef =
  useTemplateRef<InstanceType<typeof InlinePromptEditor>>('editorRef')
watch(
  () => skills.scope,
  (scope) => composer.setSkillScope(scope),
  { immediate: true, flush: 'sync' }
)
const { workflowReferences } = composer
const placeholderLabel = computed(() =>
  t(skills.enabled ? 'agent.placeholder' : 'agent.placeholderWithoutSkills')
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
  resolve: (workflow) => selectWorkflowReference(workflow)
})

const {
  mentionSection,
  mentionActive,
  mentionMatches,
  mentionVisible,
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
  skillsEnabled: () => skills.enabled,
  assets: () => composer.attachments.value,
  nodeReferenceDisabledReason: () => nodeReferenceDisabledReason,
  workflowSelecting: () => workflowSelecting,
  getMentionNodes: () => getMentionNodes(),
  selectWorkflow,
  pickNode: (node) => emit('mentionPick', node),
  pickAsset: (asset) => composer.referenceAttachment(asset.id),
  requestWorkflows: () => emit('requestWorkflowReferences')
})

function onSelectNodes(event: Event): void {
  if (nodeReferenceDisabledReason) {
    event.preventDefault()
    return
  }
  emit('selectNodes')
}

watch(mentionSection, (section) => {
  if (section === 'skills') void skills.refreshPacks()
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

function stopRunOnEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !running.value) return
  if (event.isComposing || event.repeat) return
  event.preventDefault()
  event.stopPropagation()
  emit('stop', 'escape')
}

function onComposerKeydown(event: KeyboardEvent): void {
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
const mentionMenuHeading = computed(() => {
  if (mentionSection.value === 'skills') return t('agent.skills')
  return mentionSection.value === 'root' ? t('agent.reference') : undefined
})
const skillsRetryVisible = computed(
  () => mentionSection.value === 'skills' && skills.loadFailed
)
const emptyMentionLabel = computed(() =>
  mentionSection.value === 'skills'
    ? t(
        skills.loading
          ? 'agent.skillsLoading'
          : skills.loadFailed
            ? 'agent.skillsLoadError'
            : 'agent.noSkillsFound'
      )
    : t(
        mentionSection.value === 'workflows'
          ? 'agent.noWorkflowsToReference'
          : 'agent.noNodesToReference'
      )
)

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return
  event.preventDefault()
  if (running.value) return
  composer.submit()
}

const primaryActionTooltip = computed(() =>
  running.value ? t('agent.stop') : t('agent.send')
)
const primaryActionVariant = computed(() =>
  running.value ? 'secondary' : 'inverted'
)
const primaryActionDisabled = computed(
  () => !running.value && (workflowSelecting || !composer.canSend.value)
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
  running.value ? t('agent.stopShortcut') : undefined
)

function onPrimaryAction(): void {
  if (running.value) emit('stop', 'button')
  else composer.submit()
}

const composerContainerRef = useTemplateRef<HTMLDivElement>(
  'composerContainerRef'
)

// The prompt editor only forwards `keydown` while it (the ProseMirror
// contenteditable) itself has focus, so pressing Escape after submitting via
// Enter is caught there (see the editor-scoped handler above). Clicking Send
// with the mouse doesn't reliably leave focus in a place a container-scoped
// listener would see: Chrome moves it onto the button, but Safari and
// Firefox leave it on <body> without moving it at all, so a plain pointer
// click can leave the next Escape with nothing inside the composer in its
// bubble path.
//
// For that case this registers into `keybindingService`'s Escape override
// hook instead of adding another DOM listener: `platform/` can't import from
// `workbench/`, so it can't see this component's `running` state directly,
// but `keybindHandler` consults whatever is registered here before it would
// dispatch the default Escape keybinding (`Comfy.Graph.ExitSubgraph`). This
// handler decides whether to act by checking focus directly rather than
// relying on the event's bubble path: it fires while focus is inside this
// composer, or nowhere in particular (the Safari/Firefox click case), but
// stays out of the way once focus has genuinely moved elsewhere on the page
// (see the "once focus has left the composer entirely" test).
//
// This is one of several places that establish Escape ownership in this
// app: `useKeybindingService`'s own bailouts for `[role="menu"]` targets and
// open dialogs run before this override is even consulted
// (src/platform/keybindings/keybindingService.ts), the mention picker closes
// itself first via stopPropagation (useAgentMentionPicker.ts's
// onComposerKeydown), select has its own stopEscapeToDocument
// (packages/design-system/src/select.variants.ts), and the capture-phase
// document listeners in OnboardingCoach.vue and TourSpotlight.vue let a
// full-screen overlay pre-empt everything else. This handler only ever runs
// when none of those more specific handlers claimed the event first.
function handleEscapeOverride(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape' || !running.value || event.isComposing)
    return false
  if (event.defaultPrevented) return false

  const active = document.activeElement
  const focusedElsewhere =
    active !== null &&
    active !== document.body &&
    !composerContainerRef.value?.contains(active)
  if (focusedElsewhere) return false

  event.preventDefault()
  if (!event.repeat) emit('stop', 'escape')
  return true
}

let unregisterEscapeOverride: (() => void) | undefined
onMounted(() => {
  void skills.startFlagGate({ fetch: false })
  unregisterEscapeOverride = registerEscapeOverride(handleEscapeOverride)
})
onUnmounted(() => {
  unregisterEscapeOverride?.()
})

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
    id="agent-composer"
    ref="composerContainerRef"
    data-testid="agent-composer"
    class="relative flex min-w-0 flex-col rounded-lg border border-border-subtle bg-base-background"
  >
    <div
      v-if="mentionVisible"
      id="agent-reference-menu"
      ref="mentionListRef"
      data-testid="agent-reference-menu"
      role="menu"
      :aria-label="mentionMenuLabel"
      class="absolute inset-x-0 bottom-full z-1100 -mb-8.75 max-h-64 overflow-y-auto rounded-lg border border-border-subtle bg-secondary-background p-1 font-inter shadow-md"
      @mousedown.prevent
      @mouseleave="leaveDescription"
    >
      <div
        v-if="mentionMenuHeading"
        class="flex h-6 items-center px-1.5 py-1 text-xs/4 text-muted-foreground"
      >
        {{ mentionMenuHeading }}
      </div>
      <MentionMenuItem
        v-for="(match, index) in mentionMatches"
        :key="`${match.kind}:${match.id}`"
        :match
        :index
        :active="index === mentionActive"
        :disabled="isMentionDisabled(match)"
        :node-reference-disabled-reason
        :duplicate-node-titles="graphDupes"
        :described-skill="describedSkill"
        :description-id="SKILL_DESCRIPTION_ID"
        @highlight="onMentionHover(index)"
        @pick="pickMention(match)"
        @description-enter="keepDescriptionOpen"
        @description-leave="leaveDescription"
        @description-focusout="onDescriptionFocusOut"
        @description-release-focus="focusEditor"
        @description-dismiss="onDescriptionDismiss"
      />
      <MentionMenuStatus
        v-if="!mentionHasResults"
        :label="emptyMentionLabel"
        :retryable="skillsRetryVisible"
        @retry="skills.ensurePacks()"
      />
    </div>

    <div
      v-if="$slots.header"
      class="flex h-11 shrink-0 items-center rounded-t-lg bg-base-background px-2"
    >
      <slot name="header" />
    </div>

    <slot name="aboveInput" />

    <div
      data-testid="composer-input-box"
      class="relative -m-px flex max-h-[50dvh] min-h-28 min-w-0 flex-col rounded-lg border border-border-subtle bg-secondary-background transition-colors focus-within:border-muted-foreground"
    >
      <slot name="insideInput" />
      <AssetTray
        v-if="composer.attachments.value.length"
        :attachments="composer.attachments.value"
        :highlighted-ids="highlightedAssetIds"
        @remove="composer.removeAttachment"
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
          <span
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
          <span class="icon-[lucide--loader-circle] size-3 animate-spin" />
          {{ t('agent.savingWorkflow') }}
        </div>
        <div class="grid flex-1">
          <div
            ref="editorHostRef"
            class="col-start-1 row-start-1 flex flex-col"
          >
            <InlinePromptEditor
              ref="editorRef"
              :model-value="composer.prompt.value"
              :label="placeholderLabel"
              :expanded="mentionVisible"
              :active-descendant="activeMentionDescendant"
              :search-hint="skillSearchHint"
              :history-epoch="composer.promptEpoch.value"
              :editable-workflow-id
              :skill-scope="skills.scope"
              @keydown="onComposerKeydown"
              @update:model-value="composer.applyEditorPrompt"
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
        <ComposerAddMenu
          :can-attach
          :can-open-assets
          :node-reference-disabled-reason
          :workflows="eligibleWorkflows"
          :workflow-selecting
          :select-workflow="selectWorkflow"
          @select-nodes="onSelectNodes"
          @attach="emit('attach')"
          @open-assets="emit('openAssets')"
          @request-workflow-references="emit('requestWorkflowReferences')"
        />

        <div class="flex items-center gap-1">
          <RunModePopover />
          <Button
            :tooltip="primaryActionTooltip"
            type="button"
            :variant="primaryActionVariant"
            size="icon"
            :aria-label="primaryActionTooltip"
            :disabled="primaryActionDisabled"
            @click="onPrimaryAction"
          >
            <i-lucide:square v-if="running" class="size-4" />
            <i-lucide:arrow-up v-else class="size-4" />
            <template #tooltip>
              {{ primaryActionTooltip }}
              <span v-if="primaryActionShortcut" class="ml-1 opacity-50">{{
                primaryActionShortcut
              }}</span>
            </template>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
