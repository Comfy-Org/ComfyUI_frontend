import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { getRoutes } from '@/config/routes'
import type { Locale, TranslationKey } from '@/i18n/translations'
import {
  useWorkshopAppsEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'

export interface HubLane {
  readonly id: 'apps' | 'workflows' | 'models'
  readonly href: string
  readonly label: TranslationKey
  readonly verb: TranslationKey
  readonly open: boolean
}

/** The Hub's three sections in Pick · Remix · Run order, each open only once its flag is. */
export function useHubLanes(locale: Locale): ComputedRef<readonly HubLane[]> {
  const routes = getRoutes(locale)
  const appsEnabled = useWorkshopAppsEnabled()
  const workflowsEnabled = useWorkshopWorkflowsEnabled()
  return computed(() => [
    {
      id: 'apps',
      href: routes.hubApps,
      label: 'homeHub.apps',
      verb: 'homeHub.pick',
      open: appsEnabled.value
    },
    {
      id: 'workflows',
      href: routes.hubWorkflows,
      label: 'homeHub.workflows',
      verb: 'homeHub.remix',
      open: workflowsEnabled.value
    },
    {
      id: 'models',
      href: routes.workshop,
      label: 'homeHub.models',
      verb: 'homeHub.run',
      open: true
    }
  ])
}
