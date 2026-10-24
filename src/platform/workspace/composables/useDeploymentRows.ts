import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { partition } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import type { DeploymentStatusTone } from '@/platform/workspace/composables/useDeploymentLabels'
import {
  COMFY_CLOUD_ROW,
  deploymentStatusTone,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/** One row of the Run on menu, ready to render. */
interface DeploymentRow {
  value: string
  deploymentId: string | null
  title: string
  name: string | null
  detail: string | null
  tooltip: string
  tone?: DeploymentStatusTone
  note: string | null
  pickable: boolean
}

interface DeploymentSection {
  key: 'all' | 'compatible' | 'incompatible'
  label: string
  rows: DeploymentRow[]
}

const STOPPED_STATUSES = new Set(['stopped', 'failed'])

function reasonKey(deployment: WorkspaceDeployment): string | null {
  const tone = deploymentStatusTone(deployment.status)
  if (tone === 'ready') return null
  if (tone === 'pending') return 'deploymentSwitcher.reason.starting'
  return STOPPED_STATUSES.has(deployment.status)
    ? 'deploymentSwitcher.reason.startElsewhere'
    : 'deploymentSwitcher.reason.notReady'
}

/**
 * The Run on menu's rows, Comfy Cloud first. Only a ready deployment can be
 * picked, and a row that is not says why. Once a compatibility check
 * answers, rows that run the open workflow come first under their own label.
 */
export function useDeploymentRows() {
  const { t, locale } = useI18n()
  const { deployments } = storeToRefs(useDeploymentPickStore())
  const {
    deploymentTitle,
    deploymentName,
    deploymentDetail,
    deploymentTooltip,
    deploymentFullLabel
  } = useDeploymentLabels()
  const { markFor } = useDeploymentCompatibility()

  function missingNodeNames(deploymentId: string | null): string | null {
    const mark = markFor(deploymentId)
    if (mark?.kind !== 'missing') return null
    return new Intl.ListFormat(locale.value).format(mark.nodeTypes)
  }

  function noteFor(
    deploymentId: string | null,
    label: string,
    reason: string | null
  ): string | null {
    const nodes = missingNodeNames(deploymentId)
    if (nodes === null) return reason
    if (reason === null) {
      return t(
        'deploymentSwitcher.missingNodesNamed',
        { deployment: label, nodes },
        { escapeParameter: false }
      )
    }
    const missing = t(
      'deploymentSwitcher.missingNodesAfterReason',
      { nodes },
      { escapeParameter: false }
    )
    return `${reason} ${missing}`
  }

  function cloudRow(): DeploymentRow {
    const title = t('deploymentSwitcher.comfyCloud')
    return {
      value: COMFY_CLOUD_ROW,
      deploymentId: null,
      title,
      name: null,
      detail: null,
      tooltip: title,
      note: noteFor(null, title, null),
      pickable: true
    }
  }

  function deploymentRow(deployment: WorkspaceDeployment): DeploymentRow {
    const label = deploymentFullLabel(deployment)
    const key = reasonKey(deployment)
    const reason =
      key === null
        ? null
        : t(key, { deployment: label }, { escapeParameter: false })
    return {
      value: deployment.deployment_id,
      deploymentId: deployment.deployment_id,
      title: deploymentTitle(deployment),
      name: deploymentName(deployment),
      detail: deploymentDetail(deployment),
      tooltip: deploymentTooltip(deployment),
      tone: deploymentStatusTone(deployment.status),
      note: noteFor(deployment.deployment_id, label, reason),
      pickable: deployment.status === 'ready'
    }
  }

  const sections = computed<DeploymentSection[]>(() => {
    const rows = [cloudRow(), ...deployments.value.map(deploymentRow)]
    const [compatible, incompatible] = partition(
      rows,
      (row) => markFor(row.deploymentId)?.kind === 'runs'
    )
    if (compatible.length === 0 || incompatible.length === 0) {
      return [{ key: 'all', label: t('deploymentSwitcher.runOn'), rows }]
    }
    return [
      {
        key: 'compatible',
        label: t('deploymentSwitcher.compatibleEnvironments'),
        rows: compatible
      },
      {
        key: 'incompatible',
        label: t('deploymentSwitcher.incompatibleEnvironments'),
        rows: incompatible
      }
    ]
  })

  return { sections }
}
