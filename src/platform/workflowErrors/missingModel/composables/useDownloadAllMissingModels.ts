import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import { isCloud } from '@/platform/distribution/types'
import { useMissingModelDownload } from '@/platform/workflowErrors/missingModel/composables/useMissingModelDownload'
import { getDownloadableModels } from '@/platform/workflowErrors/missingModel/missingModelViewUtils'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import { formatSize } from '@/utils/formatUtil'

export function useDownloadAllMissingModels(
  groups: MaybeRefOrGetter<MissingModelGroup[]>
) {
  const { t } = useI18n()
  const { downloadMissingModel, fileSizeFor } = useMissingModelDownload()

  const downloadableModels = computed(() =>
    isCloud ? [] : getDownloadableModels(toValue(groups))
  )

  const downloadAllLabel = computed(() => {
    const base = t('rightSidePanel.missingModels.downloadAll')
    const total = downloadableModels.value.reduce(
      (sum, model) => sum + (fileSizeFor(model.url) ?? 0),
      0
    )
    return total > 0 ? `${base} (${formatSize(total)})` : base
  })

  function downloadAllModels() {
    for (const model of downloadableModels.value) {
      downloadMissingModel(model)
    }
  }

  return { downloadableModels, downloadAllLabel, downloadAllModels }
}
