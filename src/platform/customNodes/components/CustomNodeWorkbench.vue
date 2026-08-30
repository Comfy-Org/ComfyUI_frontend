<template>
  <div
    class="custom-node-workbench flex size-full min-h-0 min-w-0 flex-col overflow-hidden bg-base-background text-base-foreground"
    data-testid="custom-node-workbench"
  >
    <div
      class="workbench-grid relative grid min-h-0 min-w-0 flex-1"
      :data-agent-open="agentOpen"
    >
      <main class="relative min-h-0 min-w-0 overflow-hidden bg-base-background">
        <CustomNodeTreeEditor
          v-show="!selectedChange"
          ref="treeEditorRef"
          v-model:explorer-open="explorerOpen"
          :session-id="sessionId"
          :state-key="editorStateKey"
          :pack-name="packName"
        />
        <CustomNodeCodeEditor
          v-if="selectedChange && selectedChangeUsesDiff"
          :path="selectedChange.path"
          :original-content="selectedChange.originalContent"
          :proposed-content="selectedChange.proposedContent"
          :theme="editorTheme"
        />
        <div
          v-else-if="selectedChange"
          class="flex size-full items-center justify-center p-6"
          data-testid="proposal-structural-change"
        >
          <div class="flex max-w-lg flex-col items-center gap-3 text-center">
            <i
              :class="proposalChangeIcon(selectedChange.kind)"
              class="size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <p class="m-0 text-sm font-medium text-base-foreground">
              {{ proposalChangeLabel(selectedChange) }}
            </p>
            <p class="m-0 text-xs text-muted-foreground">
              {{ $t('customNodePacks.editor.agent.structuralChange') }}
            </p>
          </div>
        </div>
      </main>

      <aside
        id="custom-node-agent-panel"
        class="agent-panel min-h-0 min-w-0 flex-col border-l border-border-default bg-secondary-background font-inter text-base-foreground"
        :data-open="agentOpen"
        :aria-label="$t('customNodePacks.editor.agent.title')"
      >
        <div
          class="flex h-10 shrink-0 items-center gap-2 border-b border-border-default pr-1.5 pl-3"
        >
          <i
            class="icon-[lucide--sparkles] size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-medium">
            {{ $t('customNodePacks.editor.agent.title') }}
          </h3>
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="$t('customNodePacks.editor.agent.close')"
            :title="$t('customNodePacks.editor.agent.close')"
            @click="agentOpen = false"
          >
            <i class="icon-[lucide--x] size-4" aria-hidden="true" />
          </Button>
        </div>

        <div
          ref="conversationRef"
          class="min-h-0 flex-1 overflow-y-auto"
          aria-live="polite"
        >
          <div
            v-if="!agentEnabled"
            class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
          >
            <i
              class="icon-[lucide--sparkles] size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p class="m-0 text-sm font-medium">
              {{ $t('customNodePacks.editor.agent.unavailable') }}
            </p>
            <p class="m-0 max-w-xs text-xs/5 text-muted-foreground">
              {{ $t('customNodePacks.editor.agent.unavailableDetail') }}
            </p>
          </div>

          <div
            v-else-if="messages.length === 0"
            class="flex h-full flex-col justify-end gap-3 px-3 pb-4"
            data-testid="node-agent-start"
          >
            <p class="m-0 text-sm/6 text-muted-foreground">
              {{ $t('customNodePacks.editor.agent.description') }}
            </p>
            <button
              type="button"
              class="flex w-fit max-w-full cursor-pointer appearance-none items-start gap-2 rounded-lg border border-solid border-border-subtle bg-tertiary-background px-3 py-2 text-left font-inter text-xs/5 text-base-foreground hover:bg-tertiary-background-hover focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
              @click="useSamplePrompt"
            >
              <i
                class="mt-0.5 icon-[lucide--sparkles] size-3.5 shrink-0 text-primary-background"
                aria-hidden="true"
              />
              <span class="min-w-0">
                {{ $t('customNodePacks.editor.agent.samplePrompt') }}
              </span>
            </button>
          </div>

          <ol
            v-else
            class="m-0 flex list-none flex-col gap-4 p-3"
            data-testid="node-agent-conversation"
          >
            <li
              v-for="message in messages"
              :key="message.id"
              :class="cn('flex', message.role === 'user' && 'justify-end')"
            >
              <div
                v-if="message.role === 'user'"
                class="max-w-[85%] rounded-lg rounded-br-sm bg-tertiary-background px-3 py-2 text-sm/5 wrap-break-word whitespace-pre-wrap"
              >
                {{ message.content }}
              </div>
              <div v-else class="min-w-0 flex-1 text-sm/5">
                <div
                  v-if="message.kind === 'working'"
                  class="flex items-center gap-2 text-muted-foreground"
                >
                  <i
                    class="icon-[lucide--loader-circle] size-3.5 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                  <p class="m-0">{{ message.content }}</p>
                </div>
                <p
                  v-else
                  :class="
                    cn(
                      'm-0 wrap-break-word whitespace-pre-wrap',
                      message.kind === 'error' && 'text-destructive-background',
                      message.kind === 'stopped' && 'text-muted-foreground'
                    )
                  "
                  :role="message.kind === 'error' ? 'alert' : undefined"
                >
                  {{ message.content }}
                </p>

                <div
                  v-if="message.proposal"
                  class="mt-2 flex flex-col"
                  data-testid="node-agent-proposal"
                >
                  <details
                    v-if="message.proposal.test"
                    class="group"
                    :open="message.proposal.test.status === 'failed'"
                    data-testid="node-agent-test-result"
                  >
                    <summary
                      class="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs select-none hover:bg-secondary-background-hover [&::-webkit-details-marker]:hidden"
                    >
                      <i
                        :class="testResultIcon(message.proposal.test.status)"
                        class="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span class="min-w-0 flex-1 truncate font-medium">
                        {{ testResultLabel(message.proposal.test.status) }}
                      </span>
                      <i
                        class="icon-[lucide--chevron-right] size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                        aria-hidden="true"
                      />
                    </summary>
                    <div
                      class="flex flex-col gap-1.5 py-1 pr-1.5 pl-7 text-xs text-muted-foreground"
                    >
                      <p
                        class="m-0 max-h-40 overflow-y-auto wrap-break-word whitespace-pre-wrap"
                      >
                        {{ message.proposal.test.summary }}
                      </p>
                      <p
                        v-if="
                          message.proposal.test.durationMs > 0 ||
                          message.proposal.test.phase ||
                          message.proposal.test.sandbox
                        "
                        class="m-0 flex flex-wrap gap-x-2 gap-y-1"
                      >
                        <span v-if="message.proposal.test.durationMs > 0">
                          {{
                            $t('customNodePacks.editor.agent.testDuration', {
                              duration: message.proposal.test.durationMs
                            })
                          }}
                        </span>
                        <span v-if="message.proposal.test.phase">
                          {{
                            $t('customNodePacks.editor.agent.testPhase', {
                              phase: message.proposal.test.phase
                            })
                          }}
                        </span>
                        <span v-if="message.proposal.test.sandbox">
                          {{
                            $t('customNodePacks.editor.agent.testSandbox', {
                              sandbox: message.proposal.test.sandbox
                            })
                          }}
                        </span>
                      </p>
                      <div
                        v-if="message.proposal.test.error"
                        data-testid="node-agent-python-error"
                      >
                        <p
                          class="m-0 font-medium wrap-break-word text-base-foreground"
                        >
                          {{ message.proposal.test.error.type }}:
                          {{ message.proposal.test.error.message }}
                        </p>
                        <ul
                          v-if="message.proposal.test.error.frames.length > 0"
                          class="mt-1 mb-0 flex list-none flex-col gap-0.5 p-0 font-mono"
                          :aria-label="
                            $t('customNodePacks.editor.agent.traceback')
                          "
                        >
                          <li
                            v-for="(frame, frameIndex) in message.proposal.test
                              .error.frames"
                            :key="`${frame.file}:${frame.line ?? 0}:${frameIndex}`"
                            class="wrap-break-word"
                          >
                            {{ frame.file
                            }}<template v-if="frame.line"
                              >:{{ frame.line }}</template
                            ><template v-if="frame.function">
                              — {{ frame.function }}</template
                            >
                            <span v-if="frame.source" class="block pl-3">
                              {{ frame.source }}
                            </span>
                          </li>
                        </ul>
                      </div>
                      <details
                        v-if="
                          message.proposal.test.stdout ||
                          message.proposal.test.stderr
                        "
                      >
                        <summary class="cursor-pointer select-none">
                          {{ $t('customNodePacks.editor.agent.testLogs') }}
                        </summary>
                        <div class="mt-1 flex flex-col gap-1.5">
                          <div v-if="message.proposal.test.stdout">
                            <p class="m-0 font-medium">
                              {{ $t('customNodePacks.editor.agent.stdout') }}
                            </p>
                            <pre
                              class="m-0 mt-0.5 max-h-32 overflow-auto rounded-md bg-base-background p-2 font-mono whitespace-pre-wrap"
                              >{{ message.proposal.test.stdout }}</pre>
                          </div>
                          <div v-if="message.proposal.test.stderr">
                            <p class="m-0 font-medium">
                              {{ $t('customNodePacks.editor.agent.stderr') }}
                            </p>
                            <pre
                              class="m-0 mt-0.5 max-h-32 overflow-auto rounded-md bg-base-background p-2 font-mono whitespace-pre-wrap"
                              >{{ message.proposal.test.stderr }}</pre>
                          </div>
                        </div>
                      </details>
                      <div
                        v-if="message.proposal.test.outputs.length > 0"
                        class="flex flex-col gap-1.5"
                        data-testid="node-agent-test-outputs"
                      >
                        <div
                          v-for="output in message.proposal.test.outputs"
                          :key="output.index"
                        >
                          <p class="m-0">
                            {{
                              $t('customNodePacks.editor.agent.testOutput', {
                                index: output.index + 1,
                                kind: output.kind
                              })
                            }}
                            <template v-if="output.shape?.length">
                              · {{ output.shape.join(' × ') }}
                            </template>
                            <template v-if="output.dtype">
                              · {{ output.dtype }}
                            </template>
                          </p>
                          <p
                            v-if="output.value !== undefined"
                            class="mt-0.5 mb-0 font-mono wrap-break-word whitespace-pre-wrap"
                          >
                            {{ plainOutputValue(output.value) }}
                          </p>
                          <div
                            v-if="
                              output.artifacts.some((artifact) => artifact.url)
                            "
                            class="mt-1.5 grid grid-cols-2 gap-2"
                          >
                            <img
                              v-for="artifact in output.artifacts.filter(
                                (candidate) => candidate.url
                              )"
                              :key="artifact.name"
                              :src="artifact.url"
                              :alt="
                                $t('customNodePacks.editor.agent.testPreview', {
                                  output: output.index + 1
                                })
                              "
                              class="aspect-square w-full rounded-md border border-border-subtle object-contain"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>

                  <button
                    v-for="(change, index) in message.proposal.changes"
                    :key="`${index}:${change.kind}:${change.path}:${change.destinationPath ?? ''}`"
                    type="button"
                    :title="proposalChangeLabel(change)"
                    :class="
                      cn(
                        'flex cursor-pointer appearance-none items-center gap-2 rounded-md border-none bg-transparent px-1.5 py-1 text-left font-inter text-xs text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none',
                        selectedProposal?.id === message.proposal.id &&
                          index === selectedChangeIndex &&
                          'bg-secondary-background-hover'
                      )
                    "
                    @click="selectChange(message.proposal, index)"
                  >
                    <i
                      :class="[
                        proposalChangeIcon(change.kind),
                        proposalChangeIconColor(change.kind)
                      ]"
                      class="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span class="min-w-0 flex-1 truncate">
                      {{ proposalChangeLabel(change) }}
                    </span>
                  </button>

                  <p
                    v-if="message.applied"
                    class="m-0 flex items-center gap-2 px-1.5 py-1 text-xs text-muted-foreground"
                  >
                    <i
                      class="icon-[lucide--check] size-3.5 shrink-0 text-success-background"
                      aria-hidden="true"
                    />
                    {{ $t('customNodePacks.editor.agent.applied') }}
                  </p>
                </div>
              </div>
            </li>
          </ol>
        </div>

        <form
          v-if="agentEnabled"
          class="shrink-0 border-t border-border-default p-3"
          @submit.prevent="askAgent"
        >
          <div
            class="flex flex-col rounded-lg border border-border-default bg-base-background focus-within:ring-1 focus-within:ring-border-default"
          >
            <Textarea
              ref="promptInputRef"
              v-model="instruction"
              class="field-sizing-content max-h-40 min-h-9 resize-none rounded-lg border-none bg-transparent px-3 pt-2 pb-1 font-inter text-sm/5 focus-visible:ring-0"
              rows="1"
              :placeholder="$t('customNodePacks.editor.agent.placeholder')"
              :aria-label="$t('customNodePacks.editor.agent.placeholder')"
              maxlength="4096"
              @keydown.enter.exact.prevent="askAgent"
            />
            <div class="flex items-center justify-end px-1.5 pb-1.5">
              <Button
                v-if="runState.phase === 'asking'"
                variant="primary"
                size="icon"
                type="button"
                class="size-7 rounded-full"
                :aria-label="$t('customNodePacks.editor.agent.stop')"
                :title="$t('customNodePacks.editor.agent.stop')"
                @click="stopAgent"
              >
                <i class="icon-[lucide--square] size-3" aria-hidden="true" />
              </Button>
              <Button
                v-else
                variant="primary"
                size="icon"
                type="submit"
                class="size-7 rounded-full"
                :aria-label="$t('customNodePacks.editor.agent.send')"
                :title="$t('customNodePacks.editor.agent.send')"
                :disabled="!instruction.trim() || runState.phase !== 'idle'"
              >
                <i class="icon-[lucide--arrow-up] size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { reportError } from '@/platform/telemetry/reportError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import { useCustomNodeEditor } from '../composables/useCustomNodeEditor'
