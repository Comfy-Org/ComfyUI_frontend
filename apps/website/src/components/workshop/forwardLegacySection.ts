import { watch } from 'vue'
import type { Ref } from 'vue'

import { getRoutes } from '../../config/routes'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'
import type { CatalogueTab } from './CatalogueTabs.vue'

type HubSection = Exclude<CatalogueTab, 'models'>

const SECTIONS_BY_TYPE = new Map<string, HubSection>([
  ['workflows', 'workflows'],
  ['workflow', 'workflows'],
  ['apps', 'apps']
])

const SECTION_FLAGS = {
  workflows: useWorkshopWorkflowsEnabled,
  apps: useWorkshopAppsEnabled
} satisfies Record<HubSection, () => Readonly<Ref<boolean>>>

async function flagsAnswered(): Promise<void> {
  const settled = useWorkshopEnabledSettled()
  if (!settled.value)
    await new Promise((resolve) => watch(settled, resolve, { once: true }))
}

/**
 * Sends an old `/hub/models/?type=workflows|apps` link to that section's page
 * once the flags answer, if the section is on for this visitor. Otherwise it
 * resolves and the models catalogue loads. Its own chunk, so /hub/models/
 * without `?type=` pays nothing for it.
 */
export async function forwardLegacySection(): Promise<void> {
  const url = new URL(location.href)
  const section = SECTIONS_BY_TYPE.get(url.searchParams.get('type') ?? '')
  if (!section) return
  await flagsAnswered()
  if (!useWorkshopEnabled().value || !SECTION_FLAGS[section]().value) return
  const { hubApps, hubWorkflows } = getRoutes('en')
  url.pathname = { workflows: hubWorkflows, apps: hubApps }[section]
  url.searchParams.delete('type')
  location.replace(url.href)
  return new Promise(() => {})
}
