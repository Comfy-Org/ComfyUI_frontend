import type { WorkspaceDeployment } from '@comfyorg/ingest-types'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { t as translate } from '@/i18n'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/** `dep-f24d36bb` out of `dep-f24d36bb-fd1f-...`: enough to tell two apart. */
function shortId(deploymentId: string): string {
  return deploymentId.slice(0, 12)
}

/**
 * The message for a deployment's label: its Build name and the Release
 * version it runs now, or its short id when Build names are hidden.
 */
function labelMessage(
  deployment: WorkspaceDeployment
): [key: string, values: Record<string, string | number>] {
  if (
    deployment.build_name !== undefined &&
    deployment.release_version !== undefined
  ) {
    return [
      'deploymentSwitcher.deployment',
      { build: deployment.build_name, version: deployment.release_version }
    ]
  }
  return [
    'deploymentSwitcher.unnamedDeployment',
    { id: shortId(deployment.deployment_id) }
  ]
}

/**
 * The label of the deployment this page booted on, for text outside the
 * switcher that names where the editor runs (FE-2434); undefined on Comfy
 * Cloud and until the first listing answers. Works outside a component.
 */
export function useBootDeploymentLabel() {
  const { bootDeployment } = storeToRefs(useDeploymentPickStore())
  return computed(() => {
    if (!bootDeployment.value) return undefined
    const [key, values] = labelMessage(bootDeployment.value)
    return translate(key, values, { escapeParameter: false })
  })
}

/**
 * The words the deployment switcher shows (FE-2434): a deployment's label
 * (its Build name and the Release version it runs now, or its short id when
 * Build names are hidden), its caption, and the labels of this browser's pick
 * and of the workspace's default deployment.
 */
export function useDeploymentLabels() {
  const { t } = useI18n()
  const { pickedDeployment, defaultDeploymentId, defaultDeployment } =
    storeToRefs(useDeploymentPickStore())

  function deploymentLabel(deployment: WorkspaceDeployment): string {
    const [key, values] = labelMessage(deployment)
    return t(key, values)
  }

  /** The id and status, marking the workspace's default deployment. */
  function deploymentCaption(deployment: WorkspaceDeployment): string {
    const caption = t('deploymentSwitcher.caption', {
      id: shortId(deployment.deployment_id),
      status: deployment.status
    })
    return deployment.deployment_id === defaultDeploymentId.value
      ? `${caption} · ${t('deploymentSwitcher.workspaceDefault')}`
      : caption
  }

  function labelFor(
    deploymentId: string | null,
    deployment: WorkspaceDeployment | null
  ): string {
    if (deploymentId === null) return t('deploymentSwitcher.comfyCloud')
    if (deployment) return deploymentLabel(deployment)
    return t('deploymentSwitcher.unnamedDeployment', {
      id: shortId(deploymentId)
    })
  }

  /** A pick the listing no longer has runs on Comfy Cloud. */
  const currentLabel = computed(() =>
    pickedDeployment.value
      ? deploymentLabel(pickedDeployment.value)
      : t('deploymentSwitcher.comfyCloud')
  )
  const defaultLabel = computed(() =>
    labelFor(defaultDeploymentId.value, defaultDeployment.value)
  )

  return { deploymentLabel, deploymentCaption, currentLabel, defaultLabel }
}
