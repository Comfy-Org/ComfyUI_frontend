<template>
  <section
    class="shrink-0 border-b border-border-default px-4 py-2"
    data-testid="custom-node-draft-test"
  >
    <div class="flex flex-wrap items-center gap-2">
      <SingleSelect
        v-model="workflow"
        :options="workflows"
        :label="$t('customNodePacks.editor.draftTest.workflow')"
        class="min-w-64"
        :disabled="busy || disabled"
      />
      <Button
        variant="secondary"
        size="sm"
        :loading="busy"
        :disabled="busy || disabled || !workflow"
        @click="run"
      >
        <i class="icon-[lucide--flask-conical] size-4" aria-hidden="true" />
        {{ $t('customNodePacks.editor.draftTest.run') }}
      </Button>
      <span v-if="draft" role="status" class="text-sm">{{
        $t(`customNodePacks.editor.draftTest.status.${draft.status}`)
      }}</span>
    </div>
    <p v-if="draft?.result" class="my-1 text-xs text-muted-foreground">
      {{
        $t('customNodePacks.editor.draftTest.details', {
          sandbox: draft.result.sandbox ?? '—',
          duration: draft.result.duration_ms,
          count: draft.result.outputs?.length ?? 0
        })
      }}
    </p>
    <p v-if="failure" role="alert" class="my-1 text-sm">{{ failure }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import Button from '@/components/ui/button/Button.vue'
import { reportError } from '@/platform/telemetry/reportError'

import {
  CustomNodeEditorRequestError,
  useCustomNodeEditor
} from '../composables/useCustomNodeEditor'
import type { CustomNodeEditorDraftTestView } from '../composables/useCustomNodeEditor'

const props = defineProps<{
  sessionId: string
  disabled: boolean
  beforeTest: () => Promise<void>
}>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const { t } = useI18n()
const { getFiles, createDraftTest, getDraftTest, deleteDraftTest } =
  useCustomNodeEditor()
const workflows = ref<{ value: string; name: string }[]>([])
const workflow = ref('')
const busy = ref(false)
const draft = ref<CustomNodeEditorDraftTestView | null>(null)
const requestFailure = ref('')
const failure = computed(
  () =>
    requestFailure.value ||
    draft.value?.error ||
    draft.value?.result?.error?.message ||
    ''
)
let disposed = false

async function loadWorkflows() {
  try {
    const files = await getFiles(props.sessionId)
    if (disposed) return
    workflows.value = files.files
      .filter(
        ({ path }) =>
          path.startsWith('v2/tests/workflows/') && path.endsWith('.json')
      )
      .map(({ path }) => ({ value: path, name: path }))
    workflow.value = workflows.value[0]?.value ?? ''
  } catch (error) {
    if (disposed) return
    reportError(error, { errorType: 'custom_node_draft_workflows_failed' })
    requestFailure.value = t('customNodePacks.editor.draftTest.failed')
  }
}

async function run() {
  if (busy.value || props.disabled || !workflow.value) return
  busy.value = true
  emit('busy', true)
  requestFailure.value = ''
  draft.value = null
  try {
    await props.beforeTest()
    if (disposed) return
    const files = await getFiles(props.sessionId)
    if (disposed) return
    if (!files.files.some(({ path }) => path === workflow.value)) {
      throw new CustomNodeEditorRequestError(
        t('customNodePacks.editor.draftTest.workflowMissing'),
        409
      )
    }
    const created = await createDraftTest(props.sessionId, {
      files: files.files.map(({ path, content }) => ({ path, content })),
      workflow_path: workflow.value,
      snapshot_digest: files.digest
    })
    if (disposed) {
      await deleteDraftTest(props.sessionId, created.id)
      return
    }
    draft.value = created
    const deadline = Date.now() + 330_000
    while (!disposed && ['queued', 'running'].includes(draft.value.status)) {
      if (Date.now() >= deadline) {
        await deleteDraftTest(props.sessionId, created.id)
        throw new CustomNodeEditorRequestError(
          t('customNodePacks.editor.draftTest.timeout'),
          408
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (disposed) return
      const updated = await getDraftTest(props.sessionId, created.id)
      if (!disposed) draft.value = updated
    }
  } catch (error) {
    if (disposed) return
    reportError(error, { errorType: 'custom_node_draft_test_failed' })
    requestFailure.value =
      error instanceof Error
        ? error.message
        : t('customNodePacks.editor.draftTest.failed')
  } finally {
    busy.value = false
    if (!disposed) emit('busy', false)
  }
}

onMounted(loadWorkflows)
onUnmounted(() => {
  disposed = true
  if (draft.value && ['queued', 'running'].includes(draft.value.status)) {
    void deleteDraftTest(props.sessionId, draft.value.id).catch(
      (error: unknown) =>
        reportError(error, { errorType: 'custom_node_draft_cancel_failed' })
    )
  }
})
</script>
