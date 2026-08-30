<template>
  <div
    class="custom-node-workbench text-foreground flex size-full min-h-0 min-w-0 flex-col overflow-hidden bg-base-background"
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
          <div
            class="flex max-w-lg flex-col items-center gap-3 rounded-sm border border-border-default bg-secondary-background p-6 text-center"
          >
            <i
              :class="proposalChangeIcon(selectedChange.kind)"
              class="size-6 text-blue-500"
              aria-hidden="true"
            />
            <p class="text-foreground m-0 text-sm font-medium">
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
        class="agent-panel min-h-0 min-w-0 flex-col border-l border-border-default bg-secondary-background"
        :data-open="agentOpen"
        :aria-label="$t('customNodePacks.editor.agent.title')"
      >
        <div
          class="flex shrink-0 items-center gap-2 border-b border-border-default px-3 py-2"
        >
          <i
            class="icon-[lucide--sparkles] size-4 text-blue-500"
            aria-hidden="true"
          />
          <h3 class="text-foreground m-0 flex-1 text-sm font-medium">
            {{ $t('customNodePacks.editor.agent.title') }}
          </h3>
          <Button
            variant="secondary"
            size="icon"
            :aria-label="$t('customNodePacks.editor.agent.close')"
            @click="agentOpen = false"
          >
            <i class="icon-[lucide--x] size-4" aria-hidden="true" />
          </Button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <div
            v-if="!agentEnabled"
            class="rounded-sm border border-border-default bg-base-background p-3"
          >
            <p class="text-foreground m-0 text-sm">
              {{ $t('customNodePacks.editor.agent.unavailable') }}
            </p>
            <p class="mt-2 mb-0 text-xs text-muted-foreground">
              {{ $t('customNodePacks.editor.agent.unavailableDetail') }}
            </p>
          </div>

          <template v-else-if="proposal">
            <div class="flex flex-col gap-3">
              <div>
                <p
                  class="m-0 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {{ $t('customNodePacks.editor.agent.proposal') }}
                </p>
                <p class="text-foreground mt-1 mb-0 text-sm/5">
                  {{ proposal.summary }}
                </p>
              </div>
              <div
                v-if="proposal.test"
                :class="
                  cn(
                    'flex gap-2 rounded-sm border p-2.5',
                    testResultClass(proposal.test.status)
                  )
                "
                data-testid="node-agent-test-result"
                role="status"
              >
                <i
                  :class="
                    cn(
                      'mt-0.5 size-4 shrink-0',
                      testResultIcon(proposal.test.status)
                    )
                  "
                  aria-hidden="true"
                />
                <div class="min-w-0">
                  <p class="text-foreground m-0 text-xs font-medium">
                    {{ testResultLabel(proposal.test.status) }}
                  </p>
                  <p
                    class="mt-1 mb-0 max-h-40 overflow-y-auto text-xs/4 wrap-break-word whitespace-pre-wrap text-muted-foreground"
                  >
                    {{ proposal.test.summary }}
                  </p>
                  <p
                    v-if="proposal.test.durationMs > 0"
                    class="mt-1 mb-0 text-[11px]/4 text-muted-foreground"
                  >
                    {{
                      $t('customNodePacks.editor.agent.testDuration', {
                        duration: proposal.test.durationMs
                      })
                    }}
                  </p>
                  <p
                    v-if="proposal.test.phase || proposal.test.sandbox"
                    class="mt-1 mb-0 text-[11px]/4 text-muted-foreground"
                  >
                    <span v-if="proposal.test.phase">
                      {{
                        $t('customNodePacks.editor.agent.testPhase', {
                          phase: proposal.test.phase
                        })
                      }}
                    </span>
                    <span v-if="proposal.test.phase && proposal.test.sandbox">
                      ·
                    </span>
                    <span v-if="proposal.test.sandbox">
                      {{
                        $t('customNodePacks.editor.agent.testSandbox', {
                          sandbox: proposal.test.sandbox
                        })
                      }}
                    </span>
                  </p>
                  <div
                    v-if="proposal.test.error"
                    class="mt-2 rounded-sm bg-base-background p-2"
                    data-testid="node-agent-python-error"
                  >
                    <p
                      class="text-foreground m-0 font-mono text-xs/4 wrap-break-word"
                    >
                      {{ proposal.test.error.type }}:
                      {{ proposal.test.error.message }}
                    </p>
                    <ul
                      v-if="proposal.test.error.frames.length > 0"
                      class="mt-2 mb-0 flex list-none flex-col gap-1 p-0 font-mono text-[11px]/4 text-muted-foreground"
                      :aria-label="$t('customNodePacks.editor.agent.traceback')"
                    >
                      <li
                        v-for="(frame, frameIndex) in proposal.test.error
                          .frames"
                        :key="`${frame.file}:${frame.line ?? 0}:${frameIndex}`"
                      >
                        {{ frame.file
                        }}<template v-if="frame.line"
                          >:{{ frame.line }}</template
                        ><template v-if="frame.function">
                          — {{ frame.function }}</template
                        >
                        <span v-if="frame.source" class="block pl-2">
                          {{ frame.source }}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <details
                    v-if="proposal.test.stdout || proposal.test.stderr"
                    class="mt-2 text-[11px]/4 text-muted-foreground"
                  >
                    <summary class="cursor-pointer select-none">
                      {{ $t('customNodePacks.editor.agent.testLogs') }}
                    </summary>
                    <div class="mt-1 flex flex-col gap-2">
                      <div v-if="proposal.test.stdout">
                        <p class="m-0 font-medium">
                          {{ $t('customNodePacks.editor.agent.stdout') }}
                        </p>
                        <pre
                          class="m-0 max-h-32 overflow-auto rounded-sm bg-base-background p-2 font-mono whitespace-pre-wrap"
                          >{{ proposal.test.stdout }}</pre>
                      </div>
                      <div v-if="proposal.test.stderr">
                        <p class="m-0 font-medium">
                          {{ $t('customNodePacks.editor.agent.stderr') }}
                        </p>
                        <pre
                          class="m-0 max-h-32 overflow-auto rounded-sm bg-base-background p-2 font-mono whitespace-pre-wrap"
                          >{{ proposal.test.stderr }}</pre>
                      </div>
                    </div>
                  </details>
                  <div
                    v-if="proposal.test.outputs.length > 0"
                    class="mt-2 flex flex-col gap-2"
                    data-testid="node-agent-test-outputs"
                  >
                    <div
                      v-for="output in proposal.test.outputs"
                      :key="output.index"
                      class="rounded-sm bg-base-background p-2"
                    >
                      <p class="m-0 text-[11px]/4 text-muted-foreground">
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
                        class="text-foreground mt-1 mb-0 font-mono text-[11px]/4 wrap-break-word whitespace-pre-wrap"
                      >
                        {{ plainOutputValue(output.value) }}
                      </p>
                      <div
                        v-if="output.artifacts.some((artifact) => artifact.url)"
                        class="mt-2 grid grid-cols-2 gap-2"
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
                          class="aspect-square w-full rounded-sm border border-border-default object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex flex-col gap-1">
                <button
                  v-for="(change, index) in proposal.changes"
                  :key="`${index}:${change.kind}:${change.path}:${change.destinationPath ?? ''}`"
                  type="button"
                  :class="
                    cn(
                      'flex items-center gap-2 rounded-sm border border-transparent px-2 py-1.5 text-left text-xs hover:bg-base-background',
                      index === selectedChangeIndex &&
                        'border-border-default bg-base-background'
                    )
                  "
                  @click="selectChange(index)"
                >
                  <i
                    :class="proposalChangeIcon(change.kind)"
                    class="size-3.5 text-green-500"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 flex-1 truncate">
                    {{ proposalChangeLabel(change) }}
                  </span>
                </button>
              </div>
              <p class="m-0 text-xs/4 text-muted-foreground">
                {{ $t('customNodePacks.editor.agent.reviewNotice') }}
              </p>
              <div class="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  :loading="isApplying"
                  :disabled="isApplying"
                  @click="applyProposal"
                >
                  <i class="icon-[lucide--check] size-4" aria-hidden="true" />
                  {{ $t('customNodePacks.editor.agent.apply') }}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  :disabled="isApplying"
                  @click="dismissProposal"
                >
                  {{ $t('customNodePacks.editor.agent.dismiss') }}
                </Button>
              </div>
            </div>
          </template>

          <form v-else class="flex flex-col gap-3" @submit.prevent="askAgent">
            <p class="m-0 text-xs/5 text-muted-foreground">
              {{ $t('customNodePacks.editor.agent.description') }}
            </p>
            <Textarea
              v-model="instruction"
              class="min-h-32 resize-y"
              :placeholder="$t('customNodePacks.editor.agent.placeholder')"
              :aria-label="$t('customNodePacks.editor.agent.placeholder')"
              maxlength="4096"
              :disabled="isAsking"
            />
            <p
              v-if="agentError"
              class="m-0 text-xs text-destructive-background"
              role="alert"
            >
              {{ agentError }}
            </p>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              :loading="isAsking"
              :disabled="!instruction.trim() || isAsking"
            >
              <i class="icon-[lucide--sparkles] size-4" aria-hidden="true" />
              {{
                $t(
                  isAsking
                    ? 'customNodePacks.editor.agent.working'
                    : 'customNodePacks.editor.agent.ask'
                )
              }}
            </Button>
            <p class="m-0 text-[11px]/4 text-muted-foreground">
              {{ $t('customNodePacks.editor.agent.safety') }}
            </p>
          </form>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, useTemplateRef, watch } from 'vue'
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

