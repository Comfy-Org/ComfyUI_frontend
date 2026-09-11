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

import Button from '@/components/ui/button/Button.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'

import InlinePromptEditor from './composer/InlinePromptEditor.vue'
import { useAgentMentionPicker } from '../../composables/agent/useAgentMentionPicker'
import { useWorkflowReferencePicker } from '../../composables/agent/useWorkflowReferencePicker'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { selectedNodeKey } from '../../composables/agent/useCanvasSelection'
import type {
  PromptSnapshot,
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'
import { cn } from '@comfyorg/tailwind-utils'

import AttachmentChip from './composer/AttachmentChip.vue'
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
const { t } = useI18n()

const assetDragActive = inject<Readonly<Ref<boolean>>>(
  'agentAssetDragActive',
  ref(false)
)

const duplicateIdClass =
  'shrink-0 rounded-full bg-interface-menu-keybind-surface-default px-1 py-0.5 font-mono text-xs/4 font-medium text-base-foreground'

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
        (reference) => reference.textOffset
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
            Math.max(0, reference.textOffset - start)
          )
        }))
      )
    } else emit('send', text, attachments)
  },
  isStreaming: () => streaming,
  onStop: () => emit('stop')
})

const editorRef =
  useTemplateRef<InstanceType<typeof InlinePromptEditor>>('editorRef')
const { workflowReferences } = composer

const workflowSubmenuOpen = ref(false)
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

function onWorkflowSubmenuOpenChange(open: boolean): void {
  if (open && !workflowSelecting) emit('requestWorkflowReferences')
}

async function pickWorkflow(workflow: WorkflowReferenceOption): Promise<void> {
  if (await selectWorkflow(workflow)) addMenuOpen.value = false
}

