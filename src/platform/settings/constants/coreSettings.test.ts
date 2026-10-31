import { breakpointsTailwind } from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'

import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { reportError } from '@comfyorg/telemetry/reportError'

function readDefault(id: string): unknown {
  const defaultValue = CORE_SETTINGS.find(
    (setting) => setting.id === id
  )?.defaultValue
  return typeof defaultValue === 'function' ? defaultValue() : defaultValue
}

function stubReducedMotion(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockReturnValue(
    Object.assign(new EventTarget(), {
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    })
  )
}

describe('window-dependent setting defaults', () => {
  it.for([true, false])(
    'disables animations by default when reduced motion is %s at read time',
    (prefersReducedMotion) => {
      stubReducedMotion(prefersReducedMotion)

      expect(readDefault('Comfy.Appearance.DisableAnimations')).toBe(
        prefersReducedMotion
      )
    }
  )

  it.for([
    [breakpointsTailwind.lg, true],
    [breakpointsTailwind.lg - 1, false]
  ] as const)(
    'shows the minimap by default at a %ipx window: %s',
    ([width, visible]) => {
      vi.stubGlobal('innerWidth', width)

      expect(readDefault('Comfy.Minimap.Visible')).toBe(visible)
    }
  )
})

describe('extension path setting', () => {
  it('replaces malformed persisted values with a reported safe default', () => {
    const setting = CORE_SETTINGS.find(
      ({ id }) => id === 'Comfy.Extension.DisabledPacks'
    )

    expect(setting?.migrateDeprecatedValue?.({ invalid: true })).toEqual([])
    expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
      errorType: 'invalid_extension_path_setting',
      surface: 'platform',
      level: 'warning'
    })
  })
})
