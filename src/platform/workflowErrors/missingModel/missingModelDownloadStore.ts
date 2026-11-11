import { defineStore } from 'pinia'
import { computed, shallowReactive, shallowRef, watch } from 'vue'

import { useTemplateModelRowDownloads } from '@/platform/workflow/templates/composables/useTemplateModelRowDownloads'
import {
  createTemplateModelDownloadState,
  getTemplateModelDownloadIdentity
} from '@/platform/workflow/templates/utils/templateModelDownloadState'
import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'
import {
  downloadModel,
  hostReportsModelDownloadProgress
} from '@/platform/workflowErrors/missingModel/missingModelDownload'
import type { ModelWithUrl } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'

type ModelDownloadTracker = ReturnType<typeof useTemplateModelRowDownloads>

/** Missing-model downloads, tracked for the app's lifetime on hosts that report progress. */
export const useMissingModelDownloadStore = defineStore(
  'missingModelDownload',
  () => {
    const missingModelStore = useMissingModelStore()
    const tracker = shallowRef<ModelDownloadTracker>()
    const requested = shallowReactive(new Map<string, ModelWithUrl>())
    let refreshPending = false

    function stateFor(
      model: ModelWithUrl
    ): Readonly<TemplateModelDownloadState> {
      return (
        tracker.value?.stateFor(model) ?? createTemplateModelDownloadState()
      )
    }

    const completedCount = computed(
      () =>
        [...requested.values()].filter(
          (model) => stateFor(model).status === 'done'
        ).length
    )

    function flushRefresh() {
      if (!refreshPending || missingModelStore.isRefreshingMissingModels) return
      refreshPending = false
      void missingModelStore.refreshMissingModels()
    }

    watch(completedCount, (count, previous) => {
      if (count <= previous) return
      refreshPending = true
      flushRefresh()
    })
    watch(() => missingModelStore.isRefreshingMissingModels, flushRefresh)

    function download(model: ModelWithUrl): void {
      if (!hostReportsModelDownloadProgress()) {
        downloadModel(model, missingModelStore.folderPaths)
        return
      }
      tracker.value ??= useTemplateModelRowDownloads({ folderPaths: {} })
      requested.set(getTemplateModelDownloadIdentity(model), model)
      tracker.value.request(model)
    }

    return { stateFor, download }
  }
)
