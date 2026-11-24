import { watch } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { isMissingWarningVisible } from '@/platform/settings/missingWarningVisibility'
import { getModelFileKey } from '@/platform/workflow/core/utils/modelRequirements'
import MissingModelsDialogContent from '@/platform/workflowErrors/missingModel/components/MissingModelsDialogContent.vue'
import { getDownloadableModels } from '@/platform/workflowErrors/missingModel/missingModelViewUtils'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import { useErrorOverlayState } from '@/platform/workflowErrors/overlay/useErrorOverlayState'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

const MISSING_MODELS_DIALOG_KEY = 'missing-models'

const offeredModelKeys = new Set<string>()

function hasModelNotYetOffered(groups: MissingModelGroup[]): boolean {
  return getDownloadableModels(groups).some(
    (model) => !offeredModelKeys.has(getModelFileKey(model))
  )
}

function markOffered(groups: MissingModelGroup[]) {
  for (const model of getDownloadableModels(groups)) {
    offeredModelKeys.add(getModelFileKey(model))
  }
}

/** Opens the missing models dialog in place of the error overlay when a workflow needs a model it has not offered yet. */
export function useOfferMissingModelsDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const executionErrorStore = useExecutionErrorStore()
  const { isVisible, downloadableMissingModelGroups } = useErrorOverlayState()

  function close() {
    dialogStore.closeDialog({ key: MISSING_MODELS_DIALOG_KEY })
  }

  function offer(groups: MissingModelGroup[]): boolean {
    if (
      isCloud ||
      !isMissingWarningVisible('models') ||
      !hasModelNotYetOffered(groups)
    ) {
      return false
    }
    markOffered(groups)
    dialogService.showLayoutDialog({
      key: MISSING_MODELS_DIALOG_KEY,
      component: MissingModelsDialogContent,
      props: {
        missingModelGroups: groups,
        onClose: close,
        onNotNow: () => {
          close()
          executionErrorStore.showErrorOverlay()
        }
      }
    })
    return true
  }

  watch(isVisible, (visible) => {
    if (visible && offer(downloadableMissingModelGroups.value)) {
      executionErrorStore.dismissErrorOverlay()
    }
  })
}
