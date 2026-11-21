import type { LiveNode } from '@/platform/nodeApi/v4/nodeHandle'
import type { WidgetCollection } from '@/platform/nodeApi/v4/types'

/** Gives the widgets of the node `locate` finds while it is there. */
export type WidgetsOf = (locate: () => LiveNode | undefined) => WidgetCollection
