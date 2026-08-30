<template>
  <div class="flex size-full min-h-0 flex-col bg-base-background">
    <header
      class="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border-default px-4 py-2"
    >
      <div class="flex min-w-0 flex-1 basis-72 items-center gap-3">
        <i class="icon-[lucide--code-2] size-5 shrink-0" />
        <div class="min-w-0 flex-1">
          <h2 class="sr-only">
            {{ $t('customNodePacks.editor.title', { name: session.name }) }}
          </h2>
          <div class="flex min-w-0 items-center gap-2">
            <label
              for="custom-node-editor-pack-name"
              class="shrink-0 text-sm font-medium"
            >
              {{ $t('customNodePacks.editor.editing') }}
            </label>
            <Input
              id="custom-node-editor-pack-name"
              ref="nameInputRef"
              v-model="nameDraft"
              class="h-8 max-w-80 min-w-0 flex-1 px-2 py-1 font-medium"
              type="text"
              maxlength="80"
              autocomplete="off"
              spellcheck="false"
              :aria-label="$t('customNodePacks.editor.nameLabel')"
              aria-describedby="custom-node-editor-name-status"
              :aria-busy="isNameSaving"
              :aria-invalid="renameError ? 'true' : undefined"
              :title="$t('customNodePacks.editor.nameHint')"
              :disabled="!canRename"
              @focus="onNameFocus"
              @blur="onNameBlur"
              @keydown.enter.prevent="nameInputRef?.blur()"
              @keydown.escape.prevent="onNameEscape"
            />
            <Button
              variant="secondary"
              size="icon"
              :aria-label="$t('customNodePacks.editor.editName')"
              :title="$t('customNodePacks.editor.editName')"
              :disabled="!canRename"
              @mousedown.prevent
              @click="startNameEdit"
            >
              <i class="icon-[lucide--pencil] size-4" aria-hidden="true" />
            </Button>
          </div>
          <p
            v-if="renameError"
            id="custom-node-editor-name-status"
            class="m-0 truncate text-xs text-destructive-background"
            role="alert"
          >
            {{ renameError }}
          </p>
          <p
            v-else
            id="custom-node-editor-name-status"
            class="m-0 text-xs text-muted-foreground"
          >
            {{ statusLabel }}
          </p>
        </div>
      </div>
      <div
        v-if="session.status !== 'submitted'"
        class="ml-auto flex shrink-0 items-center gap-2"
      >
        <Button
          variant="secondary"
          size="sm"
          :loading="activeAction === 'validate'"
          :disabled="!canRunEditorAction"
          @mousedown.prevent
          @click="runEditorAction('validate')"
        >
          <i class="icon-[lucide--check-check] size-4" aria-hidden="true" />
          {{ $t('customNodePacks.editor.validate') }}
        </Button>
        <Button
          variant="primary"
          size="sm"
          :loading="
            activeAction === 'submit' || session.status === 'submitting'
          "
          :disabled="!canRunEditorAction"
          @mousedown.prevent
          @click="runEditorAction('submit')"
        >
          <i class="icon-[lucide--cloud-upload] size-4" aria-hidden="true" />
          {{ $t('customNodePacks.editor.submit') }}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :loading="isAbandoning"
          :disabled="
            session.status === 'submitting' || isNameSaving || !!activeAction
          "
          @mousedown.prevent
          @click="onAbandon"
        >
          <i class="icon-[lucide--x] size-4" aria-hidden="true" />
          {{ $t('customNodePacks.editor.abandon') }}
        </Button>
      </div>
    </header>

    <div
      v-if="pollError"
      class="shrink-0 border-b border-destructive-background/30 bg-destructive-background/10 px-4 py-2 text-sm text-destructive-background"
      role="alert"
    >
      {{ pollError }}
    </div>

    <main class="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <CustomNodeWorkbench
        v-if="isEditorVisible && session.editorKind === 'workbench'"
        ref="workbenchRef"
        :session-id="session.id"
        :agent-enabled="session.agentEnabled"
        :pack-name="session.name"
      />

      <iframe
        v-else-if="isEditorVisible && session.editorUrl"
        class="block size-full min-h-0 min-w-0 border-0 bg-base-background"
        :src="session.editorUrl"
        :title="$t('customNodePacks.editor.frameTitle')"
        allow="clipboard-read; clipboard-write"
      />

      <div
        v-else-if="session.status === 'failed'"
        class="flex size-full items-center justify-center p-8"
      >
        <div class="flex max-w-lg flex-col items-center gap-3 text-center">
          <i
            class="icon-[lucide--circle-alert] size-8 text-destructive-background"
          />
          <h3 class="m-0 text-base font-medium">
            {{ $t('customNodePacks.editor.failed') }}
          </h3>
          <p class="m-0 text-sm text-muted-foreground">
            {{ session.error || $t('customNodePacks.editor.unknownError') }}
          </p>
        </div>
      </div>

      <div v-else class="flex size-full items-center justify-center p-8">
        <div class="flex flex-col items-center gap-3 text-center">
          <i class="icon-[lucide--loader-circle] size-8 animate-spin" />
          <h3 class="m-0 text-base font-medium">
            {{ $t('customNodePacks.editor.starting') }}
          </h3>
          <p class="m-0 text-sm text-muted-foreground">
            {{ $t('customNodePacks.editor.startingDetail') }}
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogService } from '@/services/dialogService'