function onComposerKeydown(event: KeyboardEvent): void {
  if (!handleMentionKeydown(event) && event.key === 'Enter') onEnter(event)
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
    class="relative flex flex-col rounded-lg border border-border-default bg-base-background"
  >
    <div
      v-if="mentionVisible"
      id="agent-reference-menu"
      ref="mentionListRef"
      data-testid="agent-reference-menu"
      role="menu"
      :aria-label="t('agent.addToPrompt')"
      class="absolute inset-x-0 bottom-full z-1100 mb-[-35px] max-h-64 overflow-y-auto rounded-lg border border-border-subtle bg-secondary-background p-1 font-inter shadow-md"
      @mousedown.prevent
    >
      <div
        v-if="mentionSection === 'root'"
        class="flex h-6 items-center px-1.5 py-1 text-xs/4 text-muted-foreground"
      >
        {{ t('agent.reference') }}
      </div>
      <AccessibleTooltip
        v-for="(match, index) in mentionMatches"
        :key="`${match.kind}:${match.id}`"
        :label="nodeReferenceDisabledReason ?? ''"
        :disabled="!isNodeReferenceDisabled(match)"
        :skip-delay-duration="0"
        disable-hoverable-content
        :collision-padding="8"
      >
        <template #trigger>
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
                'flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-normal text-base-foreground outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
                index === mentionActive && 'bg-secondary-background-hover'
              )
            "
            @mouseenter="highlightMention(index)"
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
              v-if="
                match.kind === 'workflow' && match.workflow.id === undefined
              "
              class="text-xs text-muted-foreground"
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
        </template>
      </AccessibleTooltip>
      <div
        v-if="!mentionHasResults"
        role="status"
        class="px-2 py-1 text-xs text-muted-foreground"
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
      <div
        v-if="selectionTags.length"
        data-testid="composer-node-section"
        class="flex flex-wrap items-center gap-2 border-b border-border-default p-3"
      >
        <span
          v-for="tag in selectionTags"
          :key="selectedNodeKey(tag)"
          class="inline-flex h-7 items-center gap-1 rounded-lg border border-border-default bg-secondary-background-hover px-2.5 text-xs/4 font-medium text-base-foreground transition-colors hover:bg-tertiary-background-hover"
        >
          <span class="flex items-center gap-1">
            <span class="icon-[comfy--node] size-3.5 text-muted-foreground" />
            <span class="max-w-40 truncate">{{ tag.title }}</span>
            <span
              v-if="graphDupes.has(tag.title) || tagDupes.has(tag.title)"
              :class="duplicateIdClass"
              >#{{ tag.id }}</span
            >
          </span>
          <button
            v-tooltip.top="buildTooltipConfig(t('agent.remove'))"
            type="button"
            :aria-label="
              t('agent.removeNodeLabel', { node: `${tag.title} #${tag.id}` })
            "
            class="flex size-3.5 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-base-foreground"
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
            :active-descendant="
              mentionVisible
                ? `agent-reference-item-${mentionActive}`
                : undefined
            "
            @keydown="onComposerKeydown"
            @update:model-value="composer.replacePrompt"
            @keyup="onComposerKeyup"
            @input="syncMention"
            @selection-change="syncMention"
            @click="syncMention"
            @blur="closeMention()"
            @open-reference-workflow="
              (id, name) => emit('openReferenceWorkflow', id, name)
            "
            @remove-workflow-reference="emit('removeWorkflowReference', $event)"
          />

          <div
            v-if="!composer.draft.value && !workflowReferences.length"
            class="pointer-events-none relative z-10 -mt-7 font-inter text-[14px]/[20px] font-normal text-muted-foreground"
          >
            <span>{{ placeholderHint.text }} </span>
            <AccessibleTooltip
              :label="nodeReferenceDisabledReason ?? ''"
              :disabled="!nodeReferenceDisabledReason"
              :skip-delay-duration="0"
              disable-hoverable-content
              :collision-padding="8"
            >
              <template #trigger>
                <button
                  type="button"
                  :aria-disabled="!!nodeReferenceDisabledReason || undefined"
                  :aria-description="nodeReferenceDisabledReason"
                  class="pointer-events-auto -ml-1 inline-flex h-[20px] shrink-0 cursor-pointer items-center gap-[4px] rounded-lg px-[4px] align-top text-[14px]/[20px] text-muted-foreground transition-colors hover:text-base-foreground focus-visible:text-base-foreground focus-visible:outline-1 focus-visible:outline-base-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  @click="onSelectNodes"
                >
                  <span
                    class="icon-[lucide--mouse-pointer-click] size-[14px] shrink-0"
                  />
                  <span
                    class="underline decoration-dashed underline-offset-2"
                    >{{ placeholderHint.mentionNodes }}</span
                  >
                </button>
              </template>
            </AccessibleTooltip>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between px-3 py-2">
        <DropdownMenuRoot v-model:open="addMenuOpen">
          <DropdownMenuTrigger
            v-tooltip.top="buildTooltipConfig(t('agent.addToPrompt'))"
            :aria-label="t('agent.addToPrompt')"
            class="flex size-8 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground"
          >
            <span class="icon-[lucide--plus] size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              side="top"
              align="start"
              :side-offset="4"
              class="agent-scope z-1100 box-border w-max min-w-[186px] rounded-lg border border-border-subtle bg-secondary-background p-1 font-inter shadow-lg"
            >
              <AccessibleTooltip
                :label="nodeReferenceDisabledReason ?? ''"
                :disabled="!nodeReferenceDisabledReason"
                :skip-delay-duration="0"
                disable-hoverable-content
                :collision-padding="8"
              >
                <template #trigger>
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
                </template>
              </AccessibleTooltip>
              <DropdownMenuSub
                v-model:open="workflowSubmenuOpen"
                @update:open="onWorkflowSubmenuOpenChange"
              >
                <DropdownMenuSubTrigger
                  class="mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
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
                    class="agent-scope z-1100 box-border max-h-64 min-w-[186px] overflow-y-auto rounded-lg border border-border-subtle bg-secondary-background p-1 font-inter shadow-lg"
                  >
                    <DropdownMenuItem
                      class="mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
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
                      class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
                      @select.prevent="pickWorkflow(workflow)"
                    >
                      <span class="icon-[comfy--workflow] size-4 shrink-0" />
                      <span class="max-w-64 truncate">{{ workflow.name }}</span>
                      <span
                        v-if="workflow.id === undefined"
                        class="text-xs text-muted-foreground"
                        >{{ t('agent.unsavedWorkflow') }}</span
                      >
                    </DropdownMenuItem>
                    <div
                      v-if="eligibleWorkflows.length === 0"
                      class="px-2 py-1 text-xs text-muted-foreground"
                    >
                      {{ t('agent.noWorkflowsToReference') }}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
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
                v-if="canAttach && canOpenAssets"
                class="mt-0 mb-px h-px bg-border-subtle"
              />
              <DropdownMenuItem
                v-if="canAttach"
                class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
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
          <AccessibleTooltip
            :label="primaryActionTooltip"
            :disabled="running"
            :skip-delay-duration="0"
            disable-hoverable-content
            :collision-padding="8"
          >
            <template #trigger>
              <Button
                type="button"
                :variant="running ? 'secondary' : 'inverted'"
                size="icon"
                :aria-label="running ? t('agent.stop') : t('agent.send')"
                :disabled="
                  !running && (workflowSelecting || !composer.canSend.value)
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
              </Button>
            </template>
          </AccessibleTooltip>
        </div>
      </div>
    </div>
  </div>
</template>
