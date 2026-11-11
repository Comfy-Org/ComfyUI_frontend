import { clamp } from 'es-toolkit'

export type SidebarMode = 'expanded' | 'rail' | 'drawer'

export type SidebarSection = 'chats' | 'apps' | 'workflows'

const SIDEBAR_DRAWER_BREAKPOINT = 900
export const SIDEBAR_DEFAULT_WIDTH = 260
export const SIDEBAR_MIN_WIDTH = 220
export const SIDEBAR_MAX_WIDTH = 480

const CHAT_MIN_WIDTH = 480

export interface SidebarLayout {
  collapsed: boolean
  drawerOpen: boolean
}

export function resolveSidebarMode(
  layout: SidebarLayout,
  viewportWidth: number
): SidebarMode {
  if (viewportWidth < SIDEBAR_DRAWER_BREAKPOINT)
    return layout.drawerOpen ? 'drawer' : 'rail'
  return layout.collapsed ? 'rail' : 'expanded'
}

export function toggleSidebarLayout(
  layout: SidebarLayout,
  viewportWidth: number
): SidebarLayout {
  return viewportWidth < SIDEBAR_DRAWER_BREAKPOINT
    ? { ...layout, drawerOpen: !layout.drawerOpen }
    : { ...layout, collapsed: !layout.collapsed }
}

export function clampSidebarWidth(
  width: number,
  viewportWidth: number
): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH
  const widestLeavingRoomForChat = Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, viewportWidth - CHAT_MIN_WIDTH)
  )
  return clamp(width, SIDEBAR_MIN_WIDTH, widestLeavingRoomForChat)
}
