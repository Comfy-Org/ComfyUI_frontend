import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  reloadForDeploymentSwitch,
  takeDeploymentSwitchLanding
} from './deploymentSwitchReload'

describe('deployment switch reload', () => {
  const reload = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('location', { reload })
  })

  it('reloads, and lets only the next boot know a switch caused it', () => {
    reloadForDeploymentSwitch(() => {})

    expect(reload).toHaveBeenCalledOnce()
    expect(takeDeploymentSwitchLanding()).toBe(true)
    expect(takeDeploymentSwitchLanding()).toBe(false)
  })

  it.for(['pointerdown', 'keydown'])(
    'hands the page back once, without a landing toast, when it is still in use after the reload: %s',
    (type) => {
      const onStay = vi.fn()
      reloadForDeploymentSwitch(onStay)
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

    reloadForDeploymentSwitch(() => {})

    expect(reload).toHaveBeenCalledOnce()
    expect(takeDeploymentSwitchLanding()).toBe(false)
  })
})
