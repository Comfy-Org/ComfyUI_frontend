import type { Settings } from '@/schemas/apiSchema'

/**
 * The Left Mouse Click Behavior and Mouse Wheel Scroll values each Navigation
 * Mode preset stands for.
 *
 * `custom` is deliberately absent: it means "the overrides are whatever the
 * user set", so there is no pair to apply or to restore from it.
 */
export const CANVAS_NAVIGATION_PRESETS: Record<
  string,
  Partial<Settings> | undefined
> = {
  standard: {
    'Comfy.Canvas.LeftMouseClickBehavior': 'select',
    'Comfy.Canvas.MouseWheelScroll': 'panning'
  },
  legacy: {
    'Comfy.Canvas.LeftMouseClickBehavior': 'panning',
    'Comfy.Canvas.MouseWheelScroll': 'zoom'
  }
}