import type {
  CustomNodeEditorProposalView,
  CustomNodeEditorProposalChange,
  CustomNodeEditorProposalChangeKind,
  CustomNodeEditorTestStatus
} from '../composables/useCustomNodeEditor'
import {
  customNodeEditorStateKey,
  migrateCustomNodeEditorState,
  readCustomNodeEditorState,
  updateCustomNodeEditorState
} from '../utils/customNodeEditorState'
import CustomNodeCodeEditor from './CustomNodeCodeEditor.vue'
import CustomNodeTreeEditor from './CustomNodeTreeEditor.vue'

const { sessionId, agentEnabled, packName } = defineProps<{
  sessionId: string
  agentEnabled: boolean
  packName: string
}>()
const agentOpen = defineModel<boolean>('agentOpen', { default: true })
const explorerOpen = defineModel<boolean>('explorerOpen', { default: true })

const { t } = useI18n()
const colorPaletteStore = useColorPaletteStore()
const teamWorkspaceStore = useTeamWorkspaceStore()
const { createAgentProposal, applyAgentProposal } = useCustomNodeEditor()
const treeEditorRef =
  useTemplateRef<InstanceType<typeof CustomNodeTreeEditor>>('treeEditorRef')
const promptInputRef =
  useTemplateRef<InstanceType<typeof Textarea>>('promptInputRef')
