import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { partition } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import type { DeploymentRowLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import {
  COMFY_CLOUD_ROW,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

interface DeploymentRow extends DeploymentRowLabels {
  compatibilityNote: string | null
}

/** The Run on menu's rows, the picked one first, and the picked row's value. */
export function useDeploymentRows() {
  const { t, locale } = useI18n()
  const { deployments, pickedDeploymentId } = storeToRefs(
    useDeploymentPickStore()
  )
  const { deploymentRowLabels, deploymentFullLabel } = useDeploymentLabels()
  const { markFor } = useDeploymentCompatibility()

  function compatibilityNote(
    mark: DeploymentCompatibilityMark | null,
    deployment: string
  ): string | null {
    if (mark?.kind === 'missing') {
      return t(
        'deploymentSwitcher.missingNodesNamed',
        {
          deployment,
          nodes: new Intl.ListFormat(locale.value).format(mark.nodeTypes)
        },
        { escapeParameter: false }
      )
    }
    if (mark?.kind !== 'unknown') return null
    return t(
      'deploymentSwitcher.notCheckedNamed',
      { deployment },
      { escapeParameter: false }
    )
  }

  function row(deployment: WorkspaceDeployment | null): DeploymentRow {
    return {
      ...deploymentRowLabels(deployment),
      compatibilityNote: compatibilityNote(
        markFor(deployment?.deployment_id ?? null),
        deploymentFullLabel(deployment)
      )
    }
  }

  const pickedValue = computed(
    () => pickedDeploymentId.value ?? COMFY_CLOUD_ROW
  )

  const rows = computed(() => {
    const [current, others] = partition(
      [row(null), ...deployments.value.map((d) => row(d))],
      (candidate) => candidate.value === pickedValue.value
    )
    return [...current, ...others]
  })

  return { rows, pickedValue }
}
