<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef
} from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { registerEscapeOverride } from '@/platform/keybindings/escapeOverride'
import type { AgentStopMethod } from '@/platform/telemetry/types'

import InlinePromptEditor from './composer/InlinePromptEditor.vue'
import { composerPromptForSend } from '../../utils/composerPrompt'
import { useAgentMentionPicker } from '../../composables/agent/useAgentMentionPicker'
import { useWorkflowReferencePicker } from '../../composables/agent/useWorkflowReferencePicker'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import type {
  PromptSnapshot,
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'
import { cn } from '@comfyorg/tailwind-utils'

import AttachmentChip from './composer/AttachmentChip.vue'
import MentionMenu from './composer/MentionMenu.vue'
import PrimaryAction from './composer/PrimaryAction.vue'
import RunModePopover from './composer/RunModePopover.vue'
import SelectionTags from './composer/SelectionTags.vue'
import WorkflowReferenceSubmenu from './composer/WorkflowReferenceSubmenu.vue'

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

const assetDragActive = inject<Readonly<Ref<boolean>>>(
  'agentAssetDragActive',
  ref(false)
)

const duplicateIdClass =
  'shrink-0 rounded-full bg-interface-menu-keybind-surface-default px-1 py-0.5 font-mono text-xs/4 font-medium text-base-foreground'

const running = computed(() => streaming || submitting)

const composer = useComposer({
  onSend: (text, attachments) => {
    if (workflowSelecting || submitting) return
    if (!hasWorkflowTarget) {
      emit('workflowTargetRequired')
      return
    }
    if (workflowReferences.value.length > 0) {
      const { text: draft, workflowReferences: references } =
        composerPromptForSend(composer.prompt.value)
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
    } else emit('send', text, attachments)
  },
  isRunning: () => running.value,
  onStop: () => emit('stop', 'button')
})

const editorRef =
  useTemplateRef<InstanceType<typeof InlinePromptEditor>>('editorRef')
const { workflowReferences } = composer

const addMenuOpen = ref(false)

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
  graphDupes,
  tagDupes,
  syncMention,
  pickMention,
  isNodeReferenceDisabled,
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
  nodeReferenceDisabledReason: () => nodeReferenceDisabledReason,
  workflowSelecting: () => workflowSelecting,
  getMentionNodes: () => getMentionNodes(),
  selectWorkflow,
  pickNode: (node) => emit('mentionPick', node),
  requestWorkflows: () => emit('requestWorkflowReferences')
})

function onSelectNodes(event: Event): void {
  if (nodeReferenceDisabledReason) {
    event.preventDefault()
    return
  }
  emit('selectNodes')
}

async function pickWorkflow(workflow: WorkflowReferenceOption): Promise<void> {
  if (await selectWorkflow(workflow)) addMenuOpen.value = false
}

function onEditorSelectionChange(): void {
  const point = editorRef.value?.insertionPoint()
  if (point) composer.setInsertionPoint(point)
  syncMention()
}

function onComposerKeydown(event: KeyboardEvent): void {
  if (handleMentionKeydown(event)) return
  if (event.key === 'Enter') onEnter(event)
  if (
    event.key === 'Escape' &&
    running.value &&
    !event.isComposing &&
    !event.repeat
  ) {
    event.preventDefault()
    event.stopPropagation()
    emit('stop', 'escape')
  }
}

const placeholderHint = computed(() => {
  const [text = '', mentionNodes = ''] = t('agent.placeholder').split('\n')
  return { text, mentionNodes }
})

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return
  event.preventDefault()
  if (running.value) return
  composer.submit()
}

const primaryActionDisabled = computed(
  () => !running.value && (workflowSelecting || !composer.canSend.value)
)
const showPlaceholder = computed(
  () => !composer.draft.value && !composer.prompt.value.references.length
)
const nodeReferenceTooltip = computed(() => nodeReferenceDisabledReason ?? '')
const activeMentionId = computed(() =>
  mentionVisible.value
    ? `agent-reference-item-${mentionActive.value}`
    : undefined
)
const showAssetMenuSeparator = computed(() => canAttach && canOpenAssets)

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
// (src/components/ui/select/select.variants.ts), and the capture-phase
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
  unregisterEscapeOverride = registerEscapeOverride(handleEscapeOverride)
})
onUnmounted(() => {
  unregisterEscapeOverride?.()
})