const conversationRef = useTemplateRef<HTMLDivElement>('conversationRef')

type AgentMessageKind = 'message' | 'working' | 'error' | 'stopped'

interface AgentChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  kind: AgentMessageKind
  proposal?: CustomNodeEditorProposalView
  applied?: boolean
}

type AgentRunState =
  | { phase: 'idle' }
  | { phase: 'asking'; controller: AbortController }

const editorStateKey = computed(() =>
  customNodeEditorStateKey(teamWorkspaceStore.activeWorkspaceId, packName)
)
agentOpen.value =
  readCustomNodeEditorState(editorStateKey.value)?.agentOpen ?? agentOpen.value
const instruction = ref('')
const messages = ref<AgentChatMessage[]>([])
const selectedProposal = ref<CustomNodeEditorProposalView | null>(null)
const selectedChangeIndex = ref(-1)
const runState = shallowRef<AgentRunState>({ phase: 'idle' })
let messageSequence = 0

const editorTheme = computed(() =>
  colorPaletteStore.completedActivePalette.light_theme ? 'light' : 'dark'
)
const selectedChange = computed(() =>
  selectedChangeIndex.value < 0
    ? undefined
    : selectedProposal.value?.changes[selectedChangeIndex.value]
)
const selectedChangeUsesDiff = computed(
  () =>
    selectedChange.value?.kind !== 'moved' &&
    selectedChange.value?.kind !== 'directory_created'
)

