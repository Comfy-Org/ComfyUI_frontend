import type { CatalogueTab } from '@/components/workshop/CatalogueTabs.vue'

export type HubSection = CatalogueTab | 'explore'

/** PostHog flag that opens the Hub home; everyone else reads the showcase. */
export const HUB_HOME_FLAG = 'hub-home-enabled'
