import type { CanvasSource } from '@/platform/nodeApi/shared/canvasSource'
import type { UiHandle } from '@/platform/nodeApi/v4/types'

import { createBadgeSlot, createButtonSlot } from './chromeItems'
import { showDialog } from './dialogs'
import { showMenu } from './menus'
import { prompt } from './prompts'
import { addSidebarTab } from './sidebarTabs'
import { createViewportPanels } from './viewportPanels'

/** The UI members, and the badges and buttons the host shows for them. */
export function createUi(canvas: () => CanvasSource | undefined) {
  const badges = createBadgeSlot()
  const buttons = createButtonSlot()
  const ui: UiHandle = {
    addSidebarTab,
    addTopBarBadge: badges.add,
    addActionBarButton: buttons.add,
    showDialog,
    showMenu,
    prompt,
    mountViewportPanel: createViewportPanels(canvas)
  }
  return {
    ui: Object.freeze(ui),
    topbarBadges: badges.shown,
    actionBarButtons: buttons.shown
  }
}