async function saveAll() {
  await treeEditorRef.value?.saveAll()
}

function nextMessageId(): string {
  messageSequence += 1
  return `node-agent-message-${messageSequence}`
}

async function scrollConversation() {
  await nextTick()
  if (!conversationRef.value) return
  conversationRef.value.scrollTop = conversationRef.value.scrollHeight
}

function replaceMessage(id: string, replacement: Omit<AgentChatMessage, 'id'>) {
  messages.value = messages.value.map((message) =>
    message.id === id ? { id, ...replacement } : message
  )
}

async function askAgent() {
  const requestedChange = instruction.value.trim()
  if (!requestedChange || runState.value.phase !== 'idle') return

  const controller = new AbortController()
  const responseMessageId = nextMessageId()
  runState.value = { phase: 'asking', controller }
  instruction.value = ''
  messages.value = [
    ...messages.value,
    {
      id: nextMessageId(),
      role: 'user',
      content: requestedChange,
      kind: 'message'
    },
    {
      id: responseMessageId,
      role: 'assistant',
      content: t('customNodePacks.editor.agent.working'),
      kind: 'working'
    }
  ]
  await scrollConversation()

  try {
    await saveAll()
    const proposal = await createAgentProposal(
      sessionId,
      requestedChange,
      controller.signal
    )
    if (controller.signal.aborted) return
    replaceMessage(responseMessageId, {
      role: 'assistant',
      content: proposal.summary,
      kind: 'message',
      proposal
    })
    await applyProposal(responseMessageId, proposal)
  } catch (error) {
    if (isAbortError(error)) {
      replaceMessage(responseMessageId, {
        role: 'assistant',
        content: t('customNodePacks.editor.agent.stopped'),
        kind: 'stopped'
      })
    } else {
      reportError(error, { errorType: 'custom_node_agent_request_failed' })
      replaceMessage(responseMessageId, {
        role: 'assistant',
        content:
          error instanceof Error
            ? error.message
            : t('customNodePacks.editor.agent.failed'),
        kind: 'error'
      })
    }
  } finally {
    if (
      runState.value.phase === 'asking' &&
      runState.value.controller === controller
    ) {
      runState.value = { phase: 'idle' }
    }
    await scrollConversation()
    promptInputRef.value?.focus()
  }
}