const props = defineProps<{
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

const editorStateKey = computed(() =>
  customNodeEditorStateKey(teamWorkspaceStore.activeWorkspaceId, props.packName)
)
agentOpen.value =
  readCustomNodeEditorState(editorStateKey.value)?.agentOpen ?? agentOpen.value
const instruction = ref('')
const proposal = ref<CustomNodeEditorProposalView | null>(null)
const selectedChangeIndex = ref(-1)
const isAsking = ref(false)
const isApplying = ref(false)
const agentError = ref<string | null>(null)

const editorTheme = computed(() =>
  colorPaletteStore.completedActivePalette.light_theme ? 'light' : 'dark'
)
const selectedChange = computed(() =>
  selectedChangeIndex.value < 0
    ? undefined
    : proposal.value?.changes[selectedChangeIndex.value]
)
const selectedChangeUsesDiff = computed(
  () =>
    selectedChange.value?.kind !== 'moved' &&
    selectedChange.value?.kind !== 'directory_created'
)

async function saveAll() {
  await treeEditorRef.value?.saveAll()
}

async function askAgent() {
  const requestedChange = instruction.value.trim()
  if (!requestedChange || isAsking.value) return
  isAsking.value = true
  agentError.value = null
  try {
    await saveAll()
    proposal.value = await createAgentProposal(props.sessionId, requestedChange)
    instruction.value = ''
    selectedChangeIndex.value = proposal.value.changes.length > 0 ? 0 : -1
  } catch (error) {
    reportError(error, { errorType: 'custom_node_agent_request_failed' })
    agentError.value =
      error instanceof Error
        ? error.message
        : t('customNodePacks.editor.agent.failed')
  } finally {
    isAsking.value = false
  }
}

function selectChange(index: number) {
  selectedChangeIndex.value = index
}

function dismissProposal() {
  proposal.value = null
  selectedChangeIndex.value = -1
}

async function applyProposal() {
  if (!proposal.value || isApplying.value) return
  isApplying.value = true
  agentError.value = null
  try {
    const result = await applyAgentProposal(props.sessionId, proposal.value.id)
    await treeEditorRef.value?.replaceFiles(result)
    proposal.value = null
    selectedChangeIndex.value = -1
  } catch (error) {
    reportError(error, { errorType: 'custom_node_agent_apply_failed' })
    agentError.value =
      error instanceof Error
        ? error.message
        : t('customNodePacks.editor.agent.applyFailed')
  } finally {
    isApplying.value = false
  }
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

function testResultLabel(status: CustomNodeEditorTestStatus): string {
  return t(`customNodePacks.editor.agent.testStatus.${status}`)
}

function testResultClass(status: CustomNodeEditorTestStatus): string {
  if (status === 'passed') {
    return 'border-success-background/30 bg-success-background/10'
  }
  if (status === 'failed') {
    return 'border-destructive-background/30 bg-destructive-background/10'
  }
  return 'border-border-default bg-base-background'
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
  () => props.packName,
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
