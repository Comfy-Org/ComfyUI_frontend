import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import { isCloud } from '@/platform/distribution/types'
import { useMissingModelDownload } from '@/platform/workflowErrors/missingModel/composables/useMissingModelDownload'
import { isTrustedHuggingFaceUrl } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { getDownloadableModels } from '@/platform/workflowErrors/missingModel/missingModelViewUtils'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import { formatSize } from '@/utils/formatUtil'

export function useDownloadAllMissingModels(
  groups: MaybeRefOrGetter<MissingModelGroup[]>
) {
  const { t } = useI18n()
  const { downloadMissingModel, fileSizeFor, gatedRepoUrlFor } =
    useMissingModelDownload()

  const downloadableModels = computed(() =>
    isCloud ? [] : getDownloadableModels(toValue(groups))
  )

  const gatedModelCount = computed(
    () =>
      downloadableModels.value.filter((model) => {
        const repoUrl = gatedRepoUrlFor(model.url)
        return !!repoUrl && isTrustedHuggingFaceUrl(repoUrl)
      }).length
  )

  const isEveryModelVerifiedUngated = computed(() =>
    downloadableModels.value.every(
      (model) =>
        fileSizeFor(model.url) !== undefined && !gatedRepoUrlFor(model.url)
    )
  )

  const downloadAllLabel = computed(() => {
    const base = t('rightSidePanel.missingModels.downloadAll')
    const sizes = downloadableModels.value.map((model) =>
      fileSizeFor(model.url)
    )
    if (!sizes.every((size): size is number => size !== undefined)) return base
    const total = sizes.reduce((sum, size) => sum + size, 0)
    return total > 0 ? `${base} (${formatSize(total)})` : base
  })

  function downloadAllModels() {
    for (const model of downloadableModels.value) {
      downloadMissingModel(model)
    }
  }

  return {
    downloadableModels,
    gatedModelCount,
    isEveryModelVerifiedUngated,
    downloadAllLabel,
    downloadAllModels
  }
}
