import { isCloud } from '@/platform/distribution/types'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

export type TemplateReadinessState =
  | 'ready'
  | 'requiresDownload'
  | 'needsConfiguration'
  | 'unverified'

export interface TemplateReadiness {
  state: TemplateReadinessState
  /** i18n key under templateWorkflows.readiness.reason.* explaining the state */
  reasonKey: 'ready' | 'customNodes' | 'apiKey' | 'models'
}

/**
 * PM-243 phase 1: derive readiness from what the template index can
 * truthfully assert today.
 *
 * - "Needs configuration" is verifiable from index data alone (custom node
 *   packs, partner API nodes that need a key).
 * - "Ready to run" is only claimed where it is true by construction: cloud
 *   provisions model files server-side, and local templates that need no
 *   model files have nothing left to check.
 * - Local templates that DO need model files stay "unverified" — asserting
 *   ready/requires-download honestly needs the per-file requiredAssets index
 *   (phase 2). A false "Ready to run" would poison the other states.
 *
 * Precedence: needs configuration > requires download > ready — surface the
 * most expensive blocker first (configuration forces the user out of the
 * flow; downloads resolve in-product).
 */
export function getTemplateReadiness(
  template: TemplateInfo
): TemplateReadiness {
  if (template.requiresCustomNodes?.length) {
    return { state: 'needsConfiguration', reasonKey: 'customNodes' }
  }
  if (template.openSource === false) {
    return { state: 'needsConfiguration', reasonKey: 'apiKey' }
  }
  if (isCloud) {
    return { state: 'ready', reasonKey: 'ready' }
  }
  if (template.models?.length) {
    return { state: 'unverified', reasonKey: 'models' }
  }
  return { state: 'ready', reasonKey: 'ready' }
}
