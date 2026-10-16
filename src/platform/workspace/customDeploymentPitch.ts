import { t } from '@/i18n'
import { CUSTOM_DEPLOYMENT_BRIEF } from '@/platform/workspace/customDeploymentBrief'

/** One line of what a workflow lacks: how many of a kind, then their names. */
export interface MissingItemsRow {
  label: string
  names: string
}

/** The copy a custom deployment dialog shows. */
export interface CustomDeploymentPitch {
  title: string
  body: string
  points: readonly string[]
  platformLabel: string
  brief: string
  missing?: readonly MissingItemsRow[]
}

/** The pitch for creating a custom deployment, as Run on's Create a custom deployment shows it. */
export function customDeploymentPitch(): CustomDeploymentPitch {
  return {
    title: t('deploymentSwitcher.customDeployment.title'),
    body: t('deploymentSwitcher.customDeployment.body'),
    points: [
      t('deploymentSwitcher.customDeployment.pointNodes'),
      t('deploymentSwitcher.customDeployment.pointGpu'),
      t('deploymentSwitcher.customDeployment.pointApi')
    ],
    platformLabel: t('deploymentSwitcher.customDeployment.createOnPlatform'),
    brief: CUSTOM_DEPLOYMENT_BRIEF
  }
}
