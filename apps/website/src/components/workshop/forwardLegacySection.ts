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

export const FORWARD_GRACE_MS = 2000

const SECTIONS_BY_TYPE = new Map<string, HubSection>([
  ['workflows', 'workflows'],
  ['workflow', 'workflows'],
  ['apps', 'apps']
])

const SECTION_FLAGS = {
  workflows: useWorkshopWorkflowsEnabled,
  apps: useWorkshopAppsEnabled
} satisfies Record<HubSection, () => Readonly<Ref<boolean>>>

// BaseLayout's module script starts PostHog before DOMContentLoaded; until
// then `settled` reads true without PostHog having been asked.
function documentParsed(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve()
  return new Promise((resolve) =>
    document.addEventListener('DOMContentLoaded', () => resolve(), {
      once: true
    })
  )
}

/**
 * Sends an old `/hub/models/?type=workflows|apps` link to that section's page
 * as soon as the section is on for this visitor, for as long as they are still
 * on `href` and `signal` has not aborted. Resolves, so the models catalogue
 * loads, once the flags settle with the section off, or FORWARD_GRACE_MS after
 * a forward the browser did not follow. Its own chunk, so /hub/models/ without
 * `?type=` pays nothing for it.
 */
export async function forwardLegacySection(
  href: string,
  signal: AbortSignal
): Promise<void> {
  const target = new URL(href)
  const section = SECTIONS_BY_TYPE.get(target.searchParams.get('type') ?? '')
  if (!section) return
  const { hubApps, hubWorkflows } = getRoutes('en')
  target.pathname = { workflows: hubWorkflows, apps: hubApps }[section]
  target.searchParams.delete('type')
  await documentParsed()
  const settled = useWorkshopEnabledSettled()
  const workshopOn = useWorkshopEnabled()
  const sectionOn = SECTION_FLAGS[section]()
  return new Promise((resolve) => {
    const stop = watch([settled, workshopOn, sectionOn], check)
    function finish() {
      stop()
      resolve()
    }
    function check() {
      if (signal.aborted || location.href !== href) return finish()
      if (settled.value && workshopOn.value && sectionOn.value) {
        stop()
        location.replace(target.href)
        setTimeout(resolve, FORWARD_GRACE_MS)
      } else if (settled.value) resolve()
    }
    signal.addEventListener('abort', finish, { once: true })
    check()
  })
}