async function applyProposal(
  messageId: string,
  proposal: CustomNodeEditorProposalView
) {
  try {
    const result = await applyAgentProposal(sessionId, proposal.id)
    await treeEditorRef.value?.replaceFiles(result)
    messages.value = messages.value.map((candidate) =>
      candidate.id === messageId ? { ...candidate, applied: true } : candidate
    )
  } catch (error) {
    reportError(error, { errorType: 'custom_node_agent_apply_failed' })
    messages.value = [
      ...messages.value,
      {
        id: nextMessageId(),
        role: 'assistant',
        content:
          error instanceof Error
            ? error.message
            : t('customNodePacks.editor.agent.applyFailed'),
        kind: 'error'
      }
    ]
  }
}

function stopAgent() {
  if (runState.value.phase === 'asking') {
    runState.value.controller.abort()
  }
}

function useSamplePrompt() {
  instruction.value = t('customNodePacks.editor.agent.samplePrompt')
  promptInputRef.value?.focus()
}

function selectChange(proposal: CustomNodeEditorProposalView, index: number) {
  if (
    selectedProposal.value?.id === proposal.id &&
    selectedChangeIndex.value === index
  ) {
    selectedProposal.value = null
    selectedChangeIndex.value = -1
    return
  }
  selectedProposal.value = proposal
  selectedChangeIndex.value = index
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function proposalChangeLabel(change: CustomNodeEditorProposalChange): string {
  if (change.kind === 'moved' && change.destinationPath) {
    return `${change.path} → ${change.destinationPath}`
  }
  return change.kind === 'directory_created' ? `${change.path}/` : change.path
}

function proposalChangeIcon(kind: CustomNodeEditorProposalChangeKind): string {
  switch (kind) {
    case 'created':
      return 'icon-[lucide--file-plus-2]'
    case 'deleted':
      return 'icon-[lucide--file-minus-2]'
    case 'moved':
      return 'icon-[lucide--file-input]'
    case 'directory_created':
      return 'icon-[lucide--folder-plus]'
    default:
      return 'icon-[lucide--file-diff]'
  }
}

function proposalChangeIconColor(
  kind: CustomNodeEditorProposalChangeKind
): string {
  switch (kind) {
    case 'created':
    case 'directory_created':
      return 'text-success-background'
    case 'deleted':
      return 'text-destructive-background'
    default:
      return 'text-muted-foreground'
  }
}

function testResultLabel(status: CustomNodeEditorTestStatus): string {
  return t(`customNodePacks.editor.agent.testStatus.${status}`)
}

function testResultIcon(status: CustomNodeEditorTestStatus): string {
  if (status === 'passed') {
    return 'icon-[lucide--circle-check] text-success-background'
  }
  if (status === 'failed') {
    return 'icon-[lucide--circle-x] text-destructive-background'
  }
  if (status === 'unavailable') {
    return 'icon-[lucide--circle-alert] text-warning-background'
  }
  return 'icon-[lucide--circle-minus] text-muted-foreground'
}

function plainOutputValue(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2) ?? ''
}

