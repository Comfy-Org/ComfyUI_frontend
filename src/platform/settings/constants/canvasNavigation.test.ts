import { describe, expect, it } from 'vitest'

import { CANVAS_NAVIGATION_PRESETS } from '@/platform/settings/constants/canvasNavigation'
import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'

const NAV = 'Comfy.Canvas.NavigationMode'
const LEFT = 'Comfy.Canvas.LeftMouseClickBehavior'
const WHEEL = 'Comfy.Canvas.MouseWheelScroll'

const settingById = (id: string) => CORE_SETTINGS.find((s) => s.id === id)

const overrideDefaults = () => ({
  [LEFT]: settingById(LEFT)?.defaultValue,
  [WHEEL]: settingById(WHEEL)?.defaultValue
})

describe('CANVAS_NAVIGATION_PRESETS', () => {
  /**
   * The override defaults have to describe whichever Navigation Mode a fresh
   * profile resolves to. If they disagree, that profile loads with a mode no
   * preset matches and the override handlers demote it to 'custom' on first
   * load — the bug this pairing exists to prevent. Asserted as a relationship
   * rather than against fixed values so changing a default is what trips it.
   */
  it('agrees with the default Navigation Mode', () => {
    const defaultMode = settingById(NAV)?.defaultValue as string

    expect(CANVAS_NAVIGATION_PRESETS[defaultMode]).toEqual(overrideDefaults())
  })

  it('agrees with every install-versioned Navigation Mode default', () => {
    const versioned = settingById(NAV)?.defaultsByInstallVersion ?? {}

    for (const mode of Object.values(versioned)) {
      expect(CANVAS_NAVIGATION_PRESETS[mode as string]).toEqual(
        overrideDefaults()
      )
    }
  })
})
