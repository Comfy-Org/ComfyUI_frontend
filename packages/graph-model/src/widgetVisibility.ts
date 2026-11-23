import type { WIDGET_SURFACES, WIDGET_SURFACE_TIERS } from './widgetSurfaces'

export type WidgetSurface = (typeof WIDGET_SURFACES)[number]

export type WidgetSurfaceTier = (typeof WIDGET_SURFACE_TIERS)[number]

export type WidgetSurfaces = Record<WidgetSurface, WidgetSurfaceTier>

export interface WidgetSuppression {
  byExtension: boolean
  byConnection: boolean
}

export interface WidgetVisibilityComponent {
  surfaces: WidgetSurfaces
  suppression: WidgetSuppression
}
