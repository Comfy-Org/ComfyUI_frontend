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

interface DeploymentRow {
  value: string
  deploymentId: string | null
  title: string
  name: string | null
  detail: string | null
  tooltip: string
  tone?: DeploymentStatusTone
  missingNodes: string | null
}

interface DeploymentSection {
  key: 'runOn' | 'current' | 'compatible' | 'incompatible'
  label: string
  rows: DeploymentRow[]
}

/**
 * The Run on menu's rows: the one this browser runs on, then Comfy Cloud,
 * then the deployments. Once a compatibility check has answered for every row
 * and splits them, the current row sits alone under Running on and the rest
 * are grouped by whether they run the open workflow.
 */
export function useDeploymentRows() {
  const { t, locale } = useI18n()
  const { deployments, pickedDeploymentId } = storeToRefs(
    useDeploymentPickStore()
  )
  const {
    deploymentTitle,
    deploymentName,
    deploymentDetail,
    deploymentTooltip,
    deploymentFullLabel
  } = useDeploymentLabels()
  const { markFor } = useDeploymentCompatibility()

  function missingNodesText(
    deploymentId: string | null,
    label: string
  ): string | null {
    const mark = markFor(deploymentId)
    if (mark?.kind !== 'missing') return null
    return t(
      'deploymentSwitcher.missingNodesNamed',
      {
        deployment: label,
        nodes: new Intl.ListFormat(locale.value).format(mark.nodeTypes)
      },
      { escapeParameter: false }
    )
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
      missingNodes: missingNodesText(null, title)
    }
  }

  function deploymentRow(deployment: WorkspaceDeployment): DeploymentRow {
    return {
      value: deployment.deployment_id,
      deploymentId: deployment.deployment_id,
      title: deploymentTitle(deployment),
      name: deploymentName(deployment),
      detail: deploymentDetail(deployment),
      tooltip: deploymentTooltip(deployment),
      tone: deploymentStatusTone(deployment.status),
      missingNodes: missingNodesText(
        deployment.deployment_id,
        deploymentFullLabel(deployment)
      )
    }
  }

  function isChecked(row: DeploymentRow): boolean {
    return markFor(row.deploymentId) !== null
  }

  function runsWorkflow(row: DeploymentRow): boolean {
    return markFor(row.deploymentId)?.kind === 'runs'
  }

  const pickedValue = computed(
    () => pickedDeploymentId.value ?? COMFY_CLOUD_ROW
  )

  const sections = computed<DeploymentSection[]>(() => {
    const rows = [cloudRow(), ...deployments.value.map(deploymentRow)]
    const [current, others] = partition(
      rows,
      (row) => row.value === pickedValue.value
    )
    if (
      !rows.every(isChecked) ||
      rows.every(runsWorkflow) ||
      !rows.some(runsWorkflow)
    ) {
      return [
        {
          key: 'runOn',
          label: t('deploymentSwitcher.runOn'),
          rows: [...current, ...others]
        }
      ]
    }
    const [compatible, incompatible] = partition(others, runsWorkflow)
    const groups: DeploymentSection[] = [
      {
        key: 'current',
        label: t('deploymentSwitcher.runningOn'),
        rows: current
      },
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
    return groups.filter((group) => group.rows.length > 0)
  })

  return { sections, pickedValue }
}
