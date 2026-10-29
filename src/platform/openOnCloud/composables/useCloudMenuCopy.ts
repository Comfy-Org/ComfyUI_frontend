import { useI18n } from 'vue-i18n'

import type { CloudMenuState } from '@/platform/openOnCloud/cloudMenuState'
import type { CloudWorkflowGaps } from '@/platform/openOnCloud/cloudWorkflowCheck'

/** The words the Comfy Cloud button and its menu show for a menu state. */
export function useCloudMenuCopy() {
  const { t } = useI18n()

  function uploadingLabel(modelCount: number, percent: number): string {
    return t('openOnCloud.cloudMenu.uploading', {
      models: t('openOnCloud.cloudMenu.models', modelCount),
      percent
    })
  }

  function convertDetail({ nodePacks, models }: CloudWorkflowGaps): string {
    if (models.length === 0)
      return t('openOnCloud.cloudMenu.nodePacksMissing', nodePacks.length)
    return t('openOnCloud.cloudMenu.nodePacksAndModelsMissing', {
      nodePacks: t('openOnCloud.cloudMenu.nodePacks', nodePacks.length),
      models: t('openOnCloud.cloudMenu.models', models.length)
    })
  }

  /** The Run this workflow row's second line, or null when it has none. */
  function detailLabel(state: CloudMenuState): string | null {
    switch (state.kind) {
      case 'checking':
        return t('openOnCloud.checking')
      case 'convert':
        return convertDetail(state.gaps)
      case 'upload':
        return t('openOnCloud.modelsMissing', state.models.length)
      case 'uploading':
        return uploadingLabel(state.models.length, state.percent)
      case 'canOpen':
      case 'signedOut':
        return null
    }
  }

  return { uploadingLabel, detailLabel }
}