watch(
  () => packName,
  (packName, previousPackName) => {
    const workspaceId = teamWorkspaceStore.activeWorkspaceId
    migrateCustomNodeEditorState(
      customNodeEditorStateKey(workspaceId, previousPackName),
      customNodeEditorStateKey(workspaceId, packName)
    )
  },
  { flush: 'sync' }
)

watch(editorStateKey, (key) => {
  agentOpen.value = readCustomNodeEditorState(key)?.agentOpen ?? true
})

watch(agentOpen, (isOpen) => {
  updateCustomNodeEditorState(editorStateKey.value, { agentOpen: isOpen })
})

onUnmounted(stopAgent)

defineExpose({ saveAll })
</script>

<style scoped>
.custom-node-workbench {
  container-type: inline-size;
}

.workbench-grid[data-agent-open='true'] {
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
}

.workbench-grid[data-agent-open='false'] {
  grid-template-columns: minmax(0, 1fr);
}

.agent-panel[data-open='false'] {
  display: none;
}

.agent-panel[data-open='true'] {
  display: flex;
}

@container (max-width: 62.5rem) {
  .workbench-grid[data-agent-open='true'] {
    grid-template-columns: minmax(0, 1fr);
  }

  .agent-panel[data-open='true'] {
    position: absolute;
    z-index: 30;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(22rem, 85cqw);
    box-shadow: -0.5rem 0 1.5rem rgb(0 0 0 / 35%);
  }
}
</style>