import {
  CustomNodeEditorRequestError,
  useCustomNodeEditor
} from '../composables/useCustomNodeEditor'
import type {
  CustomNodeEditorAction,
  CustomNodeEditorSession,
  CustomNodeEditorStatus
} from '../composables/useCustomNodeEditor'
import CustomNodeWorkbench from './CustomNodeWorkbench.vue'

const props = defineProps<{
  initialSession: CustomNodeEditorSession
  onClose: () => void
  onSubmitted: () => void | Promise<void>
}>()

const { t } = useI18n()
const toast = useToastStore()
const dialogService = useDialogService()
const {
  getSession,
  renameSession,
  runSessionAction,
  abandonSession,
  refreshNodeDefinitions
} = useCustomNodeEditor()

const session = ref<CustomNodeEditorSession>({ ...props.initialSession })
const isPolling = ref(false)
const isAbandoning = ref(false)
const activeAction = ref<CustomNodeEditorAction | null>(null)
const pollError = ref<string | null>(null)
const terminalHandled = ref(false)
const nameInputRef = useTemplateRef<InstanceType<typeof Input>>('nameInputRef')
const workbenchRef =
  useTemplateRef<InstanceType<typeof CustomNodeWorkbench>>('workbenchRef')
let pendingRename: Promise<void> | null = null

type RenameState =
  | { phase: 'idle'; draft: string }
  | { phase: 'editing'; draft: string; error?: string }
  | { phase: 'saving'; draft: string }

const renameState = ref<RenameState>({
  phase: 'idle',
  draft: session.value.name
})
const packNamePattern = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/

const statusKeys: Record<CustomNodeEditorStatus, string> = {
  creating: 'customNodePacks.editor.status.creating',
  ready: 'customNodePacks.editor.status.ready',
  submitting: 'customNodePacks.editor.status.submitting',
  submitted: 'customNodePacks.editor.status.submitted',
  abandoned: 'customNodePacks.editor.status.abandoned',
  failed: 'customNodePacks.editor.status.failed'
}

const isNameSaving = computed(() => renameState.value.phase === 'saving')
const renameError = computed(() =>
  renameState.value.phase === 'editing' ? renameState.value.error : undefined
)
const nameDraft = computed({
  get: () => renameState.value.draft,
  set: (draft: string) => {
    if (renameState.value.phase === 'saving') return
    renameState.value = { phase: 'editing', draft }
  }
})
const canRename = computed(
  () =>
    session.value.status === 'ready' &&
    !isAbandoning.value &&
    !isNameSaving.value &&
    !activeAction.value
)
const canRunEditorAction = computed(
  () =>
    session.value.status === 'ready' &&
    !isAbandoning.value &&
    !isNameSaving.value &&
    !activeAction.value
)
const statusLabel = computed(() =>
  isNameSaving.value
    ? t('customNodePacks.editor.renaming')
    : activeAction.value === 'validate'
      ? t('customNodePacks.editor.validating')
      : activeAction.value === 'submit'
        ? t('customNodePacks.editor.status.submitting')
        : t(statusKeys[session.value.status])
)
const isEditorVisible = computed(
  () =>
    session.value.status === 'ready' || session.value.status === 'submitting'
)

watch(
  () => session.value.name,
  (name) => {
    if (renameState.value.phase === 'idle') {
      renameState.value = { phase: 'idle', draft: name }
    }
  }
)

const onNameFocus = () => {
  if (!canRename.value || renameState.value.phase !== 'idle') return
  renameState.value = { phase: 'editing', draft: session.value.name }
}

const startNameEdit = async () => {
  if (!canRename.value) return
  if (renameState.value.phase === 'idle') {
    renameState.value = { phase: 'editing', draft: session.value.name }
  }
  await nextTick()
  nameInputRef.value?.focus()
  nameInputRef.value?.select()
}

