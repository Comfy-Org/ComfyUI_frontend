<template>
  <AppDialogPanel
    body-class="flex flex-col gap-3"
    data-testid="missing-models-dialog"
    @close="emit('close')"
  >
    <template #title>{{ title }}</template>

    <DialogDescription class="m-0">
      {{ t('missingModelsModal.description') }}
    </DialogDescription>

    <div
      v-if="gatedModelCount > 0"
      role="note"
      data-testid="missing-models-dialog-gated-hint"
      class="flex gap-2 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-warning"
    >
      <i aria-hidden="true" class="mt-0.5 icon-[lucide--lock]" />
      <p class="m-0 text-xs/relaxed">
        {{ t('rightSidePanel.missingModels.gatedModelsHint', gatedModelCount) }}
      </p>
    </div>

    <div class="-mx-1.5 flex max-h-80 flex-col gap-1 overflow-y-auto px-1.5">
      <MissingModelRow
        v-for="row in rows"
        :key="row.key"
        :model="row.model"
        :directory="row.directory"
        :is-asset-supported="row.isAssetSupported"
        @locate-model="locate"
      />
    </div>

    <p
      v-if="phase === 'failed'"
      role="alert"
      class="m-0 text-sm text-destructive"
      data-testid="missing-models-dialog-failed"
    >
      {{ t('missingModelsModal.failed') }}
    </p>

    <span role="status" aria-live="polite" class="sr-only">{{ title }}</span>

    <template #footer>
      <span
        v-if="phase === 'downloading' && progressLabel"
        class="mr-auto text-xs text-muted-foreground tabular-nums"
        data-testid="missing-models-dialog-progress"
      >
        {{ progressLabel }}
      </span>

      <template v-if="phase === 'offer' || phase === 'failed'">
        <Button
          variant="muted-textonly"
          size="lg"
          data-testid="missing-models-dialog-not-now"
          @click="emit('notNow')"
        >
          {{ t('missingModelsModal.notNow') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          data-testid="missing-models-dialog-download-all"
          @click="downloadAllModels"
        >
          <i aria-hidden="true" class="icon-[lucide--download]" />
          {{
            phase === 'failed'
              ? t('rightSidePanel.missingModels.retryDownload')
              : downloadAllLabel
          }}
        </Button>
      </template>

      <Button
        v-else-if="phase === 'downloading'"
        variant="secondary"
        size="lg"
        data-testid="missing-models-dialog-keep-working"
        @click="emit('close')"
      >
        {{ t('missingModelsModal.keepWorking') }}
      </Button>

      <template v-else>
        <Button
          variant="muted-textonly"
          size="lg"
          data-testid="missing-models-dialog-close"
          @click="emit('close')"
        >
          {{ t('g.close') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          data-testid="missing-models-dialog-run"
          @click="runWorkflow"
        >
          <i aria-hidden="true" class="icon-[lucide--play]" />
          {{ t('missingModelsModal.runWorkflow') }}
        </Button>
      </template>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import DialogDescription from '@comfyorg/design-system/dialog/DialogDescription'
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import MissingModelRow from '@/platform/workflowErrors/missingModel/components/MissingModelRow.vue'
import { useDownloadAllMissingModels } from '@/platform/workflowErrors/missingModel/composables/useDownloadAllMissingModels'
import { useMissingModelDownload } from '@/platform/workflowErrors/missingModel/composables/useMissingModelDownload'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import {
  missingModelsDialogPhase,
  missingModelsReceivedBytes
} from '@/platform/workflowErrors/missingModel/missingModelsDialogProgress'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import { formatSize } from '@/utils/formatUtil'

const { missingModelGroups } = defineProps<{
  missingModelGroups: MissingModelGroup[]
}>()

const emit = defineEmits<{ close: []; notNow: [] }>()

const { t } = useI18n()
const downloadStore = useMissingModelDownloadStore()
const { fileSizeFor } = useMissingModelDownload()
const { focusNode } = useFocusNode()
const {
  downloadableModels,
  gatedModelCount,
  downloadAllLabel,
  downloadAllModels
} = useDownloadAllMissingModels(() => missingModelGroups)

const rows = computed(() =>
  missingModelGroups.flatMap((group) =>
    group.models.map((model) => ({
      key: `${group.directory ?? ''}/${model.name}`,
      model,
      directory: group.directory,
      isAssetSupported: group.isAssetSupported
    }))
  )
)

const downloads = computed(() =>
  downloadableModels.value.map((model) => ({
    state: downloadStore.stateFor(model),
    size: fileSizeFor(model.url)
  }))
)

const phase = computed(() => missingModelsDialogPhase(downloads.value))
const modelCount = computed(() => downloadableModels.value.length)

const title = computed(() => {
  switch (phase.value) {
    case 'downloading':
      return t('missingModelsModal.titleDownloading', modelCount.value)
    case 'ready':
      return t('missingModelsModal.titleReady')
    case 'failed':
      return t('missingModelsModal.titleFailed')
    default:
      return t('missingModelsModal.title', modelCount.value)
  }
})

const progressLabel = computed(() => {
  const bytes = missingModelsReceivedBytes(downloads.value)
  return bytes
    ? t('missingModelsModal.progress', {
        received: formatSize(bytes.received),
        total: formatSize(bytes.total)
      })
    : undefined
})

function locate(nodeId: string) {
  emit('close')
  void focusNode(nodeId)
}

function runWorkflow() {
  emit('close')
  void useCommandStore().execute('Comfy.QueuePrompt')
}
</script>
