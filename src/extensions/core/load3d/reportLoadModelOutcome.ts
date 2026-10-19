import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'

import type { LoadModelOutcome } from '@comfyorg/viewport3d/load3d/interfaces'

/**
 * Warns the user about a failed model load. `silentOnNotFound` hides the
 * warning for a missing file that a preview surface may legitimately lack.
 */
export function reportLoadModelOutcome(
  outcome: LoadModelOutcome,
  { silentOnNotFound = false }: { silentOnNotFound?: boolean } = {}
): void {
  if (outcome === 'unknown-type') {
    useToast().warning(t('toastMessages.couldNotDetermineFileType'))
    return
  }
  if (outcome === 'failed' || (outcome === 'not-found' && !silentOnNotFound)) {
    useToast().warning(t('toastMessages.errorLoadingModel'))
  }
}
