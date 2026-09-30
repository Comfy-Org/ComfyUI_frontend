import { watch } from 'vue'

import { getRoutes } from '../../config/routes'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'

/**
 * Sends an old `/hub/models/?type=workflows|apps` link to that section's page
 * once the flags answer, if the section is on for this visitor. Otherwise it
 * resolves and the models catalogue loads. Its own chunk, so /hub/models/
 * without `?type=` pays nothing for it.
 */
export async function forwardLegacySection(): Promise<void> {
  const url = new URL(location.href)
  const type = url.searchParams.get('type')
  const section =
    type === 'apps'
      ? 'apps'
      : type === 'workflows' || type === 'workflow'
        ? 'workflows'
        : undefined
  if (!section) return
  const settled = useWorkshopEnabledSettled()
  if (!settled.value)
    await new Promise((resolve) => watch(settled, resolve, { once: true }))
  const sectionEnabled =
    section === 'apps'
      ? useWorkshopAppsEnabled()
      : useWorkshopWorkflowsEnabled()
  if (!useWorkshopEnabled().value || !sectionEnabled.value) return
  const { hubApps, hubWorkflows } = getRoutes('en')
  url.pathname = section === 'apps' ? hubApps : hubWorkflows
  url.searchParams.delete('type')
  location.replace(url.href)
  return new Promise(() => {})
}