const commitName = async () => {
  if (pendingRename) {
    await pendingRename
    return
  }
  if (renameState.value.phase !== 'editing') return
  const draft = renameState.value.draft
  const name = draft.trim()
  if (name === session.value.name) {
    renameState.value = { phase: 'idle', draft: session.value.name }
    return
  }
  if (!packNamePattern.test(name)) {
    renameState.value = {
      phase: 'editing',
      draft,
      error: t('customNodePacks.editor.invalidName')
    }
    return
  }
  renameState.value = { phase: 'saving', draft: name }
  pendingRename = (async () => {
    try {
      const renamed = await renameSession(session.value.id, name)
      session.value = renamed
      renameState.value = { phase: 'idle', draft: renamed.name }
    } catch (error) {
      if (
        error instanceof CustomNodeEditorRequestError &&
        error.status === 404
      ) {
        closeExpiredSession()
        return
      }
      reportError(error, { errorType: 'custom_node_editor_rename_failed' })
      renameState.value = {
        phase: 'editing',
        draft,
        error:
          error instanceof Error
            ? error.message
            : t('customNodePacks.editor.renameFailed')
      }
    }
  })()
  try {
    await pendingRename
  } finally {
    pendingRename = null
  }
}

const runEditorAction = async (action: CustomNodeEditorAction) => {
  await commitName()
  if (!canRunEditorAction.value || renameState.value.phase !== 'idle') return

  activeAction.value = action
  try {
    if (session.value.editorKind === 'workbench') {
      await workbenchRef.value?.saveAll()
    }
    session.value = await runSessionAction(session.value.id, action)
    pollError.value = null
    if (action === 'validate') {
      toast.add({
        severity: 'success',
        summary: t('customNodePacks.editor.validated'),
        detail: t('customNodePacks.editor.validatedDetail'),
        life: 5000
      })
    }
    await finishTerminalState()
  } catch (error) {
    if (error instanceof CustomNodeEditorRequestError && error.status === 404) {
      closeExpiredSession()
      return
    }
    reportError(error, { errorType: 'custom_node_editor_action_failed' })
    toast.add({
      severity: 'error',
      summary: t('customNodePacks.editor.actionFailed'),
      detail:
        error instanceof Error
          ? error.message
          : t('customNodePacks.editor.unknownError'),
      life: 5000
    })
  } finally {
    activeAction.value = null
  }
}

const onNameBlur = () => {
  void commitName()
}

const onNameEscape = () => {
  if (renameState.value.phase === 'saving') return
  renameState.value = { phase: 'idle', draft: session.value.name }
  nameInputRef.value?.blur()
}

const closeExpiredSession = () => {
  if (terminalHandled.value) return
  terminalHandled.value = true
  pause()
  toast.add({
    severity: 'warn',
    summary: t('customNodePacks.editor.sessionEnded'),
    detail: t('customNodePacks.editor.sessionEndedDetail'),
    life: 8000
  })
  props.onClose()
}

const finishTerminalState = async () => {
  if (terminalHandled.value) return
  if (
    session.value.status !== 'submitted' &&
    session.value.status !== 'abandoned'
  ) {
    return
  }
  terminalHandled.value = true
  pause()
  if (session.value.status === 'submitted') {
    try {
      await refreshNodeDefinitions(session.value.id)
      await props.onSubmitted()
      toast.add({
        severity: 'success',
        summary: t('customNodePacks.editor.submitted'),
        detail: t('customNodePacks.editor.submittedDetail'),
        life: 5000
      })
    } catch (error) {
      reportError(error, { errorType: 'custom_node_editor_refresh_failed' })
      toast.add({
        severity: 'warn',
        summary: t('customNodePacks.editor.submitted'),
        detail: t('customNodePacks.editor.refreshFailed'),
        life: 8000
      })
    }
  }
  props.onClose()
}

const poll = async () => {
  if (isPolling.value || terminalHandled.value) return
  isPolling.value = true
  try {
    session.value = await getSession(session.value.id)
    pollError.value = null
    await finishTerminalState()
    if (session.value.status === 'failed') pause()
  } catch (error) {
    if (error instanceof CustomNodeEditorRequestError && error.status === 404) {
      closeExpiredSession()
      return
    }
    if (!pollError.value) {
      reportError(error, { errorType: 'custom_node_editor_poll_failed' })
    }
    pollError.value =
      error instanceof Error
        ? error.message
        : t('customNodePacks.editor.unknownError')
  } finally {
    isPolling.value = false
  }
}

const { pause } = useIntervalFn(poll, 750, { immediateCallback: true })

const onAbandon = async () => {
  const confirmed = await dialogService.confirm({
    key: 'custom-node-editor-abandon',
    title: t('customNodePacks.editor.abandonTitle'),
    message: t('customNodePacks.editor.abandonMessage'),
    type: 'default'
  })
  if (!confirmed) return
  isAbandoning.value = true
  try {
    session.value = await abandonSession(session.value.id)
    await finishTerminalState()
  } catch (error) {
    if (error instanceof CustomNodeEditorRequestError && error.status === 404) {
      closeExpiredSession()
      return
    }
    reportError(error, { errorType: 'custom_node_editor_abandon_failed' })
    toast.add({
      severity: 'error',
      summary: t('customNodePacks.editor.abandonFailed'),
      detail:
        error instanceof Error
          ? error.message
          : t('customNodePacks.editor.unknownError'),
      life: 8000
    })
  } finally {
    isAbandoning.value = false
  }
}

onUnmounted(pause)
</script>
