import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import type { ComfyExtension } from '@/types/comfy'
import { reportError } from '@comfyorg/telemetry/reportError'

let warned = false

export const legacyVhsUnbatchWarningExtension: ComfyExtension = {
  name: 'Comfy.LegacyVhsUnbatchWarning',
  beforeRegisterNodeDef(_nodeType, nodeData) {
    // Cloud pins the pack version server-side, so users cannot act on the
    // "update from the Manager" advice and every session would report it.
    if (isCloud) return
    if (warned || nodeData.name !== 'VHS_Unbatch') return
    if (nodeData.output?.[0] !== '*') return
    warned = true
    reportError(
      new Error(
        'ComfyUI-VideoHelperSuite predates its MatchType Unbatch node. Its delayed cloneType callback reads app.graph and can disconnect links in the workflow on screen.'
      ),
      {
        errorType: 'deprecated_extension_graph_patch',
        surface: 'graph',
        level: 'warning',
        tags: { extension: 'VideoHelperSuite' },
        context: { node: 'VHS_Unbatch', pattern: 'cloneType' }
      }
    )
    useToast().warning(t('toastMessages.outdatedVideoHelperSuite'), {
      description: t('toastMessages.outdatedVideoHelperSuiteDetail')
    })
  }
}
