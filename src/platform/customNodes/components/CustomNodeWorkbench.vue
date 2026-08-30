<template>
  <div
    class="custom-node-workbench text-foreground flex size-full min-h-0 min-w-0 flex-col overflow-hidden bg-base-background"
    data-testid="custom-node-workbench"
  >
    <div
      class="flex h-10 shrink-0 items-center justify-end gap-2 border-b border-border-default px-2"
    >
      <Button
        variant="secondary"
        size="sm"
        :aria-expanded="agentOpen"
        :aria-label="$t('customNodePacks.editor.workbench.toggleAgent')"
        @click="agentOpen = !agentOpen"
      >
        <i class="icon-[lucide--sparkles] size-4" aria-hidden="true" />
        {{ $t('customNodePacks.editor.agent.title') }}
      </Button>
    </div>

    <div
      class="workbench-grid relative grid min-h-0 min-w-0 flex-1"
      :data-agent-open="agentOpen"
    >
      <main class="relative min-h-0 min-w-0 overflow-hidden bg-base-background">
        <CustomNodeTreeEditor
          v-show="!selectedChange"
          ref="treeEditorRef"
          :session-id="sessionId"
          :state-key="editorStateKey"
          :pack-name="packName"
        />
        <CustomNodeCodeEditor
          v-if="selectedChange"
          :path="selectedChange.path"
          :original-content="selectedChange.originalContent"
          :proposed-content="selectedChange.proposedContent"
          :theme="editorTheme"
        />
      </main>

      <aside
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
              <div class="flex flex-col gap-1">
                <button
                  v-for="change in proposal.changes"
                  :key="change.path"
                  type="button"
                  :class="
                    cn(
                      'flex items-center gap-2 rounded-sm border border-transparent px-2 py-1.5 text-left text-xs hover:bg-base-background',
                      change.path === selectedChange?.path &&
                        'border-border-default bg-base-background'
                    )
                  "
                  @click="selectChange(change.path)"
                >
                  <i
                    class="icon-[lucide--file-diff] size-3.5 text-green-500"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 flex-1 truncate">{{ change.path }}</span>
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
              {{ $t('customNodePacks.editor.agent.ask') }}
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
import type { CustomNodeEditorProposal } from '../composables/useCustomNodeEditor'
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

const { t } = useI18n()
const colorPaletteStore = useColorPaletteStore()
const teamWorkspaceStore = useTeamWorkspaceStore()
const { createAgentProposal, applyAgentProposal } = useCustomNodeEditor()
const treeEditorRef =
  useTemplateRef<InstanceType<typeof CustomNodeTreeEditor>>('treeEditorRef')

const editorStateKey = computed(() =>
  customNodeEditorStateKey(teamWorkspaceStore.activeWorkspaceId, props.packName)
)
const agentOpen = ref(
  readCustomNodeEditorState(editorStateKey.value)?.agentOpen ?? true
)
const instruction = ref('')
const proposal = ref<CustomNodeEditorProposal | null>(null)
const selectedChangePath = ref('')
const isAsking = ref(false)
const isApplying = ref(false)
const agentError = ref<string | null>(null)

const editorTheme = computed(() =>
  colorPaletteStore.completedActivePalette.light_theme ? 'light' : 'dark'
)
const selectedChange = computed(() =>
  proposal.value?.changes.find(
    (change) => change.path === selectedChangePath.value
  )
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
    selectedChangePath.value = proposal.value.changes[0]?.path ?? ''
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

function selectChange(path: string) {
  selectedChangePath.value = path
}

function dismissProposal() {
  proposal.value = null
  selectedChangePath.value = ''
}

async function applyProposal() {
  if (!proposal.value || isApplying.value) return
  isApplying.value = true
  agentError.value = null
  try {
    const result = await applyAgentProposal(props.sessionId, proposal.value.id)
    await treeEditorRef.value?.replaceFiles(result)
    proposal.value = null
    selectedChangePath.value = ''
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
