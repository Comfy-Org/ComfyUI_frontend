import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type { ComfyExtension } from '@/types/comfy'
import { reportError } from '@comfyorg/telemetry/reportError'

let warned = false

export const legacyVhsUnbatchWarningExtension: ComfyExtension = {
  name: 'Comfy.LegacyVhsUnbatchWarning',
  beforeRegisterNodeDef(_nodeType, nodeData) {
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
