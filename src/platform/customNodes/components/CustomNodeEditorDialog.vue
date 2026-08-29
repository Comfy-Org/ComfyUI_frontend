<template>
  <div class="flex size-full min-h-0 flex-col bg-base-background">
    <header
      class="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border-default px-4"
    >
      <div class="flex min-w-0 items-center gap-3">
        <i class="icon-[lucide--code-2] size-5 shrink-0" />
        <div class="min-w-0">
          <h2 class="m-0 truncate text-sm font-medium">
            {{ $t('customNodePacks.editor.title', { name: session.name }) }}
          </h2>
          <p class="m-0 text-xs text-muted-foreground">
            {{ statusLabel }}
          </p>
        </div>
      </div>
      <Button
        v-if="session.status !== 'submitted'"
        variant="secondary"
        size="sm"
        :loading="isAbandoning"
        :disabled="session.status === 'submitting'"
        @click="onAbandon"
      >
        <i class="icon-[lucide--x] size-4" />
        {{ $t('customNodePacks.editor.abandon') }}
      </Button>
    </header>

    <div
      v-if="pollError"
      class="shrink-0 border-b border-destructive-background/30 bg-destructive-background/10 px-4 py-2 text-sm text-destructive-background"
      role="alert"
    >
      {{ pollError }}
    </div>

    <main class="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <iframe
        v-if="isEditorVisible && session.editorUrl"
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
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogService } from '@/services/dialogService'

import { useCustomNodeEditor } from '../composables/useCustomNodeEditor'
import type {
  CustomNodeEditorSession,
  CustomNodeEditorStatus
} from '../composables/useCustomNodeEditor'

const props = defineProps<{
  initialSession: CustomNodeEditorSession
  onClose: () => void
  onSubmitted: () => void | Promise<void>
}>()

const { t } = useI18n()
const toast = useToastStore()
const dialogService = useDialogService()
const { getSession, abandonSession, refreshNodeDefinitions } =
  useCustomNodeEditor()

const session = ref<CustomNodeEditorSession>({ ...props.initialSession })
const isPolling = ref(false)
const isAbandoning = ref(false)
const pollError = ref<string | null>(null)
const terminalHandled = ref(false)

const statusKeys: Record<CustomNodeEditorStatus, string> = {
  creating: 'customNodePacks.editor.status.creating',
  ready: 'customNodePacks.editor.status.ready',
  submitting: 'customNodePacks.editor.status.submitting',
  submitted: 'customNodePacks.editor.status.submitted',
  abandoned: 'customNodePacks.editor.status.abandoned',
  failed: 'customNodePacks.editor.status.failed'
}

const statusLabel = computed(() => t(statusKeys[session.value.status]))
const isEditorVisible = computed(
  () =>
    session.value.status === 'ready' || session.value.status === 'submitting'
)

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