function insert(text: string): void {
  composer.insert(text)
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
    class="relative flex flex-col rounded-lg border border-border-default bg-base-background"
  >
    <MentionMenu
      v-if="mentionVisible"
      :matches="mentionMatches"
      :section="mentionSection"
      :active="mentionActive"
      :has-results="mentionHasResults"
      :node-reference-disabled-reason
      :graph-dupes
      :duplicate-id-class
      :is-node-reference-disabled
      :is-mention-disabled
      @highlight="highlightMention"
      @pick="pickMention"
    />

    <div
      v-if="$slots.header"
      class="flex h-11 shrink-0 items-center rounded-t-lg bg-base-background px-2"
    >
      <slot name="header" />
    </div>

    <div
      :class="
        cn(
          'relative flex flex-col border transition-colors',
          assetDragActive
            ? 'h-28 rounded-lg border-dashed border-component-node-border bg-secondary-background'
            : 'min-h-28 rounded-lg border-border-default bg-secondary-background focus-within:border-muted-foreground'
        )
      "
    >
      <div
        v-if="assetDragActive"
        role="status"
        class="absolute inset-px z-20 flex flex-col items-center justify-center gap-2 rounded-lg bg-secondary-background font-inter text-[14px] leading-[normal] font-normal text-muted-foreground"
      >
        <span
          aria-hidden="true"
          class="icon-[lucide--upload] size-6 shrink-0 text-muted-foreground"
        />
        <span>{{ t('agent.dragAndDropAssets') }}</span>
      </div>
      <SelectionTags
        v-if="selectionTags.length"
        :tags="selectionTags"
        :graph-dupes
        :tag-dupes
        :duplicate-id-class
        @remove="emit('removeTag', $event)"
      />

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
          @remove="composer.removeReference(`asset:${item.id}`)"
        />
      </div>

      <div
        data-testid="composer-inline-input"
        class="max-h-100 min-h-16 overflow-x-hidden overflow-y-auto p-3"
      >
        <div
          v-if="workflowSelecting"
          role="status"
          class="mb-1 flex items-center gap-1 text-xs text-muted-foreground"
        >
          <span class="icon-[lucide--loader-circle] size-3 animate-spin" />
          {{ t('agent.savingWorkflow') }}
        </div>
        <div class="relative min-h-7">
          <InlinePromptEditor
            ref="editorRef"
            :model-value="composer.prompt.value"
            :label="t('agent.placeholder')"
            :expanded="mentionVisible"
            :active-descendant="activeMentionId"
            :history-epoch="composer.promptEpoch.value"
            :editable-workflow-id
            @keydown="onComposerKeydown"
            @update:model-value="composer.applyEditorPrompt"
            @keyup="onComposerKeyup"
            @input="syncMention"
            @selection-change="onEditorSelectionChange"
            @click="syncMention"
            @blur="closeMention()"
            @open-reference-workflow="
              (id, name) => emit('openReferenceWorkflow', id, name)
            "
            @remove-node-reference="emit('removeTag', $event)"
            @remove-workflow-reference="emit('removeWorkflowReference', $event)"
          />

          <div
            v-if="showPlaceholder"
            class="pointer-events-none relative z-10 -mt-7 font-inter text-[14px]/[20px] font-normal text-muted-foreground"
          >
            <span>{{ placeholderHint.text }} </span>
            <Tooltip
              :config="nodeReferenceTooltip"
              :disabled="!nodeReferenceDisabledReason"
              side="top"
              :delay-duration="300"
              :ignore-non-keyboard-focus="false"
              disable-closing-trigger
              :collision-padding="8"
            >
              <button
                type="button"
                :aria-disabled="!!nodeReferenceDisabledReason || undefined"
                :aria-description="nodeReferenceDisabledReason"
                class="pointer-events-auto -ml-1 inline-flex h-5 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-1 align-top text-[14px]/[20px] text-muted-foreground transition-colors hover:text-base-foreground focus-visible:text-base-foreground focus-visible:outline-1 focus-visible:outline-base-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                @click="onSelectNodes"
              >
                <span
                  class="icon-[lucide--mouse-pointer-click] size-3.5 shrink-0"
                />
                <span class="underline decoration-dashed underline-offset-2">{{
                  placeholderHint.mentionNodes
                }}</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between px-3 py-2">
        <DropdownMenuRoot v-model:open="addMenuOpen">
          <DropdownMenuTrigger as-child>
            <Tooltip
              :config="buildTooltipConfig(t('agent.addToPrompt'))"
              side="top"
            >
              <button
                type="button"
                :aria-label="t('agent.addToPrompt')"
                class="flex size-8 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
              >
                <span class="icon-[lucide--plus] size-4" />
              </button>
            </Tooltip>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              side="top"
              align="start"
              :side-offset="4"
              class="agent-scope z-1100 box-border w-max min-w-46.5 rounded-lg border border-border-subtle bg-secondary-background p-1 font-inter shadow-lg"
            >
              <Tooltip
                :config="nodeReferenceTooltip"
                :disabled="!nodeReferenceDisabledReason"
                side="top"
                :delay-duration="300"
                :ignore-non-keyboard-focus="false"
                disable-closing-trigger
                :collision-padding="8"
              >
                <DropdownMenuItem
                  :disabled="!!nodeReferenceDisabledReason"
                  :aria-description="nodeReferenceDisabledReason"
                  class="mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-highlighted:bg-secondary-background-hover"
                  @select="onSelectNodes"
                >
                  <span class="icon-[comfy--node] size-4 shrink-0" />
                  <span class="whitespace-nowrap">
                    {{ t('agent.nodes') }}
                  </span>
                </DropdownMenuItem>
              </Tooltip>
              <WorkflowReferenceSubmenu
                :workflows="eligibleWorkflows"
                :selecting="workflowSelecting"
                @request="emit('requestWorkflowReferences')"
                @pick="pickWorkflow"
              />
              <DropdownMenuItem
                v-if="canOpenAssets"
                class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
                @select="emit('openAssets')"
              >
                <span class="icon-[comfy--image-ai-edit] size-4 shrink-0" />
                <span class="whitespace-nowrap">
                  {{ t('agent.addFromAssets') }}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator
                v-if="showAssetMenuSeparator"
                class="mt-0 mb-px h-px bg-border-subtle"
              />
              <DropdownMenuItem
                v-if="canAttach"
                class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
                @select="emit('attach')"
              >
                <i-lucide:paperclip class="size-4 shrink-0" />
                <span class="whitespace-nowrap">{{
                  t('agent.attachFiles')
                }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>

        <div class="flex items-center gap-1">
          <RunModePopover />
          <PrimaryAction
            :running
            :disabled="primaryActionDisabled"
            @action="onPrimaryAction"
          />
        </div>
      </div>
    </div>
  </div>
</template>
