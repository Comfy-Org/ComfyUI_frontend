import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import {
  useWorkshopAppsEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'

export interface HubLane {
  readonly id: 'apps' | 'workflows' | 'models'
  readonly href: string
  readonly open: boolean
}

/** The Hub's three sections, each open only once its flag is. */
export function useHubLanes(locale: Locale): ComputedRef<readonly HubLane[]> {
  const routes = getRoutes(locale)
  const appsEnabled = useWorkshopAppsEnabled()
  const workflowsEnabled = useWorkshopWorkflowsEnabled()
  return computed(() => [
    {
      id: 'apps',
      href: routes.hubApps,
      open: appsEnabled.value
    },
    {
      id: 'workflows',
      href: routes.hubWorkflows,
      open: workflowsEnabled.value
    },
    {
      id: 'models',
      href: routes.workshop,
      open: true
    }
  ])
}
