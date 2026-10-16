import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NOTHING_DISCARDED,
  reloadForDeploymentSwitch,
  takeDeploymentSwitchDiscard,
  takeDeploymentSwitchLanding
} from './deploymentSwitchReload'

describe('deployment switch reload', () => {
  const reload = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    takeDeploymentSwitchDiscard()
    vi.stubGlobal('location', { reload })
  })

  it('reloads, and lets only the next unload and the next boot know a switch caused it', () => {
    expect(takeDeploymentSwitchDiscard()).toBeNull()

    reloadForDeploymentSwitch(NOTHING_DISCARDED, () => {})

    expect(reload).toHaveBeenCalledOnce()
    expect(takeDeploymentSwitchDiscard()).toBe(NOTHING_DISCARDED)
    expect(takeDeploymentSwitchDiscard()).toBeNull()
    expect(takeDeploymentSwitchLanding()).toBe(true)
    expect(takeDeploymentSwitchLanding()).toBe(false)
  })

  it.for(['pointerdown', 'keydown'])(
    'hands the page back once, without a landing toast, when it is still in use after the reload: %s',
    (type) => {
      const onStay = vi.fn()
      reloadForDeploymentSwitch(NOTHING_DISCARDED, onStay)
      expect(onStay).not.toHaveBeenCalled()

      window.dispatchEvent(new Event(type))
      window.dispatchEvent(new Event(type))

      expect(onStay).toHaveBeenCalledOnce()
      expect(takeDeploymentSwitchLanding()).toBe(false)
    }
  )

  it('still reloads when the tab cannot store the landing mark', () => {
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    reloadForDeploymentSwitch(NOTHING_DISCARDED, () => {})

    expect(reload).toHaveBeenCalledOnce()
    expect(takeDeploymentSwitchLanding()).toBe(false)
  })
})
